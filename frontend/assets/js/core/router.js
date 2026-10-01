/**
 * Routeur du frontend (navigation par fragment `#/chemin`).
 *
 * Choix du hash plutôt que l'API History : aucune configuration serveur n'est
 * nécessaire, un simple fichier statique suffit, et un élève peut marquer ou
 * partager un lien profond sans risque d'erreur 404.
 */

function currentHash() {
  return window.location.hash.replace(/^#/, '') || '/';
}

/**
 * Découpe une chaîne de type `/suggestions/12?page=2` en segments + requête.
 */
function parseLocation(location_) {
  const [pathPart, queryPart = ''] = String(location_).split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryPart).entries());
  return { path: `/${segments.join('/')}`, segments, query, raw: location_ };
}

function matchRoute(route, segments) {
  const parts = route.split('/').filter(Boolean);
  if (route === '*' ) return {};
  if (parts.length !== segments.length) return null;
  const params = {};
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(segments[index]);
    else if (part !== segments[index]) return null;
  }
  return params;
}

export function createRouter() {
  const routes = [];
  let fallback = null;
  let current = null;
  let onChange = null;

  const router = {
    /** Enregistre une route. `pattern` accepte des segments `:nom`. */
    add(pattern, handler, options = {}) {
      routes.push({ pattern, handler, options, parts: pattern.split('/').filter(Boolean) });
      return router;
    },
    notFound(handler) {
      fallback = handler;
      return router;
    },
    async handle() {
      const { path, segments, query, raw } = parseLocation(currentHash());
      let matched = null;
      for (const route of routes) {
        const params = matchRoute(route.pattern, segments);
        if (params !== null) {
          matched = { route, params };
          break;
        }
      }

      if (current) current.cleanup?.();
      current = { cleanup: null };

      const context = { path, query, params: matched?.params ?? {}, raw };
      const handler = matched ? matched.route.handler : fallback;
      if (!handler) return;

      const result = await handler(context);
      if (typeof result === 'function') current.cleanup = result;
      else if (result?.cleanup) current.cleanup = result.cleanup;
    },
    /** Démarre l'écoute des changements de fragment. */
    start(callback) {
      onChange = callback;
      window.addEventListener('hashchange', () => {
        router.handle();
        onChange?.();
      });
      if (!window.location.hash) window.location.replace('#/');
      return router.handle();
    },
  };

  return router;
}

/** Change de page. `replace: true` n'ajoute pas d'entrée dans l'historique. */
export function navigate(path, { replace = false } = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

/** Construit un lien `#/...` sûr. */
export function href(path) {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}
