/**
 * Administration — liste et modération rapide des suggestions.
 * Interface moderne et professionnelle.
 */

import {
  SUGGESTION_STATUSES,
  CATEGORY_META,
  ROUTES,
  LIMITS,
} from '../../../../../shared/constants.js';
import { mount, esc } from '../../core/dom.js';
import { href, navigate } from '../../core/router.js';
import { icon } from '../../core/icons.js';
import { adminApi } from '../../core/api.js';
import { formatDate, formatNumber } from '../../core/format.js';
import { toast, confirmDialog } from '../../core/ui.js';
import { loadingHtml, emptyStateHtml } from '../../components/layout.js';
import { statusBadge } from '../../components/suggestions.js';
import { paginationHtml } from '../../components/pagination.js';
import { guardAdmin, handleAdminError, adminNavHtml, sidebarHtml, wireAdminBar } from './admin-shell.js';
import { logoutAdmin } from './admin-logout.js';

const SORTS = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'oldest', label: 'Plus anciennes' },
  { value: 'supported', label: 'Plus soutenues' },
  { value: 'updated', label: 'Mises à jour' },
  { value: 'status', label: 'Par statut' },
];

export async function render(context) {
  if (!guardAdmin()) return;
  const main = document.getElementById('main');
  const query = normalizedQuery(context.query);

  // Sidebar + header + content
  mount(
    main,
    `${sidebarHtml(ROUTES.adminSuggestions)}${adminNavHtml(ROUTES.adminSuggestions)}${filtersHtml(query)}${loadingHtml()}<div id="admin-results"></div>`,
  );
  wireAdminBar(() => logoutAdmin());
  wireFilters(main, query);
  await load(context);
}

