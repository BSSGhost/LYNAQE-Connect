import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { config, paths } from '../../config/env.js';
import { query, queryOne, transaction } from '../../config/db.js';
import { logger } from '../../utils/logger.js';
import { notFound, validationError } from '../../utils/errors.js';
import { hashSecret, verifySecret } from '../../utils/passwords.js';

const MAX_PHOTO_COUNT = config.photos.maxCount;
const MAX_PHOTO_SIZE = config.photos.maxSizeBytes;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const DUMMY_SECRET_HASH = hashSecret(randomBytes(16).toString('hex'));
const storageFromFrontend = path.relative(path.resolve(paths.frontend), path.resolve(config.photos.storageDir));

if (
  storageFromFrontend === '' ||
  (!storageFromFrontend.startsWith(`..${path.sep}`) && storageFromFrontend !== '..' && !path.isAbsolute(storageFromFrontend))
) {
  throw new Error('PHOTO_STORAGE_DIR doit se trouver hors du répertoire public frontend.');
}

const multipart = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PHOTO_SIZE,
    files: MAX_PHOTO_COUNT,
    fields: 1,
    fieldSize: 64,
    parts: MAX_PHOTO_COUNT + 1,
  },
}).array('photos', MAX_PHOTO_COUNT);

export function parseSuggestionPhotos(req, res, next) {
  multipart(req, res, (error) => {
    if (!error) {
      const fieldNames = Object.keys(req.body ?? {});
      if (fieldNames.length !== 1 || fieldNames[0] !== 'secretCode') {
        return next(validationError('Les informations d’envoi des photos sont invalides.'));
      }
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(validationError('Chaque photo doit faire 5 Mo maximum.'));
      }
      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(validationError(`Vous pouvez ajouter au maximum ${MAX_PHOTO_COUNT} photos.`));
      }
      return next(validationError('Les photos sélectionnées ne peuvent pas être envoyées.'));
    }

    return next(error);
  });
}

export async function replaceSuggestionPhotos(suggestionId, secretCode, files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_PHOTO_COUNT) {
    throw validationError(`Sélectionnez entre 1 et ${MAX_PHOTO_COUNT} photos.`);
  }
  if (typeof secretCode !== 'string' || secretCode.length < 8 || secretCode.length > 64) {
    throw notFound('Numéro de suggestion ou code secret incorrect.');
  }

  const suggestion = await queryOne(
    'SELECT id, secret_code_hash FROM suggestions WHERE id = ?',
    [suggestionId],
  );
  const secretHash = suggestion?.secret_code_hash ?? (await DUMMY_SECRET_HASH);
  const secretMatches = await verifySecret(secretCode, secretHash);
  if (!suggestion || !secretMatches) {
    throw notFound('Numéro de suggestion ou code secret incorrect.');
  }

  const prepared = await Promise.all(files.map(preparePhoto));
  const suggestionDirectory = suggestionPath(suggestionId);
  const stagingDirectory = path.join(config.photos.storageDir, '.staging');
  const stagedPaths = [];
  const finalPaths = [];
  let previousPhotos = [];

  try {
    await mkdir(stagingDirectory, { recursive: true, mode: 0o700 });
    await mkdir(suggestionDirectory, { recursive: true, mode: 0o700 });

    for (const photo of prepared) {
      const stagedPath = path.join(stagingDirectory, `${photo.storedName}.webp`);
      await writeFile(stagedPath, photo.buffer, { flag: 'wx', mode: 0o600 });
      stagedPaths.push(stagedPath);
    }

    const saved = await transaction(async (connection) => {
      const [suggestions] = await connection.execute(
        'SELECT id FROM suggestions WHERE id = ? FOR UPDATE',
        [suggestionId],
      );
      if (suggestions.length === 0) {
        throw notFound('Cette suggestion n’existe pas.');
      }

      const [existing] = await connection.execute(
        'SELECT stored_name FROM suggestion_photos WHERE suggestion_id = ? ORDER BY id',
        [suggestionId],
      );
      previousPhotos = existing;

      for (const photo of prepared) {
        const stagedPath = path.join(stagingDirectory, `${photo.storedName}.webp`);
        const finalPath = path.join(suggestionDirectory, `${photo.storedName}.webp`);
        await rename(stagedPath, finalPath);
        finalPaths.push(finalPath);
        await connection.execute(
          `INSERT INTO suggestion_photos (suggestion_id, stored_name, file_size)
           VALUES (?, ?, ?)`,
          [suggestionId, photo.storedName, photo.fileSize],
        );
      }

      await connection.execute(
        `DELETE FROM suggestion_photos
          WHERE suggestion_id = ?
            AND stored_name NOT IN (${prepared.map(() => '?').join(', ')})`,
        [suggestionId, ...prepared.map((photo) => photo.storedName)],
      );

      const [rows] = await connection.execute(
        `SELECT id, stored_name, file_size, created_at
           FROM suggestion_photos
          WHERE suggestion_id = ?
          ORDER BY id`,
        [suggestionId],
      );
      return rows;
    });

    await removeStoredFiles(suggestionId, previousPhotos);
    return saved.map((photo, index) => serializePhoto(suggestionId, photo, index));
  } catch (error) {
    await removePaths([...stagedPaths, ...finalPaths]);
    throw error;
  }
}

