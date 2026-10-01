/**
 * Service des statistiques.
 *
 * Regle absolute : tous les chiffres proviennent de requetes MySQL reelles.
 * Aucun nombre n'est genere, estime ou placeholder cote client. Sur une base
 * vide, la reponse contient des zeros coherents et l'interface affiche son
 * etat vide elegamment.
 */

import {
  SUGGESTION_STATUSES,
  STATUS_META,
  CATEGORY_META,
  PROGRESS_STATUSES,
} from '../../../../shared/constants.js';
import {
  fetchTotals,
  fetchCountsByStatus,
  fetchCountsByCategory,
  fetchDailyEvolution,
  fetchMonthlyEvolution,
  fetchFirstSuggestionDate,
  fetchTopSupported,
} from './statistics.repository.js';
import { toPublicSuggestion } from '../suggestions/suggestion.serializer.js';

const DAILY_WINDOW_DAYS = 30;
const MONTHLY_WINDOW_MONTHS = 12;
const TOP_SUPPORTED_LIMIT = 5;

const num = (value) => Number(value ?? 0);
const iso = (value) => (value instanceof Date ? value.toISOString() : value ?? null);

/** Format YYYY-MM-DD en heure locale stable (independant du fuseau du serveur). */
function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Complete une serie journee pour qu'elle couvre toute la fenetre, sans trou. */
function buildDailySeries(rows, days) {
  const found = new Map(rows.map((row) => [toDayKey(new Date(row.day)), num(row.count)]));
  const series = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() - index);
    const key = toDayKey(day);
    series.push({ day: key, count: found.get(key) ?? 0 });
  }
  return series;
}

/** Complete la serie mensuelle sur les 12 derniers mois. */
function buildMonthlySeries(rows, months) {
  const found = new Map(rows.map((row) => [String(row.month), num(row.count)]));
  const series = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let index = months - 1; index >= 0; index -= 1) {
    const month = new Date(cursor);
    month.setMonth(cursor.getMonth() - index);
    const key = toMonthKey(month);
    series.push({ month: key, count: found.get(key) ?? 0 });
  }
  return series;
}

/** Repartition complete : toutes les valeurs declarees, meme a zero. */
function toFullBreakdown(declared, rows, { withStatusInfo = false } = {}) {
  const counts = new Map(rows.map((row) => [String(row.label), num(row.count)]));
  return declared.map((value) => {
    const base = {
      value,
      count: counts.get(value) ?? 0,
      percentage: 0,
    };
    if (withStatusInfo) {
      const meta = STATUS_META.find((status) => status.value === value);
      base.slug = meta?.slug ?? null;
      base.tone = meta?.tone ?? null;
      base.step = meta?.step ?? null;
      base.description = meta?.description ?? null;
    }
    return base;
  });
}

export async function getStatistics() {
  const [
    totalsRow,
    statusRows,
    categoryRows,
    dailyRows,
    monthlyRows,
    topRows,
    firstDay,
  ] = await Promise.all([
    fetchTotals(),
    fetchCountsByStatus(),
    fetchCountsByCategory(),
    fetchDailyEvolution(DAILY_WINDOW_DAYS),
    fetchMonthlyEvolution(MONTHLY_WINDOW_MONTHS),
    fetchTopSupported(TOP_SUPPORTED_LIMIT),
    fetchFirstSuggestionDate(),
  ]);

  const total = num(totalsRow.total);
  const published = num(totalsRow.published);
  const supportsTotal = num(totalsRow.supports_total);

  const byStatus = toFullBreakdown(SUGGESTION_STATUSES, statusRows, { withStatusInfo: true });
  const byCategory = toFullBreakdown(
    CATEGORY_META.map((category) => category.value),
    categoryRows,
  ).map((entry) => ({
    ...entry,
    slug: CATEGORY_META.find((category) => category.value === entry.value)?.slug ?? null,
    icon: CATEGORY_META.find((category) => category.value === entry.value)?.icon ?? 'dots',
  }));

  const withPercent = (breakdown) =>
    total === 0
      ? breakdown.map((entry) => ({ ...entry, percentage: 0 }))
      : breakdown.map((entry) => ({
          ...entry,
          percentage: Math.round((entry.count / total) * 1000) / 10,
        }));

  const statusBreakdown = withPercent(byStatus);
  const categoryBreakdown = withPercent(byCategory);

  const countOf = (value) => statusBreakdown.find((entry) => entry.value === value)?.count ?? 0;
  const inProgress = PROGRESS_STATUSES.filter((status) => status !== 'En attente').reduce(
    (sum, status) => sum + countOf(status),
    0,
  );

  return {
    generatedAt: new Date().toISOString(),
    isEmpty: total === 0,

    // --- Chiffres cles (tous relus depuis MySQL) --------------------------
    totals: {
      suggestions: total,
      published,
      unpublished: num(totalsRow.unpublished),
      anonymous: num(totalsRow.anonymous),
      supports: supportsTotal,
      supportedSuggestions: num(totalsRow.supports_distinct_suggestions),
      realized: countOf('Réalisée'),
      inProgress,
      pending: countOf('En attente'),
      received: countOf('Reçue'),
      underReview: countOf('À l’étude'),
      running: countOf('En cours'),
      notRetained: countOf('Non retenue'),
      archived: countOf('Archivée'),
    },

    // --- Repartitions -------------------------------------------------------
    byStatus: statusBreakdown,
    byCategory: categoryBreakdown,
    byVisibility: [
      { value: 'publique', label: 'Publiée', count: published },
      { value: 'privee', label: 'Non publiée', count: num(totalsRow.unpublished) },
    ],

    // --- Indicateurs derives ------------------------------------------------
    indicators: {
      publicationRate: total === 0 ? 0 : Math.round((published / total) * 1000) / 10,
      realizationRate: total === 0 ? 0 : Math.round((countOf('Réalisée') / total) * 1000) / 10,
      averageSupports:
        total === 0 ? 0 : Math.round((supportsTotal / total) * 100) / 100,
      anonymousRate: total === 0 ? 0 : Math.round((num(totalsRow.anonymous) / total) * 1000) / 10,
    },

    // --- Evolution ----------------------------------------------------------
    evolution: {
      windowDays: DAILY_WINDOW_DAYS,
      windowMonths: MONTHLY_WINDOW_MONTHS,
      firstSuggestionAt: firstDay ? new Date(firstDay).toISOString() : null,
      daily: buildDailySeries(dailyRows, DAILY_WINDOW_DAYS),
      monthly: buildMonthlySeries(monthlyRows, MONTHLY_WINDOW_MONTHS),
    },

    // --- Classement des plus soutenues (uniquement les suggestions publiees)
    topSupported: topRows.map((row) => ({
      ...toPublicSuggestion(row),
      supportCount: num(row.support_count),
    })),

    lastSuggestionAt: iso(totalsRow.last_suggestion_at),
    lastUpdateAt: iso(totalsRow.last_update_at),
  };
}
