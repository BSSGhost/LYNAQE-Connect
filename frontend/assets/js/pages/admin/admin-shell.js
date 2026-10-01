/**
 * Enveloppe commune aux pages d'administration : garde d'accès et navigation.
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

const ITEMS = [
  { path: ROUTES.adminSuggestions, label: 'Suggestions', icon: 'list' },
  { path: ROUTES.adminStatistics, label: 'Statistiques', icon: 'chart' },
  { path: ROUTES.adminLogs, label: 'Journal', icon: 'journal' },
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

/** Gère une erreur d'API : une session expirée renvoie vers la connexion. */
export function handleAdminError(error) {
  if (error?.status === 401) {
    clearAdminToken();
    toast('Ta session a expiré, connecte-toi à nouveau.', 'warning');
    navigate(ROUTES.admin, { replace: true });
    return;
  }
  toast(error?.message ?? 'Une erreur est survenue.', 'error');
}

export function adminNavHtml(active) {
  const links = ITEMS.map(
    (item) =>
      `<a class="admin-nav-link ${item.path === active ? 'is-active' : ''}" href="${href(item.path)}">
        ${icon(item.icon, { size: 17 })} ${esc(item.label)}
      </a>`,
  ).join('');

  return `<div class="admin-bar">
    <div class="admin-bar-inner container">
      <span class="admin-badge">${icon('shieldCheck', { size: 16 })} Administration</span>
      <nav class="admin-nav" aria-label="Navigation administration">${links}</nav>
      <button class="btn btn-ghost btn-sm" type="button" id="admin-logout">${icon('logout', { size: 16 })} Déconnexion</button>
    </div>
  </div>`;
}

/** Branche le bouton de déconnexion présent dans la barre admin. */
export function wireAdminBar(onLogout) {
  document.getElementById('admin-logout')?.addEventListener('click', onLogout);
}
