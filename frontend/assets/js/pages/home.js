/**
 * Page d'accueil : présentation, étapes clés, dernières idées publiées.
 */

import { PROJECT, ROUTES, CATEGORY_META } from '../../../../shared/constants.js';
import { mount } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { formatNumber } from '../core/format.js';
import { suggestionsApi } from '../core/api.js';
import { loadingHtml } from '../components/layout.js';
import { suggestionListHtml } from '../components/suggestions.js';

const STEPS = [
  { number: '01', icon: 'lightbulb', title: 'Proposer', text: 'Partage ton idée ou signale un problème concret.' },
  { number: '02', icon: 'search', title: 'Examiner', text: 'La suggestion est vérifiée par l’équipe de modération.' },
  { number: '03', icon: 'book', title: 'Étudier', text: 'Sa faisabilité et son intérêt pour le lycée sont étudiés.' },
  { number: '04', icon: 'refresh', title: 'Agir', text: 'Lorsqu’elle avance, son statut est mis à jour.' },
  { number: '05', icon: 'checkCircle', title: 'Réaliser', text: 'Les propositions retenues peuvent être concrètement réalisées.' },
];

export async function render() {
  const main = document.getElementById('main');
  mount(main, loadingHtml());

  let items = [];
  let total = null;
  try {
    const result = await suggestionsApi.list({ limit: 6, sort: 'recent' });
    items = result.data ?? [];
    total = result.meta?.total ?? null;
  } catch (error) {
    items = [];
  }

  const steps = STEPS.map(
    (step) => `<article class="feature">
      <span class="step-number">${step.number}</span>
      <span class="feature-icon">${icon(step.icon, { size: 24 })}</span>
      <h3>${step.title}</h3>
      <p>${step.text}</p>
    </article>`,
  ).join('');

  const categories = CATEGORY_META.map(
    (category) => `<article class="category-card">
      <span class="category-icon">${icon(category.icon, { size: 22 })}</span>
      <h3>${category.value}</h3>
      <p>${category.description}</p>
    </article>`,
  ).join('');

  const latest = items.length
    ? suggestionListHtml(items)
    : `<div class="state-block state-empty">
        ${icon('inbox', { size: 36 })}
        <h2>Rien à afficher</h2>
        <p>${PROJECT.emptyStateMessage}</p>
        <a class="btn btn-primary" href="${href(ROUTES.submit)}">${icon('plus', { size: 16 })} ${PROJECT.emptyStateCta}</a>
      </div>`;

  mount(
    main,
    `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">${PROJECT.school}</p>
          <h1>${PROJECT.name}</h1>
          <p class="hero-tagline">${PROJECT.tagline}</p>
          <p class="lead">
            Propose une idée, signale un problème et participe à l’amélioration du lycée.
            Chaque suggestion peut être suivie et, lorsqu’elle est publiée, soutenue par les autres élèves.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="${href(ROUTES.submit)}">${icon('plus', { size: 18 })} Proposer une idée</a>
            <a class="btn btn-outline btn-lg" href="${href(ROUTES.suggestions)}">${icon('list', { size: 18 })} Voir les suggestions</a>
            <a class="btn btn-ghost btn-lg" href="${href(ROUTES.track)}">${icon('search', { size: 18 })} Suivre ma suggestion</a>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="hero-dashboard">
            <div class="hero-dashboard-top">
              <span class="hero-mini-logo">${icon('logo', { size: 20 })}</span>
              <span>${PROJECT.name}</span>
              <span class="hero-notification">${icon('info', { size: 15 })}</span>
            </div>
            <div class="hero-idea">
              <span class="hero-idea-icon">${icon('lightbulb', { size: 24 })}</span>
              <div><strong>Une idée pour le lycée</strong><small>Partage • écoute • action</small></div>
            </div>
            <div class="hero-suggestion">
              <div><span class="hero-dot"></span><span>Améliorer les espaces d’étude</span></div>
              <span class="badge tone-progress">En cours</span>
            </div>
            <div class="hero-stats">
              <div><strong>${total === null ? '—' : formatNumber(total)}</strong><span>suggestions</span></div>
              <div><strong>5</strong><span>étapes</span></div>
              <div><strong>∞</strong><span>idées</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="container section">
      <h2 class="section-title">Comment ça marche</h2>
      <div class="features process-steps">${steps}</div>
      <p class="section-more"><a class="link-more" href="${href(ROUTES.howItWorks)}">En savoir plus ${icon('arrowRight', { size: 15 })}</a></p>
    </section>

    <section class="container section">
      <h2 class="section-title">Les catégories</h2>
      <div class="category-grid">${categories}</div>
    </section>

    <section class="container section">
      <div class="section-head">
        <h2 class="section-title">Les dernières idées publiées</h2>
        <a class="link-more" href="${href(ROUTES.suggestions)}">Tout voir ${icon('arrowRight', { size: 15 })}</a>
      </div>
      ${latest}
    </section>

    <section class="container section">
      <div class="cta-band">
        <div>
          <h2>Ton idée peut changer le lycée.</h2>
          <p>${PROJECT.afterSubmitMessage}</p>
        </div>
        <a class="btn btn-primary btn-lg" href="${href(ROUTES.submit)}">${icon('send', { size: 18 })} Proposer une idée</a>
      </div>
    </section>
    `,
  );
}
