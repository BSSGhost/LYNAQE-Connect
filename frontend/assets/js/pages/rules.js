/**
 * Page « Règles de participation ».
 */

import { ROUTES } from '../../../../shared/constants.js';
import { mount } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { pageHeader, breadcrumbs } from '../components/layout.js';

const PARTICIPATION_RULES = [
  {
    icon: 'lightbulb',
    title: 'Soyez utile',
    description: 'Proposez des idées concrètes qui peuvent améliorer la vie au lycée.',
  },
  {
    icon: 'users',
    title: 'Respectez les autres',
    description: 'Aucune insulte, moquerie, attaque personnelle ou propos irrespectueux.',
  },
  {
    icon: 'school',
    title: 'Restez dans le contexte scolaire',
    description: 'Les suggestions doivent concerner la vie, les élèves, les activités ou le fonctionnement du lycée.',
  },
  {
    icon: 'lock',
    title: 'Protégez la vie privée',
    description: "Ne publiez pas de données personnelles ou d'informations privées concernant d'autres personnes.",
  },
  {
    icon: 'alert',
    title: "Pas de spam ni d'abus",
    description: "Évitez les publications répétitives, les contenus malveillants ou les utilisations abusives de la plateforme.",
  },
  {
    icon: 'sparkles',
    title: 'Soyez constructif',
    description: "Expliquez clairement le problème et, lorsque c'est possible, proposez une solution.",
  },
];

export async function render() {
  const main = document.getElementById('main');

  const cards = PARTICIPATION_RULES.map((rule, index) => `
    <article class="participation-rule-card">
      <span class="participation-rule-icon" aria-hidden="true">${icon(rule.icon, { size: 22 })}</span>
      <span class="participation-rule-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <h2>${rule.title}</h2>
      <p>${rule.description}</p>
    </article>
  `).join('');

  mount(
    main,
    `${breadcrumbs([{ label: 'Accueil', href: ROUTES.home }, { label: 'Règles de participation' }])}
    ${pageHeader({
      title: 'Règles de participation',
      lead: 'Quelques règles pour faire avancer notre lycée ensemble.',
    })}

    <section class="participation-rules" aria-label="Nos règles de participation">
      <div class="participation-rules-grid">${cards}</div>
      <p class="participation-rules-signoff">Une bonne idée commence par le respect. <span aria-label="cœur bleu">💙</span></p>
    </section>

    <section class="panel participation-moderation-note">
      <h2>${icon('shieldCheck', { size: 20 })} Modération</h2>
      <p>
        Rien n’est publié automatiquement. Chaque suggestion est d’abord examinée par l’équipe de
        modération. Les décisions sont tracées, ce qui permet à tout auteur de comprendre ce qui
        est advenu de son idée grâce à son suivi.
      </p>
      <p class="field-hint">Toute suggestion contraire à ces règles peut être retirée ou classée « Non retenue » par l’équipe de modération.</p>
    </section>

    <section class="cta-band">
      <div><h2>D’accord avec ces règles ?</h2><p>Alors lance-toi : ton idée est la bienvenue.</p></div>
      <a class="btn btn-primary" href="${href(ROUTES.submit)}">${icon('plus', { size: 16 })} Proposer une idée</a>
    </section>`,
  );
}
