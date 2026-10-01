/**
 * Page « Règles de participation ».
 */

import { ROUTES } from '../../../../shared/constants.js';
import { mount } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { pageHeader, breadcrumbs } from '../components/layout.js';

const ALLOWED = [
  'Proposer une amélioration concrète pour la vie du lycée.',
  'Décrire un problème avec respect et proposer une solution.',
  'Soutenir les idées des autres, même si elles sont différentes des tiennes.',
];

const FORBIDDEN = [
  'Insulter, harceler ou viser une personne en particulier.',
  'Diffuser des informations personnelles sur quelqu’un d’autre.',
  'Publier un contenu hors sujet, publicitaire ou illégal.',
  'Usurper l’identité d’un élève, d’un enseignant ou de l’administration.',
];

export async function render() {
  const main = document.getElementById('main');

  const list = (items, kind) =>
    items
      .map((item) => `<li class="rule-item ${kind}">${icon(kind === 'ok' ? 'check' : 'x', { size: 16 })}<span>${item}</span></li>`)
      .join('');

  mount(
    main,
    `${breadcrumbs([{ label: 'Accueil', href: ROUTES.home }, { label: 'Règles de participation' }])}
    ${pageHeader({
      title: 'Règles de participation',
      lead: 'Quelques principes simples pour que cet espace reste utile et bienveillant pour tous.',
    })}

    <section class="panel">
      <h2>${icon('checkCircle', { size: 20 })} Ce qui est encouragé</h2>
      <ul class="rule-list">${list(ALLOWED, 'ok')}</ul>
    </section>

    <section class="panel">
      <h2>${icon('alert', { size: 20 })} Ce qui est refusé</h2>
      <ul class="rule-list">${list(FORBIDDEN, 'no')}</ul>
      <p class="field-hint">Toute suggestion contraire à ces règles peut être retirée ou classée « Non retenue » par l’équipe de modération.</p>
    </section>

    <section class="panel">
      <h2>${icon('shieldCheck', { size: 20 })} Modération</h2>
      <p>
        Rien n’est publié automatiquement. Chaque suggestion est d’abord examinée par l’équipe de
        modération. Les décisions sont tracées, ce qui permet à tout auteur de comprendre ce qui
        est advenu de son idée grâce à son suivi.
      </p>
    </section>

    <section class="cta-band">
      <div><h2>D’accord avec ces règles ?</h2><p>Alors lance-toi : ton idée est la bienvenue.</p></div>
      <a class="btn btn-primary" href="${href(ROUTES.submit)}">${icon('plus', { size: 16 })} Proposer une idée</a>
    </section>`,
  );
}
