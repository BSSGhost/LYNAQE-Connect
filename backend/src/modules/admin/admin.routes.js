/**
 * Routes d'administration.
 *
 * Acces unique protege par mot de passe (cahier des charges) : aucun compte a
 * creer, aucune inscription, aucune gestion de plusieurs administrateurs.
 * Toutes les routes, sauf `/login`, exigent un jeton de session valide.
 *
 *   POST   /api/admin/login
 *   GET    /api/admin/session
 *   POST   /api/admin/logout
 *   GET    /api/admin/statistics
 *   GET    /api/admin/suggestions
 *   GET    /api/admin/suggestions/:id
 *   PATCH  /api/admin/suggestions/:id
 *   PATCH  /api/admin/suggestions/:id/status
 *   PATCH  /api/admin/suggestions/:id/moderation
 *   GET    /api/admin/suggestions/:id/logs
 *   DELETE /api/admin/suggestions/:id
 *   GET    /api/admin/logs
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { adminLimiter, loginLimiter } from '../../middleware/rateLimit.js';
import { requireAdmin, signAdminToken, verifyAdminPassword } from '../../middleware/auth.js';
import { forbidden, notFound } from '../../utils/errors.js';
import { ok } from '../../http/responses.js';
import { parseIdParam } from '../../http/params.js';
import { schemas } from '../../validation/schemas.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import * as adminService from '../admin/admin.service.js';
import { getStatistics } from '../statistics/statistics.service.js';

export const adminRouter = Router();

adminRouter.param('id', parseIdParam);

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** Connexion : une seule Verification scrypt, jamais de mot de passe en clair. */
adminRouter.post(
  '/login',
  loginLimiter,
  validateBody(schemas.adminLogin, 'Mot de passe requis.'),
  asyncHandler(async (req, res) => {
    const valid = await verifyAdminPassword(req.body.password);
    if (!valid) {
      logger.warn('Echec de connexion administrateur', {
        ip: req.clientIpMasked,
        requestId: req.id,
      });
      throw forbidden('Mot de passe administrateur incorrect.');
    }

    const token = signAdminToken();
    logger.info('Connexion administrateur reussie', { ip: req.clientIpMasked, requestId: req.id });

    // Le jeton n'est volontairement PAS place dans un cookie : le frontend le
    // conserve en memoire de session (voir `frontend/assets/js/store.js`), ce
    // qui evite toute exposition a une requete cross-site automatique.
    return ok(res, {
      token,
      tokenType: 'Bearer',
      expiresIn: config.admin.sessionTtl,
      expiresAt: new Date(Date.now() + config.admin.sessionTtl * 1000).toISOString(),
      role: 'admin',
    });
  }),
);

/** Verifie que la session est toujours valide (utilise au chargement admin). */
adminRouter.get(
  '/session',
  adminLimiter,
  requireAdmin,
  asyncHandler(async (req, res) =>
    ok(res, {
      authenticated: true,
      role: req.admin.role,
      expiresAt: new Date(req.admin.expiresAt * 1000).toISOString(),
    }),
  ),
);

/** Deconnexion : le jeton etant sans etat, le client le supprime simplement. */
adminRouter.post(
  '/logout',
  adminLimiter,
  requireAdmin,
  asyncHandler(async (req, res) => ok(res, { loggedOut: true })),
);

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

adminRouter.get(
  '/statistics',
  adminLimiter,
  requireAdmin,
  asyncHandler(async (req, res) => ok(res, await getStatistics())),
);

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

adminRouter.get(
  '/suggestions',
  adminLimiter,
  requireAdmin,
  validateQuery(schemas.adminListQuery, 'Paramètres de liste invalides.'),
  asyncHandler(async (req, res) => {
    const result = await adminService.listSuggestions(req.validatedQuery);
    return ok(res, result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  }),
);

adminRouter.get(
  '/suggestions/:id',
  adminLimiter,
  requireAdmin,
  asyncHandler(async (req, res) => ok(res, await adminService.getSuggestion(req.resourceId))),
);

adminRouter.patch(
  '/suggestions/:id',
  adminLimiter,
  requireAdmin,
  validateBody(schemas.adminUpdateSuggestion, 'Modification invalide.'),
  asyncHandler(async (req, res) =>
    ok(res, await adminService.updateSuggestion(req.resourceId, req.body, req)),
  ),
);

adminRouter.patch(
  '/suggestions/:id/status',
  adminLimiter,
  requireAdmin,
  validateBody(schemas.updateStatus, 'Statut invalide.'),
  asyncHandler(async (req, res) =>
    ok(res, await adminService.changeStatus(req.resourceId, req.body, req)),
  ),
);

adminRouter.patch(
  '/suggestions/:id/moderation',
  adminLimiter,
  requireAdmin,
  validateBody(schemas.moderationUpdate, 'Paramètres de modération invalides.'),
  asyncHandler(async (req, res) =>
    ok(res, await adminService.setModeration(req.resourceId, req.body, req)),
  ),
);

adminRouter.get(
  '/suggestions/:id/logs',
  adminLimiter,
  requireAdmin,
  asyncHandler(async (req, res) =>
    ok(res, await adminService.listLogsForSuggestion(req.resourceId)),
  ),
);

adminRouter.delete(
  '/suggestions/:id',
  adminLimiter,
  requireAdmin,
  asyncHandler(async (req, res) => ok(res, await adminService.removeSuggestion(req.resourceId, req))),
);

// ---------------------------------------------------------------------------
// Journal de moderation
// ---------------------------------------------------------------------------

adminRouter.get(
  '/logs',
  adminLimiter,
  requireAdmin,
  validateQuery(schemas.adminLogQuery, 'Paramètres de journal invalides.'),
  asyncHandler(async (req, res) => {
    const result = await adminService.listLogs(req.validatedQuery);
    return ok(res, result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  }),
);

// ---------------------------------------------------------------------------
// Filet de securite : toute route /api/admin inconnue est protegee puis 404.
// ---------------------------------------------------------------------------

adminRouter.use(
  requireAdmin,
  (req, res, next) => next(notFound(`Route d'administration introuvable : ${req.method} ${req.path}`)),
);
