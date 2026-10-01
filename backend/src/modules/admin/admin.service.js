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
import { notFound, conflict } from '../../utils/errors.js';
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
} from '../suggestions/suggestion.repository.js';

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

/** Detail complet : suggestion + timeline + journal de moderation. */
export async function getSuggestion(id) {
  const row = await loadOrFail(id);
  const [timeline, logs] = await Promise.all([
    listSuggestionUpdates(row.id),
    listSuggestionModerationLogs(row.id),
  ]);
  return {
    suggestion: toAdminSuggestion(row),
    timeline: timeline.map(toSuggestionUpdate),
    moderationLogs: logs.map(toModerationLog),
  };
}

/**
 * Change le statut d'une suggestion, avec publication optionnelle.
 *
 * @param {number|string} id
 * @param {{status: string, message?: string, publish?: boolean}} input
 * @param {object} ctx requete Express (IP masquee, agent utilisateur)
 */
export async function changeStatus(id, input, ctx) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      'SELECT id, status, visibility, published_at FROM suggestions WHERE id = ?',
      [id],
    );
    if (rows.length === 0) throw notFound('Cette suggestion n’existe pas.');

    const current = rows[0];
    const oldStatus = current.status;
    const oldVisibility = current.visibility;

    const newStatus = input.status;
    // `publish` est optionnel : absent = la visibilite ne change pas.
    const newVisibility =
      input.publish === undefined ? oldVisibility : input.publish ? 'publique' : 'privee';

    const statusChanged = newStatus !== oldStatus;
    const visibilityChanged = newVisibility !== oldVisibility;

    if (!statusChanged && !visibilityChanged && !input.message) {
      return { suggestion: await loadInTransaction(connection, id), changed: false };
    }

    // `published_at` n'est positionne qu'a la premiere publication et remis a
    // zero si la suggestion redevient privee.
    let publishedAt = current.published_at;
    if (newVisibility === 'publique' && !publishedAt) publishedAt = new Date();
    if (newVisibility === 'privee') publishedAt = null;

    await connection.execute(
      `UPDATE suggestions
          SET status = ?, visibility = ?, published_at = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [newStatus, newVisibility, publishedAt, id],
    );

    // --- Timeline ---------------------------------------------------------
    const eventType = visibilityChanged
      ? newVisibility === 'publique'
        ? 'publication'
        : 'message'
      : 'statut';

    await insertSuggestionUpdate(connection, {
      suggestionId: id,
      eventType,
      oldStatus: statusChanged ? oldStatus : null,
      newStatus: statusChanged ? newStatus : null,
      publicMessage: input.message ?? null,
      authorType: 'admin',
    });

    // --- Journal de moderation --------------------------------------------
    await insertModerationLog(connection, {
      suggestionId: id,
      action: 'statut',
      oldStatus,
      newStatus,
      oldVisibility,
      newVisibility,
      note: input.message ?? null,
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

/** Modifie le contenu d'une suggestion (titre, description, categorie...). */
export async function updateSuggestion(id, patch, ctx) {
  return transaction(async (connection) => {
    const row = await findAdminSuggestionByIdIn(connection, id);
    if (!row) throw notFound('Cette suggestion n’existe pas.');

    const columnByField = {
      title: 'title',
      description: 'description',
      category: 'category',
      location: 'location',
      extraInfo: 'extra_info',
      authorName: 'author_name',
      moderationNote: 'moderation_note',
    };

    const assignments = [];
    const params = [];
    for (const [field, column] of Object.entries(columnByField)) {
      if (patch[field] === undefined) continue;
      assignments.push(`${column} = ?`);
      params.push(patch[field] ?? null);
    }

    if (assignments.length === 0) {
      throw conflict('Aucune modification exploitable.');
    }

    assignments.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await connection.execute(`UPDATE suggestions SET ${assignments.join(', ')} WHERE id = ?`, params);

    await insertSuggestionUpdate(connection, {
      suggestionId: id,
      eventType: 'modification',
      oldStatus: null,
      newStatus: null,
      publicMessage: 'La suggestion a été mise à jour par la modération.',
      authorType: 'admin',
    });

    await insertModerationLog(connection, {
      suggestionId: id,
      action: 'modification',
      oldStatus: row.status,
      newStatus: row.status,
      oldVisibility: row.visibility,
      newVisibility: row.visibility,
      note: patch.moderationNote ?? `Champs modifies : ${Object.keys(patch).join(', ')}.`,
      ...audit(ctx),
    });

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
  return transaction(async (connection) => {
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
