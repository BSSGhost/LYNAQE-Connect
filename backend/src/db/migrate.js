#!/usr/bin/env node
/**
 * Runner de migrations MySQL.
 *
 * Usage :
 *   npm run migrate            # cree la base si besoin + applique les migrations
 *   npm run migrate:status     # affiche l'etat, n'applique rien
 *   npm run db:reset           # ⚠ RECREE la base depuis zero (efface les suggestions)
 *
 * Le DDL n'etant pas transactionnel dans MySQL, chaque migration est appliquee
 * puis enregistree separement dans `schema_migrations`. Une migration deja
 * enregistree n'est jamais reappliquee.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config, paths, assertConfigIsValid, collectWarnings } from '../config/env.js';
import { getConnection, closePool } from '../config/db.js';
import { verifySchema } from './verifySchema.js';

const RESET_FLAG = '--reset';
const STATUS_FLAG = '--status';
const args = process.argv.slice(2);
const doReset = args.includes(RESET_FLAG);
const statusOnly = args.includes(STATUS_FLAG);

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

/** Identifiant MySQL : antislash et backtick doivent etre echappes. */
function quoteIdentifier(name) {
  if (!/^[A-Za-z0-9_$]+$/u.test(name)) {
    throw new Error(`Identifiant MySQL invalide : ${name}`);
  }
  return `\`${name}\``;
}

/** Execute un fichier SQL statement par statement (les commentaires sont toleres). */
async function applySqlFile(connection, filePath) {
  const raw = await readFile(filePath, 'utf8');
  const sql = raw.replace(/^\s*--.*$/gm, '');
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await connection.query(statement);
  }
  return statements.length;
}

