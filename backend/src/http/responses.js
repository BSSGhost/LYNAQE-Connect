/**
 * Enveloppe de reponse JSON.
 *
 * Format unique pour toute l'API : le frontend peut donc distinuer un
 * succes d'une erreur sans deviner la forme de la reponse.
 *
 *   succes : { "success": true,  "data": ... , "meta": {...} }
 *   erreur : { "success": false, "error": { "code": "...", "message": "...",
 *             "details": [...] }, "requestId": "..." }
 */

export function ok(res, data, meta) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(200).json(body);
}

export function created(res, data) {
  return res.status(201).json({ success: true, data });
}

export function noContent(res) {
  return res.status(204).end();
}
