/**
 * Service d'administration.
 *
 * Regles appliquees a chaque action :
 *  1. transaction MySQL unique (statut + evenement de timeline + journal) :
 *     soit tout est enregistre, soit rien ;
 *  2. tout changement de statut produit un evenement de timeline lisible par
 *     l'auteur via son numero de suivi ;
 *  3. tout changement de statut produit une entree de `moderation_logs` ;
 *  4. la publication est une decision explicite : rien n'est public par defaut.
 */

import { transaction, query, queryOne } from '../../config/db.js';
import { notFound, validationError } from '../../utils/errors.js';
import { toAdminSuggestion, toSuggestionUpdate, toModerationLog } from '../suggestions/suggestion.serializer.js';
import {
  findSuggestionByIdForAdmin,
  findAdminSuggestionByIdIn,
  listAdminSuggestions,
  insertModerationLog,
  insertSuggestionUpdate,
  listSuggestionModerationLogs,
  listSuggestionUpdates,
  listModerationLogs,
  listSuggestionReports,
  fetchModerationQueue,
} from '../suggestions/suggestion.repository.js';
import {
  getAdminPhotoFile,
  listSuggestionPhotos,
  removeSuggestionPhotoFiles,
} from '../suggestions/suggestion-photos.js';

/** Contexte d'audit transmis par les controleurs. */
function audit(ctx) {
  return {
    ipMasked: ctx?.clientIpMasked ?? null,
    userAgent: ctx?.userAgent ?? null,
    actor: 'admin',
  };
}

/** Lecture hors transaction (pool global) : renvoie la ligne brute. */
async function loadOrFail(id) {
  const row = await findSuggestionByIdForAdmin(id);
  if (!row) throw notFound('Cette suggestion n’existe pas.');
  return row;
}

/** Lecture DANS la transaction courante, avant commit. */
async function loadInTransaction(connection, id) {
  const row = await findAdminSuggestionByIdIn(connection, id);
  if (!row) throw notFound('Cette suggestion n’existe pas.');
  return toAdminSuggestion(row);
}

export async function listSuggestions(filters) {
  const result = await listAdminSuggestions(filters);
  return { ...result, items: result.rows.map(toAdminSuggestion) };
}

export async function getModerationQueue(filters) {
  const result = await fetchModerationQueue(filters);
  return { ...result, items: result.rows.map(toAdminSuggestion) };
}

/** Detail complet : suggestion + timeline + journal de moderation. */
export async function getSuggestion(id) {
  const row = await loadOrFail(id);
  const [timeline, logs, photos, reports] = await Promise.all([
    listSuggestionUpdates(row.id),
    listSuggestionModerationLogs(row.id),
    listSuggestionPhotos(row.id),
    listSuggestionReports(row.id),
  ]);
  return {
    suggestion: toAdminSuggestion(row),
    timeline: timeline.map(toSuggestionUpdate),
    moderationLogs: logs.map(toModerationLog),
    photos,
    reports: reports.map((report) => ({
      id: String(report.id),
      reason: report.reason,
      createdAt: report.created_at instanceof Date ? report.created_at.toISOString() : report.created_at,
    })),
  };
}

/** Chemin prive d'une photo, accessible uniquement via la route admin protegee. */
export function getSuggestionPhotoFile(suggestionId, photoId) {
  return getAdminPhotoFile(suggestionId, photoId);
}

/**
 * Change le statut d'une suggestion, avec publication optionnelle.
 *
 * @param {number|string} id
 * @param {{status: string, message?: string, publish?: boolean}} input
 * @param {object} ctx requete Express (IP masquee, agent utilisateur)
 */
export async function changeStatus(id, input, ctx) {
  return transaction(async (connection) => applyStatusChange(connection, id, input, ctx));
}

