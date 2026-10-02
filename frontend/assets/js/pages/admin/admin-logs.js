/**
 * Administration — journal de modération (historique des actions).
 * Interface moderne et professionnelle.
 */

import { MODERATION_ACTIONS, ROUTES } from '../../../../../shared/constants.js';
import { mount, esc } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { icon } from '../../core/icons.js';
import { adminApi } from '../../core/api.js';
import { formatNumber } from '../../core/format.js';
import { loadingHtml } from '../../components/layout.js';
import { moderationLogHtml } from '../../components/suggestions.js';
import { paginationHtml } from '../../components/pagination.js';
import { guardAdmin, handleAdminError, adminNavHtml, sidebarHtml, wireAdminBar } from './admin-shell.js';
import { logoutAdmin } from './admin-logout.js';

const ACTION_LABELS = {
  creation: 'Création',
  publication: 'Publication',
  depublication: 'Dépublication',
  modification: 'Modification',
  statut: 'Changement de statut',
  rejet: 'Rejet',
  archivage: 'Archivage',
  suppression: 'Suppression',
  consultation: 'Consultation',
};

export async function render(context) {
  if (!guardAdmin()) return;
  const main = document.getElementById('main');
  const query = normalizedQuery(context.query);

  // Sidebar + header + content
  mount(
    main,
    `${sidebarHtml(ROUTES.adminLogs)}${adminNavHtml(ROUTES.adminLogs)}${filtersHtml(query)}${loadingHtml()}<div id="logs-results"></div>`,
  );
  wireAdminBar(() => logoutAdmin());
  wireFilters(main, query);
  await load(context);
}

async function load(context) {
  const container = document.getElementById('logs-results');
  const query = normalizedQuery(context.query);
  try {
    const { data, meta } = await adminApi.logs({
      page: query.page,
      limit: 30,
      action: query.action || undefined,
      suggestionId: query.suggestionId || undefined,
    });

    container.innerHTML = data.length
      ? `<p class="result-count">${formatNumber(meta.total)} entrée${meta.total > 1 ? 's' : ''}</p>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Action</th><th>Suggestion</th><th>Nouveau statut</th><th>Acteur</th><th>Date</th></tr></thead>
            <tbody>${data.map(moderationLogHtml).join('')}</tbody>
          </table></div>
          ${paginationHtml(meta)}
      : `<div class="state-block state-empty">${icon('journal', { size: 36 })}<h2>Aucune entrée</h2><p>Le journal est vide pour ces critères.</p></div>`;

    wirePagination(container, query);
  } catch (error) {
    handleAdminError(error);
    container.innerHTML = `<div class="state-block state-error" role="alert">${icon('alert', { size: 32 })}<h2>Erreur</h2><p>${esc(error.message)}</p></div>`;
  }
}

function filtersHtml(query) {
  const actions = MODERATION_ACTIONS.map(
    (action) => `<option value="${esc(action)}">${esc(ACTION_LABELS[action] ?? action)}</option>`,
  ).join('');

  return `<form class="filter-bar container" id="logs-filter-bar">
    <div class="field search-field">
      <span class="search-icon">${icon('search', { size: 16 })}</span>
      <input name="suggestionId" type="search" placeholder="Filtrer par n° de suggestion…" value="${esc(query.suggestionId)}" inputmode="numeric" />
    </div>
    <div class="field"><select name="action"><option value="">Toutes les actions</option>${actions}</select></div>
    <button class="btn btn-outline" type="submit">${icon('filter', { size: 16 })} Filtrer</button>
  </form>`;
}

function wirePagination(container, query) {
  container.querySelectorAll('.pagination [data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      navigate(buildHash({ ...query, page: Number(button.getAttribute('data-page')) }));
    });
  });
}

function normalizedQuery(raw = {}) {
  return {
    page: Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1),
    action: MODERATION_ACTIONS.includes(raw.action) ? raw.action : '',
    suggestionId: raw.suggestionId ?? '',
  };
}

function buildHash(query) {
  const params = new URLSearchParams();
  if (query.page > 1) params.set('page', String(query.page));
  if (query.action) params.set('action', query.action);
  if (query.suggestionId) params.set('suggestionId', query.suggestionId);
  const search = params.toString();
  return `${ROUTES.adminLogs}${search ? `?${search}` : ''}`;
}