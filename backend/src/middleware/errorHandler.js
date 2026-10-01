/**
 * Traitement centralise des erreurs.
 *
 * Objectifs :
 *  - reponse JSON homogeneous pour le frontend ;
 *  - aucune fuite d'information (message MySQL, trace, chemin serveur) ;
 *  - journalisation complete cote serveur pour le diagnostic.
 */

import { ApiError, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

/** 404 pour toute route inconnue de l'API. */
export function notFoundHandler(req, res, next) {
  next(notFound(`Route introuvable : ${req.method} ${req.path}`));
}

/** Traduit les erreurs MySQL en erreurs applicatives. */
function translateDatabaseError(error) {
  switch (error.code) {
    case 'ER_DUP_ENTRY':
      return new ApiError(
        409,
        'CONFLICT',
        'Cette valeur existe déjà. Merci de vérifier votre saisie.',
      );
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return new ApiError(400, 'INVALID_REFERENCE', 'Référence invalide.');
    case 'ER_ROW_IS_REFERENCED':
      return new ApiError(
        409,
        'CONFLICT',
        'Cet élément est encore utilisé et ne peut pas être supprimé.',
      );
    case 'ER_DATA_TOO_LONG':
      return new ApiError(400, 'DATA_TOO_LONG', 'Un champ est trop long pour la base de données.');
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return new ApiError(
        400,
        'CONSTRAINT_VIOLATION',
        'La proposition ne respecte pas les règles de la plateforme.',
      );
    case 'ER_LOCK_DEADLOCK':
      return new ApiError(409, 'CONFLICT', 'Conflit temporaire, réessayez.');
    case 'ER_TABLEACCESS_DENIED_ERROR':
    case 'ER_DBACCESS_DENIED_ERROR':
    case 'ER_ACCESS_DENIED_ERROR':
      return new ApiError(500, 'DATABASE_UNAVAILABLE', 'Base de données momentanément indisponible.');
    default:
      return null;
  }
}

// eslint-disable-next-line no-unused-vars -- Express identifie le middleware d'erreur a ses 4 arguments.
export function errorHandler(error, req, res, next) {
  const apiError =
    error instanceof ApiError
      ? error
      : (translateDatabaseError(error) ??
        new ApiError(500, 'INTERNAL_ERROR', 'Une erreur interne est survenue.'));

  const isServerFault = apiError.status >= 500;

  const logMeta = {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    ip: req.clientIpMasked,
    code: apiError.code,
    status: apiError.status,
  };

  if (isServerFault) {
    logger.error(apiError.message, {
      ...logMeta,
      // Trace complete uniquement cote serveur : jamais renvoyee au client.
      stack: error.stack,
      cause: error.code ?? undefined,
      sqlState: error.sqlState ?? undefined,
    });
  } else if (apiError.status >= 400 && apiError.status !== 404) {
    logger.warn(apiError.message, logMeta);
  }

  const body = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
    requestId: req.id,
  };

  // En developpement uniquement, on ajoute le detail de l'erreur serveur pour
  // faciliter le debogage. Jamais en production.
  if (!config.isProduction && isServerFault) {
    body.error.debug = { message: error.message, code: error.code ?? null };
  }

  res.status(apiError.status).json(body);
}

/**
 * Enveloppe un controleur async pour que toute promesse rejetee arrive
 * proprement au middleware d'erreur (Express 4 ne le fait pas seul).
 */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
