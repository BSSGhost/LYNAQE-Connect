/**
 * Page 404 (route inconnue).
 */

import { ROUTES } from '../../../../shared/constants.js';
import { mount } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';

export async function render() {
  const main = document.getElementById('main');
  mount(
    main,
    `<div class="state-block state-empty not-found">
      <span class="not-found-code">404</span>
      ${icon('search', { size: 36 })}
      <h1>Page introuvable</h1>
      <p>La page que tu cherches n’existe pas ou a été déplacée.</p>
      <div class="form-actions">
        <a class="btn btn-primary" href="${href(ROUTES.home)}">${icon('logo', { size: 16 })} Revenir à l’accueil</a>
        <a class="btn btn-outline" href="${href(ROUTES.suggestions)}">${icon('list', { size: 16 })} Voir les suggestions</a>
      </div>
    </div>`,
  );
}
