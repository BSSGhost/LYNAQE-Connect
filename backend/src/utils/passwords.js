/**
 * Hachage et verification de secrets (codes secrets et mot de passe admin).
 *
 * Schema de stockage :
 *   scrypt$N$r$p$<saltBase64url>$<hashBase64url>
 *
 * Pourquoi scrypt et non bcrypt : scrypt est "memory-hard" (il tient une
 * quantite importante de memoire par calcul), il est fourni par le module
 * natif `node:crypto` et ne necessite donc aucune dependance a compiler.
 *
 * Le code secret d'une suggestion n'est JAMAIS stocke en clair et n'est
 * JAMAIS renvoye par l'API : seule la comparaison est possible.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

/** Parametres scrypt. 16 Mo de memoire, cout CPUOW t0-2,1 a 2x. */
const PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, keyLength: 64 });

const SCHEME = 'scrypt';

/** Nombre maximum d'octets de memoire alloues a un calcul scrypt (garde-fou). */
const MAX_MEMORY = 64 * 1024 * 1024;

/**
 * Hache un secret en clair.
 * @param {string} plain
 * @returns {Promise<string>} chaine au format `scrypt$N$r$p$salt$hash`
 */
export async function hashSecret(plain) {
  const value = assertNonEmptyString(plain, 'hashSecret: secret');
  const salt = randomBytes(16);
  const derived = await derive(value, salt, PARAMS);
  return [
    SCHEME,
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

/**
 * Verifie un secret en clair face a un hash stocke.
 * Comparaison a temps constant pour eviter les timing attacks.
 * @param {string} plain
 * @param {string|null|undefined} stored
 * @returns {Promise<boolean>}
 */
export async function verifySecret(plain, stored) {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== SCHEME) return false;

  const N = Number.parseInt(parts[1], 10);
  const r = Number.parseInt(parts[2], 10);
  const p = Number.parseInt(parts[3], 10);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N < 2 || N > 1 << 20 || r < 1 || r > 32 || p < 1 || p > 16) return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], 'base64url');
    expected = Buffer.from(parts[5], 'base64url');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await derive(plain, salt, { N, r, p, keyLength: expected.length });
  return timingSafeEqual(derived, expected);
}

/** Alias semantique pour le mot de passe administrateur. */
export const hashPassword = hashSecret;
export const verifyPassword = verifySecret;

/** Indique si une chaine ressemble deja a un hash scrypt. */
export function isHashed(value) {
  return typeof value === 'string' && value.startsWith(`${SCHEME}$`);
}

/**
 * Comparaison de chaines a temps constant, sans hachage.
 * Reserve aux valeurs non secretes (comparaison de jetons deja haches, etc.).
 */
export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function derive(plain, salt, { N, r, p, keyLength }) {
  return new Promise((resolve, reject) => {
    scrypt(plain.normalize('NFKC'), salt, keyLength, { N, r, p, maxmem: MAX_MEMORY }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} doit etre une chaine non vide.`);
  }
  return value;
}
