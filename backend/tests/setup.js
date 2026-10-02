/**
 * Amorçage commun des tests (chargé avant chaque fichier de test via --import).
 *
 * Objectifs :
 *  - ne jamais toucher la base de production : les tests utilisent
 *    `lynaqe_connect_test`, recréée à chaque exécution ;
 *  - ne jamais inscrire le vrai mot de passe administrateur dans le dépôt :
 *    les tests utilisent un mot de passe de test dont le hash est calculé
 *    ici, en mémoire ;
 *  - désactiver la limitation de débit (les tests enchaînent les requêtes) ;
 *  - rendre la sortie des tests lisible (journal silencieux).
 *
 * ⚠ Ce module définit les variables d'environnement AVANT que `config/env.js`
 *   ne soit importé par les fichiers de test.
 */

process.env.NODE_ENV = 'test';

// Les tests doivent toujours viser une base MySQL locale dédiée par défaut.
// Les variables TEST_DB_* permettent d'utiliser un autre serveur de test,
// mais jamais les variables DB_* de production du fichier .env.
process.env.DB_HOST = process.env.TEST_DB_HOST ?? '127.0.0.1';
process.env.DB_PORT = process.env.TEST_DB_PORT ?? '3306';
process.env.DB_USER = process.env.TEST_DB_USER ?? 'root';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? '';
process.env.DB_SSL = process.env.TEST_DB_SSL ?? 'false';
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'lynaqe_connect_test';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'secret-de-test-uniquement-32-caracteres-minimum-0000';

// Garde-fou : refuser toute base dont le nom ne se termine pas par `_test`.
// Sans ce filet, un `npm test` mal configuré pourrait effacer de vraies
// suggestions.
if (!/.*_test$/u.test(process.env.DB_NAME)) {
  throw new Error(
    `Sécurité des tests : DB_NAME doit se terminer par "_test" (reçu : "${process.env.DB_NAME}").`,
  );
}

/** Mot de passe utilisé par les tests d'administration (jamais celui du site). */
export const TEST_ADMIN_PASSWORD = 'mot-de-passe-de-test-lynaqe';

// `passwords.js` n'importe pas `env.js` : on peut donc le charger ici sans
// déclencher la lecture de la configuration trop tôt.
const { hashSecret } = await import('../src/utils/passwords.js');
process.env.ADMIN_PASSWORD = '';
process.env.ADMIN_PASSWORD_HASH = await hashSecret(TEST_ADMIN_PASSWORD);
