/**
 * Serialisation des suggestions vers l'API.
 *
 * Regle de securite : c'est ici, et uniquement ici, qu'on decide de ce qui
 * sort de la base. Chaque type de reponse a sa propre fonction afin qu'aucune
 * donnee sensible ne puisse apparaitre par accident :
 *
 *  - `toPublicSuggestion` : ni numero de suivi, ni hash, ni nom, ni contact,
 *    ni note de moderation. Un visiteur ne peut voir que ce qui a ete
 *    explicitement publie ;
 *  - `toOwnerSuggestion` : ajoute le numero de suivi et les coordonnees que
 *    l'auteur a lui-meme fournies, reserves a son suivi ;
 *  - `toAdminSuggestion` : tout sauf le hash du code secret, qui n'a aucune
 *    utilite pour l'administration et ne doit jamais circuler.
 */

import { getStatusMeta, CATEGORY_BY_VALUE } from '../../../../shared/constants.js';

const iso = (value) => (value instanceof Date ? value.toISOString() : value ?? null);

/** Bloc de statut commun a toutes les vues (libelle + couleur + description). */
function statusInfo(status) {
  const meta = getStatusMeta(status);
  if (!meta) return { value: status, slug: null, tone: null, step: null, description: null };
  return {
    value: meta.value,
    slug: meta.slug,
    tone: meta.tone,
    step: meta.step,
    description: meta.description,
  };
}

function categoryInfo(category) {
  const meta = CATEGORY_BY_VALUE[category];
  return meta
    ? { value: meta.value, slug: meta.slug, icon: meta.icon, description: meta.description }
    : { value: category, slug: null, icon: 'dots', description: null };
}

export function toPublicSuggestion(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    category: row.category,
    categoryInfo: categoryInfo(row.category),
    location: row.location,
    extraInfo: row.extra_info,
    status: row.status,
    statusInfo: statusInfo(row.status),
    isAnonymous: Boolean(row.is_anonymous),
    supportCount: Number(row.support_count ?? 0),
    publishedAt: iso(row.published_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toOwnerSuggestion(row) {
  if (!row) return null;
  return {
    ...toPublicSuggestion(row),
    // Le proprietaire a fourni ces informations : il peut les revoir.
    trackingCode: row.tracking_code,
    authorName: row.is_anonymous ? null : row.author_name,
    authorContact: row.is_anonymous ? null : row.author_contact,
    visibility: row.visibility,
  };
}

export function toAdminSuggestion(row) {
  if (!row) return null;
  return {
    ...toPublicSuggestion(row),
    trackingCode: row.tracking_code,
    visibility: row.visibility,
    // L'administration voit le nom uniquement si la suggestion n'est pas anonyme :
    // l'anonymat est garanti des l'insertion, donc il n'y a rien a afficher.
    authorName: row.is_anonymous ? null : row.author_name,
    authorContact: row.is_anonymous ? null : row.author_contact,
    isAnonymous: Boolean(row.is_anonymous),
    moderationNote: row.moderation_note,
    publishedAt: iso(row.published_at),
  };
}

export function toSuggestionUpdate(row) {
  return {
    id: Number(row.id),
    eventType: row.event_type,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    newStatusInfo: row.new_status ? statusInfo(row.new_status) : null,
    message: row.public_message,
    authorType: row.author_type,
    createdAt: iso(row.created_at),
  };
}

export function toModerationLog(row) {
  return {
    id: Number(row.id),
    suggestionId: row.suggestion_id === null || row.suggestion_id === undefined ? null : Number(row.suggestion_id),
    suggestionTitle: row.suggestion_title ?? null,
    trackingCode: row.tracking_code ?? null,
    action: row.action,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    oldVisibility: row.old_visibility,
    newVisibility: row.new_visibility,
    actor: row.actor,
    note: row.note,
    createdAt: iso(row.created_at),
  };
}
