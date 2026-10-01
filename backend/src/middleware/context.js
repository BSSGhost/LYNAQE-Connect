/**
 * Contexte de requete.
 *
 * Centralise l'identifiant de correlation, l'adresse IP, l'agent utilisateur
 * et l'empreinte du visiteur utilisee pour les soutiens.
 */

import { createHash, randomUUID } from 'node:crypto';
import { config } from '../config/env.js';

/**
 * Sel de derivation des empreintes de soutien.
 * Il depend du JWT_SECRET : reinitialiser la session admin invalide aussi les
 * empreintes de soutien, ce qui est le comportement souhaite lors d'un
 * changement de configuration.
 */
const SUPPORT_SALT = createHash('sha256')
  .update(`lynaqe-connect/supports/${config.jwt.secret}`)
  .digest('hex');

/** En-tete porteur du jeton d'appareil genere par le frontend. */
export const SUPPORTER_TOKEN_HEADER = 'x-supporter-token';

/** Tronque l'IP au masque /24 (ou /48) pour limiter la precision du stockage. */
export function maskIp(ip) {
  if (typeof ip !== 'string' || ip.length === 0) return null;
  if (ip.includes(':')) {
    const groups = ip.split(':');
    return `${groups.slice(0, 3).join(':')}::/48`;
  }
  const octets = ip.split('.');
  if (octets.length !== 4) return ip.slice(0, 45);
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

export function requestContext(req, res, next) {
  req.id = req.get('x-request-id')?.slice(0, 64) || randomUUID();
  req.clientIp = req.ip ?? null;
  req.clientIpMasked = maskIp(req.clientIp);
  req.userAgent = (req.get('user-agent') ?? '').slice(0, 255);
  req.supporterToken = (req.get(SUPPORTER_TOKEN_HEADER) ?? '').slice(0, 128);

  res.setHeader('X-Request-Id', req.id);
  next();
}

/**
 * Empreinte stable et non reversible d'un soutien.
 *
 * Combine le jeton d'appareil (localStorage, lui-meme aleatoire), l'IP masquee
 * et l'agent utilisateur. Le resultat ne permet jamais de retrouver l'adresse
 * IP ni l'appareil d'origine.
 */
export function computeSupporterHash({ supporterToken, ipMasked, userAgent } = {}) {
  return createHash('sha256')
    .update(
      [
        SUPPORT_SALT,
        supporterToken ?? 'no-token',
        ipMasked ?? 'no-ip',
        (userAgent ?? '').slice(0, 120),
      ].join('|'),
    )
    .digest('hex');
}

/** Empreinte du jeton d'appareil seul (utile pour l'audit). */
export function computeSupporterTokenHash(supporterToken) {
  if (!supporterToken) return null;
  return createHash('sha256').update(`${SUPPORT_SALT}|token|${supporterToken}`).digest('hex');
}
