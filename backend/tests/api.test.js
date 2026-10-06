/**
 * Tests d'integration de bout en bout : frontend → API → MySQL.
 *
 * Ces tests ecrivent REELLEMENT dans MySQL (base `lynaqe_connect_test`,
 * recreee avant l'execution et supprimee apres). Ils verifient le contrat
 * complet : depot, photos privees, moderation, suivi, soutien, statistiques, journal.
 *
 * Lancement : npm test
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';

import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { closePool, query } from '../src/config/db.js';
import { recreateTestDatabase, dropTestDatabase } from './helpers/testDatabase.js';
import { TEST_ADMIN_PASSWORD } from './setup.js';
import { SUGGESTION_STATUSES, CATEGORIES, PROJECT } from '../../shared/constants.js';

const TRACKING_PATTERN = /^LQC-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/u;

let server;
let baseUrl;

before(async () => {
  const info = await recreateTestDatabase();
  assert.equal(info.database, 'lynaqe_connect_test');

  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closePool();
  await dropTestDatabase();
  await rm(config.photos.storageDir, { recursive: true, force: true });
});

/** Client HTTP minimal. */
async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  return { status: response.status, body: payload, headers: response.headers };
}

async function uploadPhotos(path, { files, secretCode, token } = {}) {
  const form = new FormData();
  form.append('secretCode', secretCode);
  for (const [index, file] of files.entries()) {
    form.append('photos', new Blob([file.buffer], { type: file.type }), file.name ?? `photo-${index}.png`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    body: form,
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    headers: response.headers,
  };
}

async function makeTestPhoto(color) {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

const validSuggestion = (overrides = {}) => ({
  title: 'Installer des bancs sous le préau',
  description:
    'Il manque des bancs sous le préau : les élèves s’assoient par terre pendant la récréation.',
  category: 'Infrastructures et matériel',
  location: 'Cour centrale',
  ...overrides,
});

/** Aucune reponse publique ne doit contenir de donnee confidentielle. */
function assertNoSecrets(payload, forbidden = []) {
  const json = JSON.stringify(payload);
  for (const needle of ['secret_code_hash', 'secretCode', 'tracking_code', 'moderation_note']) {
    assert.equal(json.includes(needle), false, `fuite detectee : « ${needle} »`);
  }
  for (const value of forbidden) {
    assert.equal(json.includes(value), false, 'une valeur confidentielle fuit');
  }
}

// ---------------------------------------------------------------------------
// Etat initial : base reellement vide
// ---------------------------------------------------------------------------

test('la base de test demarre vide (aucune donnee de demonstration)', async () => {
  const rows = await query('SELECT COUNT(*) AS n FROM suggestions');
  assert.equal(Number(rows[0].n), 0);
});

test('GET /api/health verifie reellement MySQL', async () => {
  const { status, body } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(body.data.database.ok, true);
  assert.equal(typeof body.data.database.latencyMs, 'number');
});

test('GET /api/meta expose les 7 statuts, dont Réalisée', async () => {
  const { status, body } = await api('/api/meta');
  assert.equal(status, 200);
  assert.deepEqual(body.data.statuses, [...SUGGESTION_STATUSES]);
  assert.ok(body.data.statuses.includes('Réalisée'));
  assert.equal(body.data.categoryMeta.length, CATEGORIES.length);
  assert.equal(body.data.project.tagline, 'Votre voix, notre lycée de demain.');
  assert.equal(body.data.project.creatorCredit, PROJECT.creatorCredit);
});

test('GET /api/suggestions renvoie un etat vide coherent', async () => {
  const { status, body } = await api('/api/suggestions');
  assert.equal(status, 200);
  assert.deepEqual(body.data, []);
  assert.equal(body.meta.total, 0);
  assert.equal(body.meta.page, 1);
});

// ---------------------------------------------------------------------------
// Validation du depot
// ---------------------------------------------------------------------------

test('POST /api/suggestions refuse un titre trop court', async () => {
  const { status, body } = await api('/api/suggestions', {
    method: 'POST',
    body: validSuggestion({ title: 'Banc' }),
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.details.some((detail) => detail.path === 'title'));
});

test('POST /api/suggestions refuse une categorie inconnue', async () => {
  const { status, body } = await api('/api/suggestions', {
    method: 'POST',
    body: validSuggestion({ category: 'Cantine gastronomique' }),
  });
  assert.equal(status, 422);
  assert.ok(body.error.details.some((detail) => detail.path === 'category'));
});

test('POST /api/suggestions refuse un champ non declare (mass assignment)', async () => {
  const { status, body } = await api('/api/suggestions', {
    method: 'POST',
    body: validSuggestion({ visibility: 'publique', support_count: 999 }),
  });
  assert.equal(status, 422);
  assert.ok(body.error.details.length > 0);
});

test('POST /api/suggestions refuse un champ non declare seul', async () => {
  const { status } = await api('/api/suggestions', {
    method: 'POST',
    body: validSuggestion({ administrateur: true }),
  });
  assert.equal(status, 422);
});

// ---------------------------------------------------------------------------
// Depot reussi
// ---------------------------------------------------------------------------

let suggestionA;
let suggestionB;

test('POST /api/suggestions enregistre reellement en base et renvoie le suivi', async () => {
  const { status, body } = await api('/api/suggestions', {
    method: 'POST',
    body: validSuggestion({ isAnonymous: false, authorName: 'Fatou Diop' }),
  });

  assert.equal(status, 201);
  assert.equal(body.data.message, 'Votre suggestion a bien été envoyée.');
  assert.equal(body.data.afterSubmitMessage, PROJECT.afterSubmitMessage);
  assert.match(body.data.trackingCode, TRACKING_PATTERN);
  assert.equal(body.data.secretCode.length, 12);

  // Statut et visibilite imposes par le serveur.
  assert.equal(body.data.suggestion.status, 'En attente');
  assert.equal(body.data.suggestion.visibility, 'privee');
  assert.equal(body.data.suggestion.supportCount, 0);
  assert.equal(body.data.suggestion.isAnonymous, false);

  suggestionA = body.data;

  // Verite en base : le code secret n'y est PAS en clair.
  const rows = await query(
    'SELECT tracking_code, secret_code_hash, status, visibility, support_count FROM suggestions WHERE tracking_code = ?',
    [suggestionA.trackingCode],
  );
  assert.equal(rows.length, 1);
  assert.ok(rows[0].secret_code_hash.startsWith('scrypt$'));
  assert.equal(rows[0].secret_code_hash.includes(suggestionA.secretCode), false);
  assert.equal(rows[0].status, 'En attente');
  assert.equal(rows[0].visibility, 'privee');

  // Un evenement de timeline a bien ete cree (transaction).
  const updates = await query(
    'SELECT event_type, new_status FROM suggestion_updates WHERE suggestion_id = (SELECT id FROM suggestions WHERE tracking_code = ?)',
    [suggestionA.trackingCode],
  );
  assert.equal(updates.length, 1);
  assert.equal(updates[0].event_type, 'creation');
  assert.equal(updates[0].new_status, 'En attente');
});

test('POST /api/suggestions en mode anonyme retire le nom cote serveur', async () => {
  const { status, body } = await api('/api/suggestions', {
    method: 'POST',
    body: validSuggestion({
      title: 'Ajouter un point d’eau',
      isAnonymous: true,
      authorName: 'Nom qui ne doit pas être conservé',
    }),
  });
  assert.equal(status, 201);
  assert.equal(body.data.suggestion.isAnonymous, true);
  suggestionB = body.data;

  const rows = await query(
    'SELECT is_anonymous, author_name, author_contact FROM suggestions WHERE tracking_code = ?',
    [suggestionB.trackingCode],
  );
  assert.equal(rows[0].is_anonymous, 1);
  assert.equal(rows[0].author_name, null);
  assert.equal(rows[0].author_contact, null);
});

test('une suggestion non publiee n’apparait jamais dans la liste publique', async () => {
  const { body } = await api('/api/suggestions');
  assert.deepEqual(body.data, []);
  assert.equal(body.meta.total, 0);
});

// ---------------------------------------------------------------------------
// Suivi
// ---------------------------------------------------------------------------

test('POST /api/tracking accepte un numero et un code corrects', async () => {
  const { status, body } = await api('/api/tracking', {
    method: 'POST',
    body: { trackingCode: suggestionA.trackingCode, secretCode: suggestionA.secretCode },
  });

  assert.equal(status, 200);
  assert.equal(body.data.suggestion.status, 'En attente');
  assert.equal(body.data.suggestion.trackingCode, suggestionA.trackingCode);
  assert.equal(body.data.timeline.length, 1);
  assert.equal(body.data.timeline[0].newStatus, 'En attente');
  assert.equal(body.data.timeline[0].newStatusInfo.tone, 'pending');
  assertNoSecrets(body.data);
});

test('POST /api/tracking accepte une saisie libre (minuscules, espaces)', async () => {
  const loose = suggestionA.trackingCode.toLowerCase().replace(/-/g, ' ');
  const { status } = await api('/api/tracking', {
    method: 'POST',
    body: { trackingCode: loose, secretCode: suggestionA.secretCode.toLowerCase() },
  });
  assert.equal(status, 200);
});

test('POST /api/tracking refuse un mauvais code secret', async () => {
  const wrong = await api('/api/tracking', {
    method: 'POST',
    body: { trackingCode: suggestionA.trackingCode, secretCode: 'ZZZZZZZZZZZZ' },
  });
  assert.equal(wrong.status, 404);

  const unknown = await api('/api/tracking', {
    method: 'POST',
    body: { trackingCode: 'LQC-2222-3333', secretCode: 'ZZZZZZZZZZZZ' },
  });
  assert.equal(unknown.status, 404);

  // Meme message dans les deux cas : impossible de distinguer un numero
  // existant d'un numero inexistant.
  assert.equal(wrong.body.error.message, unknown.body.error.message);
});

test('POST /api/tracking refuse un identifiant invalide', async () => {
  const { status, body } = await api('/api/tracking', {
    method: 'POST',
    body: { trackingCode: 'pas-un-code', secretCode: 'ABCDEFGHIJKL' },
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

let adminToken;

test('les routes d’administration sont protegees', async () => {
  const noToken = await api('/api/admin/suggestions');
  assert.equal(noToken.status, 401);

  const badToken = await api('/api/admin/suggestions', { token: 'jeton.invalide.ici' });
  assert.equal(badToken.status, 401);
});

test('POST /api/admin/login refuse un mauvais mot de passe', async () => {
  const { status, body } = await api('/api/admin/login', {
    method: 'POST',
    body: { password: 'mauvais-mot-de-passe' },
  });
  assert.equal(status, 403);
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('POST /api/admin/login accepte le mot de passe configure', async () => {
  const { status, body } = await api('/api/admin/login', {
    method: 'POST',
    body: { password: TEST_ADMIN_PASSWORD },
  });
  assert.equal(status, 200);
  assert.equal(typeof body.data.token, 'string');
  assert.equal(body.data.tokenType, 'Bearer');
  adminToken = body.data.token;

  // Le mot de passe ne doit jamais revenir dans la reponse.
  assert.equal(JSON.stringify(body).includes(TEST_ADMIN_PASSWORD), false);
});

test('GET /api/admin/session confirme la session', async () => {
  const { status, body } = await api('/api/admin/session', { token: adminToken });
  assert.equal(status, 200);
  assert.equal(body.data.authenticated, true);
  assert.equal(body.data.role, 'admin');
});

test('GET /api/admin/suggestions voit les suggestions non publiees', async () => {
  const { status, body } = await api('/api/admin/suggestions', { token: adminToken });
  assert.equal(status, 200);
  assert.equal(body.meta.total, 2);
  const titles = body.data.map((item) => item.title);
  assert.ok(titles.includes('Installer des bancs sous le préau'));
});

test('GET /api/admin/queue ne contient que les trois statuts à traiter', async () => {
  const { status, body } = await api('/api/admin/queue', { token: adminToken });
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(body.data.counts), ['En attente', 'Reçue', 'À l’étude']);
  assert.equal(body.data.items.length, 2);
  assert.ok(body.data.items.every((item) => ['En attente', 'Reçue', 'À l’étude'].includes(item.status)));
});

test('GET /api/admin/suggestions/:id renvoie la timeline et le journal', async () => {
  const list = await api('/api/admin/suggestions', { token: adminToken });
  const target = list.body.data.find((item) => item.title === 'Installer des bancs sous le préau');

  const { status, body } = await api(`/api/admin/suggestions/${target.id}`, { token: adminToken });
  assert.equal(status, 200);
  assert.equal(body.data.suggestion.trackingCode, suggestionA.trackingCode);
  assert.ok(body.data.timeline.length >= 1);
  assert.ok(body.data.moderationLogs.length >= 1);
  assert.equal(body.data.moderationLogs[0].actor, 'system');
});

test('les photos sont privées, vérifiées et remplaçables par leur auteur', async () => {
  const list = await api('/api/admin/suggestions', { token: adminToken });
  const target = list.body.data.find((item) => item.title === 'Installer des bancs sous le préau');
  const route = `/api/suggestions/${target.id}/photos`;
  const firstPhoto = await makeTestPhoto('#123b6d');
  const firstFile = { buffer: firstPhoto, type: 'image/png', name: 'bancs.png' };
  const incorrectFormat = await uploadPhotos(route, {
    files: [{ buffer: Buffer.from('ceci n’est pas une image'), type: 'image/png' }],
    secretCode: suggestionA.secretCode,
  });
  assert.equal(incorrectFormat.status, 422);

  const tooManyPhotos = await uploadPhotos(route, {
    files: Array.from({ length: 6 }, () => firstFile),
    secretCode: suggestionA.secretCode,
  });
  assert.equal(tooManyPhotos.status, 422);

  const oversizedPhoto = await uploadPhotos(route, {
    files: [{ buffer: Buffer.alloc(5 * 1024 * 1024 + 1), type: 'image/png' }],
    secretCode: suggestionA.secretCode,
  });
  assert.equal(oversizedPhoto.status, 422);

  const wrongSecret = await uploadPhotos(route, {
    files: [firstFile],
    secretCode: 'ZZZZZZZZZZZZ',
  });
  assert.equal(wrongSecret.status, 404);

  const uploaded = await uploadPhotos(route, {
    files: [firstFile],
    secretCode: suggestionA.secretCode,
  });
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.body.data.photos.length, 1);
  assert.equal(uploaded.body.data.photos[0].mimeType, 'image/webp');
  const firstPhotoId = uploaded.body.data.photos[0].id;
  const photoUrl = uploaded.body.data.photos[0].contentUrl;

  const privateResponse = await api(photoUrl);
  assert.equal(privateResponse.status, 401, 'une photo ne doit pas être accessible sans session admin');

  const imageResponse = await fetch(`${baseUrl}${photoUrl}`, {
    headers: { Authorization: 'Bearer ' + adminToken },
  });
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get('content-type'), 'image/webp');
  const decodedPhoto = await sharp(Buffer.from(await imageResponse.arrayBuffer())).metadata();
  assert.equal(decodedPhoto.format, 'webp');

  const detail = await api(`/api/admin/suggestions/${target.id}`, { token: adminToken });
  assert.equal(detail.body.data.photos.length, 1);

  const secondPhoto = await makeTestPhoto('#38bdf8');
  const replaced = await uploadPhotos(route, {
    files: [{ buffer: secondPhoto, type: 'image/png' }],
    secretCode: suggestionA.secretCode,
  });
  assert.equal(replaced.status, 201);
  assert.equal(replaced.body.data.photos.length, 1);
  assert.notEqual(replaced.body.data.photos[0].id, firstPhotoId);

  const removedPhoto = await api(photoUrl, { token: adminToken });
  assert.equal(removedPhoto.status, 404);
  const rows = await query('SELECT COUNT(*) AS count FROM suggestion_photos WHERE suggestion_id = ?', [
    target.id,
  ]);
  assert.equal(Number(rows[0].count), 1);
});

test('GET /api/admin/statistics calcule des chiffres reels', async () => {
  const { status, body } = await api('/api/admin/statistics', { token: adminToken });
  assert.equal(status, 200);

  const stats = body.data;
  assert.equal(stats.isEmpty, false);
  assert.equal(stats.totals.suggestions, 2);
  assert.equal(stats.totals.published, 0);
  assert.equal(stats.totals.unpublished, 2);
  assert.equal(stats.totals.anonymous, 1, 'une suggestion anonyme sur deux');
  assert.equal(stats.totals.pending, 2);

  // Les 7 statuts sont presents, y compris « Réalisée » a zero.
  assert.equal(stats.byStatus.length, 7);
  assert.deepEqual(
    stats.byStatus.map((entry) => entry.value),
    [...SUGGESTION_STATUSES],
  );
  const realized = stats.byStatus.find((entry) => entry.value === 'Réalisée');
  assert.equal(realized.count, 0);
  assert.equal(realized.tone, 'done');

  // Les 8 categories sont presentes, completees a zero.
  assert.equal(stats.byCategory.length, 8);
  for (const category of CATEGORIES) {
    assert.ok(stats.byCategory.some((entry) => entry.value === category));
  }

  // Series temporelles completes.
  assert.equal(stats.evolution.daily.length, 30);
  assert.equal(stats.evolution.monthly.length, 12);
  assert.equal(stats.evolution.daily.at(-1).count, 2, 'les 2 suggestions datent d’aujourd’hui');
  assert.equal(stats.evolution.monthly.at(-1).count, 2);
});

test('la file enregistre les pourcentages et la date prévue seulement pendant En cours', async () => {
  const list = await api('/api/admin/suggestions', { token: adminToken });
  const target = list.body.data.find((item) => item.title === 'Installer des bancs sous le préau');
  const updated = await api(`/api/admin/suggestions/${target.id}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'En cours', progressPercent: 80, expectedCompletionDate: '2026-10-20' },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.suggestion.progressPercent, 80);
  assert.equal(updated.body.data.suggestion.expectedCompletionDate, '2026-10-20');
});

test('PATCH /api/admin/suggestions/:id/status change reellement le statut', async () => {
  const list = await api('/api/admin/suggestions', { token: adminToken });
  const target = list.body.data.find((item) => item.title === 'Installer des bancs sous le préau');

  const { status, body } = await api(`/api/admin/suggestions/${target.id}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      status: 'Réalisée',
      publish: true,
      message: 'Les bancs ont été installés pendant les vacances.',
    },
  });

  assert.equal(status, 200);
  assert.equal(body.data.changed, true);
  assert.equal(body.data.suggestion.status, 'Réalisée');
  assert.equal(body.data.suggestion.visibility, 'publique');
  assert.ok(body.data.suggestion.publishedAt, 'published_at doit etre renseigne');
  assert.equal(body.data.suggestion.progressPercent, null, 'les champs de réalisation sont effacés hors En cours');
  assert.equal(body.data.suggestion.expectedCompletionDate, null);

  // Verite en base.
  const rows = await query('SELECT status, visibility, published_at FROM suggestions WHERE id = ?', [
    target.id,
  ]);
  assert.equal(rows[0].status, 'Réalisée');
  assert.equal(rows[0].visibility, 'publique');
  assert.ok(rows[0].published_at instanceof Date);
});

test('une réponse officielle est visible dans le suivi et dans les mises en avant publiques', async () => {
  const tracking = await api('/api/tracking', {
    method: 'POST',
    body: { trackingCode: suggestionA.trackingCode, secretCode: suggestionA.secretCode },
  });
  const response = tracking.body.data.timeline.find((event) =>
    event.message === 'Les bancs ont été installés pendant les vacances.',
  );
  assert.equal(response.authorType, 'admin');
  assert.equal(response.newStatus, 'Réalisée');

  const highlights = await api('/api/highlights');
  assert.equal(highlights.status, 200);
  assert.ok(highlights.body.data.popular.length === 0, 'les idées sans soutien ne sont pas classées');
});

test('l’administration choisit une idée du mois publique et peut la retirer', async () => {
  const list = await api('/api/admin/suggestions', { token: adminToken });
  const target = list.body.data.find((item) => item.title === 'Installer des bancs sous le préau');
  const selected = await api('/api/admin/monthly-idea', {
    method: 'PATCH',
    token: adminToken,
    body: { suggestionId: target.id },
  });
  assert.equal(selected.status, 200);
  assert.equal(selected.body.data.suggestionId, target.id);

  const highlights = await api('/api/highlights');
  assert.equal(highlights.body.data.monthlyIdea.id, target.id);

  const removed = await api('/api/admin/monthly-idea', {
    method: 'PATCH',
    token: adminToken,
    body: { suggestionId: null },
  });
  assert.equal(removed.body.data.suggestionId, null);
  assert.equal((await api('/api/highlights')).body.data.monthlyIdea, null);
});

test('un appareil peut signaler une suggestion une seule fois et l’admin peut traiter le signalement', async () => {
  const publicList = await api('/api/suggestions');
  const target = publicList.body.data[0];
  const route = `/api/suggestions/${target.id}/reports`;
  const first = await api(route, { method: 'POST', body: { reason: 'Contenu offensant' } });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.alreadyReported, false);

  const duplicate = await api(route, { method: 'POST', body: { reason: 'Spam' } });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.data.alreadyReported, true);

  const details = await api(`/api/admin/suggestions/${target.id}`, { token: adminToken });
  assert.equal(details.body.data.suggestion.reportCount, 1);
  assert.equal(details.body.data.reports[0].reason, 'Contenu offensant');
  const reportId = details.body.data.reports[0].id;

  const removed = await api(`/api/admin/suggestions/${target.id}/reports/${reportId}`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.reportCount, 0);
});

test('la suggestion publiee apparait dans la liste publique', async () => {
  const { status, body } = await api('/api/suggestions');
  assert.equal(status, 200);
  assert.equal(body.meta.total, 1);
  assert.equal(body.data[0].status, 'Réalisée');
  assert.equal(body.data[0].statusInfo.tone, 'done');
  assertNoSecrets(body.data);
});

test('le filtre par statut fonctionne, y compris sur Réalisée', async () => {
  const realized = await api('/api/suggestions?status=Réalisée');
  assert.equal(realized.body.meta.total, 1);

  const pending = await api('/api/suggestions?status=En%20attente');
  assert.equal(pending.body.meta.total, 0);

  const archived = await api('/api/suggestions?status=Archivée');
  assert.equal(archived.body.meta.total, 0);
});

test('le filtre par categorie et la recherche fonctionnent', async () => {
  const byCategory = await api('/api/suggestions?category=Infrastructures%20et%20mat%C3%A9riel');
  assert.equal(byCategory.body.meta.total, 1);

  const otherCategory = await api('/api/suggestions?category=Environnement');
  assert.equal(otherCategory.body.meta.total, 0);

  const search = await api('/api/suggestions?search=bancs');
  assert.equal(search.body.meta.total, 1);

  const noMatch = await api('/api/suggestions?search=zzzzz');
  assert.equal(noMatch.body.meta.total, 0);
});

test('le suivi affiche le message publie par l’administration', async () => {
  const { status, body } = await api('/api/tracking', {
    method: 'POST',
    body: { trackingCode: suggestionA.trackingCode, secretCode: suggestionA.secretCode },
  });
  assert.equal(status, 200);
  assert.equal(body.data.suggestion.status, 'Réalisée');
  const messages = body.data.timeline.map((event) => event.message).filter(Boolean);
  assert.ok(messages.some((message) => message.includes('bancs ont été installés')));
});

// ---------------------------------------------------------------------------
// Soutiens
// ---------------------------------------------------------------------------

test('POST /api/suggestions/:id/support enregistre un soutien unique', async () => {
  const list = await api('/api/suggestions');
  const id = list.body.data[0].id;

  const first = await api(`/api/suggestions/${id}/support`, {
    method: 'POST',
    headers: { 'X-Supporter-Token': 'appareil-eleve-1' },
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.alreadySupported, false);
  assert.equal(first.body.data.supportCount, 1);

  const again = await api(`/api/suggestions/${id}/support`, {
    method: 'POST',
    headers: { 'X-Supporter-Token': 'appareil-eleve-1' },
  });
  assert.equal(again.status, 200);
  assert.equal(again.body.data.alreadySupported, true);
  assert.equal(again.body.data.supportCount, 1, 'le compteur ne doit pas augmenter');

  const otherDevice = await api(`/api/suggestions/${id}/support`, {
    method: 'POST',
    headers: { 'X-Supporter-Token': 'appareil-eleve-2' },
  });
  assert.equal(otherDevice.body.data.alreadySupported, false);
  assert.equal(otherDevice.body.data.supportCount, 2);

  // La contrainte SQL existe bien.
  const rows = await query(
    'SELECT COUNT(*) AS n, COUNT(DISTINCT supporter_hash) AS distinct_hashes FROM supports WHERE suggestion_id = ?',
    [id],
  );
  assert.equal(Number(rows[0].n), 2);
  assert.equal(Number(rows[0].distinct_hashes), 2);
});

test('DELETE /api/suggestions/:id/support retire uniquement le soutien de cet appareil', async () => {
  const list = await api('/api/suggestions');
  const id = list.body.data[0].id;
  const headers = { 'X-Supporter-Token': 'appareil-eleve-1' };

  const removed = await api(`/api/suggestions/${id}/support`, {
    method: 'DELETE',
    headers,
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.removed, true);
  assert.equal(removed.body.data.supportCount, 1);

  const removedAgain = await api(`/api/suggestions/${id}/support`, {
    method: 'DELETE',
    headers,
  });
  assert.equal(removedAgain.status, 200);
  assert.equal(removedAgain.body.data.removed, false);
  assert.equal(removedAgain.body.data.supportCount, 1);

  const restored = await api(`/api/suggestions/${id}/support`, {
    method: 'POST',
    headers,
  });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.data.supportCount, 2);
});

test('soutenir une suggestion non publiee renvoie 404', async () => {
  const list = await api('/api/admin/suggestions', { token: adminToken });
  const target = list.body.data.find((item) => item.title === 'Ajouter un point d’eau');
  const { status } = await api(`/api/suggestions/${target.id}/support`, { method: 'POST' });
  assert.equal(status, 404);
});

test('les statistiques incluent les soutiens reels', async () => {
  const { body } = await api('/api/admin/statistics', { token: adminToken });
  assert.equal(body.data.totals.supports, 2);
  assert.equal(body.data.totals.supportedSuggestions, 1);
  assert.equal(body.data.topSupported.length, 1);
  assert.equal(body.data.topSupported[0].supportCount, 2);
});

// ---------------------------------------------------------------------------
// Modification, depublication, rejet, archivage, suppression
// ---------------------------------------------------------------------------

test('PATCH /api/admin/suggestions/:id interdit la modification du contenu', async () => {
  const list = await api('/api/admin/suggestions', { token: adminToken });
  const target = list.body.data.find((item) => item.title === 'Ajouter un point d’eau');

  const { status } = await api(`/api/admin/suggestions/${target.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { title: 'Installer deux points d’eau supplémentaires' },
  });

  assert.equal(status, 404);
  const { body } = await api(`/api/admin/suggestions/${target.id}`, { token: adminToken });
  assert.equal(body.data.suggestion.title, 'Ajouter un point d’eau');
});

test('PATCH /api/admin/suggestions/:id/moderation retire la publication', async () => {
  const list = await api('/api/admin/suggestions', { token: adminToken });
  const target = list.body.data.find((item) => item.status === 'Réalisée');

  const { status, body } = await api(`/api/admin/suggestions/${target.id}/moderation`, {
    method: 'PATCH',
    token: adminToken,
    body: { visibility: 'privee' },
  });
  assert.equal(status, 200);
  assert.equal(body.data.suggestion.visibility, 'privee');
  assert.equal(body.data.suggestion.publishedAt, null);

  const publicList = await api('/api/suggestions');
  assert.equal(publicList.body.meta.total, 0, 'plus rien de public');
});

test('tous les statuts officiels sont acceptes, y compris Archivée et Non retenue', async () => {
  const list = await api('/api/admin/suggestions', { token: adminToken });
  const id = list.body.data[0].id;

  for (const status of SUGGESTION_STATUSES) {
    const { status: httpStatus, body } = await api(`/api/admin/suggestions/${id}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status },
    });
    assert.equal(httpStatus, 200, `statut refuse : ${status}`);
    assert.equal(body.data.suggestion.status, status);
  }

  // Un statut hors liste est refuse.
  const refused = await api(`/api/admin/suggestions/${id}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'Terminée' },
  });
  assert.equal(refused.status, 422);
});

test('le journal de moderation enregistre toutes les actions', async () => {
  const { status, body } = await api('/api/admin/logs', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(body.meta.total > 0);

  const actions = new Set(body.data.map((entry) => entry.action));
  assert.ok(actions.has('creation'));
  assert.ok(actions.has('publication'));
  assert.ok(actions.has('depublication'));
  assert.ok(actions.has('statut'));
  assert.ok(actions.has('modification'));

  // Le journal est protege.
  const anonymous = await api('/api/admin/logs');
  assert.equal(anonymous.status, 401);
});

test('DELETE /api/admin/suggestions/:id supprime et conserve le journal', async () => {
  const list = await api('/api/admin/suggestions', { token: adminToken });
  const totalBefore = list.body.meta.total;
  const id = list.body.data[0].id;

  const logsBefore = await query('SELECT COUNT(*) AS n FROM moderation_logs');
  const updatesBefore = await query(
    'SELECT COUNT(*) AS n FROM suggestion_updates WHERE suggestion_id = ?',
    [id],
  );
  assert.ok(Number(updatesBefore[0].n) > 0);

  const { status, body } = await api(`/api/admin/suggestions/${id}`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(status, 200);
  assert.equal(body.data.deletedId, id);

  const after = await api('/api/admin/suggestions', { token: adminToken });
  assert.equal(after.body.meta.total, totalBefore - 1);

  // CASCADE : timeline supprimee.
  const updatesAfter = await query(
    'SELECT COUNT(*) AS n FROM suggestion_updates WHERE suggestion_id = ?',
    [id],
  );
  assert.equal(Number(updatesAfter[0].n), 0);

  // SET NULL : le journal survit, avec suggestion_id NULL.
  const logsAfter = await query('SELECT COUNT(*) AS n FROM moderation_logs');
  assert.ok(
    Number(logsAfter[0].n) > Number(logsBefore[0].n),
    'la suppression doit laisser une trace',
  );
  const orphan = await query(
    "SELECT COUNT(*) AS n FROM moderation_logs WHERE action = 'suppression' AND suggestion_id IS NULL",
  );
  assert.ok(Number(orphan[0].n) >= 1);
});

test('supprimer une suggestion inexistante renvoie 404', async () => {
  const { status } = await api('/api/admin/suggestions/999999', {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(status, 404);
});

// ---------------------------------------------------------------------------
// Robustesse
// ---------------------------------------------------------------------------

test('un identifiant non numerique est refuse proprement', async () => {
  const { status, body } = await api('/api/suggestions/abc');
  assert.equal(status, 400);
  assert.equal(body.error.code, 'BAD_REQUEST');
});

test('une route API inconnue renvoie un 404 JSON (jamais du HTML)', async () => {
  const { status, body, headers } = await api('/api/inconnu');
  assert.equal(status, 404);
  assert.equal(body.success, false);
  assert.ok(String(headers.get('content-type')).includes('application/json'));
});

test('une route d’administration inconnue exige une session', async () => {
  const anonymous = await api('/api/admin/inconnu');
  assert.equal(anonymous.status, 401);
});

test('les en-tetes de securite sont presents', async () => {
  const { headers } = await api('/api/health');
  assert.ok(headers.get('content-security-policy'));
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-powered-by'), null);
  assert.ok(headers.get('x-request-id'));
});

test('une origine non autorisee est refusee par CORS', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://site-malveillant.example' },
  });
  // CORS n'ajoute pas l'en-tete d'autorisation : le navigateur bloquera.
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('la liste publique est paginee et le tri par soutiens fonctionne', async () => {
  // Publie les deux suggestions restantes pour tester la liste.
  const list = await api('/api/admin/suggestions', { token: adminToken });
  for (const item of list.body.data) {
    await api(`/api/admin/suggestions/${item.id}/moderation`, {
      method: 'PATCH',
      token: adminToken,
      body: { visibility: 'publique' },
    });
  }

  const page1 = await api('/api/suggestions?page=1&limit=1&sort=supported');
  assert.equal(page1.status, 200);
  assert.equal(page1.body.data.length, 1);
  assert.equal(page1.body.meta.limit, 1);
  assert.ok(page1.body.meta.totalPages >= 1);

  const tooBig = await api('/api/suggestions?limit=9999');
  assert.equal(tooBig.status, 422, 'une limite hors bornes est refusee');

  const badSort = await api('/api/suggestions?sort=; DROP TABLE suggestions; --');
  assert.equal(badSort.status, 422, 'un tri inconnu est refuse');

  // La table existe toujours : l'injection n'a rien casse.
  const rows = await query('SELECT COUNT(*) AS n FROM suggestions');
  assert.ok(Number(rows[0].n) > 0);
});

test('les actions groupées modifient le statut, publient et archivent atomiquement', async () => {
  const list = await api('/api/admin/suggestions?limit=2', { token: adminToken });
  const ids = list.body.data.map((item) => item.id);
  assert.equal(ids.length, 2);

  const statusChange = await api('/api/admin/suggestions/bulk', {
    method: 'PATCH',
    token: adminToken,
    body: { ids, type: 'status', status: 'À l’étude' },
  });
  assert.equal(statusChange.status, 200);
  assert.equal(statusChange.body.data.updated, 2);
  assert.ok(statusChange.body.data.items.every((item) => item.status === 'À l’étude'));

  const published = await api('/api/admin/suggestions/bulk', {
    method: 'PATCH',
    token: adminToken,
    body: { ids, type: 'publish' },
  });
  assert.equal(published.status, 200);
  assert.ok(published.body.data.items.every((item) => item.visibility === 'publique'));

  const archived = await api('/api/admin/suggestions/bulk', {
    method: 'PATCH',
    token: adminToken,
    body: { ids, type: 'archive' },
  });
  assert.equal(archived.status, 200);
  assert.ok(archived.body.data.items.every((item) => item.status === 'Archivée'));

  const invalid = await api('/api/admin/suggestions/bulk', {
    method: 'PATCH',
    token: adminToken,
    body: { ids: [ids[0], 999999], type: 'publish' },
  });
  assert.equal(invalid.status, 404, 'une sélection périmée ne doit pas être traitée partiellement');
});
