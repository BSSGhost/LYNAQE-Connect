/**
 * Service metier des suggestions.
 *
 * Contient les regles de gestion :
 *  - generation du numero de suivi et du code secret (hash scrypt) ;
 *  - depot d'une suggestion : statut « En attente », visibilite « privee »,
 *    moderation obligatoire avant publication ;
 *  - suivi : verification combinee du numero de suivi ET du code secret ;
 *  - soutien : une seule fois par personne/appareil/session.
 */

import { randomBytes } from 'node:crypto';
import {
  generateTrackingCode,
  generateSecretCode,
  normalizeTrackingCode,
} from '../../utils/codes.js';
import { hashSecret, verifySecret } from '../../utils/passwords.js';
import { conflict, notFound, validationError } from '../../utils/errors.js';
import { transaction } from '../../config/db.js';
import {
  computeSupporterHash,
  computeSupporterTokenHash,
} from '../../middleware/context.js';
import {
  insertSuggestionWithHistory,
  findSuggestionForTracking,
  listSuggestionUpdates,
  listPublicSuggestions,
  findPublicSuggestionById,
  addSupportOnce,
  insertModerationLog,
} from './suggestion.repository.js';
import { toOwnerSuggestion, toPublicSuggestion, toSuggestionUpdate } from './suggestion.serializer.js';

/**
 * Message volontairement identique pour les deux cas d'echec du suivi
 * (`numero inconnu` / `code secret faux`). Sinon un attaquant pourrait
 * discoverer les numeros de suivi existants en testant les codes.
 */
const TRACKING_FAILED_MESSAGE =
  'Numéro de suivi ou code secret incorrect. Vérifiez les informations affichées après votre envoi.';

/**
 * Depot d'une suggestion.
 *
 * @param {object} payload donnees deja valides par `createSuggestion`
 * @param {object} ctx { clientIpMasked, userAgent }
 * @returns {Promise<{trackingCode: string, secretCode: string, suggestion: object}>}
 *          `secretCode` n'est renvoye qu'ici, une seule fois, jamais stocke.
 */
export async function createSuggestion(payload, ctx = {}) {
  const trackingCode = generateTrackingCode();
  const secretCode = generateSecretCode();
  const secretCodeHash = await hashSecret(secretCode);

  const suggestionId = await insertSuggestionWithHistory({
    trackingCode,
    secretCodeHash,
    payload,
    clientIpMasked: ctx.clientIpMasked ?? null,
    userAgent: ctx.userAgent ?? null,
  });

  const row = await findSuggestionForTracking(trackingCode);
  if (!row) {
    // Ne devrait jamais arriver : la transaction vient de committer.
    throw conflict('La suggestion a été enregistrée mais sa lecture a échoué.');
  }

  return {
    suggestionId,
    trackingCode,
    secretCode,
    suggestion: toOwnerSuggestion({ ...row, secret_code_hash: undefined }),
  };
}

/**
 * Suivi d'une suggestion par son auteur.
 * @throws {ApiError} meme message pour un numero inconnu et un code faux.
 */
export async function trackSuggestion({ trackingCode, secretCode }, ctx = {}) {
  const normalized = normalizeTrackingCode(trackingCode);
  if (!normalized) {
    throw validationError('Numéro de suivi ou code secret incorrect.', [
      { path: 'trackingCode', message: 'Format attendu : LQC-XXXX-XXXX.' },
    ]);
  }

  const row = await findSuggestionForTracking(normalized);

  // Comparaison systematique du hash, meme si la ligne n'existe pas : le temps
  // de reponse ne doit pas reveler l'existence du numero de suivi.
  const expectedHash = row?.secret_code_hash ?? DUMMY_HASH;
  const codeOk = await verifySecret(secretCode, expectedHash);

  if (!row || !codeOk) {
    throw notFound(TRACKING_FAILED_MESSAGE);
  }

  const events = await listSuggestionUpdates(row.id);

  return {
    suggestion: toOwnerSuggestion({ ...row, secret_code_hash: undefined }),
    timeline: events.map(toSuggestionUpdate),
  };
}

/**
 * Hash factice, calcule au demarrage, utilise quand le numero de suivi est
 * inconnu. Il force le meme calcul scrypt que le cas nominal, de sorte que le
 * temps de reponse ne revele pas l'existence d'une suggestion.
 */
const DUMMY_HASH = await hashSecret(randomBytes(16).toString('hex'));

/** Liste les suggestions publiques avec pagination et filtres. */
export async function listPublic(filters) {
  const result = await listPublicSuggestions(filters);
  return {
    ...result,
    items: result.rows.map(toPublicSuggestion),
  };
}

/** Detail public d'une suggestion. */
export async function getPublicSuggestion(id) {
  const row = await findPublicSuggestionById(id);
  if (!row) {
    throw notFound('Cette suggestion n’est pas disponible.');
  }
  return toPublicSuggestion(row);
}

/**
 * Ajoute un soutien.
 *
 * @param {number|string} id identifiant public de la suggestion
 * @param {object} req requete Express (IP, agent utilisateur, jeton d'appareil)
 * @returns {Promise<{alreadySupported: boolean, supportCount: number}>}
 */
export async function supportSuggestion(id, req) {
  const row = await findPublicSuggestionById(id);
  if (!row) {
    throw notFound('Cette suggestion n’est pas disponible.');
  }

  const supporterHash = computeSupporterHash({
    supporterToken: req.supporterToken,
    ipMasked: req.clientIpMasked,
    userAgent: req.userAgent,
  });

  const result = await addSupportOnce({
    suggestionId: row.id,
    supporterHash,
    supporterTokenHash: computeSupporterTokenHash(req.supporterToken),
    ipMasked: req.clientIpMasked,
    userAgent: req.userAgent,
  });

  // Evenement de journal : trace le soutien pour l'administration.
  if (!result.alreadySupported) {
    await transaction(async (connection) => {
      await insertModerationLog(connection, {
        suggestionId: row.id,
        action: 'modification',
        actor: 'system',
        note: 'Soutien enregistre.',
        ipMasked: req.clientIpMasked,
        userAgent: req.userAgent,
      });
    });
  }

  return result;
}
