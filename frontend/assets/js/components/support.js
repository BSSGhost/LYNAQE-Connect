/**
 * Bouton de soutien partagé (liste et détail).
 * Un seul soutien par appareil : le serveur est l'autorité, l'interface se
 * contente de refléter sa réponse.
 */

import { suggestionsApi } from '../core/api.js';
import { confirmDialog, toast } from '../core/ui.js';
import { formatNumber } from '../core/format.js';

const SUPPORT_STORAGE_KEY = 'lynaqe.supportedSuggestions';

function getSupportedIds() {
  const saved = localStorage.getItem(SUPPORT_STORAGE_KEY);
  if (!saved) return new Set();
  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== 'string')) {
    throw new Error('Les préférences de soutien enregistrées sont invalides.');
  }
  return new Set(parsed);
}

function saveSupportedIds(ids) {
  localStorage.setItem(SUPPORT_STORAGE_KEY, JSON.stringify([...ids]));
}

function updateButtonState(button, supported) {
  button.classList.toggle('is-supported', supported);
  button.setAttribute('aria-pressed', String(supported));
  button.setAttribute('aria-label', supported ? 'Soutenu' : 'Soutenir cette idée');
  const state = button.querySelector('[data-support-state]');
  if (state) state.textContent = supported ? 'Soutenu' : 'Soutenir';
  const removeButton = button.parentElement?.querySelector(`[data-unsupport="${button.dataset.support}"]`);
  if (removeButton) removeButton.hidden = !supported;
}

export function wireSupportButtons(root) {
  const supportedIds = getSupportedIds();
  root.querySelectorAll('[data-support]').forEach((button) => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    const id = button.getAttribute('data-support');
    updateButtonState(button, supportedIds.has(id));
    button.addEventListener('click', async () => {
      if (button.classList.contains('is-supported')) return;
      button.disabled = true;
      try {
        const { data } = await suggestionsApi.support(id);
        const countEl = button.querySelector('[data-support-count]');
        if (countEl) countEl.textContent = formatNumber(data.supportCount);
        updateButtonState(button, true);
        supportedIds.add(id);
        saveSupportedIds(supportedIds);
        toast(data.alreadySupported ? 'Tu soutiens déjà cette idée.' : 'Merci pour ton soutien !', data.alreadySupported ? 'info' : 'success');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  });

  root.querySelectorAll('[data-unsupport]').forEach((button) => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    const id = button.getAttribute('data-unsupport');
    button.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Retirer mon soutien',
        message: 'Veux-tu vraiment retirer ton soutien à cette suggestion ?',
        confirmLabel: 'Retirer mon soutien',
        danger: true,
      });
      if (!confirmed) return;

      const supportButton = button.parentElement?.querySelector(`[data-support="${id}"]`);
      if (!supportButton) return;
      button.disabled = true;
      supportButton.disabled = true;
      try {
        const { data } = await suggestionsApi.unsupport(id);
        const countEl = supportButton.querySelector('[data-support-count]');
        if (countEl) countEl.textContent = formatNumber(data.supportCount);
        updateButtonState(supportButton, false);
        const supportedIds = getSupportedIds();
        supportedIds.delete(id);
        saveSupportedIds(supportedIds);
        toast(data.removed ? 'Ton soutien a été retiré.' : 'Aucun soutien actif sur cet appareil.', 'success');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        button.disabled = false;
        supportButton.disabled = false;
      }
    });
  });
}
