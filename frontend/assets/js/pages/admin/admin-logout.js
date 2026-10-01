/**
 * Déconnexion administrateur : le jeton étant sans état côté serveur, il suffit
 * de le supprimer localement (et d'informer le serveur pour le journal).
 */

import { ROUTES } from '../../../../../shared/constants.js';
import { navigate } from '../../core/router.js';
import { adminApi } from '../../core/api.js';
import { clearAdminToken } from '../../core/store.js';
import { toast } from '../../core/ui.js';

export async function logoutAdmin() {
  try {
    await adminApi.logout();
  } catch (error) {
    /* Même si le serveur est injoignable, la session locale doit disparaître. */
  }
  clearAdminToken();
  toast('Déconnexion réussie.', 'info');
  navigate(ROUTES.home, { replace: true });
}
