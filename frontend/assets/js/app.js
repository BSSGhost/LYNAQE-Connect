/**
 * Point d'entrée du frontend.
 *
 * Rôle : poser le thème, rendre l'entête et le pied de page une seule fois,
 * enregistrer les routes (navigation par fragment) puis démarrer le routeur.
 */

import { ROUTES } from '../../../shared/constants.js';
import { createRouter } from './core/router.js';
import { applyTheme, getTheme } from './core/store.js';
import { scrollTop } from './core/dom.js';
import { toast } from './core/ui.js';
import { renderHeader, setActiveNav } from './components/header.js';
import { renderFooter } from './components/footer.js';

import * as home from './pages/home.js';
import * as submit from './pages/submit.js';
import * as suggestions from './pages/suggestions.js';
import * as detail from './pages/detail.js';
import * as track from './pages/track.js';
import * as howItWorks from './pages/how-it-works.js';
import * as about from './pages/about.js';
import * as rules from './pages/rules.js';
import * as privacy from './pages/privacy.js';
import * as notFound from './pages/not-found.js';

import * as adminLogin from './pages/admin/admin-login.js';
import * as adminSuggestions from './pages/admin/admin-suggestions.js';
import * as adminSuggestionDetail from './pages/admin/admin-suggestion-detail.js';
import * as adminStatistics from './pages/admin/admin-statistics.js';
import * as adminLogs from './pages/admin/admin-logs.js';

function currentPath() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  return `/${hash.split('?')[0].split('/').filter(Boolean).join('/')}`;
}

function isAdminRoute(path) {
  return path === '/admin' || path.startsWith('/admin/');
}

function bootstrap() {
  applyTheme(getTheme());
  renderHeader();
  renderFooter();

  const router = createRouter()
    .add(ROUTES.home, home.render)
    .add(ROUTES.submit, submit.render)
    .add(ROUTES.suggestions, suggestions.render)
    .add(`${ROUTES.suggestions}/:id`, detail.render)
    .add(ROUTES.track, track.render)
    .add(ROUTES.howItWorks, howItWorks.render)
    .add(ROUTES.about, about.render)
    .add(ROUTES.rules, rules.render)
    .add(ROUTES.privacy, privacy.render)
    .add(ROUTES.admin, adminLogin.render)
    .add(ROUTES.adminSuggestions, adminSuggestions.render)
    .add(`${ROUTES.adminSuggestions}/:id`, adminSuggestionDetail.render)
    .add(ROUTES.adminStatistics, adminStatistics.render)
    .add(ROUTES.adminLogs, adminLogs.render)
    .add(ROUTES.notFound, notFound.render)
    .notFound(notFound.render);

  const afterNav = () => {
    const path = currentPath();
    setActiveNav(path);
    // Mettre à jour la classe admin pour afficher/cacher la sidebar
    const html = document.documentElement;
    if (path === ROUTES.admin) {
      html.setAttribute('data-admin-login', '');
      html.removeAttribute('data-admin');
    } else if (isAdminRoute(path)) {
      html.removeAttribute('data-admin-login');
      html.setAttribute('data-admin', '');
    } else {
      html.removeAttribute('data-admin-login');
      html.removeAttribute('data-admin');
    }
    scrollTop();
    document.getElementById('main')?.focus?.();
  };

  router.start(afterNav).then(afterNav).catch(() => {});

  window.addEventListener('error', (event) => {
    if (event?.message) toast('Une erreur inattendue est survenue.', 'error');
  });

  document.documentElement.classList.add('is-ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}