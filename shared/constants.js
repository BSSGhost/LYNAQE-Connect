/**
 * Source unique de verite partagee entre le backend (ESM) et le frontend.
 *
 * Objectif : garantir qu'il ne peut jamais exister de divergence entre les
 * statuts, les categories ou les actions affichees dans le frontend, exposes
 * par l'API, ou stockes dans MySQL (les ENUM SQL sont derives de ces listes).
 *
 * ⚠ Ne jamais dupliquer ces listes ailleurs.
 */

/** Identite du projet, affichee dans le frontend et les e-mails de log. */
export const PROJECT = Object.freeze({
  name: 'LYNAQE Connect',
  tagline: 'Votre voix, notre lycée de demain.',
  school: 'LYNAQE de Sédhiou',
  creator: 'Ahmadou Bamba Bousso SANKHARÉ',
  creatorCredit: 'Créé par Ahmadou Bamba Bousso SANKHARÉ, un développeur volontaire.',
  afterSubmitMessage:
    'Après l’envoi, votre suggestion sera examinée par l’équipe de modération.',
  emptyStateMessage: 'Aucune suggestion pour le moment.',
  emptyStateCta: 'Proposer une idée',
});

/**
 * Les 7 statuts officiels, dans l'ordre exact du cahier des charges.
 * `step` sert a la timeline de suivi (les statuts terminaux n'ont pas d'etape).
 * `tone` pilote la couleur du badge dans le CSS (clair ET sombre).
 */
export const STATUS_META = Object.freeze([
  {
    value: 'En attente',
    slug: 'en-attente',
    tone: 'pending',
    step: 1,
    description: 'La suggestion a été déposée et attend le premier examen.',
  },
  {
    value: 'Reçue',
    slug: 'recue',
    tone: 'received',
    step: 2,
    description: 'La suggestion a été enregistrée par l’équipe de modération.',
  },
  {
    value: 'À l’étude',
    slug: 'a-l-etude',
    tone: 'review',
    step: 3,
    description: 'L’équipe de modération évalue la faisabilité de la suggestion.',
  },
  {
    value: 'En cours',
    slug: 'en-cours',
    tone: 'progress',
    step: 4,
    description: 'La suggestion est en cours de réalisation.',
  },
  {
    value: 'Réalisée',
    slug: 'realisee',
    tone: 'done',
    step: 5,
    description: 'La suggestion a été réalisée.',
  },
  {
    value: 'Non retenue',
    slug: 'non-retenue',
    tone: 'rejected',
    step: null,
    description: 'La suggestion n’a pas été retenue par l’équipe de modération.',
  },
  {
    value: 'Archivée',
    slug: 'archivee',
    tone: 'archived',
    step: null,
    description: 'La suggestion a été archivée.',
  },
].map(Object.freeze));

/** Liste ordonnee des statuts, derivee de STATUS_META. */
export const SUGGESTION_STATUSES = Object.freeze(STATUS_META.map((s) => s.value));

/** Statuts representant une etape de progression (utilises par la timeline). */
export const PROGRESS_STATUSES = Object.freeze(
  STATUS_META.filter((s) => s.step !== null).map((s) => s.value)
);

/** Statuts présents dans la file de modération dédiée. */
export const MODERATION_QUEUE_STATUSES = Object.freeze([
  'En attente',
  'Reçue',
  'À l’étude',
]);

export const STATUS_BY_VALUE = Object.freeze(
  Object.fromEntries(STATUS_META.map((s) => [s.value, s]))
);

/** Statut applique automatiquement a toute nouvelle suggestion. */
export const DEFAULT_STATUS = 'En attente';

export function isValidStatus(value) {
  return Object.prototype.hasOwnProperty.call(STATUS_BY_VALUE, value);
}

export function getStatusMeta(value) {
  return STATUS_BY_VALUE[value] ?? null;
}

/**
 * Categories de suggestions. `icon` renvoie vers un sprite SVG interne
 * (aucune dependance externe, aucun emoji).
 */
