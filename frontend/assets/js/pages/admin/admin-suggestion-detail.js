/**
 * Administration — fiche détaillée d'une suggestion : édition, statut,
 * publication, note interne, historique et suppression.
 * Interface moderne et professionnelle.
 */

import {
  SUGGESTION_STATUSES,
  CATEGORY_META,
  ROUTES,
  LIMITS,
} from '../../../../../shared/constants.js';
import { mount, esc } from '../../core/dom.js';
import { href, navigate } from '../../core/router.js';
import { icon } from '../../core/icons.js';
import { adminApi } from '../../core/api.js';
import { formatDateTime, formatNumber, pluralize } from '../../core/format.js';
import { toast, confirmDialog } from '../../core/ui.js';
import { loadingHtml } from '../../components/layout.js';
import { statusBadge, categoryTag, progressStepsHtml, timelineHtml, moderationLogHtml } from '../../components/suggestions.js';
import { guardAdmin, handleAdminError, adminNavHtml, sidebarHtml, wireAdminBar } from './admin-shell.js';
import { logoutAdmin } from './admin-logout.js';

export async function render(context) {
  if (!guardAdmin()) return;
  const main = document.getElementById('main');
  // Sidebar + header + content
  mount(
    main,
    `${sidebarHtml(ROUTES.adminSuggestions)}${adminNavHtml(ROUTES.adminSuggestions)}${loadingHtml('Chargement de la fiche…')}`,
  );
  wireAdminBar(() => logoutAdmin());

  try {
    const { data } = await adminApi.suggestion(context.params.id);
    mount(
      main,
      `${sidebarHtml(ROUTES.adminSuggestions)}${adminNavHtml(ROUTES.adminSuggestions)}${detailHtml(data)}`,
    );
    wireAdminBar(() => logoutAdmin());
    wireForms(main, data.suggestion);
  } catch (error) {
    handleAdminError(error);
    mount(
      main,
      `${sidebarHtml(ROUTES.adminSuggestions)}${adminNavHtml(ROUTES.adminSuggestions)}
      <div class="state-block state-error" role="alert">${icon('alert', { size: 32 })}<h2>Erreur</h2><p>${esc(error.message)}</p>
      <a class="btn btn-outline" href="${href(ROUTES.adminSuggestions)}">${icon('chevronLeft', { size: 16 })} Retour à la liste}</a></div>`,
    );
    wireAdminBar(() => logoutAdmin());
  }
}

