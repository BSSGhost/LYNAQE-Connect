/**
 * Schemas de validation de l'API (source de verite cote serveur).
 *
 * Le frontend dispose d'une validation legere purely ergonomique
 * (`frontend/assets/js/validation.js`) : elle ne remplace jamais celle-ci.
 *
 * Regles appliquees :
 *  - `.strict()` sur les corps de requete : tout champ non declare est
 *    refuse (evite le "mass assignment") ;
 *  - normalisation systematique : trim, espaces internes, casse, accents et
 *    apostrophes typographiques. Un administrateur qui saisit "realisee" ou
 *    "a l'etude" reanime bien le statut officiel correspondant, et
 *    l'integrite entre l'API, MySQL et le frontend est preservee ;
 *  - longueurs min/max issues de `shared/constants.js`.
 */

import { z } from 'zod';
import {
  SUGGESTION_STATUSES,
  CATEGORIES,
  VISIBILITIES,
  REPORT_REASONS,
  LIMITS,
} from '../../../shared/constants.js';
import { normalizeTrackingCode, normalizeSecretCode } from '../utils/codes.js';
import { validationError } from '../utils/errors.js';

/**
 * Empreinte de comparaison insensible a la casse, aux accents et au type
 * d'apostrophe. Sert uniquement a retrouver la valeur canonique.
 */
function fingerprint(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc\u0060\u00b4]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Enum tolerant a la casse et aux accents : renvoie toujours la valeur canonique. */
function canonicalEnum(values, options = {}) {
  const lookup = new Map();
  for (const value of values) lookup.set(fingerprint(value), value);
  return z.preprocess((input) => {
    if (typeof input !== 'string') return input;
    return lookup.get(fingerprint(input)) ?? input;
  }, z.enum([...values], options));
}

/** Champ texte : trim + compactage des espaces internes. */
function text(max, min = 0) {
  return z.preprocess((input) => {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/\s+/g, ' ');
  }, z.string({ required_error: 'Ce champ est obligatoire.', invalid_type_error: 'Ce champ doit être du texte.' }).min(min).max(max));
}

/** Champ texte long : trim + compactage (la mise en forme reste preservee). */
function longText(max, min = 0) {
  return z.preprocess(
    (input) => (typeof input === 'string' ? input.trim().replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n') : input),
    z.string({ required_error: 'Ce champ est obligatoire.', invalid_type_error: 'Ce champ doit être du texte.' }).min(min).max(max),
  );
}

/** Champ texte facultatif : "" / null / undefined devient undefined. */
function optionalText(max) {
  return z
    .preprocess((input) => (typeof input === 'string' ? input.trim() : input), z.string().max(max).optional())
    .transform((value) => (value === '' || value === undefined ? value : value));
}

/** Booleen tolerant a "true"/"false"/"1"/"0"/"oui" sans transformer undefined en false. */
const booleanish = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'oui', 'on', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'non', 'off', 'no'].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const statusField = canonicalEnum(SUGGESTION_STATUSES, {
  errorMap: () => ({ message: `Statut invalide. Valeurs autorisées : ${SUGGESTION_STATUSES.join(', ')}.` }),
});
const categoryField = canonicalEnum(CATEGORIES, {
  errorMap: () => ({ message: `Catégorie invalide. Valeurs autorisées : ${CATEGORIES.join(', ')}.` }),
});
const visibilityField = canonicalEnum(VISIBILITIES, {
  errorMap: () => ({ message: 'Visibilité invalide. Valeurs autorisées : privee, publique.' }),
});
const reportReasonField = canonicalEnum(REPORT_REASONS, {
  errorMap: () => ({ message: 'Motif de signalement invalide.' }),
});
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Format de date attendu : AAAA-MM-JJ.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Date invalide.');

// ---------------------------------------------------------------------------
// Suggestion
// ---------------------------------------------------------------------------

export const createSuggestion = z
  .object({
    title: text(LIMITS.titleMax, LIMITS.titleMin),
    description: longText(LIMITS.descriptionMax, LIMITS.descriptionMin),
    category: categoryField,
    location: optionalText(LIMITS.locationMax),
    extraInfo: optionalText(LIMITS.extraInfoMax),
    isAnonymous: booleanish.default(false),
    authorName: optionalText(LIMITS.authorNameMax),
    authorContact: optionalText(LIMITS.authorContactMax),
  })
  .strict()
  .transform((data) => ({
    ...data,
    // Garantie de confidentialite cote serveur : en mode anonyme, aucune
    // trace du nom ou du contact n'est conservee, meme si le client les a
    // envoyes par erreur. La contrainte SQL `chk_suggestions_anonymous_no_name`
    // verifie la meme regle au niveau de la base.
    authorName: data.isAnonymous ? undefined : data.authorName,
    authorContact: data.isAnonymous ? undefined : data.authorContact,
  }));

// ---------------------------------------------------------------------------
// Suivi
// ---------------------------------------------------------------------------

