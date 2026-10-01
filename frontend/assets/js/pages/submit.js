/**
 * Page « Proposer une idée » : formulaire de dépôt + écran de confirmation.
 *
 * Le code secret n'est affiché qu'une seule fois (il n'est jamais renvoyé par
 * l'API ensuite) : l'écran de confirmation insiste donc sur sa sauvegarde.
 */

import { CATEGORY_META, LIMITS, SUBMIT_SUCCESS_MESSAGE, PROJECT, ROUTES } from '../../../../shared/constants.js';
import { mount, esc } from '../core/dom.js';
import { href } from '../core/router.js';
import { icon } from '../core/icons.js';
import { suggestionsApi } from '../core/api.js';
import { validateSuggestion, counterClass } from '../core/validation.js';
import { formatTrackingCode } from '../core/format.js';
import { toast, copyText } from '../core/ui.js';
import { pageHeader, breadcrumbs } from '../components/layout.js';

export async function render() {
  const main = document.getElementById('main');
  const categories = CATEGORY_META.map(
    (category) => `<option value="${esc(category.value)}">${esc(category.value)}</option>`,
  ).join('');

  mount(
    main,
    `${breadcrumbs([{ label: 'Accueil', href: ROUTES.home }, { label: 'Proposer une idée' }])}
    ${pageHeader({
      eyebrow: 'Formulaire',
      title: 'Proposer une idée',
      lead: 'Décris ton idée le plus clairement possible. Toutes les suggestions sont examinées par l’équipe de modération.',
    })}
    <form class="form" id="suggestion-form" novalidate>
      <div class="field">
        <label for="title">Titre de l’idée <span class="req">*</span></label>
        <input id="title" name="title" type="text" maxlength="${LIMITS.titleMax}" placeholder="Ex. Installer des bancs dans la cour" autocomplete="off" required />
        <div class="field-foot"><span class="error" data-error="title"></span><span class="${counterClass(0, LIMITS.titleMax)}" data-counter="title">0 / ${LIMITS.titleMax}</span></div>
      </div>

      <div class="field">
        <label for="category">Catégorie <span class="req">*</span></label>
        <select id="category" name="category" required>
          <option value="">Choisir une catégorie…</option>
          ${categories}
        </select>
        <div class="field-foot"><span class="error" data-error="category"></span></div>
      </div>

      <div class="field">
        <label for="description">Description <span class="req">*</span></label>
        <textarea id="description" name="description" rows="7" maxlength="${LIMITS.descriptionMax}" placeholder="Explique le problème, ta proposition et le bénéfice attendu." required></textarea>
        <div class="field-foot"><span class="error" data-error="description"></span><span class="${counterClass(0, LIMITS.descriptionMax)}" data-counter="description">0 / ${LIMITS.descriptionMax}</span></div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="location">Lieu concerné <span class="opt">(facultatif)</span></label>
          <input id="location" name="location" type="text" maxlength="${LIMITS.locationMax}" placeholder="Ex. Cour principale, salle 6…" />
          <div class="field-foot"><span class="error" data-error="location"></span></div>
        </div>
        <div class="field">
          <label for="extraInfo">Informations complémentaires <span class="opt">(facultatif)</span></label>
          <input id="extraInfo" name="extraInfo" type="text" maxlength="${LIMITS.extraInfoMax}" placeholder="Ex. estimation de coût, nombre d’élèves concernés…" />
          <div class="field-foot"><span class="error" data-error="extraInfo"></span></div>
        </div>
      </div>

      <div class="field checkbox">
        <input id="isAnonymous" name="isAnonymous" type="checkbox" />
        <label for="isAnonymous">Envoyer de façon anonyme</label>
        <p class="field-hint">Si tu coches cette case, ton nom et ton contact ne seront jamais enregistrés.</p>
      </div>

      <fieldset class="field-row" data-identity>
        <legend class="visually-hidden">Coordonnées (facultatif)</legend>
        <div class="field">
          <label for="authorName">Nom affiché à la modération <span class="opt">(facultatif)</span></label>
          <input id="authorName" name="authorName" type="text" maxlength="${LIMITS.authorNameMax}" placeholder="Ton nom" autocomplete="name" />
          <div class="field-foot"><span class="error" data-error="authorName"></span></div>
        </div>
        <div class="field">
          <label for="authorContact">Contact <span class="opt">(facultatif)</span></label>
          <input id="authorContact" name="authorContact" type="text" maxlength="${LIMITS.authorContactMax}" placeholder="Téléphone ou e-mail" autocomplete="email" />
          <div class="field-foot"><span class="error" data-error="authorContact"></span></div>
        </div>
      </fieldset>

      <p class="notice">${icon('info', { size: 16 })} ${esc(PROJECT.afterSubmitMessage)}</p>

      <div class="form-actions">
        <a class="btn btn-ghost" href="${href(ROUTES.home)}">Annuler</a>
        <button class="btn btn-primary btn-lg" type="submit" id="submit-button">${icon('send', { size: 18 })} Envoyer ma suggestion</button>
      </div>
    </form>
    `,
  );

  const form = main.querySelector('#suggestion-form');
  const anonymousInput = form.querySelector('#isAnonymous');
  const identity = form.querySelector('[data-identity]');

  anonymousInput.addEventListener('change', () => {
    identity.hidden = anonymousInput.checked;
    if (anonymousInput.checked) {
      form.querySelector('#authorName').value = '';
      form.querySelector('#authorContact').value = '';
    }
  });

  form.querySelectorAll('[maxlength]').forEach((field) => {
    const counter = form.querySelector(`[data-counter="${field.name}"]`);
    if (!counter) return;
    const max = Number(field.getAttribute('maxlength'));
    const update = () => {
      counter.textContent = `${field.value.length} / ${max}`;
      counter.className = counterClass(field.value.length, max);
    };
    field.addEventListener('input', update);
    update();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);

    const values = formValues(form);
    const { valid, errors } = validateSuggestion(values);
    if (!valid) {
      showErrors(form, errors);
      toast('Merci de corriger les champs signalés.', 'warning');
      return;
    }

    const button = form.querySelector('#submit-button');
    button.disabled = true;
    button.innerHTML = `${icon('refresh', { size: 18 })} Envoi…`;

    try {
      const { data } = await suggestionsApi.create({
        title: values.title,
        description: values.description,
        category: values.category,
        location: values.location || undefined,
        extraInfo: values.extraInfo || undefined,
        isAnonymous: values.isAnonymous,
        authorName: values.isAnonymous ? undefined : values.authorName || undefined,
        authorContact: values.isAnonymous ? undefined : values.authorContact || undefined,
      });
      renderConfirmation(main, data);
      toast(SUBMIT_SUCCESS_MESSAGE, 'success');
    } catch (error) {
      if (error.details?.length) {
        const mapped = {};
        for (const issue of error.details) mapped[issue.path] = issue.message;
        showErrors(form, mapped);
      }
      toast(error.message, 'error');
      button.disabled = false;
      button.innerHTML = `${icon('send', { size: 18 })} Envoyer ma suggestion`;
    }
  });
}

