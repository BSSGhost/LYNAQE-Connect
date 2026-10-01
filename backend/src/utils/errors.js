/**
 * Erreurs applicatives normalisees.
 *
 * Toute erreur qui remonte au middleware d'erreur est instanceof ApiError et
 * produit une reponse JSON predictable, sans fuite d'information (aucune stack
 * en production, aucun detail MySQL).
 */

export class ApiError extends Error {
  /**
   * @param {number} status  code HTTP
   * @param {string} code    code machine lisible (ex: `VALIDATION_ERROR`)
   * @param {string} message message affichable en francais
   * @param {object} [details] informations complementaires (champs invalides...)
   */
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
    Error.captureStackTrace?.(this, ApiError);
  }
}

export const badRequest = (message = 'Requête invalide.', details) =>
  new ApiError(400, 'BAD_REQUEST', message, details);

export const validationError = (message = 'Certains champs sont invalides.', details) =>
  new ApiError(422, 'VALIDATION_ERROR', message, details);

export const unauthorized = (message = 'Accès non autorisé.') =>
  new ApiError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Accès refusé.') =>
  new ApiError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Ressource introuvable.') =>
  new ApiError(404, 'NOT_FOUND', message);

export const conflict = (message = 'Conflit avec une donnée existante.', details) =>
  new ApiError(409, 'CONFLICT', message, details);

export const tooManyRequests = (message = 'Trop de requêtes. Réessayez plus tard.') =>
  new ApiError(429, 'RATE_LIMITED', message);

export const internalError = (message = 'Une erreur interne est survenue.') =>
  new ApiError(500, 'INTERNAL_ERROR', message);
