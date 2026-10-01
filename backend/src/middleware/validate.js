/**
 * Validation automatique des entrees de requete.
 *
 * Le schema fait foi : la sortie validee remplace la donnee brute, ce qui
 * garantit qu'aucun champ non declare n'atteint la couche metier.
 */

import { validationError } from '../utils/errors.js';
import { validate } from '../validation/schemas.js';

/** Valide `req.body` et le remplace par la version normalisee. */
export function validateBody(schema, message) {
  return (req, res, next) => {
    const result = validate(schema, req.body ?? {});
    if (!result.success) return next(validationError(message, result.error.issues));
    req.body = result.data;
    return next();
  };
}

/**
 * Valide `req.query` et le remplace par la version normalisee.
 * Les query strings ne sont pas strictes : zod ignore les parametres inconnus.
 */
export function validateQuery(schema, message) {
  return (req, res, next) => {
    const result = validate(schema, req.query ?? {});
    if (!result.success) return next(validationError(message, result.error.issues));
    req.validatedQuery = result.data;
    return next();
  };
}
