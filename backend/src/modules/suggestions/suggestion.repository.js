/**
 * Couche d'acces aux donnees pour les suggestions.
 *
 * ⚠ Regle absolue de ce fichier : **toute valeur exterieure passe par un
 * placeholder `?` de mysql2**. Aucun identifiant, aucun fragment de SQL
 * n'est jamais concatene dans une chaine. Les seuls fragments dynamiques sont
 * des listes de colonnes/cle de tri issues de `SORT_CLAUSES`, definies ici
 * en dur et donc hors d'atteinte de l'utilisateur.
 */

import { query, queryOne, execute, transaction } from '../../config/db.js';
import {
  SUGGESTION_STATUSES,
  CATEGORIES,
  MODERATION_QUEUE_STATUSES,
} from '../../../../shared/constants.js';

/**
 * Chies de tri autorisees -> fragment SQL.
 * Whitelist : l'utilisateur ne peut transmettre qu'une cle, jamais du SQL.
 */
const SORT_CLAUSES = Object.freeze({
  recent: 's.created_at DESC, s.id DESC',
  oldest: 's.created_at ASC, s.id ASC',
  supported: 's.support_count DESC, s.created_at DESC',
  updated: 's.updated_at DESC, s.id DESC',
  status: `FIELD(s.status, ${SUGGESTION_STATUSES.map(() => '?').join(', ')}) ASC, s.updated_at DESC`,
});

function sortClause(sortKey, withStatusKey) {
  const key = sortKey ?? 'recent';
  if (key === 'status' && !withStatusKey) return SORT_CLAUSES.recent;
  return SORT_CLAUSES[key] ?? SORT_CLAUSES.recent;
}

/**
 * Echappe les jokers LIKE pour qu'une recherche sur « 100% » ou « a_b »
 * ne se transforme pas en motif joker.
 */
export function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const PUBLIC_COLUMNS = `
  s.id, s.title, s.description, s.category, s.location, s.extra_info,
  s.status, s.visibility, s.is_anonymous, s.support_count,
  s.published_at, s.created_at, s.updated_at, s.progress_percent,
  s.expected_completion_date, s.monthly_idea_at
`;

const OWNER_COLUMNS = `
  s.id, s.tracking_code, s.title, s.description, s.category, s.location,
  s.extra_info, s.status, s.visibility, s.is_anonymous, s.author_name,
  s.author_contact, s.support_count, s.published_at, s.created_at, s.updated_at,
  s.progress_percent, s.expected_completion_date, s.monthly_idea_at
`;

const ADMIN_COLUMNS = `
  s.id, s.tracking_code, s.title, s.description, s.category, s.location,
  s.extra_info, s.status, s.visibility, s.is_anonymous, s.author_name,
  s.author_contact, s.moderation_note, s.support_count, s.published_at,
  s.created_at, s.updated_at, s.progress_percent, s.expected_completion_date,
  s.monthly_idea_at,
  CASE WHEN s.monthly_idea_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
         AND s.monthly_idea_at < DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01')
       THEN 1 ELSE 0 END AS is_monthly_idea,
  (SELECT COUNT(*) FROM suggestion_reports r WHERE r.suggestion_id = s.id) AS report_count
`;

// ---------------------------------------------------------------------------
// Ecriture
// ---------------------------------------------------------------------------

/**
 * Insere une suggestion, son premier evenement de timeline et le journal de
 * moderation, dans une seule transaction.
 *
 * @param {object} input
 * @param {string} input.trackingCode
 * @param {string} input.secretCodeHash
 * @param {object} input.payload donnees deja valides
 * @param {string} [input.clientIpMasked]
 * @param {string} [input.userAgent]
 */
export async function insertSuggestionWithHistory(input) {
  const { trackingCode, secretCodeHash, payload, clientIpMasked = null, userAgent = null } = input;

  return transaction(async (connection) => {
    const [result] = await connection.execute(
      `INSERT INTO suggestions
         (tracking_code, secret_code_hash, title, description, category, location,
          extra_info, status, visibility, is_anonymous, author_name, author_contact)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'En attente', 'privee', ?, ?, ?)`,
      [
        trackingCode,
        secretCodeHash,
        payload.title,
        payload.description,
        payload.category,
        payload.location ?? null,
        payload.extraInfo ?? null,
        payload.isAnonymous ? 1 : 0,
        payload.authorName ?? null,
        payload.authorContact ?? null,
      ],
    );

    const suggestionId = result.insertId;

    // Premier evenement de la timeline : la suggestion vient d'etre envoyee.
    await connection.execute(
      `INSERT INTO suggestion_updates
         (suggestion_id, event_type, old_status, new_status, public_message, author_type)
       VALUES (?, 'creation', NULL, 'En attente', ?, 'system')`,
      [suggestionId, 'Suggestion envoyée. En attente d’examen par l’équipe de modération.'],
    );

    await connection.execute(
      `INSERT INTO moderation_logs (suggestion_id, action, new_status, new_visibility, actor, note, ip_address, user_agent)
       VALUES (?, 'creation', 'En attente', 'privee', 'system', ?, ?, ?)`,
      [suggestionId, `Suggestion anonymisee : ${payload.isAnonymous ? 'oui' : 'non'}`, clientIpMasked, userAgent],
    );

    return suggestionId;
  });
}

