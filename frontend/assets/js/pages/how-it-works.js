/**
 * Page « Comment ça marche ».
 */

import { PROJECT, STATUS_META, CATEGORY_META, ROUTES } from '../../../../shared/constants.js';
import { mount, esc } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { pageHeader, breadcrumbs } from '../components/layout.js';

export async function render() {
  const main = document.getElementById('main');

  const statuses = STATUS_META.map(
    (status, index) => `<li class="step-item">
      <span class="step-index">${index + 1}</span>
      <div><strong>${esc(status.value)}</strong><p>${esc(status.description)}</p></div>
    </li>`,
  ).join('');

  const categories = CATEGORY_META.map(
    (category) => `<li class="chip">${icon(category.icon, { size: 15 })}${esc(category.value)}</li>`,
  ).join('');

  mount(
    main,
    `${breadcrumbs([{ label: 'Accueil', href: ROUTES.home }, { label: 'Comment ça marche' }])}
    ${pageHeader({
      title: 'Comment ça marche',
      lead: 'De l’idée à la réalisation : un parcours simple, transparent et respectueux de chacun.',
    })}

    <section class="panel">
      <h2>${icon('send', { size: 20 })} Déposer une suggestion</h2>
      <ol class="ordered-steps">
        <li>Tu remplis le <a href="${href(ROUTES.submit)}">formulaire</a> : un titre clair, une catégorie et une description.</li>
        <li>Tu choisis si tu veux rester <strong>anonyme</strong>. Dans ce cas, aucune coordonnée n’est enregistrée.</li>
        <li>Après l’envoi, tu reçois un <strong>numéro de suivi</strong> et un <strong>code secret</strong>. Seul ton code permet de retrouver ta suggestion non publiée.</li>
      </ol>
      <p class="notice">${icon('info', { size: 16 })} ${esc(PROJECT.afterSubmitMessage)}</p>
    </section>

    <section class="panel">
      <h2>${icon('shieldCheck', { size: 20 })} Les statuts officiels</h2>
      <p class="field-hint">Chaque suggestion avance selon ces sept statuts, dans l’ordre suivant.</p>
      <ul class="step-list">${statuses}</ul>
    </section>

    <section class="panel">
      <h2>${icon('thumbsUp', { size: 20 })} Soutenir une idée</h2>
      <p>Sur la <a href="${href(ROUTES.suggestions)}">liste des suggestions</a>, tu peux soutenir les idées qui te tiennent à cœur. Un seul soutien par personne et par idée : les chiffres restent honnêtes.</p>
    </section>

    <section class="panel">
      <h2>${icon('tag', { size: 20 })} Les catégories</h2>
      <ul class="chips">${categories}</ul>
    </section>

    <section class="cta-band">
      <div><h2>Prêt à proposer ton idée ?</h2><p>Ça prend deux minutes et ça peut tout changer.</p></div>
      <a class="btn btn-primary btn-lg" href="${href(ROUTES.submit)}">${icon('plus', { size: 18 })} Proposer une idée</a>
    </section>`,
  );
}
