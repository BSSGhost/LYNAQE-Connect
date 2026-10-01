/**
 * Page « Suggestions » : liste publique filtrable et paginée.
 */

import { CATEGORY_META, SUGGESTION_STATUSES, LIMITS, ROUTES } from '../../../../shared/constants.js';
import { mount, esc } from '../core/dom.js';
import { href, navigate } from '../core/router.js';
import { icon } from '../core/icons.js';
import { suggestionsApi } from '../core/api.js';
import { formatNumber } from '../core/format.js';
import { toast } from '../core/ui.js';
import { pageHeader, breadcrumbs, loadingHtml, emptyStateHtml } from '../components/layout.js';
import { suggestionListHtml } from '../components/suggestions.js';
import { paginationHtml } from '../components/pagination.js';
import { wireSupportButtons } from '../components/support.js';

const SORTS = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'supported', label: 'Plus soutenues' },
  { value: 'updated', label: 'Récemment mises à jour' },
  { value: 'oldest', label: 'Plus anciennes' },
];

export async function render(context) {
  const main = document.getElementById('main');
  const query = normalizedQuery(context.query);

  mount(main, `${headerHtml()}${loadingHtml()}`);

  wireFilterBar(main, query);

  try {
    const { data, meta } = await suggestionsApi.list({
      page: query.page,
      limit: LIMITS.pageSizeDefault,
      category: query.category || undefined,
      status: query.status || undefined,
      search: query.search || undefined,
      sort: query.sort || undefined,
    });

    const listHtml = data.length
      ? `${suggestionListHtml(data)}${paginationHtml(meta)}`
      : emptyStateHtml();

    const container = main.querySelector('#suggestions-results');
    container.innerHTML = `<p class="result-count">${formatNumber(meta.total)} suggestion${meta.total > 1 ? 's' : ''}</p>${listHtml}`;

    wirePagination(container, query);
    wireSupportButtons(container);
  } catch (error) {
    const container = main.querySelector('#suggestions-results');
    container.innerHTML = `<div class="state-block state-error" role="alert">${icon('alert', { size: 32 })}<h2>Une erreur est survenue</h2><p>${esc(error.message)}</p></div>`;
  }
}

function normalizedQuery(raw = {}) {
  return {
    page: Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1),
    category: raw.category ?? '',
    status: raw.status ?? '',
    search: raw.search ?? '',
    sort: SORTS.some((s) => s.value === raw.sort) ? raw.sort : 'recent',
  };
}

function buildHash(query) {
  const params = new URLSearchParams();
  if (query.page > 1) params.set('page', String(query.page));
  if (query.category) params.set('category', query.category);
  if (query.status) params.set('status', query.status);
  if (query.search) params.set('search', query.search);
  if (query.sort && query.sort !== 'recent') params.set('sort', query.sort);
  const search = params.toString();
  return `${ROUTES.suggestions}${search ? `?${search}` : ''}`;
}

function headerHtml() {
  const categoryOptions = CATEGORY_META.map((c) => `<option value="${esc(c.value)}">${esc(c.value)}</option>`).join('');
  const statusOptions = SUGGESTION_STATUSES.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  const sortOptions = SORTS.map((s) => `<option value="${esc(s.value)}">${esc(s.label)}</option>`).join('');

  return `${breadcrumbs([{ label: 'Accueil', href: ROUTES.home }, { label: 'Suggestions' }])}
    ${pageHeader({
      title: 'Les suggestions',
      lead: 'Découvre les idées partagées par les élèves, soutiens celles qui te tiennent à cœur.',
      actions: `<a class="btn btn-primary" href="${href(ROUTES.submit)}">${icon('plus', { size: 16 })} Proposer une idée</a>`,
    })}
    <form class="filter-bar" id="filter-bar">
      <div class="field search-field">
        <label class="visually-hidden" for="filter-search">Rechercher</label>
        <span class="search-icon">${icon('search', { size: 16 })}</span>
        <input id="filter-search" name="search" type="search" placeholder="Rechercher une idée…" maxlength="${LIMITS.titleMax}" />
      </div>
      <div class="field">
        <label class="visually-hidden" for="filter-category">Catégorie</label>
        <select id="filter-category" name="category"><option value="">Toutes les catégories</option>${categoryOptions}</select>
      </div>
      <div class="field">
        <label class="visually-hidden" for="filter-status">Statut</label>
        <select id="filter-status" name="status"><option value="">Tous les statuts</option>${statusOptions}</select>
      </div>
      <div class="field">
        <label class="visually-hidden" for="filter-sort">Trier par</label>
        <select id="filter-sort" name="sort">${sortOptions}</select>
      </div>
      <button class="btn btn-outline" type="submit">${icon('filter', { size: 16 })} Filtrer</button>
    </form>
    <div id="suggestions-results"></div>`;
}

function wireFilterBar(main, query) {
  const form = main.querySelector('#filter-bar');
  if (!form) return;
  form.querySelector('[name="search"]').value = query.search;
  form.querySelector('[name="category"]').value = query.category;
  form.querySelector('[name="status"]').value = query.status;
  form.querySelector('[name="sort"]').value = query.sort;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    navigate(
      buildHash({
        page: 1,
        search: String(data.get('search') ?? '').trim(),
        category: String(data.get('category') ?? ''),
        status: String(data.get('status') ?? ''),
        sort: String(data.get('sort') ?? 'recent'),
      }),
    );
  });

  form.querySelectorAll('select').forEach((select) => {
    select.addEventListener('change', () => form.requestSubmit());
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
