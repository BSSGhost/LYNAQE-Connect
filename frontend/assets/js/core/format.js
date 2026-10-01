/**
 * Mise en forme (dates, nombres, textes) — locale française.
 */

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const numberFormatter = new Intl.NumberFormat('fr-FR');

const relativeFormatter = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : '—';
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

export function formatNumber(value) {
  return numberFormatter.format(Number(value ?? 0));
}

export function formatPercent(value) {
  const number = Number(value ?? 0);
  const rounded = Number.isInteger(number) ? number : Math.round(number * 10) / 10;
  return `${numberFormatter.format(rounded)} %`;
}

/** « il y a 3 jours », « aujourd’hui »... */
export function formatRelative(value) {
  const date = toDate(value);
  if (!date) return '—';
  const diffMs = date.getTime() - Date.now();
  const units = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['week', 1000 * 60 * 60 * 24 * 7],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === 'minute') {
      return relativeFormatter.format(Math.round(diffMs / ms), unit);
    }
  }
  return 'à l’instant';
}

export function pluralize(count, singular, plural) {
  return Number(count) > 1 ? plural ?? `${singular}s` : singular;
}

/** Regroupe un numéro de suivi sous la forme LQC-XXXX-XXXX. */
export function formatTrackingCode(code) {
  if (!code) return '';
  const raw = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith('LQC') ? raw.slice(3) : raw;
  if (body.length !== 8) return String(code).toUpperCase();
  return `LQC-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** Met en majuscules et supprime les espaces (saisie du code secret). */
export function normalizeSecretInput(value) {
  return String(value ?? '').toUpperCase().replace(/\s+/g, '');
}

export function truncate(value, max = 160) {
  const text = String(value ?? '');
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
