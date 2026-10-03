/**
 * Administration — liste et modération rapide des suggestions.
 * Interface moderne et professionnelle.
 */

import {
  SUGGESTION_STATUSES,
  CATEGORY_META,
  CATEGORY_BY_VALUE,
  STATUS_BY_VALUE,
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

  mount(
    main,
    sidebarHtml(ROUTES.adminSuggestions)
      + adminNavHtml(ROUTES.adminSuggestions)
      + filtersHtml(query)
      + loadingHtml()
      + '<div id="admin-results"></div>',
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

    if (data.length) {
      container.innerHTML =
        '<p class="result-count">' + formatNumber(meta.total) + ' suggestion' + (meta.total > 1 ? 's' : '') + '</p>' +
        '<div class="table-wrap"><table class="data-table">' +
        '<thead><tr><th>Suggestion</th><th>Catégorie</th><th>Date</th><th>Statut</th><th>Soutiens</th><th>Actions</th></tr></thead>' +
        '<tbody>' + data.map(rowHtml).join('') + '</tbody>' +
        '</table></div>' +
        paginationHtml(meta);
    } else {
      container.innerHTML = emptyStateHtml({
        message: 'Aucune suggestion ne correspond à ces filtres.',
        title: 'Aucun résultat',
        ctaHref: '',
      });
    }

    wireRows(container);
    wirePagination(container, query);
  } catch (error) {
    container.innerHTML = '<div class="state-block state-error">Erreur lors du chargement</div>';
  }
}

function rowHtml(suggestion) {
  const statusMeta = getStatusMeta(suggestion.status);
  const tone = statusMeta ? statusMeta.tone : 'neutral';
  const statusValue = statusMeta ? statusMeta.value : suggestion.status;
  const id = suggestion.id;
  const title = suggestion.title || '';
  const trackingCode = suggestion.trackingCode || '';
  const category = suggestion.category || '';
  const createdAt = suggestion.createdAt;
  const supportCount = suggestion.supportCount || 0;
  const hrefUrl = '/' + ROUTES.adminSuggestions + '/' + id;

  const statusOptions = SUGGESTION_STATUSES.map(
    (status) => '<option value="' + esc(status) + '" ' + (status === suggestion.status ? 'selected' : '') + '>' + esc(status) + '</option>',
  ).join('');

  const visibility = suggestion.visibility || 'privee';
  const isPublic = visibility === 'publique';
  const visibilityHtml =
    '<button type="button" class="pill ' + (isPublic ? 'pill-public' : 'pill-private') + '" data-toggle-visibility="' + id + '" data-visibility="' + visibility + '" aria-label="' + (isPublic ? 'Retirer du public' : 'Publier') + '">' +
    icon(isPublic ? 'eye' : 'eyeOff', { size: 14 }) + ' ' + (isPublic ? 'Publiée' : 'Non publiée') +
    '</button>';

  const actionsSelect = '<select class="status-select" data-status-for="' + id + '" aria-label="Changer le statut">' + statusOptions + '</select>';
  const actionsView = '<a class="btn btn-icon btn-ghost" href="' + hrefUrl + '" aria-label="Ouvrir le détail">' + icon('eye', { size: 16 }) + '</a>';
  const actionsDelete = '<button class="btn btn-icon btn-ghost danger" type="button" data-delete="' + id + '" data-title="' + esc(title) + '" aria-label="Supprimer">' + icon('trash', { size: 16 }) + '</button>';
  const cellActions = '<td class="cell-actions">' + actionsSelect + visibilityHtml + actionsView + actionsDelete + '</td>';

  return '<tr data-row="' + id + '">' +
    '<td>' +
    '<a class="cell-title" href="' + hrefUrl + '">' + esc(title) + '</a>' +
    '<div class="cell-sub">' + esc(trackingCode) + ' · ' + esc(category) + '</div>' +
    '</td>' +
    '<td>' + esc(category) + '</td>' +
    '<td class="cell-date">' + esc(formatDate(createdAt)) + '</td>' +
    '<td class="cell-status"><span class="badge tone-' + tone + '"><span class="dot"></span>' + esc(statusValue) + '</span></td>' +
    '<td>' + formatNumber(supportCount) + '</td>' +
    cellActions +
    '</tr>';
}

function categoryTagInfo(categoryValue) {
  const meta = CATEGORY_BY_VALUE[categoryValue];
  if (!meta) return categoryValue;
  return '<span class="tag"><span class="dot"></span>' + esc(meta.value) + '</span>';
}

function getStatusMeta(value) {
  return STATUS_BY_VALUE[value] ?? null;
}

