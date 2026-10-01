/**
 * Graphiques légers en SVG (aucune dépendance externe).
 *
 * Toutes les séries proviennent de `GET /api/admin/statistiques`, elles-mêmes
 * calculées par MySQL : ces fonctions ne font que dessiner des nombres reçus.
 */

import { esc } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { formatNumber, formatPercent } from '../core/format.js';

const PAD = { top: 16, right: 12, bottom: 28, left: 34 };

/** Courbe d'évolution avec aire remplie. `points` : [{ label, value }]. */
export function lineChartSvg(points, { width = 720, height = 220, formatLabel = (l) => l } = {}) {
  if (!points?.length) return emptyChart('Aucune donnée à afficher.');

  const values = points.map((p) => Number(p.value) || 0);
  const max = Math.max(1, ...values);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const coords = points.map((point, index) => {
    const x = PAD.left + index * stepX;
    const y = PAD.top + innerH - ((Number(point.value) || 0) / max) * innerH;
    return { x, y, ...point };
  });

  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `${PAD.left},${PAD.top + innerH} ${line} ${(PAD.left + innerW).toFixed(1)},${PAD.top + innerH}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = PAD.top + innerH - ratio * innerH;
      const value = Math.round(max * ratio);
      return `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${(PAD.left + innerW).toFixed(1)}" y2="${y.toFixed(1)}" class="chart-grid"/>
        <text x="${PAD.left - 6}" y="${(y + 4).toFixed(1)}" class="chart-axis" text-anchor="end">${value}</text>`;
    })
    .join('');

  const labels = coords
    .map((c, index) => {
      const showEvery = Math.ceil(points.length / 8);
      if (index % showEvery !== 0 && index !== points.length - 1) return '';
      return `<text x="${c.x.toFixed(1)}" y="${height - 8}" class="chart-axis" text-anchor="middle">${esc(formatLabel(c.label))}</text>`;
    })
    .join('');

  const dots = coords
    .map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" class="chart-dot"><title>${esc(c.label)} : ${formatNumber(c.value)}</title></circle>`)
    .join('');

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" preserveAspectRatio="xMidYMid meet">
    ${gridLines}
    <polygon points="${area}" class="chart-area"/>
    <polyline points="${line}" class="chart-line"/>
    ${dots}
    ${labels}
  </svg>`;
}

/** Barres verticales. */
export function barChartSvg(points, { width = 640, height = 220, formatLabel = (l) => l } = {}) {
  if (!points?.length) return emptyChart('Aucune donnée à afficher.');

  const values = points.map((p) => Number(p.value) || 0);
  const max = Math.max(1, ...values);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const slot = innerW / points.length;
  const barWidth = Math.min(38, slot * 0.6);

  const bars = points
    .map((point, index) => {
      const value = Number(point.value) || 0;
      const barH = (value / max) * innerH;
      const x = PAD.left + index * slot + (slot - barWidth) / 2;
      const y = PAD.top + innerH - barH;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" rx="4" class="chart-bar"><title>${esc(point.label)} : ${formatNumber(value)}</title></rect>
        <text x="${(x + barWidth / 2).toFixed(1)}" y="${height - 8}" class="chart-axis" text-anchor="middle">${esc(formatLabel(point.label))}</text>`;
    })
    .join('');

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
}

/** Barres horizontales en HTML (catégories, statuts). */
export function horizontalBarsHtml(entries, { showPercentage = true } = {}) {
  if (!entries?.length) return '<p class="field-hint">Aucune donnée à afficher.</p>';
  const max = Math.max(1, ...entries.map((entry) => Number(entry.count) || 0));

  return `<ul class="bar-list">${entries
    .map((entry) => {
      const count = Number(entry.count) || 0;
      const widthRatio = (count / max) * 100;
      const tone = entry.tone ? `tone-${esc(entry.tone)}` : '';
      const label = entry.value ?? entry.label ?? '—';
      return `<li class="bar-row">
        <div class="bar-head">
          <span class="bar-label">${entry.icon ? icon(entry.icon, { size: 14 }) : ''}${esc(label)}</span>
          <span class="bar-value">${formatNumber(count)}${showPercentage && entry.percentage !== undefined ? ` · ${formatPercent(entry.percentage)}` : ''}</span>
        </div>
        <div class="bar-track ${tone}"><span class="bar-fill" style="width:${widthRatio.toFixed(1)}%"></span></div>
      </li>`;
    })
    .join('')}</ul>`;
}

function emptyChart(message) {
  return `<p class="field-hint">${esc(message)}</p>`;
}
