/**
 * Verification du schema MySQL.
 *
 * Objectif : garantir que la base reelle correspond exactement a la source de
 * verite partagee (`shared/constants.js`). En particulier, qu'aucune derive
 * n'a pu s'introduire entre les ENUM MySQL, l'API et l'interface.
 */

import {
  SUGGESTION_STATUSES,
  CATEGORIES,
  VISIBILITIES,
  MODERATION_ACTIONS,
  UPDATE_EVENT_TYPES,
} from '../../../shared/constants.js';
import { config } from '../config/env.js';

/** Decoupe la valeur INFORMATION_SCHEMA d'un ENUM en tableau de chaines. */
export function parseEnum(columnType) {
  if (typeof columnType !== 'string') return [];
  const open = columnType.indexOf('(');
  const close = columnType.lastIndexOf(')');
  if (open === -1 || close === -1) return [];
  return columnType
    .slice(open + 1, close)
    .split(',')
    .map((value) => value.trim().replace(/^'(.*)'$/s, '$1').replace(/''/g, "'"));
}

/** Colonnes ENUM dont l'ordre et le contenu doivent suivre les constantes. */
export const ENUM_CONTRACTS = Object.freeze([
  { table: 'suggestions', column: 'status', expected: SUGGESTION_STATUSES },
  { table: 'suggestions', column: 'category', expected: CATEGORIES },
  { table: 'suggestions', column: 'visibility', expected: VISIBILITIES },
  { table: 'suggestion_updates', column: 'event_type', expected: UPDATE_EVENT_TYPES },
  { table: 'suggestion_updates', column: 'old_status', expected: SUGGESTION_STATUSES },
  { table: 'suggestion_updates', column: 'new_status', expected: SUGGESTION_STATUSES },
  { table: 'moderation_logs', column: 'action', expected: MODERATION_ACTIONS },
  { table: 'moderation_logs', column: 'old_status', expected: SUGGESTION_STATUSES },
  { table: 'moderation_logs', column: 'new_status', expected: SUGGESTION_STATUSES },
  { table: 'moderation_logs', column: 'old_visibility', expected: VISIBILITIES },
  { table: 'moderation_logs', column: 'new_visibility', expected: VISIBILITIES },
].map(Object.freeze));

/** Tables attendues. */
export const REQUIRED_TABLES = Object.freeze([
  'suggestions',
  'suggestion_updates',
  'supports',
  'moderation_logs',
  'schema_migrations',
]);

/** Index et contraintes qui doivent exister (cle `table.INDEX_NAME`). */
export const REQUIRED_INDEXES = Object.freeze({
  'suggestions.PRIMARY': 'id',
  'suggestions.uq_suggestions_tracking_code': 'tracking_code',
  'suggestions.idx_suggestions_visibility_status': 'visibility,status',
  'suggestions.idx_suggestions_status': 'status',
  'suggestions.idx_suggestions_category': 'category',
  'suggestion_updates.idx_updates_suggestion_created': 'suggestion_id,created_at,id',
  'supports.uq_supports_suggestion_supporter': 'suggestion_id,supporter_hash',
  'moderation_logs.idx_logs_suggestion': 'suggestion_id,created_at',
  'supports.PRIMARY': 'id',
  'moderation_logs.PRIMARY': 'id',
  'suggestion_updates.PRIMARY': 'id',
  'schema_migrations.PRIMARY': 'name',
});

/** Colonnes de `suggestions` exigees par le cahier des charges. */
export const REQUIRED_SUGGESTION_COLUMNS = Object.freeze([
  'id',
  'tracking_code',
  'secret_code_hash',
  'title',
  'description',
  'category',
  'location',
  'status',
  'is_anonymous',
  'visibility',
  'created_at',
  'updated_at',
]);

/**
 * Execute toutes les verifications.
 * @param {import('mysql2/promise').Connection} connection connexion MySQL
 * @returns {Promise<{ ok: boolean, checks: Array<{label:string,ok:boolean,detail:string}> }>}
 */
