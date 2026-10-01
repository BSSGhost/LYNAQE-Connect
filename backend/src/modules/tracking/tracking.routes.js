/**
 * Route de suivi.
 *
 *   POST /api/tracking   verifier un numero de suivi + code secret
 *
 * Le code secret est compare a son hash scrypt. Le message d'erreur est
 * volontairement identique pour un numero inconnu et un code faux.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { trackingLimiter } from '../../middleware/rateLimit.js';
import { ok } from '../../http/responses.js';
import { schemas } from '../../validation/schemas.js';
import * as service from '../suggestions/suggestion.service.js';

export const trackingRouter = Router();

trackingRouter.post(
  '/',
  trackingLimiter,
  validateBody(schemas.trackingRequest, 'Le numéro de suivi et le code secret sont obligatoires.'),
  asyncHandler(async (req, res) => {
    const result = await service.trackSuggestion(req.body, {
      clientIpMasked: req.clientIpMasked,
      userAgent: req.userAgent,
    });
    return ok(res, result);
  }),
);
