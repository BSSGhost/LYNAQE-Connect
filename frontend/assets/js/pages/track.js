/**
 * Page « Suivre ma suggestion » : accès réservé à l'auteur via son numéro de
 * suivi et son code secret. Aucun autre moyen d'accéder à une suggestion
 * non publiée n'existe.
 */

import { ROUTES } from '../../../../shared/constants.js';
import { mount, esc } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { trackingApi } from '../core/api.js';
import { validateTracking } from '../core/validation.js';
import { formatTrackingCode } from '../core/format.js';
import { toast } from '../core/ui.js';
import { pageHeader, breadcrumbs } from '../components/layout.js';
import { statusBadge, categoryTag, progressStepsHtml, completionPlanHtml, timelineHtml } from '../components/suggestions.js';

export async function render() {
  const main = document.getElementById('main');
  mount(main, formHtml());
  wireForm(main);
}

function formHtml() {
  return `${breadcrumbs([{ label: 'Accueil', href: ROUTES.home }, { label: 'Suivre ma suggestion' }])}
  ${pageHeader({
    title: 'Suivre ma suggestion',
    lead: 'Saisis le numéro de suivi et le code secret qui t’ont été affichés après l’envoi.',
  })}
  <form class="form form-narrow" id="track-form" novalidate>
    <div class="field">
      <label for="trackingCode">Numéro de suivi <span class="req">*</span></label>
      <input id="trackingCode" name="trackingCode" type="text" placeholder="LQC-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" required />
      <div class="field-foot"><span class="error" data-error="trackingCode"></span></div>
    </div>
    <div class="field">
      <label for="secretCode">Code secret <span class="req">*</span></label>
      <div class="input-group">
        <input id="secretCode" name="secretCode" type="password" placeholder="Ton code secret" autocomplete="off" autocapitalize="characters" spellcheck="false" required />
        <button class="btn btn-icon btn-ghost" type="button" id="toggle-secret" aria-label="Afficher le code secret">${icon('eye', { size: 18 })}</button>
      </div>
      <div class="field-foot"><span class="error" data-error="secretCode"></span></div>
    </div>
    <p class="notice">${icon('lock', { size: 16 })} Ces informations sont personnelles : ne les partage avec personne.</p>
    <div class="form-actions">
      <button class="btn btn-primary btn-lg" type="submit" id="track-button">${icon('search', { size: 18 })} Suivre</button>
    </div>
  </form>
  <div id="track-result"></div>`;
}

function wireForm(main) {
  const form = main.querySelector('#track-form');
  const tracking = form.querySelector('#trackingCode');
  const secret = form.querySelector('#secretCode');

  tracking.addEventListener('blur', () => {
    if (tracking.value.trim()) tracking.value = formatTrackingCode(tracking.value);
  });

  const toggle = form.querySelector('#toggle-secret');
  toggle.addEventListener('click', () => {
    const show = secret.type === 'password';
    secret.type = show ? 'text' : 'password';
    toggle.innerHTML = icon(show ? 'eyeOff' : 'eye', { size: 18 });
    toggle.setAttribute('aria-label', show ? 'Masquer le code secret' : 'Afficher le code secret');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);

    const values = {
      trackingCode: tracking.value.trim(),
      secretCode: secret.value.trim(),
    };
    const { valid, errors } = validateTracking(values);
    if (!valid) {
      showErrors(form, errors);
      return;
    }

    const button = form.querySelector('#track-button');
    button.disabled = true;
    button.innerHTML = `${icon('refresh', { size: 18 })} Recherche…`;

    try {
      const { data } = await trackingApi.lookup(values);
      renderResult(main, data);
    } catch (error) {
      showErrors(form, { trackingCode: error.message });
      toast(error.message, 'error');
      button.disabled = false;
      button.innerHTML = `${icon('search', { size: 18 })} Suivre`;
    }
  });
}

function renderResult(main, data) {
  const suggestion = data.suggestion;
  main.querySelector('#track-form').hidden = true;

  const result = main.querySelector('#track-result');
  result.innerHTML = `
    <section class="panel track-result">
      <div class="card-top">${statusBadge(suggestion.statusInfo)}${categoryTag(suggestion.categoryInfo, suggestion.category)}</div>
      <h2>${esc(suggestion.title)}</h2>
      <div class="meta-row">
        <span class="meta-item">${icon('tag', { size: 15 })} ${esc(suggestion.trackingCode)}</span>
        <span class="meta-item">${icon('eye', { size: 15 })} ${suggestion.visibility === 'publique' ? 'Publiée' : 'Non publiée'}</span>
      </div>
      <div class="detail-block"><h2>Description</h2><p class="preserve">${esc(suggestion.description)}</p></div>
      <div class="detail-block"><h2>Progression</h2>${progressStepsHtml(suggestion.status, data.timeline)}${completionPlanHtml(suggestion)}</div>
      <div class="detail-block"><h2>${icon('history', { size: 18 })} Historique</h2>${timelineHtml(data.timeline)}</div>
      <div class="form-actions">
        <button class="btn btn-outline" type="button" data-action="again">${icon('search', { size: 16 })} Vérifier une autre suggestion</button>
        <a class="btn btn-ghost" href="${href(ROUTES.suggestions)}">${icon('list', { size: 16 })} Voir les suggestions publiques</a>
      </div>
    </section>`;

  result.querySelector('[data-action="again"]').addEventListener('click', () => {
    main.querySelector('#track-form').hidden = false;
    main.querySelector('#track-form').reset();
    result.innerHTML = '';
  });
}

function clearErrors(form) {
  form.querySelectorAll('.error').forEach((node) => {
    node.textContent = '';
  });
  form.querySelectorAll('.field.has-error').forEach((node) => node.classList.remove('has-error'));
}

function showErrors(form, errors) {
  for (const [field, message] of Object.entries(errors)) {
    const target = form.querySelector(`[data-error="${field}"]`);
    if (target) {
      target.textContent = message;
      target.closest('.field')?.classList.add('has-error');
    }
  }
}
