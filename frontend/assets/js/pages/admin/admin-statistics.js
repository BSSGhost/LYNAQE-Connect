/**
 * Administration — tableau de bord statistique.
 * Interface moderne et professionnelle avec KPI cards et graphiques.
 */

import { ROUTES } from '../../../../../shared/constants.js';
import { mount, esc } from '../../core/dom.js';
import { href } from '../../core/router.js';
import { icon } from '../../core/icons.js';
import { adminApi } from '../../core/api.js';
import { formatDate, formatDateTime, formatNumber, formatPercent } from '../../core/format.js';
import { loadingHtml, statCardHtml } from '../../components/layout.js';
import { lineChartSvg, barChartSvg, horizontalBarsHtml } from '../../components/charts.js';
import { guardAdmin, handleAdminError, adminNavHtml, sidebarHtml, wireAdminBar } from './admin-shell.js';
import { logoutAdmin } from './admin-logout.js';

const shortDay = (value) => {
  const [, month, day] = String(value).split('-');
  return `${day}/${month}`;
};
const shortMonth = (value) => {
  const [year, month] = String(value).split('-');
  return `${month}/${year.slice(2)}`;
};

export async function render() {
  if (!guardAdmin()) return;
  const main = document.getElementById('main');
  // Sidebar + header + content
  mount(
    main,
    `${sidebarHtml(ROUTES.adminStatistics)}${adminNavHtml(ROUTES.adminStatistics)}${loadingHtml('Calcul des statistiques…')}`,
  );
  wireAdminBar(() => logoutAdmin());

  try {
    const { data } = await adminApi.statistics();
    mount(
      main,
      `${sidebarHtml(ROUTES.adminStatistics)}${adminNavHtml(ROUTES.adminStatistics)}${dashboardHtml(data)}`,
    );
    wireAdminBar(() => logoutAdmin());
  } catch (error) {
    handleAdminError(error);
    mount(
      main,
      `${sidebarHtml(ROUTES.adminStatistics)}${adminNavHtml(ROUTES.adminStatistics)}<div class="state-block state-error" role="alert">${icon('alert', { size: 32 })}<h2>Erreur</h2><p>${esc(error.message)}</p></div>`,
    );
    wireAdminBar(() => logoutAdmin());
  }
}

function dashboardHtml(data) {
  const t = data.totals;
  const i = data.indicators;
  const toProcess = t.pending + t.received + t.underReview;

  const cards = [
    statCardHtml({ label: 'Suggestions', value: formatNumber(t.suggestions), icon: 'inbox', tone: 'info' }),
    statCardHtml({ label: 'Réalisées', value: formatNumber(t.realized), icon: 'checkCircle', tone: 'done' }),
    statCardHtml({ label: 'À traiter', value: formatNumber(toProcess), icon: 'clock', tone: 'pending' }),
    statCardHtml({ label: 'Soutiens', value: formatNumber(t.supports), icon: 'thumbsUp', tone: 'progress' }),
  ].join('');

  const indicators = [
    { label: 'Taux de publication', value: formatPercent(i.publicationRate) },
    { label: 'Taux de réalisation', value: formatPercent(i.realizationRate) },
    { label: 'Soutiens par suggestion', value: formatNumber(i.averageSupports) },
    { label: 'Part d’anonymes', value: formatPercent(i.anonymousRate) },
  ]
    .map((item) => `<div class="indicator"><span class="indicator-value">${item.value}</span><span class="indicator-label">${item.label}</span></div>`)
    .join('');

  const daily = data.evolution.daily.map((point) => ({ label: point.day, value: point.count }));
  const monthly = data.evolution.monthly.map((point) => ({ label: point.month, value: point.count }));

  const topSupported = data.topSupported.length
    ? `<ul class="top-list">${data.topSupported
        .map(
          (s) => `<li>
            <a href="${href(`${ROUTES.suggestions}/${s.id}`)}">${esc(s.title)}</a>
            <span class="top-support">${icon('thumbsUp', { size: 14 })} ${formatNumber(s.supportCount)}</span>
          </li>`,
        )
        .join('')}</ul>`
    : '<p class="field-hint">Aucune suggestion publiée pour le moment.</p>';

  return `<div class="container admin-stats">
    <header class="page-header">
      <p class="eyebrow">Tableau de bord</p>
      <h1>Statistiques</h1>
      <p class="lead">
        Données calculées en direct depuis la base. Dernière suggestion :
        ${data.lastSuggestionAt ? esc(formatDate(data.lastSuggestionAt)) : '—'}.
      </p>
    </header>

    <div class="stats-grid">${cards}</div>

    <section class="admin-attention-panel" aria-labelledby="admin-attention-title">
      <div>
        <p class="admin-page-eyebrow">🚨 À traiter maintenant</p>
        <h2 id="admin-attention-title">${formatNumber(toProcess)} suggestion${toProcess === 1 ? '' : 's'} à traiter</h2>
        <p>En attente : ${formatNumber(t.pending)} · Reçues : ${formatNumber(t.received)} · À l’étude : ${formatNumber(t.underReview)}</p>
      </div>
      <a class="btn btn-primary" href="${href(ROUTES.adminQueue)}">${icon('inbox', { size: 16 })} Voir les ${formatNumber(toProcess)} suggestions</a>
    </section>

    <section class="panel">
      <h2>${icon('chart', { size: 18 })} Indicateurs clés</h2>
      <div class="indicators">${indicators}</div>
    </section>

    <section class="panel">
      <h2>${icon('chart', { size: 18 })} Évolution sur ${data.evolution.windowDays} jours</h2>
      ${lineChartSvg(daily, { formatLabel: shortDay })}
    </section>

    <section class="panel">
      <h2>${icon('chart', { size: 18 })} Évolution sur ${data.evolution.windowMonths} mois</h2>
      ${barChartSvg(monthly, { formatLabel: shortMonth })}
    </section>

    <div class="admin-stats-grid">
      <section class="panel">
        <h2>${icon('list', { size: 18 })} Répartition par statut</h2>
        ${horizontalBarsHtml(data.byStatus)}
      </section>
      <section class="panel">
        <h2>${icon('tag', { size: 18 })} Répartition par catégorie</h2>
        ${horizontalBarsHtml(data.byCategory)}
      </section>
    </div>

    <section class="panel">
      <h2>${icon('trophy', { size: 18 })} Suggestions les plus soutenues</h2>
      ${topSupported}
    </section>

    <p class="field-hint">Rapport généré le ${esc(formatDateTime(data.generatedAt))}.</p>
  </div>`;
}