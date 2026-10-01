/**
 * Utilitaires DOM et échappement.
 *
 * Règle de sécurité : toute donnée provenant de la base ou d'un formulaire est
 * insérée via `esc()` avant d'être placée dans une chaîne HTML. Les valeurs
 * choisies par le développeur (icônes, libellés de constantes) peuvent utiliser
 * `raw()`.
 */

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Échappe une valeur destinée à être insérée dans du HTML. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

/** Marque une chaîne comme déjà sûre (construite par le développeur). */
export function raw(value) {
  return { __html: String(value ?? '') };
}

/** Construit un élément à partir d'une chaîne HTML (premier nœud racine). */
export function html(markup) {
  const template = document.createElement('template');
  template.innerHTML = String(markup).trim();
  return template.content.firstElementChild;
}

/** Construit un fragment (plusieurs nœuds) à partir d'une chaîne HTML. */
export function fragment(markup) {
  const template = document.createElement('template');
  template.innerHTML = String(markup);
  return template.content;
}

/** Insère du contenu (nœud ou chaîne HTML) dans un conteneur. */
export function mount(container, content) {
  container.replaceChildren();
  if (content instanceof Node) container.append(content);
  else if (content !== null && content !== undefined) container.innerHTML = String(content);
  return container;
}

/** Crée un élément simple avec attributs et enfants. */
export function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? '' : String(value));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

/** Délégation d'évènement : `on(root, 'click', '.btn', handler)`. */
export function on(root, eventName, selector, handler) {
  root.addEventListener(eventName, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

/** Encode une valeur pour un fragment d'URL (recherche, filtres). */
export function paramString(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}

export function readParams(search = window.location.search) {
  return Object.fromEntries(new URLSearchParams(search).entries());
}

/** Force le défilement vers le haut (changement de page du routeur). */
export function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
