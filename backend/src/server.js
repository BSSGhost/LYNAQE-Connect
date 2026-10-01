#!/usr/bin/env node
/**
 * Point d'entree du serveur LYNAQE Connect.
 *
 * Demarrage :
 *   1. valide la configuration (echoue clairement si .env est incomplet) ;
 *   2. verifie que MySQL repond et que le schema est present ;
 *   3. verifie que le mot de passe administrateur est configure ;
 *   4. monte l'application Express.
 */

import { createApp } from './app.js';
import { config, assertConfigIsValid, collectWarnings, ENV_FILE } from './config/env.js';
import { getPool, ping, closePool } from './config/db.js';
import { configureLogger, logger } from './utils/logger.js';
import { getAdminPasswordHash } from './middleware/auth.js';

const paint = {
  ok: (t) => `\u001b[32m${t}\u001b[0m`,
  warn: (t) => `\u001b[33m${t}\u001b[0m`,
  err: (t) => `\u001b[31m${t}\u001b[0m`,
  dim: (t) => `\u001b[90m${t}\u001b[0m`,
  bold: (t) => `\u001b[1m${t}\u001b[0m`,
  accent: (t) => `\u001b[36m${t}\u001b[0m`,
};

function banner() {
  console.log('');
  console.log(paint.bold(paint.accent('  ██╗  ██╗   ██████╗   ██████╗')));
  console.log(paint.bold(paint.accent('  ██║  ██║  ██╔═══██╗ ██╔════╝')) + paint.dim('   LYNAQE Connect'));
  console.log(paint.bold(paint.accent('  ███████║  ██║   ██║ ██║      ')) + paint.dim('   Votre voix, notre lycée de demain.'));
  console.log(paint.bold(paint.accent('  ██╔══██║  ██║▄▄ ██║ ██║      ')));
  console.log(paint.bold(paint.accent('  ██║  ██║  ╚██████╔╝ ╚██████╗ ')));
  console.log(paint.bold(paint.accent('  ╚═╝  ╚═╝   ╚═════╝   ╚═════╝ ')));
  console.log('');
}

async function start() {
  banner();

  // --- 1. Configuration ---------------------------------------------------
  assertConfigIsValid();
  configureLogger({ level: config.logLevel, isProduction: config.isProduction });

  console.log(`  ${paint.ok('CONFIG')} fichier ${paint.dim(ENV_FILE)}`);
  console.log(
    `  ${paint.ok('CONFIG')} environnement ${paint.bold(config.env)}, journal ${config.logLevel}`,
  );
  for (const warning of collectWarnings()) {
    console.log(`  ${paint.warn('ATTENTION')} ${warning}`);
  }

  // --- 2. MySQL -----------------------------------------------------------
  try {
    const started = Date.now();
    const result = await ping();
    console.log(
      `  ${paint.ok('MYSQL')} ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database} — ${result.latencyMs} ms`,
    );
    if (!result.ok) throw new Error('MySQL a repondu de facon inattendue.');
    void started;
  } catch (error) {
    console.error(`  ${paint.err('MYSQL')} Connexion impossible : ${error.message}`);
    console.error('');
    console.error(paint.dim('  Verifiez que le service MySQL est demarre, puis :'));
    console.error(paint.dim('    npm run check      # diagnostic complet'));
    console.error(paint.dim('    npm run migrate    # creation de la base et des tables'));
    process.exit(1);
  }

  // Le pool est cree au premier appel : on verifie ici qu'il se construit.
  getPool();

  // --- 3. Administration --------------------------------------------------
  try {
    const hash = await getAdminPasswordHash();
    const scheme = hash.split('$')[0];
    console.log(`  ${paint.ok('ADMIN')} mot de passe verifie cote serveur (${scheme}), jamais transmis au navigateur`);
  } catch {
    console.error(`  ${paint.err('ADMIN')} Aucun mot de passe administrateur configure.`);
    console.error('');
    console.error(paint.dim('  Generez un hash puis renseignez ADMIN_PASSWORD_HASH dans .env :'));
    console.error(paint.dim('    npm run hash-password -- "votre-mot-de-passe"'));
    process.exit(1);
  }

  // --- 4. Application -----------------------------------------------------
  const app = createApp();

  const server = app.listen(config.server.port, config.server.host, () => {
    const url = `http://${config.server.host}:${config.server.port}`;
    console.log('');
    console.log(`  ${paint.bold('Application prete')}  ${paint.accent(url)}`);
    console.log(`  ${paint.dim('Frontend    ')} ${url}/`);
    console.log(`  ${paint.dim('Administration')} ${url}/#/admin`);
    console.log(`  ${paint.dim('Statistiques ')} ${url}/#/admin/statistiques`);
    console.log(`  ${paint.dim('Sante        ')} ${url}/api/health`);
    console.log('');
    console.log(`  ${paint.dim('Ctrl+C pour arrêter le serveur.')}`);
    console.log('');

    logger.info('Serveur demarre', {
      url,
      env: config.env,
      node: process.version,
      pid: process.pid,
    });
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error('');
      console.error(`  ${paint.err('PORT OCCUPE')} ${config.server.host}:${config.server.port} est deja utilise.`);
      console.error(paint.dim('  Changez PORT dans .env ou arretez le processus qui occupe ce port.'));
    } else {
      console.error(`  ${paint.err('ERREUR SERVEUR')} ${error.message}`);
    }
    process.exit(1);
  });

  // --- Arret propre -------------------------------------------------------
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('');
    console.log(`  ${paint.dim(`${signal} recu : fermeture en cours...`)}`);
    server.close(async () => {
      try {
        await closePool();
        console.log(`  ${paint.ok('ARRET')} connexions MySQL fermees. A bientot.`);
      } catch (error) {
        console.error(`  ${paint.err('ARRET')} ${error.message}`);
      } finally {
        process.exit(0);
      }
    });
    // Garde-fou : si une connexion reste bloquee, on force l'arret.
    setTimeout(() => process.exit(0), 8000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('');
  console.error(paint.err('Le serveur n a pas pu demarrer :'));
  console.error(`  ${error.message}`);
  if (!config.isProduction && error.stack) {
    console.error(paint.dim(error.stack.split('\n').slice(1, 6).join('\n')));
  }
  process.exit(1);
});
