/**
 * Écran de connexion à l'administration (un seul mot de passe, aucun compte).
 * Refonte UI/UX premium et minimaliste.
 */

import { ROUTES } from '../../../../../shared/constants.js';
import { mount } from '../../core/dom.js';
import { href, navigate } from '../../core/router.js';
import { icon } from '../../core/icons.js';
import { adminApi } from '../../core/api.js';
import { isAdmin, setAdminToken } from '../../core/store.js';
import { toast } from '../../core/ui.js';

export async function render() {
  const main = document.getElementById('main');

  if (isAdmin()) {
    try {
      await adminApi.session();
      navigate(ROUTES.adminSuggestions, { replace: true });
      return;
    } catch (error) {
      /* session expirée : on affiche le formulaire */
    }
  }

  mount(
    main,
    `<div class="admin-login-page">
      <section class="login-brand-panel" aria-labelledby="login-brand-title">
        <a class="login-brand" href="${href(ROUTES.home)}" aria-label="LYNAQE Connect, accueil">
          <span class="login-brand-mark">${icon('school', { size: 25 })}</span>
          <span class="login-brand-wordmark"><strong>LYNAQE</strong><span>CONNECT</span></span>
        </a>

        <div class="login-brand-copy">
          <p class="login-eyebrow"><span></span> LYNAQE de Sédhiou</p>
          <h1 id="login-brand-title">Votre voix,<br />notre lycée<br /><span>de demain.</span></h1>
          <p class="login-brand-description">Une plateforme pensée pour permettre aux élèves de proposer des idées, signaler des problèmes et participer à l'amélioration de leur lycée.</p>
        </div>

        <div class="login-illustration" aria-hidden="true">
          <div class="login-orbit login-orbit-one"></div>
          <div class="login-orbit login-orbit-two"></div>
          <div class="login-idea-card">
            <div class="login-idea-top"><span class="login-idea-logo">${icon('lightbulb', { size: 17 })}</span><span>ESPACE COLLABORATIF</span><span class="login-live-dot"></span></div>
            <p class="login-idea-caption">Une idée pour le lycée</p>
            <h2>Un foyer plus accueillant</h2>
            <div class="login-idea-meta"><span>${icon('users', { size: 15 })} 24 soutiens</span><span class="login-idea-status"><i></i> À l'étude</span></div>
            <div class="login-idea-progress"><span></span></div>
            <div class="login-idea-footer"><span>Suivi par l'équipe</span><span class="login-avatar-stack"><i>A</i><i>M</i><i>+</i></span></div>
          </div>
          <div class="login-float-card login-float-note"><span>${icon('sparkles', { size: 17 })}</span><div><strong>Chaque idée compte</strong><small>Construisons ensemble</small></div></div>
          <div class="login-float-card login-float-stat"><span class="login-stat-icon">${icon('chart', { size: 18 })}</span><div><strong>Des idées, du progrès</strong><small>Un lycée qui avance</small></div></div>
          <div class="login-visual-cross login-cross-one"></div>
          <div class="login-visual-cross login-cross-two"></div>
        </div>

        <div class="login-pillars">
          <div><span>${icon('lightbulb', { size: 16 })}</span><p><strong>Idées</strong><small>Proposer et imaginer</small></p></div>
          <div><span>${icon('users', { size: 16 })}</span><p><strong>Participation</strong><small>Faire entendre sa voix</small></p></div>
          <div><span>${icon('school', { size: 16 })}</span><p><strong>Amélioration</strong><small>Agir pour le lycée</small></p></div>
        </div>
      </section>

      <section class="login-form-panel" aria-labelledby="login-title">
        <div class="login-form-content">
          <div class="login-form-heading">
            <span class="login-security-mark">${icon('lock', { size: 19 })}</span>
            <p class="login-form-overline">ACCÈS SÉCURISÉ</p>
            <h2 id="login-title">Espace administration</h2>
            <p>Gérez les suggestions et participez à l'amélioration de votre lycée.</p>
          </div>

          <form class="login-form" id="login-form" novalidate>
            <div class="login-field">
              <label for="password">Mot de passe</label>
              <div class="login-password-wrap">
                <span class="login-password-icon">${icon('lock', { size: 17 })}</span>
                <input id="password" name="password" type="password" autocomplete="current-password" placeholder="Saisissez votre mot de passe" required aria-describedby="password-error" />
                <button class="login-password-toggle" type="button" id="toggle-password" aria-label="Afficher le mot de passe" aria-pressed="false">${icon('eye', { size: 19 })}</button>
              </div>
              <p class="login-error" id="password-error" data-error="password" role="alert" aria-live="polite"></p>
            </div>

            <button class="login-submit" type="submit" id="login-button">
              <span class="login-submit-lock">${icon('lock', { size: 17 })}</span>
              <span class="login-submit-label">Se connecter</span>
              <span class="login-spinner" aria-hidden="true"></span>
            </button>
          </form>

          <a class="login-back" href="${href(ROUTES.home)}">${icon('chevronLeft', { size: 16 })} Retour au site</a>
        </div>
        <p class="login-form-note">${icon('shieldCheck', { size: 14 })} Accès réservé à l'équipe administrative</p>
      </section>
    </div>`,
  );

  const form = main.querySelector('#login-form');
  const password = form.querySelector('#password');
  const toggle = form.querySelector('#toggle-password');

  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.innerHTML = icon(show ? 'eyeOff' : 'eye', { size: 18 });
    toggle.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    toggle.setAttribute('aria-pressed', String(show));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorSlot = form.querySelector('[data-error="password"]');
    errorSlot.textContent = '';
    form.classList.remove('has-error');

    if (!password.value) {
      errorSlot.textContent = 'Le mot de passe est obligatoire.';
      form.classList.add('has-error');
      password.focus();
      return;
    }

    const button = form.querySelector('#login-button');
    button.disabled = true;
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
    button.querySelector('.login-submit-label').textContent = 'Connexion…';

    try {
      const { data } = await adminApi.login(password.value);
      setAdminToken(data.token);
      toast('Connexion réussie. Bienvenue !', 'success');
      navigate(ROUTES.adminSuggestions, { replace: true });
    } catch (error) {
      const message =
        error.status === 403
          ? 'Mot de passe incorrect. Veuillez réessayer.'
          : error.status === 429
            ? 'Trop de tentatives. Veuillez patienter avant de réessayer.'
            : 'Connexion impossible pour le moment. Veuillez réessayer.';
      errorSlot.textContent = message;
      form.classList.add('has-error');
      toast(message, 'error');
      button.disabled = false;
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
      button.querySelector('.login-submit-label').textContent = 'Se connecter';
      password.select();
    }
  });

  password.focus({ preventScroll: true });
}