function formValues(form) {
  const data = new FormData(form);
  return {
    title: String(data.get('title') ?? ''),
    category: String(data.get('category') ?? ''),
    description: String(data.get('description') ?? ''),
    location: String(data.get('location') ?? ''),
    extraInfo: String(data.get('extraInfo') ?? ''),
    isAnonymous: Boolean(data.get('isAnonymous')),
    authorName: String(data.get('authorName') ?? ''),
    authorContact: String(data.get('authorContact') ?? ''),
  };
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
  const first = form.querySelector('.field.has-error input, .field.has-error textarea, .field.has-error select');
  first?.focus();
}

function renderConfirmation(main, data) {
  const tracking = formatTrackingCode(data.trackingCode);
  const secret = data.secretCode;
  const suggestion = data.suggestion;

  mount(
    main,
    `<section class="panel confirmation">
      <div class="confirmation-head">
        <span class="confirmation-icon">${icon('checkCircle', { size: 40 })}</span>
        <h1>${esc(data.message ?? SUBMIT_SUCCESS_MESSAGE)}</h1>
        <p class="lead">${esc(data.afterSubmitMessage ?? '')}</p>
      </div>

      <div class="receipt">
        <div class="receipt-item">
          <span class="receipt-label">Numéro de suivi</span>
          <code class="receipt-value">${esc(tracking)}</code>
          <button class="btn btn-ghost btn-sm" type="button" data-copy="${esc(data.trackingCode)}">${icon('copy', { size: 15 })} Copier</button>
        </div>
        <div class="receipt-item">
          <span class="receipt-label">Code secret</span>
          <code class="receipt-value">${esc(secret)}</code>
          <button class="btn btn-ghost btn-sm" type="button" data-copy="${esc(secret)}">${icon('copy', { size: 15 })} Copier</button>
        </div>
      </div>

      <p class="notice notice-warning">${icon('alert', { size: 16 })} Note ces deux informations : le code secret ne sera plus jamais affiché.</p>

      ${suggestion ? `<p class="field-hint">Suggestion enregistrée le ${esc(new Date(suggestion.createdAt).toLocaleDateString('fr-FR'))} — statut : ${esc(suggestion.status)}.</p>` : ''}

      <div class="form-actions">
        <a class="btn btn-outline" href="${href(ROUTES.track)}">${icon('search', { size: 16 })} Suivre ma suggestion</a>
        <a class="btn btn-primary" href="${href(ROUTES.submit)}" data-action="new">${icon('plus', { size: 16 })} Proposer une autre idée</a>
      </div>
    </section>`,
  );

  main.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const ok = await copyText(button.getAttribute('data-copy'));
      toast(ok ? 'Copié dans le presse-papiers.' : 'Impossible de copier automatiquement.', ok ? 'success' : 'warning');
    });
  });
}
