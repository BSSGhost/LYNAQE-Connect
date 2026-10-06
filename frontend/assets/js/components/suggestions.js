/**
 * Rendu des suggestions : cartes de liste, badge de statut, étapes de
 * progression et chronologie de suivi.
 */

import {
  getStatusMeta,
  CATEGORY_BY_VALUE,
  PROGRESS_STATUSES,
  ROUTES,
} from '../../../../shared/constants.js';
import { esc } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { href } from '../core/router.js';
import { formatDate, formatDateTime, formatNumber, pluralize } from '../core/format.js';

export function statusBadge(statusInfo) {
  const tone = statusInfo?.tone ?? 'neutral';
  const label = statusInfo?.value ?? '—';
  return `<span class="badge tone-${esc(tone)}"><span class="dot"></span>${esc(label)}</span>`;
}

export function categoryTag(categoryInfo, categoryValue) {
  const meta = categoryInfo ?? CATEGORY_BY_VALUE[categoryValue];
  return `<span class="tag">${icon(meta?.icon ?? 'dots', { size: 14 })}${esc(meta?.value ?? categoryValue ?? '—')}</span>`;
}

function excerpt(text, max = 220) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function supportButtonHtml(suggestion, { supported = false } = {}) {
  return `
    <button class="support-button ${supported ? 'is-supported' : ''}" type="button"
      data-support="${suggestion.id}" aria-pressed="${supported}"
      aria-label="${supported ? 'Soutenu' : 'Soutenir cette idée'}">
      ${icon('thumbsUp', { size: 16 })}
      <span data-support-state>${supported ? 'Soutenu' : 'Soutenir'}</span>
      <span data-support-count>${formatNumber(suggestion.supportCount)}</span>
      <span class="visually-hidden"> soutien${pluralize(suggestion.supportCount, '', 's')}</span>
    </button>
    <button class="support-remove-action" type="button" data-unsupport="${suggestion.id}" ${supported ? '' : 'hidden'}>
      Retirer mon soutien
    </button>
  `;
}

export function suggestionCardHtml(suggestion, options = {}) {
  return `
    <article class="suggestion-card" data-suggestion="${suggestion.id}">
      <div class="card-top">
        ${statusBadge(suggestion.statusInfo)}
        ${categoryTag(suggestion.categoryInfo, suggestion.category)}
      </div>
      <h3><a href="${href(`${ROUTES.suggestions}/${suggestion.id}`)}">${esc(suggestion.title)}</a></h3>
      <p class="excerpt">${esc(excerpt(suggestion.description))}</p>
      <div class="card-foot">
        <span>${icon('calendar', { size: 14 })} ${esc(formatDate(suggestion.createdAt))}</span>
        ${supportButtonHtml(suggestion, options)}
      </div>
    </article>
  `;
}

export function suggestionListHtml(items, options = {}) {
  return `<div class="grid-cards">${items
    .map((item) => suggestionCardHtml(item, options))
    .join('')}</div>`;
}

/** Barre d'étapes En attente → Reçue → À l'étude → En cours → Réalisée. */
export function progressStepsHtml(currentStatus, events = []) {
  const currentMeta = getStatusMeta(currentStatus);
  const currentStep = currentMeta?.step ?? null;

  const steps = PROGRESS_STATUSES.map((status) => {
    const meta = getStatusMeta(status);
    const state = currentStep === null ? '' : meta.step < currentStep ? 'is-done' : meta.step === currentStep ? 'is-current' : '';
    const event = events.find((item) => item.newStatus === status);
    const date = event?.createdAt
      ? `<span class="progress-step-date">${state === 'is-current' ? 'Depuis le ' : ''}${esc(formatDate(event.createdAt))}</span>`
      : '';
    return `<li class="${state}"><span class="step-dot"></span><span class="progress-step-label">${esc(status)}</span>${date}</li>`;
  }).join('');

  return `<ul class="progress-steps" aria-label="Progression">${steps}</ul>`;
}

export function completionPlanHtml(suggestion) {
  if (suggestion.status !== 'En cours') return '';
  const percent = suggestion.progressPercent;
  const date = suggestion.expectedCompletionDate;
  if ((percent === null || percent === undefined) && !date) return '';
  return `<section class="completion-plan" aria-label="Avancement de la réalisation">
    <h3>Avancement</h3>
    ${percent !== null && percent !== undefined ? `<div class="completion-progress" role="progressbar" aria-label="Avancement déclaré par l’administration" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(percent)}">
      <span style="width:${Math.max(0, Math.min(100, Number(percent)))}%"></span>
    </div><p class="completion-percent">${formatNumber(percent)} %</p>` : ''}
    ${date ? `<p class="completion-date">${icon('calendar', { size: 15 })} Date prévue : <strong>${esc(formatDate(date))}</strong></p>` : ''}
  </section>`;
}

function timelineIcon(eventType) {
  switch (eventType) {
    case 'creation':
      return 'send';
    case 'publication':
      return 'megaphone';
    case 'modification':
      return 'edit';
    case 'message':
      return 'info';
    default:
      return 'refresh';
  }
}

export function timelineHtml(events) {
  if (!events?.length) {
    return `<p class="field-hint">Aucun évènement pour le moment.</p>`;
  }
  const items = events
    .map((event, index) => {
      const isLast = index === events.length - 1;
      const title = event.newStatusInfo ? event.newStatusInfo.value : eventLabel(event.eventType);
      const description =
        event.message ??
        event.newStatusInfo?.description ??
        'Mise à jour de la situation de la suggestion.';
      return `
        <li class="timeline-item">
          <span class="timeline-marker ${isLast ? 'is-current' : ''}">${icon(timelineIcon(event.eventType), { size: 12 })}</span>
          <p class="timeline-title">${esc(title)}</p>
          <span class="timeline-time">${esc(formatDateTime(event.createdAt))}</span>
          ${event.message && event.authorType === 'admin' ? '<p class="timeline-official-label">Réponse de l’administration</p>' : ''}
          ${event.message ? `<p class="timeline-message">${esc(event.message)}</p>` : `<p class="field-hint">${esc(description)}</p>`}
        </li>
      `;
    })
    .join('');
  return `<ol class="timeline">${items}</ol>`;
}

function eventLabel(eventType) {
  const labels = {
    creation: 'Suggestion envoyée',
    statut: 'Changement de statut',
    message: 'Message de la modération',
    publication: 'Publication',
    modification: 'Mise à jour',
  };
  return labels[eventType] ?? 'Mise à jour';
}

export function moderationLogHtml(log) {
  const actionLabels = {
    creation: 'Création',
    publication: 'Publication',
    depublication: 'Dépublication',
    modification: 'Modification',
    statut: 'Changement de statut',
    rejet: 'Rejet',
    archivage: 'Archivage',
    suppression: 'Suppression',
    consultation: 'Consultation',
  };
  return `
    <tr>
      <td><span class="cell-title">${esc(actionLabels[log.action] ?? log.action)}</span></td>
      <td>
        <span class="cell-title">${esc(log.suggestionTitle ?? 'Suggestion supprimée')}</span>
        ${log.trackingCode ? `<div class="cell-sub">${esc(log.trackingCode)}</div>` : ''}
      </td>
      <td>${log.newStatus ? statusBadge({ value: log.newStatus, tone: getStatusMeta(log.newStatus)?.tone }) : '—'}</td>
      <td>${esc(log.actor)}</td>
      <td class="cell-sub">${esc(formatDateTime(log.createdAt))}</td>
    </tr>
  `;
}