async function applyStatusChange(connection, id, input, ctx) {
  const [rows] = await connection.execute(
    `SELECT id, status, visibility, published_at, progress_percent, expected_completion_date
       FROM suggestions WHERE id = ? FOR UPDATE`,
    [id],
  );
  if (rows.length === 0) throw notFound('Cette suggestion n’existe pas.');

  const current = rows[0];
  const oldStatus = current.status;
  const oldVisibility = current.visibility;
  const newStatus = input.status ?? oldStatus;
  if (
    newStatus !== 'En cours' &&
    (input.progressPercent !== undefined || input.expectedCompletionDate !== undefined)
  ) {
    throw validationError('Le pourcentage et la date prévue ne peuvent être définis que pour une suggestion « En cours ».');
  }
  const newVisibility =
    input.publish === undefined ? oldVisibility : input.publish ? 'publique' : 'privee';

  const statusChanged = newStatus !== oldStatus;
  const visibilityChanged = newVisibility !== oldVisibility;
  const newProgressPercent =
    newStatus === 'En cours'
      ? input.progressPercent === undefined
        ? current.progress_percent
        : input.progressPercent
      : null;
  const newCompletionDate =
    newStatus === 'En cours'
      ? input.expectedCompletionDate === undefined
        ? current.expected_completion_date
        : input.expectedCompletionDate
      : null;
  const progressChanged =
    newProgressPercent !== current.progress_percent ||
    String(newCompletionDate ?? '') !==
      String(current.expected_completion_date instanceof Date
        ? current.expected_completion_date.toISOString().slice(0, 10)
        : current.expected_completion_date ?? '');

  if (!statusChanged && !visibilityChanged && !input.message && !progressChanged) {
    return { suggestion: await loadInTransaction(connection, id), changed: false };
  }

  let publishedAt = current.published_at;
  if (newVisibility === 'publique' && !publishedAt) publishedAt = new Date();
  if (newVisibility === 'privee') publishedAt = null;

  await connection.execute(
    `UPDATE suggestions
        SET status = ?, visibility = ?, published_at = ?,
            progress_percent = ?, expected_completion_date = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [newStatus, newVisibility, publishedAt, newProgressPercent, newCompletionDate, id],
  );

  const eventType = visibilityChanged
    ? newVisibility === 'publique'
      ? 'publication'
      : 'message'
    : statusChanged
      ? 'statut'
      : progressChanged
        ? 'modification'
        : 'message';
  const publicMessage =
    input.message ??
    (progressChanged && !statusChanged && !visibilityChanged
      ? 'Le plan de réalisation a été mis à jour.'
      : null);

  await insertSuggestionUpdate(connection, {
    suggestionId: id,
    eventType,
    oldStatus: statusChanged ? oldStatus : null,
    newStatus: statusChanged ? newStatus : null,
    publicMessage,
    authorType: 'admin',
  });

  await insertModerationLog(connection, {
    suggestionId: id,
    action: statusChanged || visibilityChanged || input.message ? 'statut' : 'modification',
    oldStatus,
    newStatus,
    oldVisibility,
    newVisibility,
    note: input.message ?? (progressChanged ? 'Plan de réalisation mis à jour.' : null),
    ...audit(ctx),
  });

  if (oldVisibility !== 'publique' && newVisibility === 'publique') {
    await insertModerationLog(connection, {
      suggestionId: id,
      action: 'publication',
      oldStatus,
      newStatus,
      oldVisibility,
      newVisibility,
      note: 'Suggestion publiee.',
      ...audit(ctx),
    });
  } else if (oldVisibility === 'publique' && newVisibility === 'privee') {
    await insertModerationLog(connection, {
      suggestionId: id,
      action: 'depublication',
      oldStatus,
      newStatus,
      oldVisibility,
      newVisibility,
      note: 'Suggestion retiree de la liste publique.',
      ...audit(ctx),
    });
  }

  return { suggestion: await loadInTransaction(connection, id), changed: true };
}

/** Applique une action groupée dans une seule transaction. */
export async function bulkUpdateSuggestions(ids, action, ctx) {
  return transaction(async (connection) => {
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await connection.execute(
      `SELECT id FROM suggestions WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
      ids,
    );
    if (rows.length !== ids.length) {
      throw notFound('Au moins une suggestion sélectionnée n’existe plus.');
    }

    const input = action.type === 'status'
      ? { status: action.status }
      : action.type === 'publish'
        ? { publish: true }
        : { status: 'Archivée' };
    const items = [];
    for (const id of ids) {
      const result = await applyStatusChange(connection, id, input, ctx);
      items.push(result.suggestion);
    }
    return { updated: items.length, items };
  });
}

