/**
 * Page « Confidentialité ».
 */

import { PROJECT, ROUTES } from '../../../../shared/constants.js';
import { mount } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { pageHeader, breadcrumbs } from '../components/layout.js';

const POINTS = [
  {
    icon: 'user',
    title: 'Anonymat possible',
    text: 'Si tu coches « Envoyer de façon anonyme », ton nom et ton contact ne sont jamais enregistrés, ni en base, ni transmis à la modération.',
  },
  {
    icon: 'lock',
    title: 'Code secret protégé',
    text: 'Le code secret qui accompagne ton numéro de suivi n’est jamais conservé en clair : seule une empreinte cryptographique est stockée.',
  },
  {
    icon: 'journal',
    title: 'Données strictement nécessaires',
    text: 'Nous enregistrons uniquement ce qui est utile au fonctionnement : le contenu de la suggestion, sa catégorie, ses statuts et l’historique de sa modération.',
  },
  {
    icon: 'eye',
    title: 'Aucune publicité, aucun traçage',
    text: 'La plateforme n’utilise pas de cookie publicitaire, n’intègre aucun réseau social et ne revend aucune donnée.',
  },
  {
    icon: 'shield',
    title: 'Sécurité',
    text: 'Les échanges sont protégés et les accès techniques sont limités. Le mot de passe d’administration n’est jamais stocké en clair.',
  },
  {
    icon: 'trash',
    title: 'Suppression',
    text: 'Une suggestion peut être retirée par la modération sur simple demande motivée, ou lorsque son contenu ne respecte pas les règles.',
  },
];

export async function render() {
  const main = document.getElementById('main');

  const cards = POINTS.map(
    (point) => `<article class="policy-card">
      <span class="policy-icon">${icon(point.icon, { size: 22 })}</span>
      <h3>${point.title}</h3>
      <p>${point.text}</p>
    </article>`,
  ).join('');

  mount(
    main,
    `${breadcrumbs([{ label: 'Accueil', href: ROUTES.home }, { label: 'Confidentialité' }])}
    ${pageHeader({
      title: 'Confidentialité',
      lead: `Ce que ${PROJECT.name} fait — et ne fait pas — avec tes informations.`,
    })}
    <div class="grid-cards policy-grid">${cards}</div>

    <section class="panel">
      <h2>${icon('info', { size: 20 })} En résumé</h2>
      <p>
        Tu décides de ce que tu souhaites partager. Une suggestion anonyme le reste : aucune
        information ne permet de remonter jusqu’à son auteur, même pour l’administration. Les
        chiffres affichés sur le site proviennent uniquement des suggestions déposées.
      </p>
      <p class="field-hint">
        Pour toute question, adresse-toi à l’équipe d’administration du ${PROJECT.school}.
      </p>
    </section>

    <section class="cta-band">
      <div><h2>Prêt à participer ?</h2><p>Dépose ton idée en toute confiance.</p></div>
      <a class="btn btn-primary" href="${href(ROUTES.submit)}">${icon('plus', { size: 16 })} Proposer une idée</a>
    </section>`,
  );
}
