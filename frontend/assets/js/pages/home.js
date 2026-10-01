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
  { icon: 'lightbulb', title: 'Tu as une idée', text: 'Un constat, une proposition pour améliorer la vie du lycée.' },
  { icon: 'send', title: 'Tu la déposes', text: 'Une seule page, anonyme si tu le souhaites, et un reçu de suivi immédiat.' },
  { icon: 'shieldCheck', title: 'Elle est examinée', text: 'L’équipe de modération vérifie, publie si elle est conforme, puis suit sa réalisation.' },
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
      <span class="feature-icon">${icon(step.icon, { size: 24 })}</span>
      <h3>${step.title}</h3>
      <p>${step.text}</p>
    </article>`,
  ).join('');

  const categories = CATEGORY_META.map(
    (category) => `<li class="chip">${icon(category.icon, { size: 15 })}${category.value}</li>`,
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
          <h1>${PROJECT.tagline}</h1>
          <p class="lead">
            ${PROJECT.name} permet à chaque élève de proposer une idée pour le lycée, de la
            soutenir et de suivre son avancement, en toute transparence.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="${href(ROUTES.submit)}">${icon('plus', { size: 18 })} Proposer une idée</a>
            <a class="btn btn-outline btn-lg" href="${href(ROUTES.suggestions)}">${icon('list', { size: 18 })} Voir les suggestions</a>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="hero-card">
            <span class="hero-card-icon">${icon('lightbulb', { size: 30 })}</span>
            <strong>${total === null ? 'Ton idée' : formatNumber(total)}</strong>
            <span>${total === null ? 'peut tout changer' : `idée${total > 1 ? 's' : ''} partagée${total > 1 ? 's' : ''}`}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="container section">
      <h2 class="section-title">Comment ça marche</h2>
      <div class="features">${steps}</div>
      <p class="section-more"><a class="link-more" href="${href(ROUTES.howItWorks)}">En savoir plus ${icon('arrowRight', { size: 15 })}</a></p>
    </section>

    <section class="container section">
      <h2 class="section-title">Les catégories</h2>
      <ul class="chips">${categories}</ul>
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
