/**
 * Limitation de debit.
 *
 * Protection des operations sensibles (depot de suggestion, suivi, soutien,
 * connexion administrateur) contre les abus et le remplissage de la base.
 *
 * Les quotas sont distincts par type d'operation et configurables par
 * variables d'environnement (voir `.env.example`).
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { tooManyRequests } from '../utils/errors.js';

function build({ max, windowMs = config.rateLimit.windowMs, name, message }) {
  if (!config.rateLimit.enabled) {
    // Limitation desactivee (developpement ou tests) : laissez passer.
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Le generateur de cle par defaut s'appuie sur `req.ip` et gere IPv4/IPv6.
    // Les requetes reussies ne consomment pas de quota.
    skipSuccessfulRequests: name === 'login',
    handler: (req, res, next, options) => {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((options.windowMs - Date.now()) / 1000),
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      next(
        tooManyRequests(
          message ??
            `Trop de requêtes. Réessayez dans ${retryAfterSeconds} secondes.`,
        ),
      );
    },
  });
}

/** Lecture publique : navigation, filtres, detail. */
export const publicLimiter = build({
  max: config.rateLimit.public,
  name: 'public',
});

/** Depot d'une suggestion : quota serré (protege la base). */
export const submitLimiter = build({
  max: config.rateLimit.submit,
  name: 'submit',
  message:
    'Vous avez envoyé beaucoup de suggestions. Attendez quelques minutes avant de réessayer.',
});

/** Verification d'un numero de suivi : prevents le brute force du code secret. */
export const trackingLimiter = build({
  max: config.rateLimit.tracking,
  name: 'tracking',
  message:
    'Trop de tentatives de suivi. Patientez quelques minutes avant de réessayer.',
});

/** Soutien a une suggestion. */
export const supportLimiter = build({
  max: config.rateLimit.support,
  name: 'support',
});

/** Connexion administrateur : quasi bloquee apres quelques essais. */
export const loginLimiter = build({
  max: config.rateLimit.login,
  name: 'login',
  message: 'Trop de tentatives de connexion. Patientez quelques minutes.',
});

/** Operations d'administration (navigation une fois connecte). */
export const adminLimiter = build({
  max: config.rateLimit.admin,
  name: 'admin',
});