async function ensureSchemaMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        VARCHAR(191) NOT NULL,
      checksum    CHAR(64)     NOT NULL COMMENT 'SHA-256 du fichier applique',
      applied_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE = InnoDB
      DEFAULT CHARACTER SET = utf8mb4
      COLLATE = utf8mb4_unicode_ci
      COMMENT = 'Migrations appliquees a la base lynaqe_connect'
  `);
}

async function main() {
  heading('Configuration');
  console.log(`  Base      : ${paint.bold(`${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`)}`);
  console.log(`  Mot de passe : ${config.db.password ? paint.dim('defini dans .env') : paint.warn('VIDE')}`);
  console.log(`  Environnement : ${config.env}`);
  console.log(`  Migrations : ${paint.dim(path.relative(paths.root, paths.migrations))}`);

  const warnings = collectWarnings();
  for (const warning of warnings) console.log(`  ${paint.warn('Avertissement')} : ${warning}`);

  if (config.db.ssl) console.log(`  ${paint.warn('Avertissement')} : DB_SSL=true`);

  heading('Connexion au serveur MySQL');
  let connection;
  try {
    connection = await getConnection({ withDatabase: false });
    const [serverRows] = await connection.query('SELECT VERSION() AS version, @@sql_mode AS sqlMode');
    console.log(`  ${paint.ok('OK')} Serveur MySQL ${serverRows[0].version}`);
    console.log(`  ${paint.dim('sql_mode')} : ${serverRows[0].sqlMode}`);
  } catch (error) {
    console.error(`  ${paint.err('ECHEC')} Connexion impossible : ${error.message}`);
    console.error(paint.dim(`  Verifiez que le service MySQL est demarre et que .env est correct.`));
    process.exitCode = 1;
    return;
  }

  const database = quoteIdentifier(config.db.database);

  if (doReset) {
    heading('Reinitialisation');
    console.log(`  ${paint.warn('ATTENTION')} Suppression de la base ${paint.bold(config.db.database)}`);
    await connection.query(`DROP DATABASE IF EXISTS ${database}`);
    console.log(`  ${paint.ok('OK')} Base supprimee`);
  }

  heading('Base de donnees');
  if (config.db.createIfMissing) {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${database} ` +
        'DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );
  }
  const [dbRows] = await connection.query(
    'SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
    [config.db.database],
  );
  if (dbRows.length === 0) {
    console.error(
      `  ${paint.err('ECHEC')} La base ${config.db.database} n'existe pas et DB_CREATE_IF_MISSING=false.\n` +
        `         Creez-la manuellement dans MySQL Workbench puis relancez.`,
    );
    process.exitCode = 1;
    await connection.end();
    return;
  }
  console.log(`  ${paint.ok('OK')} ${dbRows[0].SCHEMA_NAME} (${dbRows[0].DEFAULT_CHARACTER_SET_NAME} / ${dbRows[0].DEFAULT_COLLATION_NAME})`);

  // Bascule sur la base pour appliquer le schema.
  await connection.end();
  connection = await getConnection();

  if (!statusOnly) {
    await ensureSchemaMigrationsTable(connection);
  }

  heading('Migrations');
  const files = (await readdir(paths.migrations))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));

  if (files.length === 0) {
    console.log(`  ${paint.warn('Aucun fichier .sql dans')} ${paths.migrations}`);
  }

  const [migrationTableRows] = await connection.query(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'schema_migrations'`,
    [config.db.database],
  );
  const [appliedRows] = migrationTableRows.length
    ? await connection.query('SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name')
    : [[]];
  const applied = new Map(appliedRows.map((row) => [row.name, row]));

  for (const file of files) {
    const fullPath = path.join(paths.migrations, file);
    const raw = await readFile(fullPath, 'utf8');
    const { createHash } = await import('node:crypto');
    const checksum = createHash('sha256').update(raw).digest('hex');
    const record = applied.get(file);

    if (statusOnly) {
      if (!record) {
        console.log(`  ${paint.warn('  en attente')} ${file}`);
      } else if (record.checksum !== checksum) {
        console.log(`  ${paint.warn('  modifiee')}   ${file}`);
      } else {
        console.log(`  ${paint.dim('  installee')}  ${file}  ${paint.dim(record.applied_at.toISOString().slice(0, 19).replace('T', ' '))}`);
      }
      continue;
    }

    if (record) {
      if (record.checksum === checksum) {
        console.log(`  ${paint.dim('  a jour')}   ${file} ${paint.dim('(deja appliquee)')}`);
        continue;
      }
      console.log(
        `  ${paint.warn('  modifiee')} ${file} ${paint.warn('-> reappliquee')}` +
          paint.dim(' (le fichier a change depuis le premier enregistrement)'),
      );
    }

    const started = Date.now();
    try {
      const count = await applySqlFile(connection, fullPath);
      await connection.query(
        `INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), applied_at = CURRENT_TIMESTAMP`,
        [file, checksum],
      );
      console.log(
        `  ${paint.ok('  appliquee')} ${file} ${paint.dim(`${count} statement(s) en ${Date.now() - started} ms`)}`,
      );
    } catch (error) {
      console.error(`  ${paint.err('  ECHEC')} ${file}`);
      console.error(`         ${error.message}`);
      process.exitCode = 1;
      await connection.end();
      return;
    }
  }

  if (statusOnly) {
    heading('Resume');
    console.log(`  ${applied.size} migration(s) enregistree(s), ${files.length} fichier(s) present(s).`);
    await connection.end();
    await closePool();
    return;
  }

  heading('Verification du schema');
  const verification = await verifySchema(connection);
  for (const check of verification.checks) {
    const icon = check.ok ? paint.ok('OK  ') : paint.err('ECHEC');
    console.log(`  ${icon} ${check.label}${check.detail ? paint.dim(` — ${check.detail}`) : ''}`);
  }

  await connection.end();
  await closePool();

  heading('Resultat');
  if (verification.ok) {
    console.log(`  ${paint.ok('Base prete.')} ${config.db.database} est operationnelle.`);
    console.log(`  ${paint.dim('Prochaine etape : npm start (puis ouvrez http://localhost:3000)')}`);
  } else {
    console.error(`  ${paint.err('Le schema ne correspond pas a la source de verite.')}`);
    console.error(paint.dim('  Lancez `npm run db:reset` puis `npm run migrate` pour reconstruire.'));
    process.exitCode = 1;
  }
}

try {
  assertConfigIsValid();
  await main();
} catch (error) {
  console.error('');
  console.error(paint.err('Migration interrompue :'));
  console.error(`  ${error.message}`);
  process.exitCode = 1;
} finally {
  await closePool();
}
