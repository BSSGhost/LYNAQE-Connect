/**
 * Routes publiques des suggestions.
 *
 *   POST   /api/suggestions                    deposer une suggestion
 *   GET    /api/suggestions                    lister les suggestions publiees
 *   GET    /api/suggestions/:id                detail d'une suggestion publiee
 *   POST   /api/suggestions/:id/support        soutenir une suggestion
 *   DELETE /api/suggestions/:id/support        retirer son soutien
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { publicLimiter, submitLimiter, supportLimiter } from '../../middleware/rateLimit.js';
import { created, ok } from '../../http/responses.js';
import { parseIdParam } from '../../http/params.js';
import { schemas } from '../../validation/schemas.js';
import { PROJECT, SUBMIT_SUCCESS_MESSAGE } from '../../../../shared/constants.js';
import * as service from './suggestion.service.js';

export const suggestionRouter = Router();

suggestionRouter.param('id', parseIdParam);

/** Depot d'une suggestion. Le code secret n'est renvoye qu'ici, une seule fois. */
suggestionRouter.post(
  '/',
  submitLimiter,
  validateBody(schemas.createSuggestion, 'La suggestion est incomplète ou invalide.'),
  asyncHandler(async (req, res) => {
    const result = await service.createSuggestion(req.body, {
      clientIpMasked: req.clientIpMasked,
      userAgent: req.userAgent,
    });

    return created(res, {
      message: SUBMIT_SUCCESS_MESSAGE,
      afterSubmitMessage: PROJECT.afterSubmitMessage,
      trackingCode: result.trackingCode,
      secretCode: result.secretCode,
      suggestion: result.suggestion,
    });
  }),
);

/** Liste publique : seules les suggestions publiees sont accessibles. */
suggestionRouter.get(
  '/',
  publicLimiter,
  validateQuery(schemas.publicListQuery, 'Paramètres de liste invalides.'),
  asyncHandler(async (req, res) => {
    const result = await service.listPublic(req.validatedQuery);
    return ok(res, result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  }),
);

suggestionRouter.get(
  '/:id',
  publicLimiter,
  asyncHandler(async (req, res) => ok(res, await service.getPublicSuggestion(req.resourceId))),
);

/** Soutien : un seul soutien par personne et par suggestion. */
suggestionRouter.post(
  '/:id/support',
  supportLimiter,
  asyncHandler(async (req, res) => {
    const result = await service.supportSuggestion(req.resourceId, req);
    return ok(res, result);
  }),
);

/** Retrait du soutien de l'appareil courant. */
suggestionRouter.delete(
  '/:id/support',
  supportLimiter,
  asyncHandler(async (req, res) => {
    const result = await service.unsupportSuggestion(req.resourceId, req);
    return ok(res, result);
  }),
);
