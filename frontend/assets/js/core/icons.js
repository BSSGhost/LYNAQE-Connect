/**
 * Jeu d'icônes SVG embarquées (aucune dépendance externe, aucun emoji).
 * Chaque icône est décrite par son contenu à l'intérieur d'un <svg viewBox="0 0 24 24">.
 * Trait : `stroke="currentColor"`, ce qui permet de colorer via le CSS.
 */

const PATHS = {
  logo: '<path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5"/><path d="M22 8v6"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/><path d="M9 9.5h.01"/><path d="M15 9.5h.01"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  heart: '<path d="M19.5 12.6 12 20l-7.5-7.4A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 7.5 6.4Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4Z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="1"/><rect x="12" y="7" width="3" height="10" rx="1"/><rect x="17" y="13" width="3" height="4" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  journal: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.7 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a10.6 10.6 0 0 0 4.5-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M6 6v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mapPin: '<path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  camera: '<path d="M14 5h-4l-2 2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3"/>',
  tag: '<path d="M20.6 13.4 12 22l-8-8V4h10l6.6 6.6a2 2 0 0 1 0 2.8Z"/><circle cx="8" cy="8" r="1.4"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  sparkles: '<path d="m12 3 1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3Z"/><path d="M19 15l.9 2.4 2.4.9-2.4.9L19 21l-.9-2.4-2.4-.9 2.4-.9Z"/>',
  trophy: '<path d="M6 4h12v4a6 6 0 0 1-12 0Z"/><path d="M6 6H3v2a4 4 0 0 0 4 4M18 6h3v2a4 4 0 0 1-4 4"/><path d="M9 18h6M10 18v-3h4v3M8 21h8"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4Z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7Z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 6-9 16-9 0 10-3 16-9 16Z"/><path d="M4 13c3 0 6 1 8 3"/>',
  utensils: '<path d="M4 3v7a2 2 0 0 0 4 0V3"/><path d="M6 10v11"/><path d="M15 3c-1.5 0-3 2-3 5s1 4 3 4v9"/><path d="M15 3v18"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.1-.6-.6-2.1Z"/>',
  school: '<path d="M12 3 2 8l10 5 10-5Z"/><path d="M6 10v6c0 1.5 2.7 3 6 3s6-1.5 6-3v-6"/>',
  dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  thumbsUp: '<path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"/><path d="M7 11l3.5-7A2 2 0 0 1 14 5v3h4.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17 19H7"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>',
  inbox: '<path d="M3 12h5l2 3h4l2-3h5"/><path d="M5 5h14l2 7v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z"/>',
  send2: '<path d="M4 4h16v12H5.2L4 18Z"/><path d="M8 9h8M8 12h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  megaphone: '<path d="m3 11 14-5v12L3 13Z"/><path d="M17 6a3 3 0 0 1 0 12"/><path d="M6 12v5l4 1"/>',
  lightbulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 1 4 10.5c-.7.7-1 1.3-1 2.5H9c0-1.2-.3-1.8-1-2.5A6 6 0 0 1 12 2Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4l3 2"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v5h-5"/>',
};

const CATEGORY_ICON_ALIASES = {
  school: 'school',
  tools: 'tools',
  sparkle: 'sparkles',
  utensils: 'utensils',
  trophy: 'trophy',
  book: 'book',
  leaf: 'leaf',
  dots: 'dots',
};

/**
 * Renvoie une chaîne SVG pour une icône donnée.
 * @param {string} name
 * @param {{ size?: number, className?: string, title?: string }} [options]
 */
export function icon(name, options = {}) {
  const key = CATEGORY_ICON_ALIASES[name] ?? name;
  const body = PATHS[key] ?? PATHS.dots;
  const size = options.size ?? 20;
  const className = options.className ? ` class="${options.className}"` : '';
  const title = options.title ? `<title>${options.title}</title>` : '';
  return (
    `<svg${className} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false" role="img">${title}${body}</svg>`
  );
}

/** Icône d'une catégorie (utilise `icon` du partage de constantes). */
export function categoryIcon(categoryMeta, options) {
  return icon(categoryMeta?.icon ?? 'dots', options);
}
