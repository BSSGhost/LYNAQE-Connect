/**
 * Routes de metadonnees publiques.
 *
 *   GET /api/meta     statuts, categories, informations du projet
 *   GET /api/health   etat du service et de la connexion MySQL
 *
 * Aucune donnee sensible : `ADMIN_PASSWORD`, `JWT_SECRET` et les identifiants
 * MySQL ne sortent jamais du serveur.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ok } from '../../http/responses.js';
import { ping } from '../../config/db.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import {
  PROJECT,
  STATUS_META,
  CATEGORY_META,
  VISIBILITY_META,
  SUGGESTION_STATUSES,
  LIMITS,
} from '../../../../shared/constants.js';

export const metaRouter = Router();

/**
 * Source de verite exposee au frontend.
 * Le frontend importe deja `shared/constants.js` : cette route sert de
 * verification croisee et permet a un client tiers de connaitre le contrat.
 */
metaRouter.get(
  '/meta',
  asyncHandler(async (req, res) =>
    ok(res, {
      project: {
        name: PROJECT.name,
        tagline: PROJECT.tagline,
        school: PROJECT.school,
        creator: PROJECT.creator,
        creatorCredit: PROJECT.creatorCredit,
        afterSubmitMessage: PROJECT.afterSubmitMessage,
        emptyStateMessage: PROJECT.emptyStateMessage,
        emptyStateCta: PROJECT.emptyStateCta,
      },
      statuses: SUGGESTION_STATUSES,
      statusMeta: STATUS_META,
      categoryMeta: CATEGORY_META,
      visibilityMeta: VISIBILITY_META,
      limits: LIMITS,
    }),
  ),
);

/**
 * Sonde de sante.
 * Renvoie un vrai resultat de `SELECT 1` execute sur MySQL : un deploiement ne
 * peut donc pas afficher « OK » si la base est injoignable.
 */
metaRouter.get(
  '/health',
  asyncHandler(async (req, res) => {
    let database;
    try {
      const result = await ping();
      database = { ok: result.ok, latencyMs: result.latencyMs };
    } catch (error) {
      logger.error('Echec du test de connexion MySQL', { message: error.message });
      database = { ok: false, latencyMs: null };
    }

    const healthy = database.ok;
    return res.status(healthy ? 200 : 503).json({
      success: healthy,
      data: {
        service: 'lynaqe-connect-api',
        environment: config.env,
        uptimeSeconds: Math.round(process.uptime()),
        database,
        time: new Date().toISOString(),
      },
    });
  }),
);
