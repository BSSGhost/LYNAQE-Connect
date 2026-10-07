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
import { emptyStateHtml } from '../../components/layout.js';
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
      + '<header class="admin-page-heading"><p class="admin-page-eyebrow">LYNAQE de Sédhiou</p><h1>Suggestions</h1><p>Gérez, examinez et mettez à jour les propositions des élèves.</p></header>'
      + filtersHtml(query)
      + '<section class="admin-results-panel" aria-label="Liste des suggestions">'
      + '<div class="admin-skeleton" id="admin-loading" role="status" aria-label="Chargement des suggestions">'
      + '<span></span><span></span><span></span><span></span>'
      + '</div>'
      + '<div id="admin-results"></div>'
      + '</section>',
  );

  wireAdminBar(() => logoutAdmin());
  wireFilters(main, query);
  await load(context);
}

async function load(context) {
  const container = document.getElementById('admin-results');
  const loading = document.getElementById('admin-loading');
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

    loading?.remove();
    if (data.length) {
      container.innerHTML =
        '<p class="result-count">' + formatNumber(meta.total) + ' suggestion' + (meta.total > 1 ? 's' : '') + '</p>' +
        bulkToolbarHtml() +
        '<div class="table-wrap"><table class="data-table">' +
        '<thead><tr><th><label class="admin-select-all-label"><input type="checkbox" data-select-all aria-label="Sélectionner toutes les suggestions de cette page" /><span>Suggestion</span></label></th><th>Catégorie</th><th>Date</th><th>Statut</th><th>Soutiens</th><th>Actions</th></tr></thead>' +
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
    wireBulkActions(container);
    wirePagination(container, query);
  } catch (error) {
    handleAdminError(error);
    loading?.remove();
    container.innerHTML = '<div class="state-block state-error" role="alert"><h2>Erreur lors du chargement</h2><p>' + esc(error.message) + '</p></div>';
  }
}

function rowHtml(suggestion) {
  const statusMeta = getStatusMeta(suggestion.status);
  const tone = statusMeta ? statusMeta.tone : 'neutral';
  const id = suggestion.id;
  const title = suggestion.title || '';
  const trackingCode = suggestion.trackingCode || '';
  const category = suggestion.category || '';
  const createdAt = suggestion.createdAt;
  const supportCount = suggestion.supportCount || 0;
  const hrefUrl = href(ROUTES.adminSuggestions + '/' + id);

  const statusOptions = SUGGESTION_STATUSES.map(
    (status) => '<option value="' + esc(status) + '" ' + (status === suggestion.status ? 'selected' : '') + '>' + esc(status) + '</option>',
  ).join('');

  const visibility = suggestion.visibility || 'privee';
  const isPublic = visibility === 'publique';

  const actionsDelete = '<button type="button" data-delete="' + id + '" data-title="' + esc(title) + '">' + icon('trash', { size: 16 }) + '<span>Supprimer</span></button>';
  const visibilityAction = '<button type="button" class="admin-menu-visibility" data-toggle-visibility="' + id + '" data-visibility="' + visibility + '" aria-label="' + (isPublic ? 'Dépublier cette suggestion' : 'Publier cette suggestion') + '">' + icon(isPublic ? 'eyeOff' : 'eye', { size: 16 }) + '<span>' + (isPublic ? 'Dépublier' : 'Publier') + '</span></button>';
  const cellActions = '<td class="cell-actions"><div class="admin-row-actions">' +
    '<a class="btn btn-outline btn-sm admin-view-action" href="' + hrefUrl + '" aria-label="Voir la suggestion : ' + esc(title) + '">' +
    icon('eye', { size: 16 }) + '<span>Voir</span></a>' +
    '<details class="admin-row-menu"><summary aria-label="Autres actions pour ' + esc(title) + '">' +
    icon('dots', { size: 19 }) + '</summary><div class="admin-row-menu-panel">' +
    visibilityAction + actionsDelete + '</div></details></div></td>';

  const statusControl = '<label class="admin-status-control tone-' + tone + '" data-status-control data-current-status="' + esc(suggestion.status) + '">' +
    '<span class="admin-status-indicator" aria-hidden="true"></span>' +
    '<select data-status-for="' + id + '" aria-label="Modifier le statut de : ' + esc(title) + '">' + statusOptions + '</select>' +
    '</label>';

  return '<tr data-row="' + id + '">' +
    '<td>' +
    '<input class="admin-row-select" type="checkbox" data-row-select value="' + id + '" aria-label="Sélectionner ' + esc(title) + '" />' +
    '<a class="cell-title" href="' + hrefUrl + '">' + esc(title) + '</a>' +
    '<div class="cell-sub">' + esc(trackingCode) + '</div>' +
    '</td>' +
    '<td>' + esc(category) + '</td>' +
    '<td class="cell-date">' + esc(formatDate(createdAt)) + '</td>' +
    '<td class="cell-status">' + statusControl + '</td>' +
    '<td>' + formatNumber(supportCount) + '</td>' +
    cellActions +
    '</tr>';
}