async function load(context) {
  const container = document.getElementById('admin-results');
  const query = normalizedQuery(context.query);
  try {
    const { data, meta } = await adminApi.suggestions({
      page: query.page,
      limit: 20,
      category: query.category || undefined,
      status: query.status || undefined,
      visibility: query.visibility || undefined,
      search: query.search || undefined,
      sort: query.sort || undefined,
    });

    container.innerHTML = data.length
      ? `<p class="result-count">${formatNumber(meta.total)} suggestion${meta.total > 1 ? 's' : ''}</p>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Suggestion</th><th>Catégorie</th><th>Date</th><th>Statut</th><th>Soutiens</th><th>Actions</th></tr></thead>
            <tbody>${data.map(rowHtml).join('')}</tbody>
          </table></div>
          ${paginationHtml(meta)}
      : emptyStateHtml({ message: 'Aucune suggestion ne correspond à ces filtres.', title: 'Aucun résultat', ctaHref: '' });

    wireRows(container, query);
    wirePagination(container, query);
  } catch (error) {
    handleAdminError(error);
    container.innerHTML = `<div class="state-block state-error" role="alert">${icon('alert', { size: 32 })}<h2>Erreur</h2><p>${esc(error.message)}</p></div>`;
  }
}

function rowHtml(suggestion) {
  const statusMeta = getStatusMeta(suggestion.status);
  return `<tr data-row="${suggestion.id}">
    <td>
      <div class="cell-title-wrapper">
        <a class="cell-title" href="${href(`${ROUTES.adminSuggestions}/${suggestion.id}`)}">${esc(suggestion.title)}</a>
        <div class="cell-sub">${esc(suggestion.trackingCode ?? '')} · ${esc(suggestion.category)}</div>
      </div>
    </td>
    <td>
      <span class="category-tag">${categoryTagInfo(suggestion.category)}</span>
    </td>
    <td class="cell-date">${esc(formatDate(suggestion.createdAt))}</td>
    <td class="cell-status">
      <span class="badge tone-${statusMeta?.tone ?? 'neutral'}"><span class="dot"></span>${esc(suggestion.status)}</span>
    </td>
    <td>${formatNumber(suggestion.supportCount)}</td>
    <td class="cell-actions">
      <select class="status-select" data-status-for="${suggestion.id}" aria-label="Changer le statut">
        ${SUGGESTION_STATUSES.map(
          (s) => `<option value="${esc(s)}" ${s === suggestion.status ? 'selected' : ''}>${esc(s)}</option>`,
        ).join('')}
      </select>
      <a class="btn btn-icon btn-ghost" href="${href(`${ROUTES.adminSuggestions}/${suggestion.id}`)}" aria-label="Ouvrir le détail">${icon('eye', { size: 16 })}</a>
      <button class="btn btn-icon btn-ghost danger" type="button" data-delete="${suggestion.id}" data-title="${esc(suggestion.title)}" aria-label="Supprimer">${icon('trash', { size: 16 })}</button>
    </td>
  </tr>`;
}

function categoryTagInfo(categoryValue) {
  const meta = CATEGORY_BY_VALUE[categoryValue];
  if (!meta) return categoryValue;
  return `<span class="tag"><span class="dot"></span>${esc(meta.value)}</span>`;
}

function getStatusMeta(value) {
  return STATUS_BY_VALUE[value] ?? null;
}

function wireRows(container, query) {
  container.querySelectorAll('[data-status-for]').forEach((select) => {
    select.addEventListener('change', async () => {
      const id = select.getAttribute('data-status-for');
      const status = select.value;
      select.disabled = true;
      try {
        const { data } = await adminApi.changeStatus(id, { status });
        updateRowStatus(container, id, data.suggestion);
        toast(`Statut mis à jour : ${status}.`, 'success');
      } catch (error) {
        handleAdminError(error);
      } finally {
        select.disabled = false;
      }
    });
  });

  container.querySelectorAll('[data-toggle-visibility]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-toggle-visibility');
      const current = button.getAttribute('data-visibility');
      const next = current === 'publique' ? 'privee' : 'publique';
      button.disabled = true;
      try {
        const { data } = await adminApi.moderation(id, { visibility: next });
        updateRowStatus(container, id, data.suggestion);
        toast(next === 'publique' ? 'Suggestion publiée.' : 'Suggestion retirée du public.', 'success');
      } catch (error) {
        handleAdminError(error);
      } finally {
        button.disabled = false;
      }
    });
  });

  container.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-delete');
      const title = button.getAttribute('data-title');
      const ok = await confirmDialog({
        title: 'Supprimer la suggestion',
        message: `Supprimer définitivement « ${title} » ? Cette action est irréversible.`,
        confirmLabel: 'Supprimer',
        danger: true,
      });
      if (!ok) return;
      try {
        await adminApi.remove(id);
        container.querySelector(`[data-row="${id}"]`)?.remove();
        toast('Suggestion supprimée.', 'success');
      } catch (error) {
        handleAdminError(error);
      }
    });
  });
}

function updateRowStatus(container, id, suggestion) {
  const row = container.querySelector(`[data-row="${id}"]`);
  if (!row || !suggestion) return;
  const statusMeta = getStatusMeta(suggestion.status);
  row.querySelector('.cell-status').innerHTML = `<span class="badge tone-${statusMeta?.tone ?? 'neutral'}"><span class="dot"></span>${esc(suggestion.statusInfo?.value ?? suggestion.status)}</span>`;
  const toggle = row.querySelector('[data-toggle-visibility]');
  if (toggle) {
    const isPublic = suggestion.visibility === 'publique';
    toggle.setAttribute('data-visibility', suggestion.visibility);
    toggle.className = `pill ${isPublic ? 'pill-public' : 'pill-private'}`;
    toggle.innerHTML = `${icon(isPublic ? 'eye' : 'eyeOff', { size: 14 })} ${isPublic ? 'Publiée' : 'Non publiée'}`;
  }
  const select = row.querySelector('[data-status-for]');
  if (select) select.value = suggestion.status;
}

function wirePagination(container, query) {
  container.querySelectorAll('.pagination [data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      navigate(buildHash({ ...query, page: Number(button.getAttribute('data-page')) }));
    });
  });
}

function filtersHtml(query) {
  const categoryOptions = CATEGORY_META.map((c) => `<option value="${esc(c.value)}">${esc(c.value)}</option>`).join('');
  const statusOptions = SUGGESTION_STATUSES.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  const sortOptions = SORTS.map((s) => `<option value="${esc(s.value)}">${esc(s.label)}</option>`).join('');

  return `<form class="filter-bar container" id="admin-filter-bar">
    <div class="field search-field">
      <span class="search-icon">${icon('search', { size: 16 })}</span>
      <input name="search" type="search" placeholder="Rechercher par titre…" maxlength="${LIMITS.titleMax}" value="${esc(query.search)}" />
    </div>
    <div class="field"><select name="category"><option value="">Toutes catégories</option>${categoryOptions}</select></div>
    <div class="field"><select name="status"><option value="">Tous statuts</option>${statusOptions}</select></div>
    <div class="field"><select name="visibility"><option value="">Toutes visibilités</option><option value="publique">Publiée</option><option value="privee">Non publiée</option></select></div>
    <div class="field"><select name="sort">${sortOptions}</select></div>
    <button class="btn btn-outline" type="submit">${icon('filter', { size: 16 })} Filtrer</button>
  </form>`;
}

function normalizedQuery(raw = {}) {
  return {
    page: Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1),
    category: raw.category ?? '',
    status: raw.status ?? '',
    visibility: raw.visibility ?? '',
    search: raw.search ?? '',
    sort: SORTS.some((s) => s.value === raw.sort) ? raw.sort : 'recent',
  };
}

function buildHash(query) {
  const params = new URLSearchParams();
  if (query.page > 1) params.set('page', String(query.page));
  if (query.category) params.set('category', query.category);
  if (query.status) params.set('status', query.status);
  if (query.visibility) params.set('visibility', query.visibility);
  if (query.search) params.set('search', query.search);
  if (query.sort && query.sort !== 'recent') params.set('sort', query.sort);
  const search = params.toString();
  return `${ROUTES.adminSuggestions}${search ? `?${search}` : ''}`;
}