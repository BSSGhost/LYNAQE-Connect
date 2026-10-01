/**
 * Requetes d'agregation pour la page « Consulter les statistiques ».
 *
 * Aucune valeur n'est simulee : tous les compteurs proviennent de COUNT/SUM
 * executes sur MySQL. Les series temporelles sont completees a zero pour
 * couvrir toute la periode demandee, afin qu'un graphique n'affiche jamais de
 * trou silencieux lorsque la base est vide.
 */

import { query, queryOne } from '../../config/db.js';

/** Compteurs principaux. */
export async function fetchTotals() {
  const [row] = await query(
    `SELECT
       (SELECT COUNT(*) FROM suggestions)                                        AS total,
       (SELECT COUNT(*) FROM suggestions WHERE visibility = 'publique')         AS published,
       (SELECT COUNT(*) FROM suggestions WHERE visibility = 'privee')            AS unpublished,
       (SELECT COUNT(*) FROM suggestions WHERE is_anonymous = 1)                AS anonymous,
       (SELECT COUNT(*) FROM supports)                                           AS supports_total,
       (SELECT COUNT(DISTINCT suggestion_id) FROM supports)                     AS supports_distinct_suggestions,
       (SELECT MAX(created_at) FROM suggestions)                                 AS last_suggestion_at,
       (SELECT MAX(created_at) FROM suggestion_updates)                          AS last_update_at`,
  );
  return row;
}

/** Repartition par statut (les statuts absents sont ajoutes a zero cote service). */
export async function fetchCountsByStatus() {
  return query('SELECT status AS label, COUNT(*) AS count FROM suggestions GROUP BY status');
}

export async function fetchCountsByCategory() {
  return query('SELECT category AS label, COUNT(*) AS count FROM suggestions GROUP BY category');
}

/** Evolution journaliere sur `days` jours (inclut le jour courant). */
export async function fetchDailyEvolution(days) {
  return query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count
       FROM suggestions
      WHERE created_at >= (CURDATE() - INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC`,
    [days - 1],
  );
}

/** Evolution mensuelle sur `months` mois. */
export async function fetchMonthlyEvolution(months) {
  return query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM suggestions
      WHERE created_at >= (DATE_FORMAT(CURDATE(), '%Y-%m-01') - INTERVAL ? MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC`,
    [months - 1],
  );
}

/** Nombre de suggestions par jour de creation, premiere entree (borne basse). */
export async function fetchFirstSuggestionDate() {
  const row = await queryOne('SELECT DATE(MIN(created_at)) AS first_day FROM suggestions');
  return row?.first_day ?? null;
}

/** Suggestions publiees les plus soutenues (pour la page statistiques). */
export async function fetchTopSupported(limit) {
  return query(
    `SELECT id, title, category, status, support_count, published_at, created_at
       FROM suggestions
      WHERE visibility = 'publique'
      ORDER BY support_count DESC, created_at DESC
      LIMIT ?`,
    [limit],
  );
}

/** Suggestions en attente de traitement : utile au travail de l'administration. */
export async function fetchPendingOverview() {
  return query(
    `SELECT status, COUNT(*) AS count
       FROM suggestions
      WHERE status IN ('En attente', 'Reçue', 'À l’étude')
      GROUP BY status`,
  );
}
