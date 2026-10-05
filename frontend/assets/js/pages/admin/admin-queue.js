/**
 * File de modération : uniquement les trois statuts à traiter.
 */

import { ROUTES, MODERATION_QUEUE_STATUSES } from '../../../../../shared/constants.js';
import { mount, esc } from '../../core/dom.js';
import { href, navigate } from '../../core/router.js';
import { icon } from '../../core/icons.js';
import { adminApi } from '../../core/api.js';
import { formatDateTime, formatNumber } from '../../core/format.js';
import { emptyStateHtml, loadingHtml } from '../../components/layout.js';
import { paginationHtml } from '../../components/pagination.js';
import { statusBadge } from '../../components/suggestions.js';
import { guardAdmin, handleAdminError, adminNavHtml, sidebarHtml, wireAdminBar } from './admin-shell.js';
import { logoutAdmin } from './admin-logout.js';

const QUEUE_STATUSES = [
  { value: MODERATION_QUEUE_STATUSES[0], label: 'Suggestions à examiner', tone: 'pending', icon: 'clock' },
  { value: MODERATION_QUEUE_STATUSES[1], label: 'Suggestions reçues', tone: 'received', icon: 'inbox' },
  { value: MODERATION_QUEUE_STATUSES[2], label: 'Suggestions à l’étude', tone: 'review', icon: 'search' },
];

export async function render(context) {
  if (!guardAdmin()) return;
  const main = document.getElementById('main');
  const page = Number.parseInt(context.query.page ?? '1', 10) || 1;
  mount(
    main,
    `${sidebarHtml(ROUTES.adminQueue)}${adminNavHtml(ROUTES.adminQueue)}
      <div class="container admin-queue">
        <header class="admin-page-heading">
          <p class="admin-page-eyebrow">LYNAQE de Sédhiou</p>
          <h1>À traiter</h1>
          <p>Les suggestions qui attendent une première réponse de l’administration.</p>
        </header>
        <div id="queue-counts" class="queue-count-grid" aria-label="Suggestions par étape"></div>
        <section class="admin-results-panel" aria-label="Suggestions à traiter">
          <div id="queue-loading">${loadingHtml('Chargement de la file de modération…')}</div>
          <div id="queue-results"></div>
        </section>
      </div>`,
  );
  wireAdminBar(() => logoutAdmin());

  try {
    const { data, meta } = await adminApi.queue({ page, limit: 30 });
    document.getElementById('queue-loading')?.remove();
    const counts = document.getElementById('queue-counts');
    const results = document.getElementById('queue-results');
    if (!counts?.isConnected || !results?.isConnected) return;
    counts.innerHTML = QUEUE_STATUSES.map((status) => `
      <article class="queue-count-card tone-${status.tone}">
        <span class="queue-count-icon" aria-hidden="true">${icon(status.icon, { size: 20 })}</span>
        <strong>${formatNumber(data.counts[status.value] ?? 0)}</strong>
        <span>${esc(status.label)}</span>
      </article>`).join('');

    results.innerHTML = data.items.length
      ? `<p class="result-count">${formatNumber(meta.total)} suggestion${meta.total === 1 ? '' : 's'} à traiter</p>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Suggestion</th><th>Statut</th><th>Reçue le</th><th>Signalements</th><th></th></tr></thead>
          <tbody>${data.items.map((item) => {
            const url = href(`${ROUTES.adminSuggestions}/${item.id}`);
            return `<tr>
              <td><a class="cell-title" href="${url}">${esc(item.title)}</a>
                <div class="cell-sub">${esc(item.category)} · ${esc(item.trackingCode)}</div></td>
              <td>${statusBadge(item.statusInfo)}</td>
              <td>${esc(formatDateTime(item.createdAt))}</td>
              <td>${formatNumber(item.reportCount ?? 0)}</td>
              <td><a class="btn btn-outline btn-sm" href="${url}">${icon('eye', { size: 15 })} Examiner</a></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>${paginationHtml(meta)}`
      : emptyStateHtml({
          title: 'La file est à jour',
          message: 'Aucune suggestion n’attend de traitement pour le moment.',
          ctaHref: '',
        });

    results.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        navigate(`${ROUTES.adminQueue}?page=${button.dataset.page}`);
      });
    });
  } catch (error) {
    handleAdminError(error);
    document.getElementById('queue-loading')?.remove();
    const results = document.getElementById('queue-results');
    if (results?.isConnected) {
      results.innerHTML = `<div class="state-block state-error" role="alert"><h2>Erreur lors du chargement</h2><p>${esc(error.message)}</p></div>`;
    }
  }
}