export async function verifySchema(connection) {
  const checks = [];
  const add = (label, ok, detail = '') => checks.push({ label, ok, detail });

  const database = config.db.database;

  // --- 1. Tables -----------------------------------------------------------
  const [tableRows] = await connection.query(
    'SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [database],
  );
  const tables = new Map(tableRows.map((row) => [row.TABLE_NAME, row]));
  for (const table of REQUIRED_TABLES) {
    const found = tables.get(table);
    add(
      `Table ${table}`,
      Boolean(found),
      found ? `moteur ${found.ENGINE}, collation ${found.TABLE_COLLATION}` : 'table absente',
    );
  }

  const allPresent = REQUIRED_TABLES.every((table) => tables.has(table));
  if (!allPresent) {
    return { ok: false, checks };
  }

  // --- 2. Charset ----------------------------------------------------------
  const utf8mb4Tables = [...tables.values()].filter(
    (row) => String(row.TABLE_COLLATION).startsWith('utf8mb4'),
  );
  add(
    'Encodage utf8mb4',
    utf8mb4Tables.length === tables.size,
    `${utf8mb4Tables.length}/${tables.size} tables en utf8mb4`,
  );

  // --- 3. Index / contraintes uniques -------------------------------------
  const [indexRows] = await connection.query(
    'SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX',
    [database],
  );
  // Cle `table.INDEX_NAME` : "PRIMARY" existe dans chaque table, l'index
  // composite doit donc etre identifie par son couple table/index.
  const indexByKey = new Map();
  for (const row of indexRows) {
    const key = `${row.TABLE_NAME}.${row.INDEX_NAME}`;
    if (!indexByKey.has(key)) indexByKey.set(key, { table: row.TABLE_NAME, nonUnique: row.NON_UNIQUE, columns: [] });
    indexByKey.get(key).columns.push(row.COLUMN_NAME);
  }
  for (const [key, expectedColumns] of Object.entries(REQUIRED_INDEXES)) {
    const [table, name] = key.split('.');
    const index = indexByKey.get(key);
    const columns = index ? index.columns.join(',') : null;
    add(
      `Index ${key}`,
      columns === expectedColumns,
      index ? `(${columns})` : 'index absent',
    );
  }

  // Un numero de suivi unique = un seul proprietaire par suggestion.
  const trackingIndex = indexByKey.get('suggestions.uq_suggestions_tracking_code');
  add(
    'Numeros de suivi uniques',
    Boolean(trackingIndex) && trackingIndex.nonUnique === 0,
    trackingIndex ? (trackingIndex.nonUnique === 0 ? 'contrainte UNIQUE active' : 'contrainte absente') : 'index absent',
  );

  // Un soutien unique par suggestion et par personne.
  const supportIndex = indexByKey.get('supports.uq_supports_suggestion_supporter');
  add(
    'Soutiens uniques (anti-doublon)',
    Boolean(supportIndex) && supportIndex.nonUnique === 0,
    supportIndex ? (supportIndex.nonUnique === 0 ? 'contrainte UNIQUE active' : 'contrainte absente') : 'index absent',
  );

  // --- 4. Chiffre-obligatoire --------------------------------------------
  const [suggestionColumns] = await connection.query(
    'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    [database, 'suggestions'],
  );
  const columnMap = new Map(suggestionColumns.map((row) => [row.COLUMN_NAME, row]));
  for (const column of REQUIRED_SUGGESTION_COLUMNS) {
    add(`Colonne suggestions.${column}`, columnMap.has(column));
  }
  const secretColumn = columnMap.get('secret_code_hash');
  // Regle : le code secret ne doit exister qu'en une seule colonne, nommee
  // explicitement comme un hash, NOT NULL et sans valeur par defaut. Aucune
  // colonne `secret_code` en clair ne doit exister.
  const plaintextColumns = [...columnMap.keys()].filter(
    (name) => name !== 'secret_code_hash' && /secret/i.test(name) && !/hash/i.test(name),
  );
  const secretIsHashOnly =
    Boolean(secretColumn) &&
    secretColumn.IS_NULLABLE === 'NO' &&
    // mysql2 expose l'absence de defaut soit par `null`, soit par cle absente.
    (secretColumn.COLUMN_DEFAULT ?? null) === null &&
    plaintextColumns.length === 0;
  add(
    'Code secret stocke sous forme de hash uniquement',
    secretIsHashOnly,
    plaintextColumns.length > 0
      ? `colonnes en clair detectees : ${plaintextColumns.join(', ')}`
      : `${secretColumn.COLUMN_TYPE} nullable=${secretColumn.IS_NULLABLE} defaut=${JSON.stringify(secretColumn.COLUMN_DEFAULT)}`,
  );

  // --- 5. ENUM alignes sur shared/constants.js ----------------------------
  for (const contract of ENUM_CONTRACTS) {
    const [rows] = await connection.query(
      'SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [database, contract.table, contract.column],
    );
    if (rows.length === 0) {
      add(`ENUM ${contract.table}.${contract.column}`, false, 'colonne absente');
      continue;
    }
    const actual = parseEnum(rows[0].COLUMN_TYPE);
    const sameLength = actual.length === contract.expected.length;
    const sameOrder = sameLength && actual.every((value, index) => value === contract.expected[index]);
    add(
      `ENUM ${contract.table}.${contract.column}`,
      sameOrder,
      sameOrder ? actual.join(' | ') : `attendu [${contract.expected.join(' | ')}] obtenu [${actual.join(' | ')}]`,
    );
  }

  // --- 6. Relations (cles etrangeres) -------------------------------------
  const [foreignKeys] = await connection.query(
    'SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL',
    [database],
  );
  const fkSet = new Set(
    foreignKeys.map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}->${row.REFERENCED_TABLE_NAME}.${row.REFERENCED_COLUMN_NAME}`),
  );
  const REQUIRED_FKS = [
    'suggestion_updates.suggestion_id->suggestions.id',
    'supports.suggestion_id->suggestions.id',
    'moderation_logs.suggestion_id->suggestions.id',
  ];
  for (const fk of REQUIRED_FKS) {
    add(`Relation ${fk}`, fkSet.has(fk));
  }

  // --- 7. Etat reel des donnees -------------------------------------------
  const [counts] = await connection.query(
    'SELECT (SELECT COUNT(*) FROM suggestions) AS suggestions, (SELECT COUNT(*) FROM supports) AS supports, (SELECT COUNT(*) FROM suggestion_updates) AS updates, (SELECT COUNT(*) FROM moderation_logs) AS logs',
  );
  add(
    'Contenu de la base',
    true,
    `suggestions=${counts[0].suggestions}, soutiens=${counts[0].supports}, evenements=${counts[0].updates}, journaux=${counts[0].logs}`,
  );

  return { ok: checks.every((check) => check.ok), checks };
}
