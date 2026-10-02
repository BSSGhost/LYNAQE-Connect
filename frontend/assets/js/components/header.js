/**
 * Entête du site : marque, navigation, bouton de thème, lien administration.
 */

import { ROUTES, PROJECT } from '../../../../shared/constants.js';
import { href } from '../core/router.js';
import { getTheme, toggleTheme, applyTheme } from '../core/store.js';
import { icon } from '../core/icons.js';
import { el } from '../core/dom.js';

const LINKS = [
  { path: ROUTES.home, label: 'Accueil' },
  { path: ROUTES.submit, label: 'Proposer une idée' },
  { path: ROUTES.suggestions, label: 'Suggestions' },
  { path: ROUTES.howItWorks, label: 'Comment ça marche' },
  { path: ROUTES.about, label: 'À propos' },
];

export function renderHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;

  const navLinks = LINKS.map(
    (link) => `<a href="${href(link.path)}" data-route="${link.path}">${link.label}</a>`,
  ).join('');

  header.innerHTML = `
    <div class="container header-inner">
      <a class="brand" href="${href(ROUTES.home)}" aria-label="${PROJECT.name} — accueil">
        <span class="brand-mark">${icon('logo', { size: 24 })}</span>
        <span class="brand-text">${PROJECT.name}<small>${PROJECT.school}</small></span>
      </a>
      <nav class="nav" id="primary-nav" aria-label="Navigation principale">
        ${navLinks}
        <a href="${href(ROUTES.track)}" data-route="${ROUTES.track}">Suivre ma suggestion</a>
      </nav>
      <div class="header-actions">
        <button class="theme-toggle" type="button" id="theme-toggle" aria-label="Changer de thème" title="Changer de thème (clair / sombre)">
          ${icon('sun', { size: 20, className: 'icon-sun' })}
          ${icon('moon', { size: 20, className: 'icon-moon' })}
        </button>
        <a class="btn btn-primary" href="${href(ROUTES.submit)}">${icon('plus', { size: 18 })}<span>Proposer une idée</span></a>
        <button class="nav-toggle" type="button" id="nav-toggle" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="primary-nav">
          ${icon('menu', { size: 22 })}
        </button>
      </div>
    </div>
  `;

  const toggle = header.querySelector('#theme-toggle');
  toggle?.addEventListener('click', () => {
    applyTheme(toggleTheme());
  });

  const navToggle = header.querySelector('#nav-toggle');
  const nav = header.querySelector('#primary-nav');
  navToggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  });
  nav?.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      nav.classList.remove('is-open');
      navToggle?.setAttribute('aria-expanded', 'false');
    }
  });

  applyTheme(getTheme());
}

/** Met en évidence le lien correspondant au chemin courant. */
export function setActiveNav(path) {
  const header = document.getElementById('site-header');
  if (!header) return;
  for (const link of header.querySelectorAll('.nav a[data-route], .brand[data-route]')) {
    const target = link.getAttribute('data-route');
    const active =
      target === path ||
      (target !== ROUTES.home && target !== '/' && path.startsWith(target));
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

export function adminLink() {
  return el('a', { class: 'btn btn-ghost btn-sm', href: href(ROUTES.admin) }, [
    icon('lock', { size: 16 }),
    'Admin',
  ]);
}
