/**
 * Pool de connexions MySQL (mysql2/promise).
 *
 * Points importants :
 *  - toutes les requetes applicatives passent par des requetes PARAMETREES
 *    (`?`) : aucune concaténation de valeur dans le SQL ;
 *  - `namedPlaceholders` est actif pour la lisibilite des requetes ;
 *  - la connexion est configuree en utf8mb4 pour préserver les accents et
 *    l'apostrophe typographique utilisee dans les statuts ;
 *  - un garde-fou `decimalNumbers` et des `BIGINT` en `string` evitent les
 *    pertes de precision sur les identifiants.
 */

import mysql from 'mysql2/promise';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

let pool = null;

/** Cree (une seule fois) le pool de connexions. */
export function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    queueLimit: 0,
    connectTimeout: config.db.connectTimeout,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: false,
    namedPlaceholders: true,
    multipleStatements: false,
    ...(config.db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  return pool;
}

/** Connexion dediee (utilisee par le script de migration pour le DDL). */
export async function getConnection({ withDatabase = true } = {}) {
  const target = withDatabase
    ? {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
      }
    : {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
      };

  return mysql.createConnection({
    ...target,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    connectTimeout: config.db.connectTimeout,
    supportBigNumbers: true,
    bigNumberStrings: true,
    multipleStatements: false,
    ...(config.db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}

/** Execute une requete parametree et renvoie les lignes. */
export async function query(sql, params = {}) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/** Execute une requete parametree et renvoie la premiere ligne (ou undefined). */
export async function queryOne(sql, params = {}) {
  const rows = await query(sql, params);
  return rows[0];
}

/** Execute une requete parametree et renvoie le resultat d'ecriture. */
export async function execute(sql, params = {}) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

/**
 * Execute un ensemble d'operations dans une transaction.
 * @template T
 * @param {(connection: import('mysql2/promise').PoolConnection) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function transaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.error('Echec du ROLLBACK', { message: rollbackError.message });
    }
    throw error;
  } finally {
    connection.release();
  }
}

/** Verifie que la base est joignable. */
export async function ping() {
  const started = Date.now();
  const row = await queryOne('SELECT 1 AS ok');
  // `bigNumberStrings: true` fait renvoyer les nombres sous forme de chaine.
  return { ok: String(row?.ok) === '1', latencyMs: Date.now() - started };
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}
