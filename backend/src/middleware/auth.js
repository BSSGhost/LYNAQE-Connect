/**
 * Acces a l'administration.
 *
 * Modele volontairement simple (cahier des charges) : UN acces, UN mot de
 * passe, aucun compte a creer, aucune inscription. La verification se fait
 * integralement cote backend avec un hash scrypt ; le mot de passe ne figure
 * jamais dans le frontend, ni dans les reponses de l'API.
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { unauthorized } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { verifySecret, hashSecret } from '../utils/passwords.js';

const ALGORITHM = 'HS256';
const ROLE_ADMIN = 'admin';

/**
 * Hash effectif du mot de passe administrateur.
 *  - si ADMIN_PASSWORD_HASH est defini (recommande), il fait foi ;
 *  - sinon le mot de passe ADMIN_PASSWORD est hache une seule fois au
 *    demarrage, puis mis en cache.
 */
let cachedPasswordHash = null;

export async function getAdminPasswordHash() {
  if (cachedPasswordHash) return cachedPasswordHash;

  const { passwordHash, password } = config.admin;

  if (passwordHash) {
    cachedPasswordHash = passwordHash;
    return cachedPasswordHash;
  }

  if (password) {
    logger.warn(
      'ADMIN_PASSWORD_HASH absent : le mot de passe ADMIN_PASSWORD est hache au demarrage. ' +
        'Generez un hash avec `npm run hash-password` et mettez ADMIN_PASSWORD a vide.',
    );
    cachedPasswordHash = await hashSecret(password);
    return cachedPasswordHash;
  }

  logger.error(
    "Aucun mot de passe administrateur configure : renseignez ADMIN_PASSWORD_HASH (via `npm run hash-password`) dans .env.",
  );
  throw new Error('ADMIN_NOT_CONFIGURED');
}

/** Reinitialise le cache (tests). */
export function resetAdminPasswordCache() {
  cachedPasswordHash = null;
}

/**
 * Verifie un mot de passe candidat face au hash scrypt.
 *
 * Le cout du calcul scrypt est independant de la position du premier caractere
 * different : le temps de reponse ne revele donc pas le prefixe correct.
 */
export async function verifyAdminPassword(candidate) {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  const hash = await getAdminPasswordHash();
  return verifySecret(candidate, hash);
}

/** Signe un jeton de session administrateur. */
export function signAdminToken() {
  return jwt.sign({ role: ROLE_ADMIN, scope: ['admin'] }, config.jwt.secret, {
    algorithm: ALGORITHM,
    expiresIn: config.admin.sessionTtl,
    issuer: config.admin.issuer,
    subject: ROLE_ADMIN,
  });
}

function verifyAdminToken(token) {
  if (typeof token !== 'string' || token.length === 0) return null;
  try {
    const payload = jwt.verify(token, config.jwt.secret, {
      algorithms: [ALGORITHM],
      issuer: config.admin.issuer,
    });
    if (payload?.role !== ROLE_ADMIN) return null;
    if (!Array.isArray(payload.scope) || !payload.scope.includes('admin')) return null;
    return payload;
  } catch {
    return null;
  }
}

function extractToken(req) {
  const header = req.get('authorization');
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  // Repli : le frontend n'accede jamais a cette route par URL.
  return null;
}

/** Exige une session administrateur valide. */
export function requireAdmin(req, res, next) {
  const payload = verifyAdminToken(extractToken(req));
  if (!payload) {
    logger.warn('Acces administrateur refuse', { path: req.originalUrl, ip: req.clientIpMasked });
    return next(unauthorized('Session administrateur requise ou expirée. Reconnectez-vous.'));
  }
  req.admin = { role: payload.role, expiresAt: payload.exp };
  return next();
}

/**
 * Renseigne `req.admin` si un jeton valide est present, sans jamais bloquer.
 * Utile pour un espace administrateur affiche proprement quand la session a
 * expire (redirection vers la connexion au lieu d'une erreur brute).
 */
export function attachAdmin(req, res, next) {
  const payload = verifyAdminToken(extractToken(req));
  if (payload) req.admin = { role: payload.role, expiresAt: payload.exp };
  next();
}

export function readTokenExpiry(token) {
  const payload = verifyAdminToken(token);
  return payload?.exp ?? null;
}
