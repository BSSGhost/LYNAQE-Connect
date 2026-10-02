/**
 * Écran de connexion à l'administration (un seul mot de passe, aucun compte).
 * Refonte UI/UX premium et minimaliste.
 */

import { ROUTES } from '../../../../../shared/constants.js';
import { mount } from '../../core/dom.js';
import { href, navigate } from '../../core/router.js';
import { icon } from '../../core/icons.js';
import { adminApi } from '../../core/api.js';
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
    `<div class="admin-login" role="dialog" aria-modal="true" aria-label="Connexion administration">
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
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorSlot = form.querySelector('[data-error="password"]');
    errorSlot.textContent = '';

    if (!password.value) {
      errorSlot.textContent = 'Le mot de passe est obligatoire.';
      password.focus();
      return;
    }

    const button = form.querySelector('#login-button');
    button.disabled = true;
    button.innerHTML = `${icon('refresh', { size: 18 })} Connexion…`;

    try {
      const { data } = await adminApi.login(password.value);
      setAdminToken(data.token);
      toast('Connexion réussie. Bienvenue !', 'success');
      navigate(ROUTES.adminSuggestions, { replace: true });
    } catch (error) {
      const message = error.status === 403 ? 'Mot de passe incorrect. Veuillez réessayer.' : error.message;
      errorSlot.textContent = message;
      form.querySelector('.field')?.classList.add('has-error');
      toast(message, 'error');
      button.disabled = false;
      button.innerHTML = `${icon('lock', { size: 18 })} Se connecter`;
      password.select();
    }
  });

  password.focus();
}