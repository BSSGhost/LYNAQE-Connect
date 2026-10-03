/**
 * Enveloppe commune aux pages d'administration : garde d'accès et navigation.
 * Inclut la sidebar moderne et la header bar.
 *
 * Le jeton est conservé en mémoire de session (sessionStorage). S'il disparaît
 * ou expire, chaque appel d'API renvoie 401 et l'utilisateur est renvoyé vers
 * l'écran de connexion.
 */

import { ROUTES } from '../../../../../shared/constants.js';
import { href, navigate } from '../../core/router.js';
import { icon } from '../../core/icons.js';
import { isAdmin, clearAdminToken } from '../../core/store.js';
import { toast } from '../../core/ui.js';
import { esc } from '../../core/dom.js';

const SIDEBAR_ITEMS = [
  { path: ROUTES.adminSuggestions, label: 'Suggestions', icon: 'list' },
  { path: ROUTES.adminStatistics, label: 'Statistiques', icon: 'chart' },
  { path: ROUTES.adminLogs, label: 'Journal', icon: 'journal' },
];

const NAV_ITEMS = [
  { path: ROUTES.home, label: 'Accueil', icon: 'home' },
];

/**
 * Vérifie l'accès. Renvoie `true` si l'utilisateur est connecté, sinon
 * redirige vers la connexion et renvoie `false`.
 */
export function guardAdmin() {
  if (isAdmin()) return true;
  toast('Connecte-toi pour accéder à l’administration.', 'warning');
  navigate(ROUTES.admin, { replace: true });
  return false;
}

/* --- Construction de la sidebar ------------------------------------------- */

/**
 * Gère le basculement de la sidebar (open/closed).
 * Stocke l'état dans sessionStorage.
 */
function toggleSidebarState() {
  const html = document.documentElement;
  const current =
    html.getAttribute('data-sidebar') ||
    (window.matchMedia('(max-width: 900px)').matches ? 'collapsed' : 'expanded');
  const next = current === 'collapsed' ? 'expanded' : 'collapsed';
  html.setAttribute('data-sidebar', next);
  try {
    sessionStorage.setItem('sidebarState', next);
  } catch (e) {
    /* mode navigation privée : on ignore */
  }
}

export function sidebarHtml(active) {
  const items = SIDEBAR_ITEMS.map(
    (item) =>
      `<a class="sidebar-link ${item.path === active ? 'is-active' : ''}" href="${href(item.path)}">
        ${icon(item.icon, { size: 20 })} <span>${esc(item.label)}</span>
      </a>`,
  ).join('');

  return `
    <div class="admin-sidebar" id="admin-sidebar" aria-label="Menu administration">
      <div class="admin-sidebar-brand">
        <div class="logo">${icon('logo', { size: 24 })}</div>
        <span>LYNAQE<br><span class="brand-sub">CONNECT</span></span>
      </div>
      <nav class="admin-nav-sidebar">
        ${items}
      </nav>
      <button class="admin-sidebar-toggle" id="admin-sidebar-toggle" type="button" aria-label="Ouvrir/fermer le menu">
        ✕
      </button>
    </div>
  `;
}

function headerHtml(active) {
  const items = NAV_ITEMS.map(
    (item) =>
      `<a class="header-nav-link ${item.path === active ? 'is-active' : ''}" href="${href(item.path)}">
        ${icon(item.icon, { size: 18 })} ${esc(item.label)}
      </a>`,
  ).join('');

  return `
    <header class="admin-header" id="admin-header">
      <div class="admin-header-left">
        <button class="admin-header-toggle" id="admin-header-toggle" type="button" aria-label="Ouvrir le menu">
          ${icon('menu', { size: 20 })}
        </button>
        <div class="admin-brand">
          ${icon('logo', { size: 20 })} <span>LYNAQE CONNECT</span>
        </div>
      </div>
      <nav class="admin-header-nav">
        ${items}
      </nav>
    </header>
  `;
}

export function adminNavHtml(active) {
  return headerHtml(active);
}

/* --- Construction de la barre de navigation admin ------------------------ */

/**
 * Branche le bouton de déconnexion présent dans la barre admin.
 */
export function wireAdminBar(onLogout) {
  const sidebarToggle = document.getElementById('admin-sidebar-toggle');
  sidebarToggle?.addEventListener('click', toggleSidebarState);
  document.getElementById('admin-header-toggle')?.addEventListener('click', toggleSidebarState);

  document.getElementById('admin-logout')?.addEventListener('click', onLogout);
}

export function handleAdminError(error) {
  if (error?.status === 401) {
    clearAdminToken();
    toast('Ta session a expiré. Connecte-toi à nouveau.', 'warning');
    navigate(ROUTES.admin, { replace: true });
    return;
  }

  toast(error?.message || 'Une erreur inattendue est survenue.', 'error');
}

/* --- Fonctions d'enveloppe pour app.js ----------------------------------- */

/**
 * HTML complet de la page administration avec sidebar et header.
 * À appeler une fois au démarrage dans app.js, pas dans chaque page render.
 * @param {string} active La route active pour la sidebar
 * @returns {string} HTML complet sidebar + header
 */
export function adminPageWrapper(active) {
  const sidebarActive = active || ROUTES.adminSuggestions;
  const headerActive = active || ROUTES.adminSuggestions;

  return `
    ${sidebarHtml(sidebarActive)}
    ${headerHtml(headerActive)}
    <main class="admin-main" id="main" role="main">
      <!-- Page content injected by individual page render functions -->
    </main>
  `;
}

/* --- HTML pour la page de connexion admin (se par) ---------------------- */

/** HTML de la page de connexion administration. */
export function adminLoginHtml() {
  return `
    <div class="admin-login" role="dialog" aria-modal="true" aria-label="Connexion administration">
      <form class="panel login-card" id="login-form" novalidate>
        <span class="login-mark">${icon('lock', { size: 30 })}</span>
        <h1>Espace administration</h1>
        <p class="field-hint">Gérez les suggestions et participez à l'amélioration de votre lycée.</p>

        <div class="field">
          <label for="password">Mot de passe</label>
          <div class="input-group">
            <input id="password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required />
            <button class="btn btn-icon btn-ghost" type="button" id="toggle-password" aria-label="Afficher le mot de passe">${icon('eye', { size: 18 })}</button>
          </div>
          <div class="field-foot"><span class="error" data-error="password"></span></div>
        </div>

        <button class="btn btn-primary btn-lg btn-block" type="submit" id="login-button">${icon('lock', { size: 18 })} Se connecter</button>
        <a class="login-back" href="${href(ROUTES.home)}">${icon('chevronLeft', { size: 15 })} Retour au site</a>
      </form>
    </div>
  `;
}