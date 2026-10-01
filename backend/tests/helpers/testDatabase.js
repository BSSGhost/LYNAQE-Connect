/**
 * Outils de base de donnees pour les tests d'integration.
 *
 * La base de test est SUPPRIMEE puis RECREEE a chaque execution, puis le
 * schema est applique a partir des memes fichiers de migration que la
 * production. Les tests ne peuvent donc jamais voir de reste d'execution
 * precedente, et le schema teste est exactement celui livre.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { config, paths } from '../../src/config/env.js';

export function assertTestDatabaseName() {
  if (!/_test$/u.test(config.db.database)) {
    throw new Error(
      `Refus d'agir sur la base "${config.db.database}" : les tests n'acceptent que les bases se terminant par "_test".`,
    );
  }
}

/** Applique un fichier SQL statement par statement. */
async function applySqlFile(connection, filePath) {
  const raw = await readFile(filePath, 'utf8');
  const statements = raw
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) await connection.query(statement);
}

/** Recree la base de test et applique toutes les migrations. */
export async function recreateTestDatabase() {
  assertTestDatabaseName();
  const target = config.db.database;

  const admin = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: false,
  });
  await admin.query(`DROP DATABASE IF EXISTS \`${target}\``);
  await admin.query(
    `CREATE DATABASE \`${target}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await admin.end();

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: target,
    charset: 'utf8mb4_unicode_ci',
    multipleStatements: false,
  });

  const files = (await readdir(paths.migrations))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));

  for (const file of files) {
    await applySqlFile(connection, path.join(paths.migrations, file));
  }

  await connection.end();
  return { database: target, migrations: files };
}

/** Supprime la base de test a la fin de l'execution. */
export async function dropTestDatabase() {
  assertTestDatabaseName();
  const admin = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });
  await admin.query(`DROP DATABASE IF EXISTS \`${config.db.database}\``);
  await admin.end();
}
