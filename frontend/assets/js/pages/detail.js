/**
 * Page détail d'une suggestion publiée (lecture seule, soutien possible).
 */

import { ROUTES, REPORT_REASONS } from '../../../../shared/constants.js';
import { mount, esc } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { suggestionsApi } from '../core/api.js';
import { formatDate, formatNumber, pluralize } from '../core/format.js';
import { toast, copyText } from '../core/ui.js';
import { breadcrumbs, loadingHtml } from '../components/layout.js';
import { statusBadge, categoryTag, progressStepsHtml, completionPlanHtml, supportButtonHtml } from '../components/suggestions.js';
import { wireSupportButtons } from '../components/support.js';

export async function render(context) {
  const main = document.getElementById('main');
  mount(main, loadingHtml('Chargement de la suggestion…'));

  try {
    const { data: suggestion } = await suggestionsApi.detail(context.params.id);
    mount(main, detailHtml(suggestion));
    wireSupportButtons(main);
    wirePublicActions(main, suggestion);
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
        ${completionPlanHtml(suggestion)}
      </div>
      <div class="panel panel-support">
        <span class="support-count">${formatNumber(suggestion.supportCount)}</span>
        <span class="support-label">soutien${pluralize(suggestion.supportCount, '', 's')}</span>
        ${supportButtonHtml(suggestion)}
        <p class="field-hint">Dis que cette idée compte pour toi. Un seul soutien par personne.</p>
        <div class="suggestion-public-actions">
          <button class="btn btn-outline btn-sm" type="button" data-share-suggestion>${icon('share', { size: 16 })} Partager</button>
          <button class="btn btn-ghost btn-sm" type="button" data-toggle-report aria-expanded="false" aria-controls="suggestion-report-form">${icon('alert', { size: 16 })} Signaler</button>
        </div>
        <form class="suggestion-report-form" id="suggestion-report-form" hidden>
          <label for="report-reason">Pourquoi signales-tu cette suggestion ?</label>
          <select id="report-reason" name="reason" required>
            <option value="">Choisir un motif…</option>
            ${REPORT_REASONS.map((reason) => `<option value="${esc(reason)}">${esc(reason)}</option>`).join('')}
          </select>
          <button class="btn btn-outline btn-sm" type="submit">Envoyer le signalement</button>
          <p class="field-hint">Un seul signalement par appareil. Aucun nom n’est demandé.</p>
        </form>
      </div>
    </aside>
  </article>`;
}

function wirePublicActions(main, suggestion) {
  const share = main.querySelector('[data-share-suggestion]');
  share?.addEventListener('click', async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: suggestion.title, url });
      } else if (await copyText(url)) {
        toast('Lien copié dans le presse-papiers.', 'success');
      } else {
        throw new Error('Impossible de partager le lien depuis ce navigateur.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') toast(error.message, 'error');
    }
  });

  const toggle = main.querySelector('[data-toggle-report]');
  const form = main.querySelector('#suggestion-report-form');
  toggle?.addEventListener('click', () => {
    form.hidden = !form.hidden;
    toggle.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) form.querySelector('select')?.focus();
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const { data } = await suggestionsApi.report(suggestion.id, form.querySelector('[name="reason"]').value);
      toast(
        data.alreadyReported
          ? 'Un signalement a déjà été envoyé depuis cet appareil pour cette suggestion.'
          : 'Merci. Ton signalement a été transmis à l’administration.',
        data.alreadyReported ? 'info' : 'success',
      );
      form.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });
}