export const CATEGORY_META = Object.freeze([
  {
    value: 'Vie scolaire',
    slug: 'vie-scolaire',
    icon: 'school',
    description: 'Organisation, discipline, vie de classe et communication interne.',
  },
  {
    value: 'Infrastructures et matériel',
    slug: 'infrastructures-et-materiel',
    icon: 'tools',
    description: 'Salles, mobilier, équipements, espaces d’étude.',
  },
  {
    value: 'Propreté et hygiène',
    slug: 'proprete-et-hygiene',
    icon: 'sparkle',
    description: 'Sanitaires, classes, espaces communs et hygiène.',
  },
  {
    value: 'Restauration et cadre de vie',
    slug: 'restauration-et-cadre-de-vie',
    icon: 'utensils',
    description: 'Cantine, espaces de détente, qualité de vie au quotidien.',
  },
  {
    value: 'Activités culturelles et sportives',
    slug: 'activites-culturelles-et-sportives',
    icon: 'trophy',
    description: 'Clubs, sorties, événements, sport et culture.',
  },
  {
    value: 'Enseignement et apprentissage',
    slug: 'enseignement-et-apprentissage',
    icon: 'book',
    description: 'Cours, devoirs, bibliothèque, examens, pédagogie.',
  },
  {
    value: 'Environnement',
    slug: 'environnement',
    icon: 'leaf',
    description: 'Arbres, espaces verts, déchets,developpement durable.',
  },
  {
    value: 'Autres',
    slug: 'autres',
    icon: 'dots',
    description: 'Toute proposition qui ne rentre pas dans les autres catégories.',
  },
].map(Object.freeze));

export const CATEGORIES = Object.freeze(CATEGORY_META.map((c) => c.value));

export const CATEGORY_BY_VALUE = Object.freeze(
  Object.fromEntries(CATEGORY_META.map((c) => [c.value, c]))
);

export const DEFAULT_CATEGORY = 'Autres';

export function isValidCategory(value) {
  return Object.prototype.hasOwnProperty.call(CATEGORY_BY_VALUE, value);
}

/** Visibilite d'une suggestion : rien n'est public avant validation par l'admin. */
export const VISIBILITY_META = Object.freeze([
  {
    value: 'privee',
    label: 'Non publiée',
    description: 'Visible uniquement par l’administration et son auteur via le suivi.',
  },
  {
    value: 'publique',
    label: 'Publiée',
    description: 'Visible par tous les élèves dans la liste des suggestions.',
  },
].map(Object.freeze));

export const VISIBILITIES = Object.freeze(VISIBILITY_META.map((v) => v.value));
export const DEFAULT_VISIBILITY = 'privee';

/** Motifs de signalement disponibles sur une suggestion publique. */
export const REPORT_REASONS = Object.freeze([
  'Contenu offensant',
  'Spam',
  'Informations personnelles',
  'Fausse information',
  'Contenu inapproprié',
  'Autre',
]);

/** Actions tracees dans `moderation_logs`. */
export const MODERATION_ACTIONS = Object.freeze([
  'creation',
  'publication',
  'depublication',
  'modification',
  'statut',
  'rejet',
  'archivage',
  'suppression',
  'consultation',
]);

/** Types d'evenements enregistres dans `suggestion_updates` (timeline du suivi). */
export const UPDATE_EVENT_TYPES = Object.freeze([
  'creation',
  'statut',
  'message',
  'publication',
  'modification',
]);

/** Origines possibles d'un evenement. */
export const UPDATE_AUTHOR_TYPES = Object.freeze(['system', 'admin']);

/** Contraintes de saisie, partagees pour valider cote client et cote serveur. */
export const LIMITS = Object.freeze({
  titleMin: 5,
  titleMax: 180,
  descriptionMin: 20,
  descriptionMax: 4000,
  locationMax: 180,
  extraInfoMax: 2000,
  authorNameMax: 120,
  authorContactMax: 120,
  adminMessageMax: 2000,
  moderationNoteMax: 2000,
  trackingCodeMax: 32,
  secretCodeMax: 64,
  supportBatchMax: 50,
  pageSizeDefault: 12,
  pageSizeMax: 50,
  adminPageSizeMax: 100,
});

/** Message affiche apres l'envoi d'une suggestion (contrat unique). */
export const SUBMIT_SUCCESS_MESSAGE = 'Votre suggestion a bien été envoyée.';

export const ROUTES = Object.freeze({
  home: '/',
  submit: '/proposer',
  suggestions: '/suggestions',
  track: '/suivre',
  howItWorks: '/comment-ca-marche',
  about: '/a-propos',
  rules: '/regles',
  privacy: '/confidentialite',
  admin: '/admin',
  adminSuggestions: '/admin/suggestions',
  adminQueue: '/admin/a-traiter',
  adminStatistics: '/admin/statistiques',
  adminLogs: '/admin/journal',
  notFound: '/introuvable',
});

/** Predicat utilise par le frontend et le backend pour le CTA d'etat vide. */
export const EMPTY_STATE = Object.freeze({
  message: PROJECT.emptyStateMessage,
  ctaLabel: PROJECT.emptyStateCta,
  ctaHref: ROUTES.submit,
});
