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

const QUICK_ACTIONS = [
  { status: 'Reçue', label: 'Recevoir' },
  { status: 'À l’étude', label: 'Étudier' },
  { status: 'En cours', label: 'En cours' },
  { status: 'Réalisée', label: 'Réalisée' },
  { status: 'Non retenue', label: 'Rejeter' },
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
        '<thead><tr><th>Suggestion <input type="checkbox" data-select-all aria-label="Sélectionner toutes les suggestions de cette page" /></th><th>Catégorie</th><th>Date</th><th>Statut</th><th>Soutiens</th><th>Actions</th></tr></thead>' +
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
  const statusValue = statusMeta ? statusMeta.value : suggestion.status;
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

  const actionsSelect = '<label class="admin-menu-field">Changer le statut<select class="status-select" data-status-for="' + id + '" aria-label="Changer le statut">' + statusOptions + '</select></label>';
  const actionsView = '<a href="' + hrefUrl + '">' + icon('eye', { size: 16 }) + '<span>Voir la suggestion</span></a>';
  const actionsDelete = '<button type="button" data-delete="' + id + '" data-title="' + esc(title) + '">' + icon('trash', { size: 16 }) + '<span>Supprimer</span></button>';
  const visibilityAction = '<button type="button" class="admin-menu-visibility" data-toggle-visibility="' + id + '" data-visibility="' + visibility + '" aria-label="' + (isPublic ? 'Dépublier cette suggestion' : 'Publier cette suggestion') + '">' + icon(isPublic ? 'eyeOff' : 'eye', { size: 16 }) + '<span>' + (isPublic ? 'Dépublier' : 'Publier') + '</span></button>';
  const quickActions = '<div class="admin-quick-menu"><span class="admin-quick-menu-title">Actions rapides</span><div>' + QUICK_ACTIONS.map((action) =>
    '<button class="btn btn-outline btn-sm" type="button" data-quick-status="' + esc(action.status) + '" data-quick-for="' + id + '"' +
      (action.status === suggestion.status ? ' disabled' : '') + '>' + esc(action.label) + '</button>',
  ).join('') + '</div></div>';
  const cellActions = '<td class="cell-actions"><details class="admin-row-menu"><summary aria-label="Actions pour ' + esc(title) + '">' + icon('dots', { size: 19 }) + '</summary><div class="admin-row-menu-panel">' + actionsView + quickActions + actionsSelect + visibilityAction + actionsDelete + '</div></details></td>';

  return '<tr data-row="' + id + '">' +
    '<td>' +
    '<input class="admin-row-select" type="checkbox" data-row-select value="' + id + '" aria-label="Sélectionner ' + esc(title) + '" />' +
    '<a class="cell-title" href="' + hrefUrl + '">' + esc(title) + '</a>' +
    '<div class="cell-sub">' + esc(trackingCode) + '</div>' +
    '</td>' +
    '<td>' + esc(category) + '</td>' +
    '<td class="cell-date">' + esc(formatDate(createdAt)) + '</td>' +
    '<td class="cell-status"><span class="badge tone-' + tone + '"><span class="dot"></span>' + esc(statusValue) + '</span></td>' +
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
  container.querySelectorAll('[data-quick-for]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-quick-for');
      const status = button.getAttribute('data-quick-status');
      button.disabled = true;
      try {
        const { data } = await adminApi.changeStatus(id, { status });
        updateRowStatus(container, id, data.suggestion);
        button.closest('.admin-row-menu')?.removeAttribute('open');
        toast('Statut mis à jour : ' + status + '.', 'success');
      } catch (error) {
        handleAdminError(error);
        button.disabled = false;
      }
    });
  });

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
    toggle.setAttribute('aria-label', isPublic ? 'Dépublier cette suggestion' : 'Publier cette suggestion');
    toggle.innerHTML = icon(isPublic ? 'eyeOff' : 'eye', { size: 16 }) + '<span>' + (isPublic ? 'Dépublier' : 'Publier') + '</span>';
  }

  const select = row.querySelector('[data-status-for]');
  if (select) select.value = suggestion.status;
  row.querySelectorAll('[data-quick-status]').forEach((button) => {
    button.disabled = button.getAttribute('data-quick-status') === suggestion.status;
  });
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