function detailHtml(data) {
  const s = data.suggestion;
  const statusOptions = SUGGESTION_STATUSES.map(
    (status) => `<option value="${esc(status)}" ${status === s.status ? 'selected' : ''}>${esc(status)}</option>`,
  ).join('');
  const categoryOptions = CATEGORY_META.map(
    (c) => `<option value="${esc(c.value)}" ${c.value === s.category ? 'selected' : ''}>${esc(c.value)}</option>`,
  ).join('');

  const logRows = data.moderationLogs.length
    ? data.moderationLogs.map(moderationLogHtml).join('')
    : `<tr><td colspan="5" class="cell-sub">Aucune entrée de journal.</td></tr>`;

  return `
  <div class="container admin-detail">
    <a class="back-link" href="${href(ROUTES.adminSuggestions)}">${icon('chevronLeft', { size: 16 })} Retour à la liste</a>

    <header class="admin-detail-head">
      <div class="card-top">${statusBadge(s.statusInfo)}${categoryTag(s.categoryInfo, s.category)}
        <span class="pill ${s.visibility === 'publique' ? 'pill-public' : 'pill-private'}">${s.visibility === 'publique' ? 'Publiée' : 'Non publiée'}</span>
      </div>
      <h1>${esc(s.title)}</h1>
      <p class="cell-sub">${esc(s.trackingCode ?? '')} · ${formatNumber(s.supportCount)} soutien${pluralize(s.supportCount, '', 's')} · reçue le ${esc(formatDateTime(s.createdAt))}</p>
    </header>

    <div class="admin-detail-grid">
      <div class="admin-detail-main">
        <section class="panel">
          <h2>${icon('edit', { size: 18 })} Modifier le contenu</h2>
          <form id="edit-form" class="form">
            <div class="field"><label for="edit-title">Titre</label><input id="edit-title" name="title" type="text" maxlength="${LIMITS.titleMax}" value="${esc(s.title)}" /></div>
            <div class="field"><label for="edit-category">Catégorie</label><select id="edit-category" name="category">${categoryOptions}</select></div>
            <div class="field"><label for="edit-description">Description</label><textarea id="edit-description" name="description" rows="6" maxlength="${LIMITS.descriptionMax}">${esc(s.description)}</textarea></div>
            <div class="field-row">
              <div class="field"><label for="edit-location">Lieu</label><input id="edit-location" name="location" type="text" maxlength="${LIMITS.locationMax}" value="${esc(s.location ?? '')}" /></div>
              <div class="field"><label for="edit-author">Nom de l'auteur</label><input id="edit-author" name="authorName" type="text" maxlength="${LIMITS.authorNameMax}" value="${esc(s.authorName ?? '')}" ${s.isAnonymous ? 'disabled' : ''} /></div>
            </div>
            <div class="field"><label for="edit-extra">Informations complémentaires</label><textarea id="edit-extra" name="extraInfo" rows="3" maxlength="${LIMITS.extraInfoMax}">${esc(s.extraInfo ?? '')}</textarea></div>
            <div class="field"><label for="edit-note">Note interne de modération</label><textarea id="edit-note" name="moderationNote" rows="3" maxlength="${LIMITS.moderationNoteMax}" placeholder="Visible uniquement par l'administration">${esc(s.moderationNote ?? '')}</textarea></div>
            <div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check', { size: 16 })} Enregistrer les modifications</button></div>
          </form>
        </section>

        <section class="panel">
          <h2>${icon('history', { size: 18 })} Historique du suivi (visible par l'auteur)</h2>
          ${timelineHtml(data.timeline)}
        </section>

        <section class="panel">
          <h2>${icon('journal', { size: 18 })} Journal de modération</h2>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Action</th><th>Suggestion</th><th>Nouveau statut</th><th>Acteur</th><th>Date</th></tr></thead>
            <tbody>${logRows}</tbody>
          </table></div>
        </section>
      </div>

      <aside class="admin-detail-side">
        <section class="panel">
          <h2>Progression</h2>
          ${progressStepsHtml(s.status)}
          <p class="field-hint">${esc(s.statusInfo?.description ?? '')}</p>
        </section>

        <section class="panel">
          <h2>${icon('refresh', { size: 18 })} Changer le statut</h2>
          <div class="field"><label for="status-select">Nouveau statut</label><select id="status-select">${statusOptions}</select></div>
          <div class="field"><label for="status-message">Message public (facultatif)</label><textarea id="status-message" rows="3" maxlength="${LIMITS.adminMessageMax}" placeholder="Affiché dans le suivi de l'auteur"></textarea></div>
          <div class="field checkbox"><input id="status-publish" type="checkbox" ${s.visibility === 'publique' ? 'checked' : ''} /><label for="status-publish">Publier cette suggestion</label></div>
          <button class="btn btn-primary btn-block" type="button" id="apply-status">${icon('check', { size: 16 })} Appliquer le statut</button>
        </section>

        <section class="panel">
          <h2>${icon('shieldCheck', { size: 18 })} Modération</h2>
          <div class="field"><label for="moderation-visibility">Visibilité</label>
            <select id="moderation-visibility">
              <option value="privee" ${s.visibility === 'privee' ? 'selected' : ''}>Non publiée</option>
              <option value="publique" ${s.visibility === 'publique' ? 'selected' : ''}>Publiée</option>
            </select>
          </div>
          <div class="field"><label for="moderation-note">Note interne</label><textarea id="moderation-note" rows="3" maxlength="${LIMITS.moderationNoteMax}">${esc(s.moderationNote ?? '')}</textarea></div>
          <button class="btn btn-outline btn-block" type="button" id="apply-moderation">${icon('shieldCheck', { size: 16 })} Appliquer</button>
        </section>
      </aside>
    </div>
  </div>`;
}

function wireForms(main, suggestion) {
  const editForm = main.querySelector('#edit-form');
  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(editForm).entries());
    const patch = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'moderationNote' || value !== '') patch[key] = value;
    }
    if (suggestion.isAnonymous) delete patch.authorName;

    try {
      const result = await adminApi.updateSuggestion(suggestion.id, patch);
      toast('Modifications enregistrées.', 'success');
      void result;
    } catch (error) {
      handleAdminError(error);
    }
  });

  main.querySelector('#apply-status').addEventListener('click', async () => {
    const status = main.querySelector('#status-select').value;
    const message = main.querySelector('#status-message').value.trim();
    const publish = main.querySelector('#status-publish').checked;
    try {
      await adminApi.changeStatus(suggestion.id, { status, message: message || undefined, publish });
      toast(`Statut mis à jour : ${status}.`, 'success');
    } catch (error) {
      handleAdminError(error);
    }
  });

  main.querySelector('#apply-moderation').addEventListener('click', async () => {
    const visibility = main.querySelector('#moderation-visibility').value;
    const moderationNote = main.querySelector('#moderation-note').value.trim();
    try {
      await adminApi.moderate(suggestion.id, { visibility, moderationNote: moderationNote || undefined });
      toast('Modération mise à jour.', 'success');
    } catch (error) {
      handleAdminError(error);
    }
  });

  main.querySelector('[data-action="delete"]').addEventListener('click', async (event) => {
    const title = event.currentTarget.getAttribute('data-title');
    const ok = await confirmDialog({
      title: 'Supprimer la suggestion',
      message: `Supprimer définitivement « ${title} » ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.remove(suggestion.id);
      toast('Suggestion supprimée.', 'success');
      navigate(ROUTES.adminSuggestions, { replace: true });
    } catch (error) {
      handleAdminError(error);
    }
  });
}