const BASE = '/api';

function getToken() {
  return localStorage.getItem('slt_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('slt_token');
    localStorage.removeItem('slt_user');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (username, password) => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    return fetch(`${BASE}/auth/login`, { method: 'POST', body: form })
      .then(r => { if (!r.ok) throw new Error('Invalid credentials'); return r.json(); });
  },
  getMe: () => request('/auth/me'),

  // Game Data
  getChassisList: () => request('/gamedata/chassis'),
  getChassis: (name) => request(`/gamedata/chassis/${encodeURIComponent(name)}`),
  getComponentTypes: () => request('/gamedata/component-types'),
  getFCPrograms: () => request('/gamedata/fc-programs'),
  getOverloadLevels: () => request('/gamedata/overload-levels'),
  getShieldAdjustOptions: () => request('/gamedata/shield-adjust-options'),
  getComplib: (type) => request(`/gamedata/complib${type ? `?comp_type=${type}` : ''}`),
  calculate: (data) => request('/gamedata/calculate', { method: 'POST', body: JSON.stringify(data) }),
  lootLookup: (query, type) => request(`/gamedata/loot-lookup?query=${encodeURIComponent(query)}&search_type=${type}`),

  // Loadouts
  getLoadouts: () => request('/loadouts'),
  getPublicLoadouts: () => request('/loadouts/public'),
  getLoadout: (id) => request(`/loadouts/${id}`),
  createLoadout: (data) => request('/loadouts', { method: 'POST', body: JSON.stringify(data) }),
  updateLoadout: (id, data) => request(`/loadouts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  duplicateLoadout: (id, name) => request(`/loadouts/${id}/duplicate?new_name=${encodeURIComponent(name)}`, { method: 'POST' }),
  deleteLoadout: (id) => request(`/loadouts/${id}`, { method: 'DELETE' }),

  // Components
  getComponents: (type) => request(`/components${type ? `?comp_type=${type}` : ''}`),
  createComponent: (data) => request('/components', { method: 'POST', body: JSON.stringify(data) }),
  updateComponent: (id, data) => request(`/components/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteComponent: (id) => request(`/components/${id}`, { method: 'DELETE' }),

  // Import from desktop app
  importSavedata: (file) => {
    const form = new FormData();
    form.append('file', file);
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE}/import/savedata`, { method: 'POST', headers, body: form })
      .then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.detail || 'Import failed'); });
        return r.json();
      });
  },

  // RE Calculator
  getREComponentTypes: () => request('/re/component-types'),
  getRELevels: () => request('/re/levels'),
  getREStats: (compType) => request(`/re/stats/${encodeURIComponent(compType)}`),
  analyzeRE: (data) => request('/re/analyze', { method: 'POST', body: JSON.stringify(data) }),
  getBrandTable: (data) => request('/re/brand-table', { method: 'POST', body: JSON.stringify(data) }),
  getREProjects: () => request('/re/projects'),
  saveREProject: (data) => request('/re/projects', { method: 'POST', body: JSON.stringify(data) }),
  deleteREProject: (id) => request(`/re/projects/${id}`, { method: 'DELETE' }),

  // FC Calculator
  getFCLevels: () => request('/fc/levels'),
  calcCooldowns: (data) => request('/fc/cooldowns', { method: 'POST', body: JSON.stringify(data) }),
  generateMacro: (data) => request('/fc/macro', { method: 'POST', body: JSON.stringify(data) }),
  getFCLoadouts: () => request('/fc/loadouts'),
  saveFCLoadout: (data) => request('/fc/loadouts', { method: 'POST', body: JSON.stringify(data) }),
  deleteFCLoadout: (id) => request(`/fc/loadouts/${id}`, { method: 'DELETE' }),

  // Best Sources (enhanced loot lookup)
  getBestSources: (component, level, stat, value) => {
    let url = `/gamedata/best-sources?component=${encodeURIComponent(component)}&level=${level}`;
    if (stat) url += `&stat=${encodeURIComponent(stat)}`;
    if (value) url += `&value=${value}`;
    return request(url);
  },

  // ─── COLLECTIONS (NEW) ──────────────────────────────────────────────

  // Collections data
  getCollections: () => request('/collections'),
  getCollectionGroup: (id) => request(`/collections/${id}`),

  // Characters
  getCharacters: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.user_id) qs.set('user_id', params.user_id);
    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    return request(`/characters?${qs.toString()}`);
  },
  getCharacter: (id) => request(`/characters/${id}`),
  createCharacter: (data) => request('/characters', { method: 'POST', body: JSON.stringify(data) }),
  updateCharacter: (id, data) => request(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCharacter: (id) => request(`/characters/${id}`, { method: 'DELETE' }),

  // Collection tracking
  collectItem: (charId, itemId, notes = '') =>
    request(`/characters/${charId}/collections`, { method: 'POST', body: JSON.stringify({ item_id: itemId, notes }) }),
  bulkCollect: (charId, itemIds) =>
    request(`/characters/${charId}/collections/bulk`, { method: 'POST', body: JSON.stringify({ item_ids: itemIds }) }),
  uncollectItem: (charId, itemId) =>
    request(`/characters/${charId}/collections/${itemId}`, { method: 'DELETE' }),

  // Stats & leaderboard
  getGlobalStats: () => request('/stats'),
  getCharacterStats: (charId) => request(`/characters/${charId}/stats`),
  getLeaderboard: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', params.limit);
    if (params.offset) qs.set('offset', params.offset);
    if (params.category) qs.set('category', params.category);
    return request(`/leaderboard?${qs.toString()}`);
  },
};
