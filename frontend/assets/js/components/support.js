/**
 * Bouton de soutien partagé (liste et détail).
 * Un seul soutien par appareil : le serveur est l'autorité, l'interface se
 * contente de refléter sa réponse.
 */

import { suggestionsApi } from '../core/api.js';
import { toast } from '../core/ui.js';
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
  button.setAttribute('aria-label', supported ? 'Retirer mon soutien' : 'Soutenir cette idée');
}

export function wireSupportButtons(root) {
  const supportedIds = getSupportedIds();
  root.querySelectorAll('[data-support]').forEach((button) => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    const id = button.getAttribute('data-support');
    updateButtonState(button, supportedIds.has(id));
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const wasSupported = button.classList.contains('is-supported');
        const { data } = wasSupported
          ? await suggestionsApi.unsupport(id)
          : await suggestionsApi.support(id);
        const countEl = button.querySelector('[data-support-count]');
        if (countEl) countEl.textContent = formatNumber(data.supportCount);
        const nextSupported = wasSupported ? !data.removed : true;
        updateButtonState(button, nextSupported);
        if (nextSupported) supportedIds.add(id);
        else supportedIds.delete(id);
        saveSupportedIds(supportedIds);
        toast(
          nextSupported ? 'Merci pour ton soutien !' : 'Ton soutien a été retiré.',
          data.alreadySupported && !wasSupported ? 'info' : 'success',
        );
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  });
}
