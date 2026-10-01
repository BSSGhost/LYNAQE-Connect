/**
 * Chargement et validation de la configuration.
 *
 * Regle de securite : aucune valeur sensible n'est jamais renvoyee au
 * frontend. Ce module n'est importe que par le backend.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import dotenv from 'dotenv';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Racine du depot : backend/src/config -> ../../.. */
export const PROJECT_ROOT = path.resolve(HERE, '..', '..', '..');
export const ENV_FILE = path.join(PROJECT_ROOT, '.env');

const configProblems = [];

/** Vrai quand aucun `.env` n'a ete trouve et que l'on tourne en production. */
let envFileMissing = false;

if (existsSync(ENV_FILE)) {
  // `override: false` : les variables reellement definies dans
  // l'environnement du systeme restent prioritaires (utile en production).
  dotenv.config({ path: ENV_FILE, override: false, quiet: true });
} else if (process.env.NODE_ENV === 'production') {
  // Sur un hebergeur (Render, Railway, VPS...), le fichier n'est volontairement
  // pas deploye : les variables viennent de l'environnement du serveur. Absence
  // de `.env` = avertissement, pas erreur fatale. Si une variable obligatoire
  // manque vraiment, elle est signalee plus bas comme probleme bloquant.
  envFileMissing = true;
}

/**
 * Valeur brute d'une variable, SANS trim : un mot de passe peut commencer ou
 * finir par un espace, et le modifier serait un bug silencieux.
 */
function raw(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value : undefined;
}

/** Idem, mais pour les secrets (aucun traitement de la valeur). */
function secret(name) {
  const value = raw(name);
  return value === undefined || value === '' ? undefined : value;
}

function str(name, fallback, { required = false } = {}) {
  const value = raw(name)?.trim();
  if (value === undefined || value === '') {
    if (required) configProblems.push(`Variable d'environnement manquante : ${name}`);
    return fallback;
  }
  return value;
}

function int(name, fallback, { min, max } = {}) {
  const value = raw(name);
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    configProblems.push(`Variable d'environnement invalide (entier attendu) : ${name}=${value}`);
    return fallback;
  }
  if (min !== undefined && parsed < min) {
    configProblems.push(`Variable d'environnement hors bornes : ${name}=${parsed} (min ${min})`);
    return fallback;
  }
  if (max !== undefined && parsed > max) {
    configProblems.push(`Variable d'environnement hors bornes : ${name}=${parsed} (max ${max})`);
    return fallback;
  }
  return parsed;
}

function bool(name, fallback) {
  const value = raw(name);
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'oui', 'on'].includes(value.toLowerCase());
}