/** Désigne (ou retire) l’idée du mois courant, sans conserver de sélection ancienne. */
export async function selectMonthlyIdea(suggestionId, ctx) {
  return transaction(async (connection) => {
    // Lock the suggestion rows in primary-key order so concurrent admin
    // selections serialize before clearing and replacing the current idea.
    await connection.execute('SELECT id FROM suggestions ORDER BY id FOR UPDATE');
    let selected = null;
    if (suggestionId !== null) {
      const [rows] = await connection.execute(
        'SELECT id, status, visibility FROM suggestions WHERE id = ? FOR UPDATE',
        [suggestionId],
      );
      if (rows.length === 0 || rows[0].visibility !== 'publique') {
        throw notFound('Seule une suggestion publiée peut être choisie comme idée du mois.');
      }
      selected = rows[0];
    }

    const [current] = await connection.execute(
      `SELECT id, status, visibility FROM suggestions
        WHERE monthly_idea_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND monthly_idea_at < DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01')
        FOR UPDATE`,
    );
    await connection.execute('UPDATE suggestions SET monthly_idea_at = NULL WHERE monthly_idea_at IS NOT NULL');
    if (selected) {
      await connection.execute('UPDATE suggestions SET monthly_idea_at = CURRENT_TIMESTAMP WHERE id = ?', [
        selected.id,
      ]);
    }
    const auditedSuggestion = selected ?? current[0] ?? null;
    await insertModerationLog(connection, {
      suggestionId: auditedSuggestion?.id ?? null,
      action: 'modification',
      oldStatus: auditedSuggestion?.status ?? null,
      newStatus: auditedSuggestion?.status ?? null,
      oldVisibility: auditedSuggestion?.visibility ?? null,
      newVisibility: auditedSuggestion?.visibility ?? null,
      note: selected ? 'Suggestion choisie comme idée du mois.' : 'Idée du mois retirée.',
      ...audit(ctx),
    });
    return { suggestionId: selected ? Number(selected.id) : null };
  });
}

