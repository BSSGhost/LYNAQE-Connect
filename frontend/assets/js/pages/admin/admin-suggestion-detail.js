/**
 * Administration — fiche détaillée d'une suggestion : consultation, statut,
 * publication, note interne, historique et suppression.
 * Interface moderne et professionnelle.
 */

import {
  SUGGESTION_STATUSES,
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
import { statusBadge, categoryTag, progressStepsHtml, completionPlanHtml, timelineHtml, moderationLogHtml } from '../../components/suggestions.js';
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
    wireActions(main, data.suggestion, () => render(context));
    wirePhotoGallery(main, data.suggestion.id, data.photos ?? []);
  } catch (error) {
    handleAdminError(error);
    mount(
      main,
      `${sidebarHtml(ROUTES.adminSuggestions)}${adminNavHtml(ROUTES.adminSuggestions)}
      <div class="state-block state-error" role="alert">${icon('alert', { size: 32 })}<h2>Erreur</h2><p>${esc(error.message)}</p>
      <a class="btn btn-outline" href="${href(ROUTES.adminSuggestions)}">${icon('chevronLeft', { size: 16 })} Retour à la liste</a></div>`,
    );
    wireAdminBar(() => logoutAdmin());
  }
}

function detailHtml(data) {
  const s = data.suggestion;
  const statusOptions = SUGGESTION_STATUSES.map(
    (status) => `<option value="${esc(status)}" ${status === s.status ? 'selected' : ''}>${esc(status)}</option>`,
  ).join('');
  const visibilityOptions = [
    { value: 'privee', label: 'Non publiée' },
    { value: 'publique', label: 'Publiée' },
  ].map(
    (visibility) => `<option value="${visibility.value}" ${visibility.value === s.visibility ? 'selected' : ''}>${visibility.label}</option>`,
  ).join('');
  const location = s.location
    ? `<div class="detail-block"><h2>${icon('mapPin', { size: 18 })} Lieu concerné</h2><p>${esc(s.location)}</p></div>`
    : '';
  const extraInfo = s.extraInfo
    ? `<div class="detail-block"><h2>Informations complémentaires</h2><p class="preserve">${esc(s.extraInfo)}</p></div>`
    : '';

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
      <div class="meta-row"><span class="meta-item">${icon('user', { size: 15 })} ${s.isAnonymous ? 'Auteur anonyme' : 'Suggestion d’un élève'}</span></div>
    </header>

    <div class="admin-detail-grid">
      <div class="admin-detail-main">
        <section class="detail-block" aria-labelledby="admin-suggestion-description">
          <h2 id="admin-suggestion-description">Description</h2>
          <p class="preserve">${esc(s.description)}</p>
        </section>
        ${location}
        ${extraInfo}
        ${photosHtml(data.photos ?? [])}
        ${reportsHtml(data.reports ?? [], s.reportCount ?? 0)}
        <div id="photo-viewer-root"></div>

        <section class="panel admin-actions-panel">
          <h2>${icon('shieldCheck', { size: 18 })} Actions administratives</h2>

          <div class="admin-action-row">
            <div class="admin-action-summary">
              <span class="admin-action-label">Statut</span>
              <div class="admin-action-current">
                <span class="badge tone-${esc(s.statusInfo?.tone ?? 'neutral')}" data-current-status><span class="dot"></span>${esc(s.statusInfo?.value ?? s.status)}</span>
                <button class="admin-action-edit" type="button" data-edit-toggle="status" aria-controls="status-editor" aria-expanded="false">Modifier <span aria-hidden="true">→</span></button>
              </div>
            </div>
            <div class="admin-action-editor" id="status-editor" hidden>
              <div class="field"><label for="status-select">Nouveau statut</label><select id="status-select">${statusOptions}</select></div>
              <div class="field checkbox"><input id="status-publish" type="checkbox" ${s.visibility === 'publique' ? 'checked' : ''} /><label for="status-publish">Publier avec le changement de statut</label></div>
              <div class="admin-progress-fields" id="admin-progress-fields" ${s.status === 'En cours' ? '' : 'hidden'}>
                <div class="field"><label for="progress-percent">Avancement déclaré (%)</label><input id="progress-percent" type="number" min="0" max="100" step="1" value="${s.progressPercent ?? ''}" placeholder="Ex. 80" /></div>
                <div class="field"><label for="expected-completion-date">Date prévue de réalisation</label><input id="expected-completion-date" type="date" value="${esc(s.expectedCompletionDate ?? '')}" /></div>
              </div>
            </div>
          </div>

          <div class="admin-action-row">
            <div class="admin-action-summary">
              <span class="admin-action-label">Publication</span>
              <div class="admin-action-current">
                <span class="pill ${s.visibility === 'publique' ? 'pill-public' : 'pill-private'}" data-current-visibility>${s.visibility === 'publique' ? 'Publiée' : 'Non publiée'}</span>
                <button class="admin-action-edit" type="button" data-edit-toggle="visibility" aria-controls="visibility-editor" aria-expanded="false">Modifier <span aria-hidden="true">→</span></button>
              </div>
            </div>
            <div class="admin-action-editor" id="visibility-editor" hidden>
              <div class="field"><label for="moderation-visibility">Visibilité</label><select id="moderation-visibility">${visibilityOptions}</select></div>
            </div>
          </div>

          <div class="admin-action-field">
            <label for="status-message">Réponse officielle à l’auteur</label>
            <textarea id="status-message" rows="2" maxlength="${LIMITS.adminMessageMax}" placeholder="Écrire une réponse visible dans le suivi de l’auteur…"></textarea>
          </div>
          <div class="admin-action-field">
            <label for="moderation-note">Note interne</label>
            <textarea id="moderation-note" rows="2" maxlength="${LIMITS.moderationNoteMax}" placeholder="Ajouter une note pour l'administration…">${esc(s.moderationNote ?? '')}</textarea>
          </div>

          <div class="admin-actions-footer">
            <button class="btn btn-outline btn-sm" type="button" id="apply-status">${icon('check', { size: 16 })} Enregistrer le statut</button>
            <button class="btn btn-outline btn-sm" type="button" id="apply-moderation">${icon('shieldCheck', { size: 16 })} Enregistrer la modération</button>
          </div>
          ${s.visibility === 'publique' ? `<button class="btn btn-outline btn-sm monthly-idea-action" type="button" data-monthly-idea>${icon('trophy', { size: 16 })} ${s.isMonthlyIdea ? 'Retirer l’idée du mois' : 'Choisir comme idée du mois'}</button>` : ''}
          <button class="btn btn-outline btn-sm danger admin-delete-action" type="button" data-action="delete" data-title="${esc(s.title)}">${icon('trash', { size: 16 })} Supprimer la suggestion</button>
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
          ${progressStepsHtml(s.status, data.timeline)}
          ${completionPlanHtml(s)}
          <p class="field-hint">${esc(s.statusInfo?.description ?? '')}</p>
        </section>
      </aside>
    </div>
  </div>`;
}

function photosHtml(photos) {
  const items = photos.length
    ? `<div class="admin-photo-grid">${photos
        .map(
          (photo, index) => `
            <button class="admin-photo-button" type="button" data-photo-id="${esc(photo.id)}" data-photo-index="${index}" aria-label="Ouvrir la photo ${index + 1}" aria-busy="true">
              <span class="admin-photo-loading">${icon('refresh', { size: 20 })}<span>Chargement…</span></span>
            </button>`,
        )
        .join('')}</div>
      <p class="admin-photo-count">${photos.length} photo${photos.length > 1 ? 's' : ''}</p>`
    : '<p class="admin-photo-empty">Aucune photo jointe à cette suggestion.</p>';
  return `
    <section class="panel admin-photos-panel" aria-labelledby="admin-photos-title">
      <h2 id="admin-photos-title">${icon('camera', { size: 18 })} Photos jointes</h2>
      ${items}
    </section>`;
}

function reportsHtml(reports, count) {
  const items = reports.length
    ? `<ul class="admin-report-list">${reports.map((report) => `
        <li data-report="${esc(report.id)}">
          <span><strong>${esc(report.reason)}</strong><small>${esc(formatDateTime(report.createdAt))}</small></span>
          <button class="btn btn-ghost btn-sm danger" type="button" data-remove-report="${esc(report.id)}" aria-label="Retirer le signalement ${esc(report.reason)}">${icon('trash', { size: 15 })} Traité</button>
        </li>`).join('')}</ul>`
    : '<p class="admin-photo-empty">Aucun signalement pour cette suggestion.</p>';
  return `<section class="panel admin-reports-panel">
    <h2>${icon('alert', { size: 18 })} Signalements <span class="report-count" data-report-count>${formatNumber(count)}</span></h2>
    ${items}
  </section>`;
}

function wirePhotoGallery(main, suggestionId, photos) {
  const buttons = [...main.querySelectorAll('[data-photo-id]')];
  if (!buttons.length) return;
  const photoUrls = new Array(buttons.length);
  const gallery = main.querySelector('.admin-photo-grid');
  let viewerCleanup = null;

  const cleanup = () => {
    viewerCleanup?.();
    photoUrls.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  };
  window.addEventListener('hashchange', cleanup, { once: true });

  buttons.forEach((button, index) => {
    adminApi.photo(suggestionId, photos[index].id)
      .then((blob) => {
        if (!button.isConnected) {
          return;
        }
        photoUrls[index] = URL.createObjectURL(blob);
        button.setAttribute('aria-busy', 'false');
        button.innerHTML = `<img src="${photoUrls[index]}" alt="Photo jointe ${index + 1}" loading="lazy" />`;
      })
      .catch(() => {
        button.disabled = true;
        button.setAttribute('aria-busy', 'false');
        button.innerHTML = `<span class="admin-photo-unavailable">${icon('alert', { size: 20 })}<span>Photo indisponible</span></span>`;
      });
  });

  gallery?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-photo-index]');
    if (!button || !photoUrls[Number(button.getAttribute('data-photo-index'))]) return;
    viewerCleanup = openPhotoViewer(
      main.querySelector('#photo-viewer-root'),
      photoUrls,
      Number(button.getAttribute('data-photo-index')),
      button,
    );
  });
}

function openPhotoViewer(root, photoUrls, initialIndex, trigger) {
  let index = initialIndex;
  root.innerHTML = `
    <div class="photo-viewer-backdrop" data-viewer-backdrop>
      <section class="photo-viewer" role="dialog" aria-modal="true" aria-labelledby="photo-viewer-count">
        <button class="photo-viewer-close" type="button" data-viewer-close aria-label="Fermer la visionneuse">${icon('x', { size: 22 })}</button>
        <button class="photo-viewer-nav photo-viewer-previous" type="button" data-viewer-previous aria-label="Photo précédente">${icon('chevronLeft', { size: 24 })}</button>
        <img class="photo-viewer-image" data-viewer-image alt="" />
        <button class="photo-viewer-nav photo-viewer-next" type="button" data-viewer-next aria-label="Photo suivante">${icon('chevronRight', { size: 24 })}</button>
        <p id="photo-viewer-count" class="photo-viewer-count"></p>
      </section>
    </div>`;

  const backdrop = root.querySelector('[data-viewer-backdrop]');
  const image = root.querySelector('[data-viewer-image]');
  const count = root.querySelector('#photo-viewer-count');
  const closeButton = root.querySelector('[data-viewer-close]');
  const previousButton = root.querySelector('[data-viewer-previous]');
  const nextButton = root.querySelector('[data-viewer-next]');

  const render = () => {
    image.src = photoUrls[index];
    image.alt = `Photo ${index + 1} sur ${photoUrls.length}`;
    count.textContent = `Photo ${index + 1} sur ${photoUrls.length}`;
    previousButton.hidden = photoUrls.length < 2;
    nextButton.hidden = photoUrls.length < 2;
  };
  const close = () => {
    root.innerHTML = '';
    trigger.focus();
  };
  const keydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowLeft' && photoUrls.length > 1) {
      event.preventDefault();
      index = (index - 1 + photoUrls.length) % photoUrls.length;
      render();
    } else if (event.key === 'ArrowRight' && photoUrls.length > 1) {
      event.preventDefault();
      index = (index + 1) % photoUrls.length;
      render();
    } else if (event.key === 'Tab') {
      const focusable = [...root.querySelectorAll('button:not([hidden])')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  closeButton.addEventListener('click', close);
  previousButton.addEventListener('click', () => {
    index = (index - 1 + photoUrls.length) % photoUrls.length;
    render();
  });
  nextButton.addEventListener('click', () => {
    index = (index + 1) % photoUrls.length;
    render();
  });
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', keydown);
  render();
  closeButton.focus();

  return () => {
    document.removeEventListener('keydown', keydown);
    root.innerHTML = '';
  };
}

function wireActions(main, suggestion, refresh) {
  const statusSelect = main.querySelector('#status-select');
  const progressFields = main.querySelector('#admin-progress-fields');
  statusSelect?.addEventListener('change', () => {
    progressFields.hidden = statusSelect.value !== 'En cours';
  });

  main.querySelectorAll('[data-edit-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const editor = main.querySelector(`#${button.getAttribute('aria-controls')}`);
      const expanded = button.getAttribute('aria-expanded') === 'true';
      editor.hidden = expanded;
      button.setAttribute('aria-expanded', String(!expanded));
      button.querySelector('span').textContent = expanded ? '→' : '↑';
      button.firstChild.textContent = expanded ? 'Modifier ' : 'Fermer ';
    });
  });

  main.querySelector('#apply-status').addEventListener('click', async () => {
    const button = main.querySelector('#apply-status');
    const status = main.querySelector('#status-select').value;
    const message = main.querySelector('#status-message').value.trim();
    const publish = main.querySelector('#status-publish').checked;
    const progressPercent = main.querySelector('#progress-percent')?.value;
    const expectedCompletionDate = main.querySelector('#expected-completion-date')?.value;
    button.disabled = true;
    try {
      await adminApi.changeStatus(suggestion.id, {
        status,
        message: message || undefined,
        publish,
        ...(status === 'En cours'
          ? {
              progressPercent: progressPercent === '' ? null : Number(progressPercent),
              expectedCompletionDate: expectedCompletionDate || null,
            }
          : {}),
      });
      toast(`Statut mis à jour : ${status}.`, 'success');
      await refresh();
    } catch (error) {
      handleAdminError(error);
    } finally {
      button.disabled = false;
    }
  });

  main.querySelector('[data-monthly-idea]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const nextValue = !suggestion.isMonthlyIdea;
      await adminApi.selectMonthlyIdea(nextValue ? suggestion.id : null);
      suggestion.isMonthlyIdea = nextValue;
      button.innerHTML = `${icon('trophy', { size: 16 })} ${nextValue ? 'Retirer l’idée du mois' : 'Choisir comme idée du mois'}`;
      toast(nextValue ? 'Cette suggestion est l’idée du mois.' : 'Idée du mois retirée.', 'success');
    } catch (error) {
      handleAdminError(error);
    } finally {
      button.disabled = false;
    }
  });

  main.querySelectorAll('[data-remove-report]').forEach((button) => {
    button.addEventListener('click', async () => {
      const reportId = button.getAttribute('data-remove-report');
      button.disabled = true;
      try {
        const { data } = await adminApi.removeReport(suggestion.id, reportId);
        main.querySelector(`[data-report="${reportId}"]`)?.remove();
        const count = main.querySelector('[data-report-count]');
        if (count) count.textContent = formatNumber(data.reportCount);
        if (data.reportCount === 0) {
          const list = main.querySelector('.admin-report-list');
          list?.replaceWith(Object.assign(document.createElement('p'), {
            className: 'admin-photo-empty',
            textContent: 'Aucun signalement pour cette suggestion.',
          }));
        }
        toast('Signalement marqué comme traité.', 'success');
      } catch (error) {
        handleAdminError(error);
        button.disabled = false;
      }
    });
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