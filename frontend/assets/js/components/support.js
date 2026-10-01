/**
 * Bouton de soutien partagé (liste et détail).
 * Un seul soutien par appareil : le serveur est l'autorité, l'interface se
 * contente de refléter sa réponse.
 */

import { suggestionsApi } from '../core/api.js';
import { toast } from '../core/ui.js';
import { formatNumber } from '../core/format.js';

export function wireSupportButtons(root) {
  root.querySelectorAll('[data-support]').forEach((button) => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-support');
      button.disabled = true;
      try {
        const { data } = await suggestionsApi.support(id);
        const countEl = button.querySelector('[data-support-count]');
        if (countEl) countEl.textContent = formatNumber(data.supportCount);
        button.classList.add('is-supported');
        toast(
          data.alreadySupported ? 'Tu as déjà soutenu cette suggestion.' : 'Merci pour ton soutien !',
          data.alreadySupported ? 'info' : 'success',
        );
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  });
}
