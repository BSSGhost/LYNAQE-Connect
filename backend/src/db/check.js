#!/usr/bin/env node
/**
 * Verification de la connexion MySQL et de l'etat du schema.
 *
 * Usage : npm run check
 *
 * Affiche : serveur, base, tables, index, contraintes, ENUM alignes sur
 * `shared/constants.js`, et l'etat reel des donnees. Aucun chiffre n'est
 * invente : tout provient de MySQL.
 */

import { config, paths, assertConfigIsValid, collectWarnings } from '../config/env.js';
import { getConnection, closePool, query } from '../config/db.js';
import { verifySchema } from './verifySchema.js';
import { SUGGESTION_STATUSES, CATEGORIES } from '../../../shared/constants.js';

const paint = {
  ok: (t) => `\u001b[32m${t}\u001b[0m`,
  warn: (t) => `\u001b[33m${t}\u001b[0m`,
  err: (t) => `\u001b[31m${t}\u001b[0m`,
  dim: (t) => `\u001b[90m${t}\u001b[0m`,
  bold: (t) => `\u001b[1m${t}\u001b[0m`,
};

function heading(title) {
  console.log('');
  console.log(paint.bold(`── ${title} ` + '─'.repeat(Math.max(0, 62 - title.length))));
}

const num = (value) => Number(value ?? 0);

/** Connexion dediee, fermee systematiquement dans le `finally`. */
let activeConnection = null;

async function main() {
  heading('Configuration');
  console.log(`  Cible     : ${paint.bold(`${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`)}`);
  console.log(`  Fichier   : ${paint.dim('.env')}   ${paint.dim(`(racine : ${paths.root})`)}`);
  for (const warning of collectWarnings()) console.log(`  ${paint.warn('Avertissement')} : ${warning}`);

  heading('Connexion');
  const started = Date.now();
  try {
    activeConnection = await getConnection();
    const rows = await query('SELECT 1 AS ok');
    console.log(`  ${paint.ok('OK')} Connexion etablie en ${Date.now() - started} ms`);
    if (String(rows[0].ok) !== '1') throw new Error('SELECT 1 a renvoye une valeur inattendue.');
  } catch (error) {
    console.error(`  ${paint.err('ECHEC')} ${error.message}`);
    console.error(paint.dim('  Verifiez : service MySQL demarre, identifiants .env corrects, base existante.'));
    process.exitCode = 1;
    return;
  }

  const connection = activeConnection;
  const [serverRows] = await connection.query(
    'SELECT VERSION() AS version, @@character_set_server AS charset, @@collation_server AS collation, @@sql_mode AS sqlMode, @@time_zone AS tz',
  );
  const server = serverRows[0];
  console.log(`  MySQL     : ${server.version}`);
  console.log(`  Charset   : ${server.charset} / ${server.collation}`);
  console.log(`  sql_mode  : ${paint.dim(server.sqlMode)}`);

  heading('Schema');
  const verification = await verifySchema(connection);
  for (const check of verification.checks) {
    if (check.label === 'Contenu de la base') continue;
    const icon = check.ok ? paint.ok('OK  ') : paint.err('ECHEC');
    console.log(`  ${icon} ${check.label}${check.detail ? paint.dim(` — ${check.detail}`) : ''}`);
  }

  if (!verification.ok) {
    heading('Resultat');
    console.error(
      `  ${paint.err('Anomalies detectees.')} Appliquez les migrations manquantes avec ${paint.bold('npm run migrate')}, puis relancez ${paint.bold('npm run check')}.`,
    );
    process.exitCode = 1;
    return;
  }

  heading('Donnees reelles (MySQL)');
  const totals = await query('SELECT COUNT(*) AS total FROM suggestions');
  console.log(`  Suggestions     : ${paint.bold(num(totals[0].total))}`);

  await printBreakdown('status', SUGGESTION_STATUSES);
  console.log(`  ${paint.dim('—')}`);
  await printBreakdown('category', CATEGORIES);
  console.log(`  ${paint.dim('—')}`);

  const supports = await query(
    'SELECT COUNT(*) AS n, COUNT(DISTINCT suggestion_id) AS distinct_suggestions FROM supports',
  );
  console.log(
    `  Soutiens        : ${paint.bold(num(supports[0].n))} sur ${paint.bold(num(supports[0].distinct_suggestions))} suggestion(s)`,
  );

  const visibility = await query('SELECT visibility, COUNT(*) AS n FROM suggestions GROUP BY visibility');
  for (const row of visibility) {
    console.log(`  Visibilite ${String(row.visibility).padEnd(8)}: ${paint.bold(num(row.n))}`);
  }

  const updates = await query('SELECT COUNT(*) AS n FROM suggestion_updates');
  const logs = await query('SELECT COUNT(*) AS n FROM moderation_logs');
  console.log(`  Evenements timeline : ${paint.bold(num(updates[0].n))}`);
  console.log(`  Journal moderation  : ${paint.bold(num(logs[0].n))}`);

  const countCheck = verification.checks.find((check) => check.label === 'Contenu de la base');
  console.log(`  ${paint.dim(countCheck.detail)}`);

  await connection.end();
  activeConnection = null;
  await closePool();

  heading('Resultat');
  if (verification.ok) {
    const empty = num(totals[0].total) === 0;
    console.log(`  ${paint.ok('Tout est conforme.')} Connexion, tables, relations, index et ENUM valides.`);
    if (empty) {
      console.log(
        `  ${paint.dim('La base est vide : aucune donnee de demonstration n\'a ete inseree (conforme au cahier des charges).')}`,
      );
      console.log(`  ${paint.dim('L\'interface affichera « Aucune suggestion pour le moment. »')}`);
    }
  } else {
    console.error(`  ${paint.err('Anomalies detectees.')} Appliquez les migrations manquantes avec ${paint.bold('npm run migrate')}.`);
    process.exitCode = 1;
  }
}

/**
 * Affiche la repartition reelle d'une colonne, dans l'ordre officiel des
 * constantes. Les placeholders sont generees dynamiquement : une liste de
 * valeurs ne peut pas etre injectee telle quelle dans une prepared statement.
 */
async function printBreakdown(column, order) {
  const placeholders = order.map(() => '?').join(', ');
  const rows = await query(
    `SELECT ${column} AS label, COUNT(*) AS n FROM suggestions GROUP BY ${column} ORDER BY FIELD(${column}, ${placeholders})`,
    order,
  );
  const found = new Map(rows.map((row) => [String(row.label), num(row.n)]));
  for (const label of order) {
    console.log(`  ${String(label).padEnd(38)}: ${paint.bold(String(found.get(label) ?? 0))}`);
  }
}

try {
  assertConfigIsValid();
  await main();
} catch (error) {
  console.error('');
  console.error(paint.err('Verification interrompue :'));
  console.error(`  ${error.message}`);
  process.exitCode = 1;
} finally {
  await activeConnection?.end().catch(() => {});
  activeConnection = null;
  await closePool();
}