function bulkToolbarHtml() {
  const statusOptions = SUGGESTION_STATUSES.map(
    (status) => '<option value="' + esc(status) + '">' + esc(status) + '</option>',
  ).join('');
  return '<div class="admin-bulk-toolbar" data-bulk-toolbar hidden>' +
    '<strong data-bulk-count>0 sélectionnée</strong>' +
    '<label for="bulk-status">Nouveau statut</label>' +
    '<select id="bulk-status" data-bulk-status>' + statusOptions + '</select>' +
    '<button class="btn btn-outline btn-sm" type="button" data-bulk-action="status">Modifier le statut</button>' +
    '<button class="btn btn-outline btn-sm" type="button" data-bulk-action="publish">Publier</button>' +
    '<button class="btn btn-outline btn-sm danger" type="button" data-bulk-action="archive">Archiver</button>' +
    '</div>';
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
      const previousStatus = select.closest('[data-status-control]')?.getAttribute('data-current-status');
      const statusControl = select.closest('[data-status-control]');
      if (status === previousStatus) return;

      select.disabled = true;
      setStatusControlStatus(statusControl, status);
      statusControl?.classList.add('is-loading');
      statusControl?.setAttribute('aria-busy', 'true');

      try {
        const { data } = await adminApi.changeStatus(id, { status });
        updateRowStatus(container, id, data.suggestion);
        toast('Statut mis à jour : ' + status + '.', 'success');
      } catch (error) {
        select.value = previousStatus;
        setStatusControlStatus(statusControl, previousStatus);
        handleAdminError(error);
      } finally {
        select.disabled = false;
        statusControl?.classList.remove('is-loading');
        statusControl?.removeAttribute('aria-busy');
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

function wireBulkActions(container) {
  const toolbar = container.querySelector('[data-bulk-toolbar]');
  const selectAll = container.querySelector('[data-select-all]');
  const updateSelection = () => {
    const checkboxes = [...container.querySelectorAll('[data-row-select]')];
    const selected = checkboxes.filter((checkbox) => checkbox.checked);
    toolbar.hidden = selected.length === 0;
    toolbar.querySelector('[data-bulk-count]').textContent =
      selected.length + ' sélectionnée' + (selected.length === 1 ? '' : 's');
    toolbar.querySelectorAll('[data-bulk-action]').forEach((button) => {
      button.disabled = selected.length === 0;
    });
    if (selectAll) {
      selectAll.checked = checkboxes.length > 0 && selected.length === checkboxes.length;
      selectAll.indeterminate = selected.length > 0 && selected.length < checkboxes.length;
    }
  };

  container.querySelectorAll('[data-row-select]').forEach((checkbox) => {
    checkbox.addEventListener('change', updateSelection);
  });
  selectAll?.addEventListener('change', () => {
    container.querySelectorAll('[data-row-select]').forEach((checkbox) => {
      checkbox.checked = selectAll.checked;
    });
    updateSelection();
  });
  updateSelection();

  toolbar.querySelectorAll('[data-bulk-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const ids = [...container.querySelectorAll('[data-row-select]:checked')]
        .map((checkbox) => Number(checkbox.value));
      if (!ids.length) return;

      const type = button.getAttribute('data-bulk-action');
      const action = type === 'status'
        ? { type, status: toolbar.querySelector('[data-bulk-status]').value }
        : { type };
      if (type === 'archive') {
        const confirmed = await confirmDialog({
          title: 'Archiver les suggestions',
          message: 'Archiver ' + ids.length + ' suggestion' + (ids.length === 1 ? '' : 's') + ' sélectionnée' + (ids.length === 1 ? '' : 's') + ' ?',
          confirmLabel: 'Archiver',
          danger: true,
        });
        if (!confirmed) return;
      }

      toolbar.querySelectorAll('button, select').forEach((control) => {
        control.disabled = true;
      });
      try {
        const { data } = await adminApi.bulkUpdateSuggestions(ids, action);
        data.items.forEach((suggestion) => updateRowStatus(container, suggestion.id, suggestion));
        container.querySelectorAll('[data-row-select]').forEach((checkbox) => {
          checkbox.checked = false;
        });
        updateSelection();
        toast(data.updated + ' suggestion' + (data.updated === 1 ? '' : 's') + ' mise' + (data.updated === 1 ? '' : 's') + ' à jour.', 'success');
      } catch (error) {
        handleAdminError(error);
      } finally {
        toolbar.querySelectorAll('button, select').forEach((control) => {
          control.disabled = false;
        });
        updateSelection();
      }
    });
  });
}

function updateRowStatus(container, id, suggestion) {
  const row = container.querySelector('[data-row="' + id + '"]');
  if (!row || !suggestion) return;

  const statusControl = row.querySelector('[data-status-control]');
  setStatusControlStatus(statusControl, suggestion.status);

  const toggle = row.querySelector('[data-toggle-visibility]');
  if (toggle) {
    const isPublic = suggestion.visibility === 'publique';
    toggle.setAttribute('data-visibility', suggestion.visibility);
    toggle.setAttribute('aria-label', isPublic ? 'Dépublier cette suggestion' : 'Publier cette suggestion');
    toggle.innerHTML = icon(isPublic ? 'eyeOff' : 'eye', { size: 16 }) + '<span>' + (isPublic ? 'Dépublier' : 'Publier') + '</span>';
  }
}

function setStatusControlStatus(control, status) {
  if (!control || !status) return;
  const select = control.querySelector('[data-status-for]');
  if (!select) return;

  const statusMeta = getStatusMeta(status);
  const tone = statusMeta ? statusMeta.tone : 'neutral';
  control.className = 'admin-status-control tone-' + tone;
  control.setAttribute('data-current-status', status);
  select.value = status;
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