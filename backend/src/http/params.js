/**
 * Validation des parametres d'URL.
 */

import { badRequest } from '../utils/errors.js';

/**
 * Convertit `req.params.id` en entier positif.
 * Evite qu'une valeur comme « 1 OR 1=1 » atteigne la couche SQL (meme si les
 * requetes sont deja parametrees, autant rejeter les entrees absurdes tot).
 */
export function parseIdParam(req, res, next, value) {
  // Signature a 4 arguments : Express l'utilise pour `router.param`.
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== String(value)) {
    return next(badRequest(`Identifiant invalide : « ${value} ».`));
  }
  req.resourceId = parsed;
  return next();
}

/** Valide un identifiant optionnel, fourni en query string. */
export function parseOptionalId(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}
