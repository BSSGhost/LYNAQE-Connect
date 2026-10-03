/**
 * Page « Comment ça marche ».
 */

import { PROJECT, STATUS_META, CATEGORY_META, ROUTES } from '../../../../shared/constants.js';
import { mount, esc } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { breadcrumbs } from '../components/layout.js';

const OVERVIEW_STEPS = [
  {
    number: '01',
    icon: 'lightbulb',
    title: 'Proposer',
    description: 'Partage une idée ou signale un problème concret de la vie du lycée.',
  },
  {
    number: '02',
    icon: 'search',
    title: 'Examiner',
    description: 'L’équipe de modération prend connaissance de la suggestion.',
  },
  {
    number: '03',
    icon: 'history',
    title: 'Suivre',
    description: 'Consulte l’évolution de la suggestion grâce à tes informations de suivi.',
  },
];

const SUBMISSION_STEPS = [
  {
    number: '01',
    icon: 'edit',
    title: 'Remplir le formulaire',
    description: 'Donne un titre clair à ton idée, choisis sa catégorie et décris-la.',
  },
  {
    number: '02',
    icon: 'user',
    title: 'Choisir l’anonymat',
    description: 'Décide si tu souhaites partager ton identité avec ta suggestion.',
  },
  {
    number: '03',
    icon: 'shield',
    title: 'Garder tes codes',
    description: 'Après l’envoi, conserve le numéro de suivi et le code secret reçus.',
  },
  {
    number: '04',
    icon: 'refresh',
    title: 'Suivre son évolution',
    description: 'Utilise ces informations pour retrouver ta suggestion et consulter son statut.',
  },
];

const STATUS_ICONS = {
  'en-attente': 'clock',
  recue: 'inbox',
  'a-l-etude': 'search',
  'en-cours': 'refresh',
  realisee: 'checkCircle',
  'non-retenue': 'info',
  archivee: 'archive',
};

