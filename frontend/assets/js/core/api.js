/**
 * Client de l'API.
 *
 * Toutes les réponses suivent l'enveloppe `{ success, data, meta }` ou
 * `{ success: false, error }`. Le client renvoie `data`+`meta` en cas de succès
 * et lève une `ApiError` porteuse du code et du message sinon — le frontend
 * n'a donc jamais à deviner la forme de la réponse.
 */

import { getAdminToken, getSupporterToken } from './store.js';

const BASE = '/api';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, query, auth = false, signal } = {}) {
  const search = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === '') continue;
      search.set(key, String(value));
    }
  }
  const queryString = search.toString();
  const url = `${BASE}${path}${queryString ? `?${queryString}` : ''}`;

  const headers = { Accept: 'application/json', 'X-Supporter-Token': getSupporterToken() };
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      'Impossible de joindre le serveur. Vérifiez votre connexion internet, puis réessayez.',
      { status: 0, code: 'NETWORK_ERROR' },
    );
  }

  if (response.status === 204) return { data: null, meta: null };

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = null;
    }
  }

  if (!response.ok || payload?.success === false) {
    const error = payload?.error ?? {};
    throw new ApiError(error.message ?? 'Une erreur inattendue est survenue.', {
      status: response.status,
      code: error.code ?? 'ERROR',
      details: error.details ?? [],
    });
  }

  return { data: payload?.data ?? null, meta: payload?.meta ?? null };
}

async function requestFile(path, { auth = false, signal } = {}) {
  const headers = { Accept: 'image/webp', 'X-Supporter-Token': getSupporterToken() };
  if (auth) {
    const token = getAdminToken();
    if (token) headers.Authorization = 'Bearer ' + token;
  }

  let response;
  try {
    response = await fetch(`${BASE}${path}`, { headers, signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      'Impossible de joindre le serveur. Vérifiez votre connexion internet, puis réessayez.',
      { status: 0, code: 'NETWORK_ERROR' },
    );
  }

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const error = payload?.error ?? {};
    throw new ApiError(error.message ?? 'Une erreur inattendue est survenue.', {
      status: response.status,
      code: error.code ?? 'ERROR',
      details: error.details ?? [],
    });
  }
  return response.blob();
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

/* --- Points d'entrée métier -------------------------------------------- */

export const metaApi = {
  info: () => api.get('/meta'),
  health: () => api.get('/health'),
  highlights: () => api.get('/highlights'),
};

export const suggestionsApi = {
  list: (query) => api.get('/suggestions', { query }),
  detail: (id) => api.get(`/suggestions/${id}`),
  create: (payload) => api.post('/suggestions', payload),
  uploadPhotos: (id, payload, options) => request(`/suggestions/${id}/photos`, {
    ...options,
    method: 'POST',
    body: payload,
  }),
  report: (id, reason) => api.post(`/suggestions/${id}/reports`, { reason }),
  support: (id) => api.post(`/suggestions/${id}/support`),
  unsupport: (id) => api.delete(`/suggestions/${id}/support`),
};

export const trackingApi = {
  lookup: (payload) => api.post('/tracking', payload),
};

export const adminApi = {
  login: (password) => api.post('/admin/login', { password }),
  session: () => api.get('/admin/session', { auth: true }),
  logout: () => api.post('/admin/logout', undefined, { auth: true }),
  statistics: () => api.get('/admin/statistics', { auth: true }),
  queue: (query) => api.get('/admin/queue', { auth: true, query }),
  selectMonthlyIdea: (suggestionId) =>
    api.patch('/admin/monthly-idea', { suggestionId }, { auth: true }),
  suggestions: (query) => api.get('/admin/suggestions', { auth: true, query }),
  suggestion: (id) => api.get(`/admin/suggestions/${id}`, { auth: true }),
  photo: (suggestionId, photoId, options) =>
    requestFile(`/admin/suggestions/${suggestionId}/photos/${photoId}/content`, {
      ...options,
      auth: true,
    }),
  changeStatus: (id, payload) =>
    api.patch(`/admin/suggestions/${id}/status`, payload, { auth: true }),
  bulkUpdateSuggestions: (ids, action) =>
    api.patch('/admin/suggestions/bulk', { ids, ...action }, { auth: true }),
  moderate: (id, payload) =>
    api.patch(`/admin/suggestions/${id}/moderation`, payload, { auth: true }),
  remove: (id) => api.delete(`/admin/suggestions/${id}`, { auth: true }),
  removeReport: (suggestionId, reportId) =>
    api.delete(`/admin/suggestions/${suggestionId}/reports/${reportId}`, { auth: true }),
  logs: (query) => api.get('/admin/logs', { auth: true, query }),
  logsForSuggestion: (id) => api.get(`/admin/suggestions/${id}/logs`, { auth: true }),
};
