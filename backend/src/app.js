/**
 * Application Express.
 *
 * Ordre des couches (important) :
 *   1. securite (helmet, cors)
 *   2. analyse du corps de requete
 *   3. contexte de requete (id, IP, agent)
 *   4. fichiers statiques du frontend
 *   5. API
 *   6. 404 puis gestionnaire d'erreurs
 */

import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config, paths } from './config/env.js';
import { requestContext } from './middleware/context.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { suggestionRouter } from './modules/suggestions/suggestion.routes.js';
import { trackingRouter } from './modules/tracking/tracking.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { metaRouter } from './modules/meta/meta.routes.js';

export function createApp() {
  const app = express();

  // Derriere un proxy (reverse proxy, hebergement), l'IP reelle provient de
  // X-Forwarded-For. Desactive par defaut : un client ne peut pas falsifier
  // son IP tant que l'on n'est pas explicitement derriere un proxy de confiance.
  app.set('trust proxy', config.server.trustProxy);
  app.disable('x-powered-by');
  app.set('etag', 'strong');

  // --- 1. Securite ---------------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          // Les barres de progression et les variables de theme sont ecrites
          // via l'attribut `style` : 'unsafe-inline' reste limite aux styles.
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'"],
          'connect-src': ["'self'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );

  const allowedOrigins = new Set(config.server.corsOrigins);
  app.use(
    cors({
      origin(origin, callback) {
        // Requetes same-origin (navigateur vers notre propre serveur) : `origin`
        // est absent, on autorise.
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        // Origine inconnue : on n'ajoute aucun en-tete CORS. Le navigateur
        // bloquera la lecture de la reponse, sans pour autant produire une
        // erreur serveur (utile aux clients non-navigateur).
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Supporter-Token', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Retry-After'],
      credentials: false,
      maxAge: 600,
    }),
  );

  // --- 2. Corps de requete -------------------------------------------------
  app.use(express.json({ limit: config.server.bodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.server.bodyLimit }));

  // --- 3. Contexte --------------------------------------------------------
  app.use(requestContext);

  // --- 4. Frontend -------------------------------------------------------
  // `shared/` est servi afin que le frontend importe EXACTEMENT le meme
  // fichier de constantes que le backend : aucune divergence possible sur les
  // statuts ou les categories.
  app.use(
    '/shared',
    express.static(paths.shared, {
      index: false,
      dotfiles: 'deny',
      maxAge: config.isProduction ? '1h' : 0,
    }),
  );

  app.use(
    express.static(paths.frontend, {
      extensions: ['html'],
      index: 'index.html',
      dotfiles: 'deny',
      maxAge: config.isProduction ? '1h' : 0,
      setHeaders(res, filePath) {
        // Le HTML ne doit jamais etre mis en cache : une mise a jour du site
        // doit etre visible immediatement.
        if (path.extname(filePath) === '.html') {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
      },
    }),
  );

  // --- 5. API -------------------------------------------------------------
  app.use('/api', metaRouter);
  app.use('/api/suggestions', suggestionRouter);
  app.use('/api/tracking', trackingRouter);
  app.use('/api/admin', adminRouter);

  app.get('/api', (req, res) => {
    res.json({
      success: true,
      data: {
        name: 'LYNAQE Connect API',
        version: '1.0.0',
        documentation: 'README.md',
        endpoints: {
          public: [
            'GET    /api/health',
            'GET    /api/meta',
            'GET    /api/suggestions',
            'POST   /api/suggestions',
            'GET    /api/suggestions/:id',
            'POST   /api/suggestions/:id/support',
            'POST   /api/tracking',
          ],
          admin: [
            'POST   /api/admin/login',
            'GET    /api/admin/session',
            'POST   /api/admin/logout',
            'GET    /api/admin/statistics',
            'GET    /api/admin/suggestions',
            'GET    /api/admin/suggestions/:id',
            'PATCH  /api/admin/suggestions/:id',
            'PATCH  /api/admin/suggestions/:id/status',
            'PATCH  /api/admin/suggestions/:id/moderation',
            'GET    /api/admin/suggestions/:id/logs',
            'DELETE /api/admin/suggestions/:id',
            'GET    /api/admin/logs',
          ],
        },
      },
    });
  });

  // --- 6. Repli ------------------------------------------------------------
  // Toute route /api inconnue renvoie une erreur JSON (jamais du HTML).
  app.all('/api/*', notFoundHandler);

  // Le reste est le frontend : routage par hash cote client. On ne sert
  // l'application que pour une navigation (pas d'extension de fichier et
  // client acceptant le HTML), afin qu'un fichier manquant renvoie bien 404.
  app.get('*', (req, res, next) => {
    if (path.extname(req.path)) return next();
    if (!req.accepts('html')) return next();
    return res.sendFile(path.join(paths.frontend, 'index.html'));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
