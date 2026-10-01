/**
 * Journalisation structuree, sans dependance externe.
 * En production, une seule ligne JSON par evenement (compatible log shipper).
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

let threshold = LEVELS.info;

export function configureLogger({ level = 'info', isProduction = false } = {}) {
  threshold = LEVELS[level] ?? LEVELS.info;
  return isProduction;
}

export function setLogLevel(level) {
  threshold = LEVELS[level] ?? threshold;
}

const REDACTED_KEYS = new Set([
  'password',
  'secretcode',
  'secret_code',
  'secrethash',
  'secret_code_hash',
  'token',
  'jwt',
  'authorization',
  'cookie',
  'x-supporter-token',
]);

/** Retire toute valeur sensible d'un objet avant journalisation. */
export function redact(input) {
  if (!input || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(redact);
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = REDACTED_KEYS.has(key.toLowerCase()) ? '[redacted]' : redact(value);
  }
  return out;
}

function emit(level, message, meta) {
  if (LEVELS[level] < threshold) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(meta ? { meta: redact(meta) } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message, meta) => emit('debug', message, meta),
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
};
