/**
 * Page détail d'une suggestion publiée (lecture seule, soutien possible).
 */

import { ROUTES } from '../../../../shared/constants.js';
import { mount, esc } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { suggestionsApi } from '../core/api.js';
import { formatDate, formatNumber, pluralize } from '../core/format.js';
import { breadcrumbs, loadingHtml } from '../components/layout.js';
import { statusBadge, categoryTag, progressStepsHtml, supportButtonHtml } from '../components/suggestions.js';
import { wireSupportButtons } from '../components/support.js';

export async function render(context) {
  const main = document.getElementById('main');
  mount(main, loadingHtml('Chargement de la suggestion…'));

  try {
    const { data: suggestion } = await suggestionsApi.detail(context.params.id);
    mount(main, detailHtml(suggestion));
    wireSupportButtons(main);
  } catch (error) {
    const notFound = error.status === 404;
    mount(
      main,
      `<div class="state-block ${notFound ? 'state-empty' : 'state-error'}" role="alert">
        ${icon(notFound ? 'search' : 'alert', { size: 36 })}
        <h1>${notFound ? 'Suggestion introuvable' : 'Une erreur est survenue'}</h1>
        <p>${esc(notFound ? 'Cette suggestion n’est pas disponible.' : error.message)}</p>
        <a class="btn btn-primary" href="${href(ROUTES.suggestions)}">${icon('list', { size: 16 })} Revenir à la liste</a>
      </div>`,
    );
  }
}

function detailHtml(suggestion) {
  const meta = [
    { icon: 'user', label: suggestion.isAnonymous ? 'Auteur anonyme' : 'Suggestion d’un élève' },
    { icon: 'calendar', label: formatDate(suggestion.createdAt) },
  ]
    .map((item) => `<span class="meta-item">${icon(item.icon, { size: 15 })} ${esc(item.label)}</span>`)
    .join('');

  const extra = suggestion.extraInfo
    ? `<div class="detail-block"><h2>Informations complémentaires</h2><p>${esc(suggestion.extraInfo)}</p></div>`
    : '';

  const location = suggestion.location
    ? `<div class="detail-block"><h2>${icon('mapPin', { size: 18 })} Lieu concerné</h2><p>${esc(suggestion.location)}</p></div>`
    : '';

  return `${breadcrumbs([
    { label: 'Accueil', href: ROUTES.home },
    { label: 'Suggestions', href: ROUTES.suggestions },
    { label: suggestion.title },
  ])}
  <article class="detail">
    <div class="detail-main">
      <div class="card-top">${statusBadge(suggestion.statusInfo)}${categoryTag(suggestion.categoryInfo, suggestion.category)}</div>
      <h1>${esc(suggestion.title)}</h1>
      <div class="meta-row">${meta}</div>
      <div class="detail-block"><h2>Description</h2><p class="preserve">${esc(suggestion.description)}</p></div>
      ${location}
      ${extra}
    </div>
    <aside class="detail-side">
      <div class="panel">
        <h2>Progression</h2>
        ${progressStepsHtml(suggestion.status)}
        <p class="field-hint">${esc(suggestion.statusInfo?.description ?? '')}</p>
      </div>
      <div class="panel panel-support">
        <span class="support-count">${formatNumber(suggestion.supportCount)}</span>
        <span class="support-label">soutien${pluralize(suggestion.supportCount, '', 's')}</span>
        ${supportButtonHtml(suggestion)}
        <p class="field-hint">Dis que cette idée compte pour toi. Un seul soutien par personne.</p>
      </div>
    </aside>
  </article>`;
}
