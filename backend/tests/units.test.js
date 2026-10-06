/**
 * Tests unitaires : ne touchent pas MySQL.
 * Lancement : npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hashSecret,
  verifySecret,
  hashPassword,
  verifyPassword,
  isHashed,
  safeCompare,
} from '../src/utils/passwords.js';

import {
  generateTrackingCode,
  normalizeTrackingCode,
  isValidTrackingCode,
  generateSecretCode,
  normalizeSecretCode,
  isValidSecretCode,
  TRACKING_PREFIX,
  SECRET_CODE_LENGTH,
} from '../src/utils/codes.js';

import {
  PROJECT,
  SUGGESTION_STATUSES,
  PROGRESS_STATUSES,
  STATUS_META,
  CATEGORIES,
  DEFAULT_STATUS,
  DEFAULT_VISIBILITY,
  VISIBILITIES,
  REPORT_REASONS,
  isValidStatus,
  isValidCategory,
  getStatusMeta,
} from '../../shared/constants.js';

import { validate, schemas } from '../src/validation/schemas.js';

// ---------------------------------------------------------------------------
// Codes secrets / mots de passe
// ---------------------------------------------------------------------------

test('hashSecret produit un hash scrypt reutilisable', async () => {
  const hash = await hashSecret('mon-code-secret');
  assert.ok(isHashed(hash), 'le hash doit etre identifiable');
  assert.ok(!hash.includes('mon-code-secret'), 'le secret ne doit jamais apparaitre dans le hash');
  assert.equal(await verifySecret('mon-code-secret', hash), true);
  assert.equal(await verifySecret('autre-chose', hash), false);
});

test('deux hachages du meme secret sont differents (sel aleatoire)', async () => {
  const a = await hashSecret(' identique ');
  const b = await hashSecret(' identique ');
  assert.notEqual(a, b);
  assert.equal(await verifySecret(' identique ', a), true);
  assert.equal(await verifySecret(' identique ', b), true);
});

test('verifySecret rejette les entrees invalides sans lever', async () => {
  assert.equal(await verifySecret(null, null), false);
  assert.equal(await verifySecret('abc', undefined), false);
  assert.equal(await verifySecret('abc', 'bcrypt$12$abc'), false);
  assert.equal(await verifySecret('abc', 'scrypt$a$b$c$d$e'), false);
  assert.equal(await verifySecret('abc', 'plaintext'), false);
});

test('hashPassword / verifyPassword sont des alias de hashSecret', async () => {
  const hash = await hashPassword('LYNAQE2026');
  assert.equal(await verifyPassword('LYNAQE2026', hash), true);
  assert.equal(await verifyPassword('lynaqe2026', hash), false, 'la casse doit compter');
});

test('safeCompare refuse les chaines de longueurs differentes', () => {
  assert.equal(safeCompare('abc', 'abc'), true);
  assert.equal(safeCompare('abc', 'abcd'), false);
  assert.equal(safeCompare(null, 'abc'), false);
});

// ---------------------------------------------------------------------------
// Numeros de suivi et codes secrets
// ---------------------------------------------------------------------------

test('generateTrackingCode respecte le format LQC-XXXX-XXXX', () => {
  for (let i = 0; i < 500; i += 1) {
    const code = generateTrackingCode();
    assert.ok(code.startsWith(`${TRACKING_PREFIX}-`), `prefixe manquant : ${code}`);
    assert.ok(isValidTrackingCode(code), `format invalide : ${code}`);
  }
});

test('les numeros de suivi sont suffisamment varies', () => {
  const codes = new Set();
  for (let i = 0; i < 1000; i += 1) codes.add(generateTrackingCode());
  assert.ok(codes.size > 995, `collisions inattendues : ${codes.size}/1000`);
});

test('generateTrackingCode evite les caracteres ambigus', () => {
  for (let i = 0; i < 200; i += 1) {
    assert.equal(/[01OIL]/u.test(generateTrackingCode().slice(4)), false);
  }
});

test('normalizeTrackingCode tolere la saisie libre', () => {
  const expected = 'LQC-AB2C-D3EF';
  assert.equal(normalizeTrackingCode('lqc ab2c d3ef'), expected);
  assert.equal(normalizeTrackingCode('  LQC-AB2C-D3EF '), expected);
  assert.equal(normalizeTrackingCode('ab2cd3ef'), expected);
  assert.equal(normalizeTrackingCode('AB2C-D3EF'), expected);
  assert.equal(normalizeTrackingCode('LQC_AB2C_D3EF'), expected);
  assert.equal(normalizeTrackingCode('trop-court'), null);
  assert.equal(normalizeTrackingCode(''), null);
  assert.equal(normalizeTrackingCode(null), null);
});

test('generateSecretCode produit un code de 12 caracteres robustes', () => {
  for (let i = 0; i < 300; i += 1) {
    const code = generateSecretCode();
    assert.equal(code.length, SECRET_CODE_LENGTH);
    assert.ok(isValidSecretCode(code), `code invalide : ${code}`);
  }
});

test('normalizeSecretCode uniformise casse et espaces', () => {
  assert.equal(normalizeSecretCode(' ab cD-ef '), 'ABCD-EF');
  assert.equal(normalizeSecretCode('abc'), 'ABC');
  assert.equal(normalizeSecretCode(undefined), '');
});

// ---------------------------------------------------------------------------
// Source unique de verite partagee
// ---------------------------------------------------------------------------

test('les 7 statuts officiels sont presents dans le bon ordre', () => {
  assert.deepEqual(SUGGESTION_STATUSES, [
    'En attente',
    'Reçue',
    'À l’étude',
    'En cours',
    'Réalisée',
    'Non retenue',
    'Archivée',
  ]);
});

test('le statut Réalisée existe dans la progression', () => {
  assert.ok(SUGGESTION_STATUSES.includes('Réalisée'));
  assert.ok(PROGRESS_STATUSES.includes('Réalisée'));
  assert.equal(getStatusMeta('Réalisée').tone, 'done');
});

test('chaque statut a une description, un tone et un slug unique', () => {
  const slugs = new Set();
  const tones = new Set();
  for (const status of STATUS_META) {
    assert.ok(status.description.length > 10, `description trop courte : ${status.value}`);
    assert.ok(!slugs.has(status.slug), `slug duplique : ${status.slug}`);
    assert.ok(!tones.has(status.tone), `tone duplique : ${status.tone}`);
    slugs.add(status.slug);
    tones.add(status.tone);
  }
  assert.equal(slugs.size, 7);
});

test('les categories correspondent au cahier des charges', () => {
  assert.deepEqual(CATEGORIES, [
    'Vie scolaire',
    'Infrastructures et matériel',
    'Propreté et hygiène',
    'Restauration et cadre de vie',
    'Activités culturelles et sportives',
    'Enseignement et apprentissage',
    'Environnement',
    'Autres',
  ]);
});

test('les valeurs par defaut sont des statuts/categories valides', () => {
  assert.ok(isValidStatus(DEFAULT_STATUS));
  assert.ok(isValidCategory(DEFAULT_CATEGORY_FOR_TEST));
  assert.ok(VISIBILITIES.includes(DEFAULT_VISIBILITY));
  assert.equal(DEFAULT_VISIBILITY, 'privee', 'rien ne doit etre public par defaut');
});

const DEFAULT_CATEGORY_FOR_TEST = 'Autres';

test('isValidStatus / isValidCategory rejettent les valeurs inconnues', () => {
  assert.equal(isValidStatus('Realisee'), false);
  assert.equal(isValidStatus('À l étude'), false);
  assert.equal(isValidStatus('__proto__'), false);
  assert.equal(isValidStatus('constructor'), false);
  assert.equal(isValidCategory('Sport'), false);
});

test('le texte apres envoi est exactement celui du cahier des charges', () => {
  assert.equal(
    PROJECT.afterSubmitMessage,
    'Après l’envoi, votre suggestion sera examinée par l’équipe de modération.',
  );
  assert.equal(PROJECT.tagline, 'Votre voix, notre lycée de demain.');
  assert.equal(
    PROJECT.creatorCredit,
    'Créé par Ahmadou Bamba Bousso SANKHARÉ, un développeur volontaire.',
  );
});

// ---------------------------------------------------------------------------
// Validation des saisies (partagee avec le frontend)
// ---------------------------------------------------------------------------

test('le schema de creation refuse les titres trop courts', () => {
  const result = validate(schemas.createSuggestion, {
    title: 'Cour',
    description: 'Une description suffisamment longue pour etre acceptee ici.',
    category: 'Autres',
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => issue.path.includes('title')));
});

test('le schema de creation refuse une categorie inconnue', () => {
  const result = validate(schemas.createSuggestion, {
    title: 'Un titre parfaitement acceptable',
    description: 'Une description suffisamment longue pour etre acceptee ici.',
    category: 'Categorie qui n existe pas',
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => issue.path.includes('category')));
});

test('le schema de creation normalise les espaces', () => {
  const result = validate(schemas.createSuggestion, {
    title: '   Installer   des    bancs    ',
    description: '  Il manque de bancs dans la cour.  ',
    category: 'Environnement',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.title, 'Installer des bancs');
  assert.equal(result.data.description, 'Il manque de bancs dans la cour.');
  assert.equal(result.data.isAnonymous, false, 'defaut : non anonyme');
  assert.equal(
    result.data.visibility,
    undefined,
    'la visibilite n est jamais fournie par le client : le serveur force "privee"',
  );
});

test('une suggestion anonyme ne conserve pas de nom', () => {
  const result = validate(schemas.createSuggestion, {
    title: 'AneAnonymous',
    description: 'Je souhaite rester anonyme pour cette proposition de test.',
    category: 'Autres',
    isAnonymous: true,
    authorName: 'Should Be Dropped',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.authorName, undefined);
});

test('le schema de suivi normalise le numero de suivi', () => {
  const result = validate(schemas.trackingRequest, {
    trackingCode: 'lqc ab2c d3ef',
    secretCode: 'ab cd ef gh ij kl',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.trackingCode, 'LQC-AB2C-D3EF');
  assert.equal(result.data.secretCode, 'ABCDEFGHIJKL');
});

test('le schema de suivi refuse les champs manquants', () => {
  const result = validate(schemas.trackingRequest, {});
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => issue.path.includes('trackingCode')));
  assert.ok(result.error.issues.some((issue) => issue.path.includes('secretCode')));
});

test('le schema de changement de statut n autorise que les 7 statuts', () => {
  for (const status of SUGGESTION_STATUSES) {
    const result = validate(schemas.updateStatus, { status });
    assert.equal(result.success, true, `${status} devrait etre valide`);
  }
  const bad = validate(schemas.updateStatus, { status: 'Terminée' });
  assert.equal(bad.success, false);
});

test('les motifs de signalement et les dates d’avancement sont valides et stricts', () => {
  assert.deepEqual(REPORT_REASONS, [
    'Contenu offensant',
    'Spam',
    'Informations personnelles',
    'Fausse information',
    'Contenu inapproprié',
    'Autre',
  ]);
  assert.equal(validate(schemas.reportSuggestion, { reason: 'Spam' }).success, true);
  assert.equal(validate(schemas.reportSuggestion, { reason: 'Autre chose' }).success, false);
  assert.equal(
    validate(schemas.updateStatus, {
      status: 'En cours',
      progressPercent: 80,
      expectedCompletionDate: '2026-10-20',
    }).success,
    true,
  );
  assert.equal(
    validate(schemas.updateStatus, {
      status: 'En cours',
      progressPercent: 101,
      expectedCompletionDate: '2026-02-30',
    }).success,
    false,
  );
  assert.equal(validate(schemas.selectMonthlyIdea, { suggestionId: null }).success, true);
  assert.equal(
    validate(schemas.bulkSuggestionUpdate, { ids: [1, 2], type: 'status', status: 'Reçue' }).success,
    true,
  );
  assert.equal(
    validate(schemas.bulkSuggestionUpdate, { ids: [1, 1], type: 'publish' }).success,
    false,
  );
  assert.equal(
    validate(schemas.bulkSuggestionUpdate, { ids: [1], type: 'status', status: 'Terminée' }).success,
    false,
  );
});

test('le schema de connexion admin exige un mot de passe raisonnable', () => {
  assert.equal(validate(schemas.adminLogin, { password: '' }).success, false);
  assert.equal(validate(schemas.adminLogin, { password: 'x'.repeat(500) }).success, false);
  assert.equal(validate(schemas.adminLogin, { password: 'LYNAQE2026' }).success, true);
});