export const trackingRequest = z
  .object({
    trackingCode: z.preprocess(
      (input) => (typeof input === 'string' ? normalizeTrackingCode(input) : input),
      z
        .string({
          required_error: 'Le numéro de suivi est obligatoire.',
          invalid_type_error: 'Numéro de suivi invalide (format attendu : LQC-XXXX-XXXX).',
        })
        .min(8)
        .max(LIMITS.trackingCodeMax),
    ),
    secretCode: z.preprocess(
      (input) => (typeof input === 'string' ? normalizeSecretCode(input) : input),
      z.string({ required_error: 'Le code secret est obligatoire.', invalid_type_error: 'Code secret invalide.' })
        .min(8)
        .max(LIMITS.secretCodeMax),
    ),
  })
  .strict();

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export const adminLogin = z
  .object({
    password: z.string().min(1, 'Le mot de passe est obligatoire.').max(200),
  })
  .strict();

export const updateStatus = z
  .object({
    status: statusField,
    /** Message public affiche dans la timeline du proprietaire. */
    message: optionalText(LIMITS.adminMessageMax),
    /** Passe (true) ou retire (false) la publication publique. */
    publish: booleanish.optional(),
    progressPercent: z.preprocess(
      (value) => (value === '' || value === null ? null : value === undefined ? undefined : Number(value)),
      z.number().int().min(0).max(100).nullable().optional(),
    ),
    expectedCompletionDate: z.union([dateField, z.null()]).optional(),
  })
  .strict();

export const reportSuggestion = z.object({ reason: reportReasonField }).strict();

export const selectMonthlyIdea = z
  .object({
    suggestionId: z.preprocess(
      (value) => (value === '' || value === null ? null : value),
      z.union([z.coerce.number().int().positive(), z.null()]),
    ),
  })
  .strict();

export const moderationUpdate = z
  .object({
    visibility: visibilityField,
    moderationNote: optionalText(LIMITS.moderationNoteMax),
  })
  .strict();

const bulkSuggestionIds = z
  .array(z.coerce.number().int().positive().safe())
  .min(1)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Une suggestion ne peut être sélectionnée qu’une seule fois.',
  });

export const bulkSuggestionUpdate = z.discriminatedUnion('type', [
  z.object({ ids: bulkSuggestionIds, type: z.literal('status'), status: statusField }).strict(),
  z.object({ ids: bulkSuggestionIds, type: z.literal('publish') }).strict(),
  z.object({ ids: bulkSuggestionIds, type: z.literal('archive') }).strict(),
]);

// ---------------------------------------------------------------------------
// Listes paginees
// ---------------------------------------------------------------------------

const positiveInt = (fallback, max) =>
  z.preprocess((value) => {
    if (value === undefined || value === '') return fallback;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }, z.number().int().min(1).max(max));

/**
 * Les query strings ne sont PAS `.strict()` : zod supprime silencieusement les
 * parametres inconnus (`utm_*`, `cachebust`...) au lieu de renvoyer une
 * erreur 422. Les corps de requete, eux, restent stricts.
 */
export const publicListQuery = z.object({
  page: positiveInt(1, 10_000),
  limit: positiveInt(LIMITS.pageSizeDefault, LIMITS.pageSizeMax),
  category: categoryField.optional(),
  status: statusField.optional(),
  search: text(LIMITS.titleMax).optional(),
  sort: canonicalEnum(['recent', 'oldest', 'supported', 'updated']).optional(),
});

export const adminListQuery = publicListQuery.extend({
  limit: positiveInt(20, LIMITS.adminPageSizeMax),
  visibility: visibilityField.optional(),
  sort: canonicalEnum(['recent', 'oldest', 'supported', 'updated', 'status']).optional(),
});

export const moderationQueueQuery = z.object({
  page: positiveInt(1, 10_000),
  limit: positiveInt(30, LIMITS.adminPageSizeMax),
});

export const adminLogQuery = z.object({
  page: positiveInt(1, 10_000),
  limit: positiveInt(30, LIMITS.adminPageSizeMax),
  suggestionId: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().max(32).optional(),
  ),
  action: canonicalEnum([
    'creation',
    'publication',
    'depublication',
    'modification',
    'statut',
    'rejet',
    'archivage',
    'suppression',
    'consultation',
  ]).optional(),
});

export const schemas = Object.freeze({
  createSuggestion,
  trackingRequest,
  adminLogin,
  updateStatus,
  reportSuggestion,
  selectMonthlyIdea,
  moderationUpdate,
  bulkSuggestionUpdate,
  publicListQuery,
  adminListQuery,
  moderationQueueQuery,
  adminLogQuery,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Valide des donnees sans lever d'exception.
 * @returns {{ success: true, data: object } | { success: false, error: { issues: Array } }}
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: { issues: formatIssues(result.error) } };
}

/**
 * Valide des donnees et leve une ApiError 422 en cas d'echec.
 * Utilise par les controleurs.
 */
export function parseOrThrow(schema, data, message) {
  const result = validate(schema, data);
  if (!result.success) throw validationError(message, result.error.issues);
  return result.data;
}

export function formatIssues(zodError) {
  return zodError.issues.map((issue) => ({
    path: issue.path.join('.') || '(racine)',
    message: issue.message,
  }));
}
