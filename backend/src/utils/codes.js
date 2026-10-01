/**
 * Generation et verification des codes de suivi.
 *
 * Format : LQC-XXXX-XXXX  (12 caracteres utiles)
 * Alphabet sans caracteres ambigus (0/O, 1/I/L) : facilite la dictée et la
 * saisie manuelle au guichet, tres probable pour des eleves.
 */

import { randomInt } from 'node:crypto';

/** Prefixe unique de la plateforme. */
export const TRACKING_PREFIX = 'LQC';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const GROUP_LENGTH = 4;
const GROUP_COUNT = 2;

export const TRACKING_CODE_PATTERN = /^LQC-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

/** Nombre de codes theoriquement possibles : 32^8 ~= 1,1 x 10^12. */
export const TRACKING_CODE_SPACE = 32 ** (GROUP_LENGTH * GROUP_COUNT);

/** Genere un numero de suivi au format `LQC-XXXX-XXXX`. */
export function generateTrackingCode() {
  const groups = [];
  for (let g = 0; g < GROUP_COUNT; g += 1) {
    let group = '';
    for (let i = 0; i < GROUP_LENGTH; i += 1) {
      group += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return `${TRACKING_PREFIX}-${groups.join('-')}`;
}

/**
 * Normalise une saisie utilisateur : majuscules, espaces et tirets retires,
 * prefixe re-tolere.
 * @param {string} value
 * @returns {string|null} code normalise ou null si irrecoverable
 */
export function normalizeTrackingCode(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith(TRACKING_PREFIX) ? raw.slice(TRACKING_PREFIX.length) : raw;
  if (body.length !== GROUP_LENGTH * GROUP_COUNT) return null;
  const upper = body.toUpperCase();
  return `${TRACKING_PREFIX}-${upper.slice(0, GROUP_LENGTH)}-${upper.slice(GROUP_LENGTH)}`;
}

export function isValidTrackingCode(value) {
  return typeof value === 'string' && TRACKING_CODE_PATTERN.test(value);
}

/**
 * Genere un code secret lisible et saisissable sans ambiguite.
 * 12 caracteres, alphabet identique a celui du numero de suivi.
 * ~60 bits d'entropie : suffisant pour un usage scolaire, et le hachage
 * scrypt + la limitation de debit fournissent le reste de la protection.
 */
export const SECRET_CODE_LENGTH = 12;

export function generateSecretCode() {
  let code = '';
  for (let i = 0; i < SECRET_CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Normalise un code secret saisi (casse et espaces). */
export function normalizeSecretCode(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidSecretCode(value) {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    value.length <= 64 &&
    /^[A-Za-z0-9]+$/.test(value)
  );
}
