/**
 * Page « À propos ».
 */

import { PROJECT, ROUTES } from '../../../../shared/constants.js';
import { mount } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { breadcrumbs } from '../components/layout.js';

const PILLARS = [
  {
    number: '01',
    icon: 'users',
    title: 'Écouter',
    description: 'Recueillir les propositions des élèves, quelles que soient leurs idées.',
  },
  {
    number: '02',
    icon: 'search',
    title: 'Comprendre',
    description: 'Examiner chaque proposition avec attention, dans le respect de chacun.',
  },
  {
    number: '03',
    icon: 'arrowRight',
    title: 'Agir',
    description: 'Suivre l’évolution et la réalisation des idées aussi ouvertement que possible.',
  },
];

const COMMITMENTS = [
  {
    icon: 'heart',
    title: 'Respect',
    description: 'Les suggestions sont modérées : aucun propos insultant ou blessant n’a sa place ici.',
  },
  {
    icon: 'shield',
    title: 'Confidentialité',
    description: 'Chacun peut proposer une idée en restant totalement anonyme.',
  },
  {
    icon: 'history',
    title: 'Transparence',
    description: 'Les changements de statut sont tracés et consultables par l’auteur.',
  },
  {
    icon: 'sparkles',
    title: 'Simplicité',
    description: 'Pas de compte à créer ni d’application à installer pour participer.',
  },
];

export async function render() {
  const main = document.getElementById('main');
  const pillars = PILLARS.map(
    (pillar) => `<article class="about-pillar">
      <span class="about-pillar-number">${pillar.number}</span>
      <span class="about-pillar-icon">${icon(pillar.icon, { size: 20 })}</span>
      <h3>${pillar.title}</h3>
      <p>${pillar.description}</p>
    </article>`,
  ).join('');

  const commitments = COMMITMENTS.map(
    (commitment) => `<article class="about-commitment">
      <span class="about-commitment-icon">${icon(commitment.icon, { size: 20 })}</span>
      <h3>${commitment.title}</h3>
      <p>${commitment.description}</p>
    </article>`,
  ).join('');

  mount(
    main,
    `<div class="about-page">
      ${breadcrumbs([{ label: 'Accueil', href: ROUTES.home }, { label: 'À propos' }])}

      <header class="about-hero">
        <div class="about-hero-copy">
          <p class="editorial-eyebrow"><span></span> ${PROJECT.school}</p>
          <h1>À propos</h1>
          <p class="about-hero-lead">${PROJECT.name} est né d’une idée simple : donner à chaque élève une vraie voix dans la vie de son lycée.</p>
          <a class="about-text-link" href="${href(ROUTES.howItWorks)}">Découvrir comment ça marche ${icon('arrowRight', { size: 16 })}</a>
        </div>
        <div class="about-hero-art" aria-hidden="true">
          <div class="about-art-orbit about-art-orbit-one"></div>
          <div class="about-art-orbit about-art-orbit-two"></div>
          <div class="about-art-board">
            <div class="about-art-board-head"><span>${icon('school', { size: 18 })}</span><span>LYNAQE CONNECT</span><i></i></div>
            <div class="about-art-board-title">Les idées font<br />avancer le lycée.</div>
            <div class="about-art-suggestion"><span>${icon('lightbulb', { size: 17 })}</span><div><strong>Une idée partagée</strong><small>Une voix rejoint la conversation</small></div></div>
            <div class="about-art-path"><span></span><span></span><span></span><span></span></div>
            <div class="about-art-board-foot"><span>Écouter</span><span>Comprendre</span><span>Agir</span></div>
          </div>
          <span class="about-art-spark about-art-spark-one">+</span>
          <span class="about-art-spark about-art-spark-two">+</span>
          <span class="about-art-dot"></span>
        </div>
      </header>

      <section class="about-section about-mission" aria-labelledby="about-mission-title">
        <div class="about-section-heading">
          <p class="editorial-eyebrow"><span></span> Notre mission</p>
          <h2 id="about-mission-title">Une idée mérite d’être entendue.</h2>
          <p>De la première proposition au suivi de son évolution, la plateforme donne un cadre simple à la participation des élèves.</p>
        </div>
        <div class="about-pillars">${pillars}</div>
        <p class="about-mission-note">${icon('info', { size: 17 })}<span>Propreté, infrastructures, restauration ou vie scolaire : chaque idée compte. Les chiffres affichés viennent des suggestions réellement déposées, jamais de données de démonstration. ${PROJECT.name} appartient à la communauté du ${PROJECT.school}.</span></p>
      </section>

      <section class="about-why" aria-labelledby="about-why-title">
        <div class="about-why-visual" aria-hidden="true">
          <div class="about-why-ring about-why-ring-one"></div>
          <div class="about-why-ring about-why-ring-two"></div>
          <div class="about-why-center">${icon('school', { size: 30 })}</div>
          <span class="about-why-node about-why-node-one">${icon('lightbulb', { size: 17 })}</span>
          <span class="about-why-node about-why-node-two">${icon('users', { size: 17 })}</span>
          <span class="about-why-node about-why-node-three">${icon('checkCircle', { size: 17 })}</span>
          <span class="about-why-line about-why-line-one"></span>
          <span class="about-why-line about-why-line-two"></span>
          <span class="about-why-line about-why-line-three"></span>
        </div>
        <div class="about-why-copy">
          <p class="editorial-eyebrow"><span></span> Une plateforme pour la communauté</p>
          <h2 id="about-why-title">Parce que le lycée avance mieux quand chacun peut contribuer.</h2>
          <p>Une idée peut partir d’un besoin quotidien. LYNAQE Connect aide à la partager, à la faire examiner et à en suivre les évolutions au sein du lycée.</p>
          <a class="about-text-link" href="${href(ROUTES.suggestions)}">Voir les suggestions ${icon('arrowRight', { size: 16 })}</a>
        </div>
      </section>

      <section class="about-section about-engagements" aria-labelledby="about-engagements-title">
        <div class="about-section-heading about-section-heading-row">
          <div><p class="editorial-eyebrow"><span></span> Nos engagements</p><h2 id="about-engagements-title">Un cadre simple et respectueux.</h2></div>
          <p>Les principes qui accompagnent chaque participation sur la plateforme.</p>
        </div>
        <div class="about-commitments">${commitments}</div>
      </section>

      <section class="about-creator" aria-label="Créateur de la plateforme">
        <span class="about-creator-icon">${icon('user', { size: 20 })}</span>
        <div><p class="about-creator-label">À l’initiative du projet</p><p>${PROJECT.creatorCredit}</p></div>
      </section>

      <section class="about-cta">
        <div><p class="editorial-eyebrow"><span></span> LYNAQE Connect</p><h2>Une idée peut commencer par une seule voix.</h2></div>
        <a class="btn btn-primary btn-lg" href="${href(ROUTES.submit)}">${icon('plus', { size: 18 })} Proposer une idée</a>
      </section>
    </div>`,
  );
}
