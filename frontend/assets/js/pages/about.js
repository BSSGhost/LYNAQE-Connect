/**
 * Page « À propos ».
 */

import { PROJECT, ROUTES } from '../../../../shared/constants.js';
import { mount } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { pageHeader, breadcrumbs } from '../components/layout.js';

export async function render() {
  const main = document.getElementById('main');

  mount(
    main,
    `${breadcrumbs([{ label: 'Accueil', href: ROUTES.home }, { label: 'À propos' }])}
    ${pageHeader({
      title: 'À propos',
      lead: `${PROJECT.name} est né d’une idée simple : donner à chaque élève une vraie voix dans la vie de son lycée.`,
    })}

    <section class="panel">
      <h2>${icon('lightbulb', { size: 20 })} Notre mission</h2>
      <p>
        Recueillir les propositions des élèves, les examiner avec attention et suivre leur
        réalisation le plus ouvertement possible. Chaque idée compte, qu’elle parle de propreté,
        d’infrastructures, de restauration ou de la vie scolaire au quotidien.
      </p>
      <p>
        La plateforme appartient à la communauté du ${PROJECT.school} : les chiffres affichés
        proviennent uniquement des idées réellement déposées, jamais de données de démonstration.
      </p>
    </section>

    <section class="panel">
      <h2>${icon('shield', { size: 20 })} Nos engagements</h2>
      <ul class="check-list">
        <li>${icon('check', { size: 16 })} <strong>Respect.</strong> Aucune insulte, aucun propos blessant : les suggestions sont modérées.</li>
        <li>${icon('check', { size: 16 })} <strong>Confidentialité.</strong> Tu peux proposer une idée en restant totalement anonyme.</li>
        <li>${icon('check', { size: 16 })} <strong>Transparence.</strong> Chaque changement de statut est tracé et consultable par l’auteur.</li>
        <li>${icon('check', { size: 16 })} <strong>Simplicité.</strong> Pas de compte à créer, pas d’application à installer.</li>
      </ul>
    </section>

    <section class="panel creator-card">
      <span class="creator-avatar">${icon('user', { size: 26 })}</span>
      <div>
        <h2>Le créateur</h2>
        <p>${PROJECT.creatorCredit}</p>
      </div>
    </section>

    <section class="cta-band">
      <div><h2>Une remarque, une idée ?</h2><p>La meilleure façon de participer, c’est de proposer.</p></div>
      <a class="btn btn-primary" href="${href(ROUTES.submit)}">${icon('plus', { size: 16 })} Proposer une idée</a>
    </section>`,
  );
}