export async function render() {
  const main = document.getElementById('main');

  const overview = OVERVIEW_STEPS.map(
    (step) => `<article class="how-overview-step">
      <span class="how-overview-number">${step.number}</span>
      <span class="how-overview-icon">${icon(step.icon, { size: 21 })}</span>
      <h2>${step.title}</h2>
      <p>${step.description}</p>
    </article>`,
  ).join('');

  const submission = SUBMISSION_STEPS.map(
    (step) => `<li class="how-submission-step">
      <span class="how-submission-number">${step.number}</span>
      <span class="how-submission-icon">${icon(step.icon, { size: 19 })}</span>
      <div><h3>${step.title}</h3><p>${step.description}</p></div>
    </li>`,
  ).join('');

  const statuses = STATUS_META.map(
    (status, index) => `<li class="how-status-item">
      <span class="how-status-marker" aria-hidden="true">
        <span class="how-status-number">${String(index + 1).padStart(2, '0')}</span>
        <span class="how-status-icon">${icon(STATUS_ICONS[status.slug] || 'refresh', { size: 17 })}</span>
      </span>
      <div class="how-status-content">
        <div class="how-status-heading"><span class="how-status-order">ÉTAPE ${String(index + 1).padStart(2, '0')}</span><h3>${esc(status.value)}</h3></div>
        <p>${esc(status.description)}</p>
      </div>
    </li>`,
  ).join('');

  const categories = CATEGORY_META.map(
    (category) => `<li class="how-category">${icon(category.icon, { size: 16 })}<span>${esc(category.value)}</span></li>`,
  ).join('');

  mount(
    main,
    `<div class="how-page">
      ${breadcrumbs([{ label: 'Accueil', href: ROUTES.home }, { label: 'Comment ça marche' }])}

      <header class="how-hero">
        <div class="how-hero-copy">
          <p class="editorial-eyebrow"><span></span> ${PROJECT.name} · ${PROJECT.school}</p>
          <h1>Comment ça marche</h1>
          <p>De l’idée à la réalisation : un parcours simple, transparent et respectueux de chacun.</p>
        </div>
        <div class="how-hero-visual" aria-hidden="true">
          <div class="how-hero-visual-line"></div>
          <div class="how-hero-orbit"></div>
          <span class="how-hero-node how-hero-node-one">${icon('lightbulb', { size: 20 })}</span>
          <span class="how-hero-node how-hero-node-two">${icon('search', { size: 19 })}</span>
          <span class="how-hero-node how-hero-node-three">${icon('checkCircle', { size: 20 })}</span>
          <span class="how-hero-center">${icon('school', { size: 29 })}</span>
          <span class="how-hero-step-label how-hero-label-one">Une idée</span>
          <span class="how-hero-step-label how-hero-label-two">Un suivi</span>
        </div>
      </header>

      <section class="how-overview" aria-label="Les grandes étapes">
        <div class="how-overview-grid">${overview}</div>
      </section>

      <section class="how-submission section-shell" aria-labelledby="how-submission-title">
        <div class="how-section-intro">
          <p class="editorial-eyebrow"><span></span> Participer</p>
          <h2 id="how-submission-title">Déposer une suggestion</h2>
          <p>Quelques étapes pour partager une idée et en garder le suivi.</p>
          <a class="how-inline-link" href="${href(ROUTES.submit)}">Accéder au formulaire ${icon('arrowRight', { size: 16 })}</a>
        </div>
        <ol class="how-submission-list">${submission}</ol>
      </section>

      <section class="how-anonymity" aria-labelledby="how-anonymity-title">
        <div class="how-anonymity-symbol" aria-hidden="true">${icon('shieldCheck', { size: 27 })}<span>${icon('user', { size: 14 })}</span></div>
        <div class="how-anonymity-copy">
          <p class="editorial-eyebrow"><span></span> À ton rythme</p>
          <h2 id="how-anonymity-title">Ton anonymat</h2>
          <p>Tu peux choisir d’envoyer ta suggestion de façon anonyme. Dans ce cas, ton nom et tes coordonnées ne sont pas enregistrés. Tu reçois tout de même un numéro de suivi et un code secret pour retrouver ta suggestion.</p>
        </div>
        <span class="how-anonymity-note">${icon('lock', { size: 15 })} Ton choix t’appartient</span>
      </section>

      <section class="how-statuses section-shell" aria-labelledby="how-statuses-title">
        <div class="how-section-intro">
          <p class="editorial-eyebrow"><span></span> Suivi des suggestions</p>
          <h2 id="how-statuses-title">Les statuts officiels</h2>
          <p>Chaque suggestion avance selon ces sept statuts, dans l’ordre suivant.</p>
        </div>
        <ol class="how-status-timeline">${statuses}</ol>
      </section>

      <section class="how-community" aria-labelledby="how-community-title">
        <div class="how-community-copy">
          <span class="how-community-icon">${icon('thumbsUp', { size: 20 })}</span>
          <p class="editorial-eyebrow"><span></span> Les idées avancent ensemble</p>
          <h2 id="how-community-title">Soutenir une idée</h2>
          <p>Sur la <a href="${href(ROUTES.suggestions)}">liste des suggestions</a>, tu peux soutenir les idées qui te tiennent à cœur. Un seul soutien par personne et par idée : les chiffres restent honnêtes.</p>
        </div>
        <div class="how-categories-wrap">
          <h3>Les catégories</h3>
          <ul class="how-categories">${categories}</ul>
        </div>
      </section>

      <section class="how-track-cta" aria-labelledby="how-track-title">
        <div class="how-track-icon" aria-hidden="true">${icon('search', { size: 22 })}</div>
        <div><p class="editorial-eyebrow"><span></span> Numéro de suivi + code secret</p><h2 id="how-track-title">Retrouver ma suggestion</h2><p>Renseigne ton numéro de suivi et ton code secret pour retrouver ta suggestion et consulter son évolution.</p></div>
        <a class="btn btn-primary btn-lg" href="${href(ROUTES.track)}">${icon('arrowRight', { size: 17 })} Suivre ma suggestion</a>
      </section>
    </div>`,
  );
}
