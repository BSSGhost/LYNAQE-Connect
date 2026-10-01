#!/usr/bin/env node
/**
 * Genere un hash scrypt pour le mot de passe administrateur ou un code secret.
 *
 * Usage :
 *   npm run hash-password                       # lit ADMIN_PASSWORD du .env
 *   npm run hash-password -- "motdepasse"       # valeur en ligne de commande
 *   npm run hash-password -- "secret" --length 10
 *
 * Le hash obtenu se place dans ADMIN_PASSWORD_HASH (jamais dans le frontend).
 */

import { hashSecret } from '../src/utils/passwords.js';
import { config } from '../src/config/env.js';

const args = process.argv.slice(2);
const lengthFlagIndex = args.indexOf('--length');
const requested = lengthFlagIndex !== -1 ? Number.parseInt(args[lengthFlagIndex + 1], 10) : NaN;

// Ignore les drapeaux et leur valeur afin de ne pas les confondre avec le secret.
const positional = args.filter(
  (arg, index) => !arg.startsWith('--') && !(lengthFlagIndex !== -1 && index === lengthFlagIndex + 1),
);
const plain = positional[0] ?? config.admin.password;

if (!plain) {
  console.error(
    'Aucun secret fourni.\n' +
      'Usage : npm run hash-password -- "mon-mot-de-passe"\n' +
      'ou renseignez ADMIN_PASSWORD dans le fichier .env.',
  );
  process.exit(1);
}

if (Number.isInteger(requested) && requested > 0 && plain.length < requested) {
  console.error(`Secret trop court : ${plain.length} caracteres, ${requested} requis.`);
  process.exit(1);
}

const hash = await hashSecret(plain);

console.log('\nHash scrypt genere :');
console.log(hash);
console.log('\nAjoutez-le dans .env (jamais dans le frontend ni sur GitHub) :');
console.log('ADMIN_PASSWORD_HASH=' + hash);
console.log('\nPour la production, prefers ADMIN_PASSWORD_HASH a ADMIN_PASSWORD en clair.');