function list(name, fallback) {
  const value = raw(name);
  if (value === undefined || value === '') return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const nodeEnv = str('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

/**
 * Le secret de signature des jetons de session administrateur.
 * Priorite : variable explicite, sinon derive de ADMIN_PASSWORD.
 */
function resolveJwtSecret() {
  const explicit = secret('JWT_SECRET');
  if (explicit && explicit.length >= 32) return explicit;

  const adminPassword = secret('ADMIN_PASSWORD') ?? '';
  if (adminPassword.length >= 16) {
    configProblems.push(
      'JWT_SECRET est absent. Un secret temporaire derive de ADMIN_PASSWORD est utilise : ' +
        'definissez JWT_SECRET en production (node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))").',
    );
    return `derivation-locale-${adminPassword}`;
  }

  configProblems.push(
    'JWT_SECRET manquant ou trop court (32 caracteres minimum). ' +
      'Generez-le avec : node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
  );
  return 'secret-de-developpement-a-remplacer';
}

export const config = Object.freeze({
  env: nodeEnv,
  isProduction,
  isTest,
  isDevelopment: !isProduction && !isTest,

  server: Object.freeze({
    host: str('HOST', '127.0.0.1'),
    port: int('PORT', 3000, { min: 1, max: 65535 }),
    appUrl: str('APP_URL', 'http://localhost:3000'),
    corsOrigins: list('CORS_ORIGINS', ['http://localhost:3000', 'http://127.0.0.1:3000']),
    trustProxy: bool('TRUST_PROXY', isProduction),
    bodyLimit: str('BODY_LIMIT', '100kb'),
  }),

  db: Object.freeze({
    host: str('DB_HOST', '127.0.0.1', { required: true }),
    port: int('DB_PORT', 3306, { min: 1, max: 65535 }),
    database: str('DB_NAME', 'lynaqe_connect', { required: true }),
    user: str('DB_USER', 'root', { required: true }),
    password: secret('DB_PASSWORD') ?? '',
    ssl: bool('DB_SSL', false),
    connectionLimit: int('DB_CONNECTION_LIMIT', 10, { min: 1, max: 100 }),
    connectTimeout: int('DB_CONNECT_TIMEOUT', 10000, { min: 1000, max: 60000 }),
    createIfMissing: bool('DB_CREATE_IF_MISSING', true),
  }),

  admin: Object.freeze({
    /** Mot de passe administrateur en clair, utilise uniquement au demarrage. */
    password: secret('ADMIN_PASSWORD') ?? '',
    /** Hash scrypt prefere : compare sans jamais conserver le clair. */
    passwordHash: secret('ADMIN_PASSWORD_HASH') ?? '',
    sessionTtl: int('ADMIN_SESSION_TTL', 43200, { min: 300, max: 604800 }),
    issuer: str('JWT_ISSUER', 'lynaqe-connect'),
  }),

  jwt: Object.freeze({
    secret: resolveJwtSecret(),
  }),

  rateLimit: Object.freeze({
    enabled: bool('RATE_LIMIT_ENABLED', true),
    windowMs: int('RATE_LIMIT_WINDOW_MS', 900000, { min: 1000 }),
    public: int('RATE_LIMIT_MAX_PUBLIC', 60, { min: 1 }),
    submit: int('RATE_LIMIT_MAX_SUBMIT', 8, { min: 1 }),
    tracking: int('RATE_LIMIT_MAX_TRACKING', 15, { min: 1 }),
    support: int('RATE_LIMIT_MAX_SUPPORT', 120, { min: 1 }),
    login: int('RATE_LIMIT_MAX_LOGIN', 10, { min: 1 }),
    admin: int('RATE_LIMIT_MAX_ADMIN', 600, { min: 1 }),
  }),

  logLevel: str('LOG_LEVEL', isProduction ? 'info' : 'debug'),
});

/** Chemins du projet utilises par le backend. */
export const paths = Object.freeze({
  root: PROJECT_ROOT,
  frontend: path.join(PROJECT_ROOT, 'frontend'),
  shared: path.join(PROJECT_ROOT, 'shared'),
  migrations: path.join(PROJECT_ROOT, 'database', 'migrations'),
});

/** Signale la presence de configuration de developpement non securisee. */
export function collectWarnings() {
  const warnings = [];
  if (envFileMissing) {
    warnings.push(
      'Aucun fichier .env : configuration lue depuis l\'environnement du serveur (normal sur un hebergeur).',
    );
  }
  if (!config.isProduction) {
    if (!config.admin.passwordHash) {
      warnings.push('ADMIN_PASSWORD_HASH absent : le mot de passe ADMIN_PASSWORD sera hache au demarrage.');
    }
    if (config.jwt.secret.startsWith('secret-de-developpement')) {
      warnings.push('JWT_SECRET doit etre defini, meme en developpement.');
    }
    if (!config.db.ssl && config.db.host !== 'localhost' && config.db.host !== '127.0.0.1') {
      warnings.push('DB_SSL=false alors que DB_HOST est distant.');
    }
  } else if (config.server.host === '127.0.0.1' || config.server.host === 'localhost') {
    // Piege classique des hebergeurs : une app ecoutee uniquement sur la
    //boucle locale reste inaccessible depuis l'exterieur.
    warnings.push(
      'HOST vaut ' + config.server.host + ' alors que NODE_ENV=production : ' +
        'definis HOST=0.0.0.0 sur ton hebergeur, sinon aucune requete externe n\'atteindra le serveur.',
    );
  }
  if (config.admin.password && config.admin.passwordHash) {
    warnings.push(
      'ADMIN_PASSWORD et ADMIN_PASSWORD_HASH sont tous deux definis : seul ADMIN_PASSWORD_HASH sera utilise.',
    );
  }
  return warnings;
}

/** Leve une erreur fatale si la configuration est inexploitable. */
export function assertConfigIsValid() {
  if (configProblems.length === 0) return;
  const error = new Error(
    `Configuration invalide :\n  - ${configProblems.join('\n  - ')}\n` +
      `Verifiez le fichier ${ENV_FILE} (copiez .env.example pour demarrer).`,
  );
  error.code = 'INVALID_CONFIG';
  throw error;
}