export async function listSuggestionPhotos(suggestionId) {
  const photos = await query(
    `SELECT id, stored_name, file_size, created_at
       FROM suggestion_photos
      WHERE suggestion_id = ?
      ORDER BY id`,
    [suggestionId],
  );
  return photos.map((photo, index) => serializePhoto(suggestionId, photo, index));
}

export async function getAdminPhotoFile(suggestionId, photoId) {
  const photo = await queryOne(
    `SELECT stored_name
       FROM suggestion_photos
      WHERE id = ? AND suggestion_id = ?`,
    [photoId, suggestionId],
  );
  if (!photo || !/^[0-9a-f-]{36}$/iu.test(photo.stored_name)) {
    throw notFound('Cette photo n’existe pas.');
  }

  const filePath = path.join(suggestionPath(suggestionId), `${photo.stored_name}.webp`);
  try {
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) throw new Error('Stored photo path is not a file.');
  } catch (error) {
    if (error.code === 'ENOENT') throw notFound('Cette photo n’est plus disponible.');
    throw error;
  }
  return filePath;
}

export async function removeSuggestionPhotoFiles(suggestionId) {
  try {
    await rm(suggestionPath(suggestionId), { recursive: true, force: true });
  } catch (error) {
    logger.error('Impossible de supprimer les photos de la suggestion', {
      suggestionId,
      message: error.message,
    });
  }
}

async function preparePhoto(file) {
  let image;
  try {
    image = sharp(file.buffer, { failOn: 'error', limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (!ACCEPTED_FORMATS.has(metadata.format)) {
      throw validationError('Un format de photo n’est pas accepté. Utilisez JPG, PNG ou WEBP.');
    }

    const buffer = await image
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
    if (buffer.length > MAX_PHOTO_SIZE) {
      throw validationError('Une photo optimisée dépasse encore la taille maximale de 5 Mo.');
    }

    return { storedName: randomUUID(), buffer, fileSize: buffer.length };
  } catch (error) {
    if (error?.status) throw error;
    throw validationError('Un fichier sélectionné est invalide ou ne peut pas être lu comme une image.');
  }
}

function serializePhoto(suggestionId, photo, index) {
  return {
    id: String(photo.id),
    name: `Photo ${index + 1}`,
    mimeType: 'image/webp',
    size: Number(photo.file_size),
    createdAt: photo.created_at instanceof Date ? photo.created_at.toISOString() : photo.created_at,
    contentUrl: `/api/admin/suggestions/${suggestionId}/photos/${photo.id}/content`,
  };
}

function suggestionPath(suggestionId) {
  return path.join(config.photos.storageDir, String(suggestionId));
}

async function removeStoredFiles(suggestionId, photos) {
  const directory = suggestionPath(suggestionId);
  await removePaths(
    photos.map((photo) => path.join(directory, `${photo.stored_name}.webp`)),
  );
}

async function removePaths(filePaths) {
  const results = await Promise.allSettled(filePaths.map((filePath) => rm(filePath, { force: true })));
  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error('Impossible de nettoyer un fichier photo temporaire', {
        message: result.reason?.message ?? 'Erreur inconnue',
      });
    }
  }
}
