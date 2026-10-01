/**
 * Validation côté client — purement ergonomique.
 *
 * Elle donne un retour immédiat à l'élève, mais ne remplace JAMAIS la
 * validation du serveur (`backend/src/validation/schemas.js`), qui reste la
 * seule source de vérité.
 */

import { LIMITS, isValidCategory } from '../../../../shared/constants.js';

export function validateSuggestion(values) {
  const errors = {};
  const title = (values.title ?? '').trim();
  const description = (values.description ?? '').trim();

  if (!title) errors.title = 'Le titre est obligatoire.';
  else if (title.length < LIMITS.titleMin)
    errors.title = `Le titre doit contenir au moins ${LIMITS.titleMin} caractères.`;
  else if (title.length > LIMITS.titleMax)
    errors.title = `Le titre ne peut pas dépasser ${LIMITS.titleMax} caractères.`;

  if (!description) errors.description = 'La description est obligatoire.';
  else if (description.length < LIMITS.descriptionMin)
    errors.description = `La description doit contenir au moins ${LIMITS.descriptionMin} caractères.`;
  else if (description.length > LIMITS.descriptionMax)
    errors.description = `La description ne peut pas dépasser ${LIMITS.descriptionMax} caractères.`;

  if (!values.category) errors.category = 'Merci de choisir une catégorie.';
  else if (!isValidCategory(values.category)) errors.category = 'Catégorie inconnue.';

  if (values.location && values.location.trim().length > LIMITS.locationMax)
    errors.location = `Le lieu ne peut pas dépasser ${LIMITS.locationMax} caractères.`;

  if (values.extraInfo && values.extraInfo.trim().length > LIMITS.extraInfoMax)
    errors.extraInfo = `Ce champ ne peut pas dépasser ${LIMITS.extraInfoMax} caractères.`;

  if (values.authorName && values.authorName.trim().length > LIMITS.authorNameMax)
    errors.authorName = `Le nom ne peut pas dépasser ${LIMITS.authorNameMax} caractères.`;

  if (values.authorContact && values.authorContact.trim().length > LIMITS.authorContactMax)
    errors.authorContact = `Le contact ne peut pas dépasser ${LIMITS.authorContactMax} caractères.`;

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateTracking(values) {
  const errors = {};
  const tracking = (values.trackingCode ?? '').trim();
  const secret = (values.secretCode ?? '').trim();

  if (!tracking) errors.trackingCode = 'Le numéro de suivi est obligatoire.';
  else if (tracking.replace(/[^A-Za-z0-9]/g, '').length < 8)
    errors.trackingCode = 'Format attendu : LQC-XXXX-XXXX.';

  if (!secret) errors.secretCode = 'Le code secret est obligatoire.';
  else if (secret.length < 8) errors.secretCode = 'Le code secret est trop court.';

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Compteur de caractères : renvoie la classe CSS correspondante. */
export function counterClass(length, max) {
  if (length > max) return 'counter is-over';
  if (length > max * 0.9) return 'counter is-warning';
  return 'counter';
}