function wireFilters(main, query) {
  const form = main.querySelector('#admin-filter-bar');
  if (!form) return;

  const searchInput = form.querySelector('[name="search"]');
  const categoryInput = form.querySelector('[name="category"]');
  const statusInput = form.querySelector('[name="status"]');
  const visibilityInput = form.querySelector('[name="visibility"]');
  const sortInput = form.querySelector('[name="sort"]');

  if (searchInput) searchInput.value = query.search;
  if (categoryInput) categoryInput.value = query.category;
  if (statusInput) statusInput.value = query.status;
  if (visibilityInput) visibilityInput.value = query.visibility;
  if (sortInput) sortInput.value = query.sort;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    navigate(
      buildHash({
        page: 1,
        search: String(data.get('search') ?? '').trim(),
        category: String(data.get('category') ?? ''),
        status: String(data.get('status') ?? ''),
        visibility: String(data.get('visibility') ?? ''),
        sort: String(data.get('sort') ?? 'recent'),
      }),
    );
  });

  form.querySelectorAll('select').forEach((select) => {
    select.addEventListener('change', () => form.requestSubmit());
  });
}

function wireRows(container) {
  container.querySelectorAll('[data-status-for]').forEach((select) => {
    select.addEventListener('change', async () => {
      const id = select.getAttribute('data-status-for');
      const status = select.value;
      select.disabled = true;

      try {
        const { data } = await adminApi.changeStatus(id, { status });
        updateRowStatus(container, id, data.suggestion);
        toast('Statut mis à jour : ' + status + '.', 'success');
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
        const { data } = await adminApi.moderate(id, { visibility: next });
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
        message: 'Supprimer définitivement « ' + title + ' » ? Cette action est irréversible.',
        confirmLabel: 'Supprimer',
        danger: true,
      });

      if (!ok) return;

      try {
        await adminApi.remove(id);
        const row = container.querySelector('[data-row="' + id + '"]');
        if (row) row.remove();
        toast('Suggestion supprimée.', 'success');
      } catch (error) {
        handleAdminError(error);
      }
    });
  });
}

function updateRowStatus(container, id, suggestion) {
  const row = container.querySelector('[data-row="' + id + '"]');
  if (!row || !suggestion) return;

  const statusMeta = getStatusMeta(suggestion.status);
  const tone = statusMeta ? statusMeta.tone : 'neutral';
  const label = suggestion.statusInfo && suggestion.statusInfo.value ? suggestion.statusInfo.value : suggestion.status;

  const statusEl = row.querySelector('.cell-status');
  if (statusEl) {
    statusEl.innerHTML = '<span class="badge tone-' + tone + '"><span class="dot"></span>' + esc(label) + '</span>';
  }

  const toggle = row.querySelector('[data-toggle-visibility]');
  if (toggle) {
    const isPublic = suggestion.visibility === 'publique';
    toggle.setAttribute('data-visibility', suggestion.visibility);
    toggle.className = 'pill ' + (isPublic ? 'pill-public' : 'pill-private');
    toggle.innerHTML = icon(isPublic ? 'eye' : 'eyeOff', { size: 14 }) + ' ' + (isPublic ? 'Publiée' : 'Non publiée');
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
  const categoryOptions = CATEGORY_META.map(
    (category) => '<option value="' + esc(category.value) + '">' + esc(category.value) + '</option>',
  ).join('');
  const statusOptions = SUGGESTION_STATUSES.map(
    (status) => '<option value="' + esc(status) + '">' + esc(status) + '</option>',
  ).join('');
  const sortOptions = SORTS.map(
    (sort) => '<option value="' + esc(sort.value) + '">' + esc(sort.label) + '</option>',
  ).join('');

  return '<form class="filter-bar container" id="admin-filter-bar">' +
    '<div class="field search-field">' +
    '<span class="search-icon">' + icon('search', { size: 16 }) + '</span>' +
    '<input name="search" type="search" placeholder="Rechercher par titre…" maxlength="' + LIMITS.titleMax + '" value="' + esc(query.search) + '" />' +
    '</div>' +
    '<div class="field"><select name="category"><option value="">Toutes catégories</option>' + categoryOptions + '</select></div>' +
    '<div class="field"><select name="status"><option value="">Tous statuts</option>' + statusOptions + '</select></div>' +
    '<div class="field"><select name="visibility"><option value="">Toutes visibilités</option><option value="publique">Publiée</option><option value="privee">Non publiée</option></select></div>' +
    '<div class="field"><select name="sort">' + sortOptions + '</select></div>' +
    '<button class="btn btn-outline" type="submit">' + icon('filter', { size: 16 }) + ' Filtrer</button>' +
    '</form>';
}

function normalizedQuery(raw = {}) {
  return {
    page: Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1),
    category: raw.category ?? '',
    status: raw.status ?? '',
    visibility: raw.visibility ?? '',
    search: raw.search ?? '',
    sort: SORTS.some((sort) => sort.value === raw.sort) ? raw.sort : 'recent',
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
  return ROUTES.adminSuggestions + (search ? '?' + search : '');
}