/**
 * Insere un soutien et incremente le compteur de facon atomique.
 * La contrainte UNIQUE (suggestion_id, supporter_hash) est le garde-fou final
 * contre les soutiens en double, y compris en cas de requetes simultanees.
 *
 * @returns {Promise<{alreadySupported: boolean, supportCount: number}>}
 */
export async function addSupportOnce({ suggestionId, supporterHash, supporterTokenHash, ipMasked, userAgent }) {
  return transaction(async (connection) => {
    const [existing] = await connection.execute(
      'SELECT id FROM supports WHERE suggestion_id = ? AND supporter_hash = ?',
      [suggestionId, supporterHash],
    );
    if (existing.length > 0) {
      const [rows] = await connection.execute(
        'SELECT support_count FROM suggestions WHERE id = ?',
        [suggestionId],
      );
      return { alreadySupported: true, supportCount: Number(rows[0].support_count) };
    }

    try {
      await connection.execute(
        `INSERT INTO supports (suggestion_id, supporter_hash, supporter_token_hash, ip_prefix, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [suggestionId, supporterHash, supporterTokenHash, ipMasked, userAgent],
      );
    } catch (error) {
      // Course entre deux requites simultanees : la contrainte UNIQUE gagne.
      if (error.code === 'ER_DUP_ENTRY') {
        const [rows] = await connection.execute(
          'SELECT support_count FROM suggestions WHERE id = ?',
          [suggestionId],
        );
        return { alreadySupported: true, supportCount: Number(rows[0].support_count) };
      }
      throw error;
    }

    // Increment atomique : pas de lecture-modification-ecriture en JS.
    await connection.execute(
      'UPDATE suggestions SET support_count = support_count + 1 WHERE id = ?',
      [suggestionId],
    );
    const [rows] = await connection.execute(
      'SELECT support_count FROM suggestions WHERE id = ?',
      [suggestionId],
    );
    return { alreadySupported: false, supportCount: Number(rows[0].support_count) };
  });
}

/** Retire un soutien de l'appareil et met a jour le compteur atomiquement. */
export async function removeSupportOnce({ suggestionId, supporterHash }) {
  return transaction(async (connection) => {
    const [result] = await connection.execute(
      'DELETE FROM supports WHERE suggestion_id = ? AND supporter_hash = ?',
      [suggestionId, supporterHash],
    );

    if (result.affectedRows > 0) {
      await connection.execute(
        'UPDATE suggestions SET support_count = GREATEST(support_count - 1, 0) WHERE id = ?',
        [suggestionId],
      );
    }

    const [rows] = await connection.execute(
      'SELECT support_count FROM suggestions WHERE id = ?',
      [suggestionId],
    );
    return { removed: result.affectedRows > 0, supportCount: Number(rows[0].support_count) };
  });
}

/** Ajoute un signalement unique par empreinte d'appareil et suggestion. */
export async function reportSuggestionOnce({ suggestionId, reporterHash, reason }) {
  try {
    await execute(
      `INSERT INTO suggestion_reports (suggestion_id, reporter_hash, reason)
       VALUES (?, ?, ?)`,
      [suggestionId, reporterHash, reason],
    );
    return { alreadyReported: false };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return { alreadyReported: true };
    throw error;
  }
}

export function listSuggestionReports(suggestionId) {
  return query(
    `SELECT id, reason, created_at
       FROM suggestion_reports
      WHERE suggestion_id = ?
      ORDER BY created_at DESC, id DESC`,
    [suggestionId],
  );
}

export function deleteSuggestionReport(suggestionId, reportId) {
  return execute(
    'DELETE FROM suggestion_reports WHERE suggestion_id = ? AND id = ?',
    [suggestionId, reportId],
  );
}

export function findReportableSuggestion(id) {
  return queryOne(
    `SELECT id FROM suggestions
      WHERE id = ? AND visibility = 'publique'`,
    [id],
  );
}

/** Highlights visibles sur l'accueil : idées populaires et sélection du mois courant. */
export async function fetchPublicHighlights(limit = 3) {
  const [popular, monthlyIdea] = await Promise.all([
    query(
      `SELECT ${PUBLIC_COLUMNS}
         FROM suggestions s
        WHERE s.visibility = 'publique' AND s.support_count > 0
        ORDER BY s.support_count DESC, s.published_at DESC, s.id DESC
        LIMIT ?`,
      [limit],
    ),
    queryOne(
      `SELECT ${PUBLIC_COLUMNS}
         FROM suggestions s
        WHERE s.visibility = 'publique'
          AND s.monthly_idea_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND s.monthly_idea_at < DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01')
        ORDER BY s.monthly_idea_at DESC, s.id DESC
        LIMIT 1`,
    ),
  ]);
  return { popular, monthlyIdea: monthlyIdea ?? null };
}

/** Retire tous les soutiens d'une suggestion (repli apres suppression). */
export async function deleteSupportsForSuggestion(suggestionId) {
  return execute('DELETE FROM supports WHERE suggestion_id = ?', [suggestionId]);
}

// ---------------------------------------------------------------------------
// Lecture publique
// ---------------------------------------------------------------------------

/**
 * Liste les suggestions publiques.
 * Seules les lignes `visibility = 'publique'` sont accessibles : c'est
 * l'administration qui decide de la publication, jamais le client.
 */
export async function listPublicSuggestions({ page, limit, category, status, search, sort }) {
  const where = ["s.visibility = 'publique'"];
  const params = [];

  if (category) {
    where.push('s.category = ?');
    params.push(category);
  }
  if (status) {
    where.push('s.status = ?');
    params.push(status);
  }
  if (search) {
    where.push("(s.title LIKE ? ESCAPE '\\\\' OR s.description LIKE ? ESCAPE '\\\\')");
    const pattern = `%${escapeLike(search)}%`;
    params.push(pattern, pattern);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const orderSql = sortClause(sort, false);
  const offset = (page - 1) * limit;

  const rows = await query(
    `SELECT ${PUBLIC_COLUMNS}
       FROM suggestions s
       ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const counters = await queryOne(
    `SELECT COUNT(*) AS total FROM suggestions s ${whereSql}`,
    params,
  );

  return {
    rows,
    total: Number(counters?.total ?? 0),
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(Number(counters?.total ?? 0) / limit)),
  };
}

/** Detail public d'une suggestion publiee. */
export function findPublicSuggestionById(id) {
  return queryOne(
    `SELECT ${PUBLIC_COLUMNS} FROM suggestions s WHERE s.id = ? AND s.visibility = 'publique'`,
    [id],
  );
}

// ---------------------------------------------------------------------------
// Suivi (proprietaire)
// ---------------------------------------------------------------------------

/**
 * Recherche par numero de suivi pour verifier le code secret.
 * La colonne `secret_code_hash` est selectionnee car elle sert uniquement a la
 * comparaison scrypt ; elle n'est jamais Renvoyee telle quelle au client (voir
 * `toOwnerSuggestion`).
 */
export function findSuggestionForTracking(trackingCode) {
  return queryOne(
    `SELECT ${OWNER_COLUMNS}, s.secret_code_hash FROM suggestions s WHERE s.tracking_code = ?`,
    [trackingCode],
  );
}

/** Timeline chronologique d'une suggestion (tous evenements). */
export async function listSuggestionUpdates(suggestionId) {
  const rows = await query(
    `SELECT id, event_type, old_status, new_status, public_message, author_type, created_at
       FROM suggestion_updates
      WHERE suggestion_id = ?
      ORDER BY created_at ASC, id ASC`,
    [suggestionId],
  );
  return rows;
}

/** Messages publics uniquement (messages de suivi de l'administration). */
export async function listPublicMessages(suggestionId) {
  const rows = await query(
    `SELECT id, public_message, created_at
       FROM suggestion_updates
      WHERE suggestion_id = ? AND public_message IS NOT NULL AND public_message <> ''
      ORDER BY created_at ASC, id ASC`,
    [suggestionId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export async function listAdminSuggestions({ page, limit, category, status, visibility, search, sort }) {
  const where = [];
  const params = [];

  if (category) {
    where.push('s.category = ?');
    params.push(category);
  }
  if (status) {
    where.push('s.status = ?');
    params.push(status);
  }
  if (visibility) {
    where.push('s.visibility = ?');
    params.push(visibility);
  }
  if (search) {
    where.push(
      "(s.title LIKE ? ESCAPE '\\\\' OR s.description LIKE ? ESCAPE '\\\\' OR s.tracking_code LIKE ? ESCAPE '\\\\' OR s.author_name LIKE ? ESCAPE '\\\\')",
    );
    const pattern = `%${escapeLike(search)}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // `FIELD(status, ?...)` consomme autant de placeholders que de statuts.
  const statusOrder = SORT_CLAUSES.status;
  const statusOrderNeedsParams = sort === 'status';
  const orderSql = statusOrderNeedsParams ? statusOrder : sortClause(sort, true);
  const orderParams = statusOrderNeedsParams ? [...SUGGESTION_STATUSES] : [];

  const rows = await query(
    `SELECT ${ADMIN_COLUMNS} FROM suggestions s ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
    [...params, ...orderParams, limit, (page - 1) * limit],
  );

  const counters = await queryOne(`SELECT COUNT(*) AS total FROM suggestions s ${whereSql}`, params);
  const total = Number(counters?.total ?? 0);

  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Liste et compteurs de la file, limitée aux trois statuts à traiter. */
export async function fetchModerationQueue({ page, limit }) {
  const statuses = MODERATION_QUEUE_STATUSES;
  const counts = await query(
    `SELECT status, COUNT(*) AS count
       FROM suggestions
      WHERE status IN (?, ?, ?)
      GROUP BY status`,
    statuses,
  );
  const rows = await query(
    `SELECT ${ADMIN_COLUMNS}
       FROM suggestions s
      WHERE s.status IN (?, ?, ?)
      ORDER BY FIELD(s.status, ?, ?, ?), s.created_at ASC, s.id ASC
      LIMIT ? OFFSET ?`,
    [...statuses, ...statuses, limit, (page - 1) * limit],
  );
  const total = counts.reduce((sum, row) => sum + Number(row.count), 0);
  return {
    counts: Object.fromEntries(statuses.map((status) => [
      status,
      Number(counts.find((row) => row.status === status)?.count ?? 0),
    ])),
    rows,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function findAdminSuggestionById(id) {
  return queryOne(`SELECT ${ADMIN_COLUMNS} FROM suggestions s WHERE s.id = ?`, [id]);
}

/**
 * Variante lisant via une connexion de transaction.
 * Indispensable pour relire une suggestion AVANT le commit : passer par le
 * pool donnerait une autre connexion, qui ne verrait pas les modifications
 * en cours.
 */
export async function findAdminSuggestionByIdIn(connection, id) {
  const [rows] = await connection.execute(
    `SELECT ${ADMIN_COLUMNS} FROM suggestions s WHERE s.id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/** Detail complet d'une suggestion, y compris la visibility privee. */
export function findSuggestionByIdForAdmin(id) {
  return queryOne(`SELECT ${ADMIN_COLUMNS} FROM suggestions s WHERE s.id = ?`, [id]);
}

export function deleteSuggestion(id) {
  return execute('DELETE FROM suggestions WHERE id = ?', [id]);
}

/** Historique de moderation d'une suggestion. */
export function listSuggestionModerationLogs(suggestionId) {
  return query(
    `SELECT id, action, old_status, new_status, old_visibility, new_visibility, actor, note, created_at
       FROM moderation_logs
      WHERE suggestion_id = ?
      ORDER BY created_at DESC, id DESC`,
    [suggestionId],
  );
}

/** Journal de moderation global (pagination + filtres). */
export async function listModerationLogs({ page, limit, suggestionId, action }) {
  const where = [];
  const params = [];
  if (suggestionId) {
    where.push('l.suggestion_id = ?');
    params.push(suggestionId);
  }
  if (action) {
    where.push('l.action = ?');
    params.push(action);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT l.id, l.suggestion_id, l.action, l.old_status, l.new_status, l.old_visibility,
            l.new_visibility, l.actor, l.note, l.created_at, s.title AS suggestion_title,
            s.tracking_code AS tracking_code
       FROM moderation_logs l
       LEFT JOIN suggestions s ON s.id = l.suggestion_id
       ${whereSql}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit],
  );

  const counters = await queryOne(`SELECT COUNT(*) AS total FROM moderation_logs l ${whereSql}`, params);
  const total = Number(counters?.total ?? 0);
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Record du journal de moderation (utilise par le service admin). */
export async function insertModerationLog(connection, entry) {
  await connection.execute(
    `INSERT INTO moderation_logs
       (suggestion_id, action, old_status, new_status, old_visibility, new_visibility, actor, note, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.suggestionId ?? null,
      entry.action,
      entry.oldStatus ?? null,
      entry.newStatus ?? null,
      entry.oldVisibility ?? null,
      entry.newVisibility ?? null,
      entry.actor ?? 'admin',
      entry.note ?? null,
      entry.ipMasked ?? null,
      entry.userAgent ?? null,
    ],
  );
}

/** Ajout d'un evenement dans la timeline de suivi. */
export async function insertSuggestionUpdate(connection, entry) {
  await connection.execute(
    `INSERT INTO suggestion_updates
       (suggestion_id, event_type, old_status, new_status, public_message, author_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entry.suggestionId,
      entry.eventType,
      entry.oldStatus ?? null,
      entry.newStatus ?? null,
      entry.publicMessage ?? null,
      entry.authorType ?? 'admin',
    ],
  );
}

/** Reserved aux statistiques : liste ordonnee des categories declarees. */
export const CATEGORY_ORDER = CATEGORIES;
