/**
 * État persistant côté navigateur.
 *
 *  - thème (clair/sombre) : localStorage, partagé entre les visites ;
 *  - jeton d'appareil pour le soutien : localStorage (identifie l'appareil de
 *    façon anonyme, sans collecter de donnée personnelle) ;
 *  - session administrateur : sessionStorage uniquement (le jeton disparaît à
 *    la fermeture de l'onglet et n'est jamais exposé dans un cookie).
 */

const THEME_KEY = 'lynaqe.theme';
const SUPPORTER_KEY = 'lynaqe.appareil';
const ADMIN_KEY = 'lynaqe.admin.session';

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch (error) {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch (error) {
    /* Mode navigation privée restrictive : on ignore silencieusement. */
  }
}

function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
  } catch (error) {
    /* rien */
  }
}

/* --- Thème -------------------------------------------------------------- */

export function getTheme() {
  const stored = safeGet(localStorage, THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1220' : '#123B6D');
}

export function setTheme(theme) {
  safeSet(localStorage, THEME_KEY, theme);
  applyTheme(theme);
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/* --- Jeton d'appareil (soutien) ---------------------------------------- */

function randomToken() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  // `crypto.randomUUID` exige un contexte securise : sur un acces HTTP en
  // reseau local on retombe sur `getRandomValues`, puis sur Math.random.
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Identifiant d'appareil stable et anonyme, créé à la première utilisation. */
export function getSupporterToken() {
  let token = safeGet(localStorage, SUPPORTER_KEY);
  if (!token) {
    token = randomToken();
    safeSet(localStorage, SUPPORTER_KEY, token);
  }
  return token;
}

/* --- Session administrateur -------------------------------------------- */

export function getAdminToken() {
  return safeGet(sessionStorage, ADMIN_KEY);
}

export function setAdminToken(token) {
  if (!token) safeRemove(sessionStorage, ADMIN_KEY);
  else safeSet(sessionStorage, ADMIN_KEY, token);
}

export function clearAdminToken() {
  safeRemove(sessionStorage, ADMIN_KEY);
}

export function isAdmin() {
  return Boolean(getAdminToken());
}
