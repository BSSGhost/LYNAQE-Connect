/**
 * Pied de page : navigation secondaire, mentions et crédit du créateur.
 */

import { ROUTES, PROJECT } from '../../../../shared/constants.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';

export function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;

  const year = new Date().getFullYear();

  footer.innerHTML = `
    <div class="container footer-grid">
      <div>
        <a class="brand" href="${href(ROUTES.home)}">
          <span class="brand-mark">${icon('logo', { size: 24 })}</span>
          <span class="brand-text">${PROJECT.name}<small>${PROJECT.school}</small></span>
        </a>
        <p style="margin-top: var(--space-3); color: var(--text-muted); max-width: 34ch;">
          ${PROJECT.tagline} Une plateforme simple et respectueuse pour recueillir les idées des
          élèves et suivre leur réalisation.
        </p>
      </div>
      <div>
        <h4>Explorer</h4>
        <ul class="footer-links">
          <li><a href="${href(ROUTES.home)}">Accueil</a></li>
          <li><a href="${href(ROUTES.suggestions)}">Suggestions</a></li>
          <li><a href="${href(ROUTES.submit)}">Proposer une idée</a></li>
          <li><a href="${href(ROUTES.track)}">Suivre ma suggestion</a></li>
          <li><a href="${href(ROUTES.howItWorks)}">Comment ça marche</a></li>
        </ul>
      </div>
      <div>
        <h4>Informations</h4>
        <ul class="footer-links">
          <li><a href="${href(ROUTES.about)}">À propos</a></li>
          <li><a href="${href(ROUTES.rules)}">Règles de participation</a></li>
          <li><a href="${href(ROUTES.privacy)}">Confidentialité</a></li>
          <li><a href="${href(ROUTES.admin)}">Espace administration</a></li>
        </ul>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© ${year} ${PROJECT.name} — ${PROJECT.school}</span>
      <span class="credit">
        <span class="heart">${icon('heart', { size: 15 })}</span>
        ${PROJECT.creatorCredit}
      </span>
    </div>
  `;
}
