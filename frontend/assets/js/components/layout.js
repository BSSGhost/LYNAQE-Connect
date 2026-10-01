/**
 * Fragments de mise en page réutilisables (en-tête de page, états, cartes).
 */

import { esc } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { href } from '../core/router.js';
import { EMPTY_STATE } from '../../../../shared/constants.js';

export function pageHeader({ eyebrow, title, lead, actions = '' } = {}) {
  return `
    <header class="page-header">
      ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
      <div class="page-header-row">
        <div>
          <h1>${esc(title ?? '')}</h1>
          ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
        </div>
        ${actions ? `<div class="page-header-actions">${actions}</div>` : ''}
      </div>
    </header>
  `;
}

export function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Fil d’Ariane">${items
    .map((item, index) =>
      item.href
        ? `<a href="${href(item.href)}">${esc(item.label)}</a>${index < items.length - 1 ? '<span class="sep">/</span>' : ''}`
        : `<span aria-current="page">${esc(item.label)}</span>`,
    )
    .join('')}</nav>`;
}

export function loadingHtml(label = 'Chargement…') {
  return `<div class="state-block" role="status" aria-live="polite">
    <span class="spinner" aria-hidden="true"></span>
    <p>${esc(label)}</p>
  </div>`;
}

export function errorHtml(message, { retry = true } = {}) {
  return `<div class="state-block state-error" role="alert">
    ${icon('alert', { size: 32 })}
    <h2>Une erreur est survenue</h2>
    <p>${esc(message)}</p>
    ${retry ? `<button class="btn btn-primary" type="button" data-action="retry">${icon('refresh', { size: 16 })} Réessayer</button>` : ''}
  </div>`;
}

export function emptyStateHtml(overrides = {}) {
  const message = overrides.message ?? EMPTY_STATE.message;
  const ctaLabel = overrides.ctaLabel ?? EMPTY_STATE.ctaLabel;
  const ctaHref = overrides.ctaHref ?? EMPTY_STATE.ctaHref;
  return `<div class="state-block state-empty">
    ${icon('inbox', { size: 36 })}
    <h2>${esc(overrides.title ?? 'Rien à afficher')}</h2>
    <p>${esc(message)}</p>
    ${ctaHref ? `<a class="btn btn-primary" href="${href(ctaHref)}">${icon('plus', { size: 16 })} ${esc(ctaLabel)}</a>` : ''}
  </div>`;
}

export function statCardHtml({ label, value, hint, icon: name = 'chart', tone = '' }) {
  return `<div class="stat-card ${tone ? `tone-${esc(tone)}` : ''}">
    <span class="stat-icon">${icon(name, { size: 22 })}</span>
    <span class="stat-value">${esc(String(value))}</span>
    <span class="stat-label">${esc(label)}</span>
    ${hint ? `<span class="stat-hint">${esc(hint)}</span>` : ''}
  </div>`;
}

export function cardHtml({ title, subtitle, body, actions = '' }) {
  return `<section class="panel">
    <header class="panel-head">
      <div>
        <h2>${esc(title)}</h2>
        ${subtitle ? `<p class="field-hint">${esc(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="panel-actions">${actions}</div>` : ''}
    </header>
    <div class="panel-body">${body}</div>
  </section>`;
}

export function tabsHtml(tabs, activeValue) {
  return `<div class="tabs" role="tablist">${tabs
    .map(
      (tab) =>
        `<button role="tab" type="button" data-tab="${esc(tab.value)}" aria-selected="${tab.value === activeValue}">${esc(tab.label)}</button>`,
    )
    .join('')}</div>`;
}