export async function removeSuggestionReport(suggestionId, reportId, ctx) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT s.status, s.visibility, r.reason
         FROM suggestion_reports r
         JOIN suggestions s ON s.id = r.suggestion_id
        WHERE r.suggestion_id = ? AND r.id = ?
        FOR UPDATE`,
      [suggestionId, reportId],
    );
    if (!rows.length) throw notFound('Ce signalement n’existe pas.');
    await connection.execute(
      'DELETE FROM suggestion_reports WHERE suggestion_id = ? AND id = ?',
      [suggestionId, reportId],
    );
    await insertModerationLog(connection, {
      suggestionId,
      action: 'modification',
      oldStatus: rows[0].status,
      newStatus: rows[0].status,
      oldVisibility: rows[0].visibility,
      newVisibility: rows[0].visibility,
      note: `Signalement examiné et retiré (${rows[0].reason}).`,
      ...audit(ctx),
    });
    const [countRows] = await connection.execute(
      'SELECT COUNT(*) AS count FROM suggestion_reports WHERE suggestion_id = ?',
      [suggestionId],
    );
    return { removed: true, reportCount: Number(countRows[0].count) };
  });
}

/** Change uniquement la visibilite et la note interne de moderation. */
export async function setModeration(id, input, ctx) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      'SELECT id, status, visibility, published_at, moderation_note FROM suggestions WHERE id = ?',
      [id],
    );
    if (rows.length === 0) throw notFound('Cette suggestion n’existe pas.');

    const current = rows[0];
    const oldVisibility = current.visibility;
    const newVisibility = input.visibility;

    let publishedAt = current.published_at;
    if (newVisibility === 'publique' && !publishedAt) publishedAt = new Date();
    if (newVisibility === 'privee') publishedAt = null;

    const note = input.moderationNote === undefined ? current.moderation_note : input.moderationNote;

    await connection.execute(
      `UPDATE suggestions
          SET visibility = ?, published_at = ?, moderation_note = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [newVisibility, publishedAt, note ?? null, id],
    );

    if (oldVisibility !== newVisibility) {
      await insertSuggestionUpdate(connection, {
        suggestionId: id,
        eventType: newVisibility === 'publique' ? 'publication' : 'message',
        oldStatus: null,
        newStatus: null,
        publicMessage:
          newVisibility === 'publique'
            ? 'Cette suggestion est désormais publiée.'
            : 'Cette suggestion n’est plus publiée.',
        authorType: 'admin',
      });

      await insertModerationLog(connection, {
        suggestionId: id,
        action: newVisibility === 'publique' ? 'publication' : 'depublication',
        oldStatus: current.status,
        newStatus: current.status,
        oldVisibility,
        newVisibility,
        note: input.moderationNote ?? null,
        ...audit(ctx),
      });
    } else if (input.moderationNote !== undefined) {
      await insertModerationLog(connection, {
        suggestionId: id,
        action: 'modification',
        oldStatus: current.status,
        newStatus: current.status,
        oldVisibility,
        newVisibility,
        note: input.moderationNote ?? null,
        ...audit(ctx),
      });
    }

    return { suggestion: await loadInTransaction(connection, id) };
  });
}

/**
 * Supprime une suggestion.
 * Le journal de moderation est ecrit AVANT la suppression : la table des logs
 * est en `ON DELETE SET NULL`, l'historique est donc conserve meme si la
 * suggestion disparaît. Les soutiens et la timeline suivent la suppression
 * (`ON DELETE CASCADE`) pour ne pas laisser de ligne orpheline.
 */
export async function removeSuggestion(id, ctx) {
  const deleted = await transaction(async (connection) => {
    const row = await findAdminSuggestionByIdIn(connection, id);
    if (!row) throw notFound('Cette suggestion n’existe pas.');

    await insertModerationLog(connection, {
      suggestionId: id,
      action: 'suppression',
      oldStatus: row.status,
      newStatus: null,
      oldVisibility: row.visibility,
      newVisibility: null,
      note: `Suggestion supprimee : « ${truncate(row.title, 120)} ».`,
      ...audit(ctx),
    });

    await connection.execute('DELETE FROM suggestions WHERE id = ?', [id]);
    return { deletedId: Number(id) };
  });
  await removeSuggestionPhotoFiles(id);
  return deleted;
}

/** Journal de moderation global. */
export async function listLogs(filters) {
  const result = await listModerationLogs(filters);
  return { ...result, items: result.rows.map(toModerationLog) };
}

/** Journal d'une suggestion (route de detail). */
export async function listLogsForSuggestion(id) {
  await loadOrFail(id);
  const rows = await listSuggestionModerationLogs(id);
  return rows.map(toModerationLog);
}

/** Journal global brut, utilise par les tests d'integration. */
export async function countLogs() {
  const row = await queryOne('SELECT COUNT(*) AS n FROM moderation_logs');
  return Number(row?.n ?? 0);
}

/** Toutes les lignes du journal, pour les tests. */
export async function allLogs() {
  return query('SELECT * FROM moderation_logs ORDER BY id ASC');
}

function truncate(value, max) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
