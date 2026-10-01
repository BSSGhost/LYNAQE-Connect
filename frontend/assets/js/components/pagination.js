/**
 * Pagination réutilisable.
 */

import { icon } from '../core/icons.js';
import { formatNumber, pluralize } from '../core/format.js';

/** Génère les boutons de pagination (l'état est porté par `data-page`). */
export function paginationHtml(meta) {
  const page = Number(meta?.page ?? 1);
  const totalPages = Number(meta?.totalPages ?? 1);
  if (totalPages <= 1) return '';

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const buttons = [];
  buttons.push(
    `<button type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Page précédente">${icon('chevronLeft', { size: 16 })}</button>`,
  );

  let previous = 0;
  for (const value of sorted) {
    if (value - previous > 1) buttons.push('<span class="pagination-gap">…</span>');
    buttons.push(
      `<button type="button" data-page="${value}" ${value === page ? 'aria-current="true"' : ''}>${value}</button>`,
    );
    previous = value;
  }

  buttons.push(
    `<button type="button" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} aria-label="Page suivante">${icon('chevronRight', { size: 16 })}</button>`,
  );

  return `
    <nav class="pagination" aria-label="Pagination">
      ${buttons.join('')}
    </nav>
    <p class="field-hint" style="text-align:center">
      Page ${formatNumber(page)} sur ${formatNumber(totalPages)} —
      ${formatNumber(meta.total)} suggestion${pluralize(meta.total, '', 's')}
    </p>
  `;
}
