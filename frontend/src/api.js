const BASE = '/api';

function createApiError(message, status = 0, detail = null) {
  const error = new Error(message || 'Request failed');
  error.status = status;
  error.detail = detail || message || 'Request failed';
  return error;
}

async function parseErrorResponse(res, fallbackMessage) {
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await res.json().catch(() => null);
    return body?.detail || fallbackMessage;
  }

  const text = await res.text().catch(() => '');
  return text || fallbackMessage;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });
  } catch (error) {
    throw createApiError(error?.message || 'Network request failed', 0);
  }

  if (res.status === 401) {
      }

  if (!res.ok) {
    const detail = await parseErrorResponse(res, 'Request failed');
    throw createApiError(detail, res.status, detail);
  }

  return res.json();
}

export const api = {
  // Auth
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: async (username, password) => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    let res;
    try {
      res = await fetch(`${BASE}/auth/login`, { method: 'POST', body: form, credentials: 'include' });
    } catch (error) {
      throw createApiError(error?.message || 'Login request failed', 0);
    }
    if (!res.ok) {
      const detail = await parseErrorResponse(res, 'Invalid credentials');
      throw createApiError(detail, res.status, detail);
    }
    return res.json();
  },
  getMe: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPasswordWithToken: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  getAuthProviders: () => request('/auth/providers'),
  getDiscordLoginUrl: () => `${BASE}/auth/discord/login`,

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


  // Buildout Explorer
  getBuildoutZones: () => request('/buildouts/zones'),
  getBuildoutZone: (zoneId) => request(`/buildouts/zones/${encodeURIComponent(zoneId)}`),
  parseBuildoutFile: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const headers = {};
    let res;
    try {
      res = await fetch(`${BASE}/buildouts/parse`, { method: 'POST', headers, body: form, credentials: 'include' });
    } catch (error) {
      throw createApiError(error?.message || 'Buildout parse failed', 0);
    }
    if (!res.ok) {
      const detail = await parseErrorResponse(res, 'Buildout parse failed');
      throw createApiError(detail, res.status, detail);
    }
    return res.json();
  },


  // Mods
  getMods: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.category) qs.set('category', params.category);
    if (params.featured !== undefined && params.featured !== null) qs.set('featured', params.featured);
    return request(`/mods${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  getMod: (slug) => request(`/mods/${encodeURIComponent(slug)}`),
  getAdminMods: () => request('/admin/mods'),
  getAdminMod: (id) => request(`/admin/mods/${id}`),
  createMod: (data) => request('/admin/mods', { method: 'POST', body: JSON.stringify(data) }),
  updateMod: (id, data) => request(`/admin/mods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMod: (id) => request(`/admin/mods/${id}`, { method: 'DELETE' }),
  uploadModFiles: async (id, files) => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('files', file));
    const headers = {};
    let res;
    try {
      res = await fetch(`${BASE}/admin/mods/${id}/files`, { method: 'POST', headers, body: form, credentials: 'include' });
    } catch (error) {
      throw createApiError(error?.message || 'Upload failed', 0);
    }
    if (!res.ok) {
      const detail = await parseErrorResponse(res, 'Upload failed');
      throw createApiError(detail, res.status, detail);
    }
    return res.json();
  },
  uploadModScreenshots: async (id, files) => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('files', file));
    const headers = {};
    let res;
    try {
      res = await fetch(`${BASE}/admin/mods/${id}/screenshots`, { method: 'POST', headers, body: form, credentials: 'include' });
    } catch (error) {
      throw createApiError(error?.message || 'Upload failed', 0);
    }
    if (!res.ok) {
      const detail = await parseErrorResponse(res, 'Upload failed');
      throw createApiError(detail, res.status, detail);
    }
    return res.json();
  },
  updateModFileLabel: (id, label) => request(`/admin/mods/files/${id}`, { method: 'PUT', body: JSON.stringify({ label }) }),
  deleteModFile: (id) => request(`/admin/mods/files/${id}`, { method: 'DELETE' }),
  deleteModScreenshot: (id) => request(`/admin/mods/screenshots/${id}`, { method: 'DELETE' }),

  // Loadouts
  getLoadouts: () => request('/loadouts'),
  getPublicLoadouts: () => request('/loadouts/public'),
  getStarterLoadouts: () => request('/loadouts/starters'),
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
  importSavedata: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const headers = {};
    let res;
    try {
      res = await fetch(`${BASE}/import/savedata`, { method: 'POST', headers, body: form, credentials: 'include' });
    } catch (error) {
      throw createApiError(error?.message || 'Import failed', 0);
    }
    if (!res.ok) {
      const detail = await parseErrorResponse(res, 'Import failed');
      throw createApiError(detail, res.status, detail);
    }
    return res.json();
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

  // Site config
  getModuleConfig: () => request('/config/modules'),
  updateModuleConfig: (enabled) => request('/config/modules', { method: 'PUT', body: JSON.stringify({ enabled }) }),

  // Ent Buff Builds
  getEntBuffBuilds: () => request('/ent-buff-builds'),
  saveEntBuffBuild: (name, serialized) => request('/ent-buff-builds', { method: 'POST', body: JSON.stringify({ name, serialized }) }),
  deleteEntBuffBuild: (id) => request(`/ent-buff-builds/${id}`, { method: 'DELETE' }),

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
  createCollectionGroup: (data) => request('/admin/collections/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateCollectionGroup: (id, data) => request(`/admin/collections/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCollectionGroup: (id) => request(`/admin/collections/groups/${id}`, { method: 'DELETE' }),
  createCollectionItem: (data) => request('/admin/collections/items', { method: 'POST', body: JSON.stringify(data) }),
  updateCollectionItem: (id, data) => request(`/admin/collections/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCollectionItem: (id) => request(`/admin/collections/items/${id}`, { method: 'DELETE' }),

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

  // ─── ADMIN ────────────────────────────────────────────────────────

  getAdminUsers: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.role) qs.set('role', params.role);
    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    return request(`/admin/users?${qs.toString()}`);
  },
  updateUserRole: (id, role) =>
    request(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  updateUserActive: (id, is_active) =>
    request(`/admin/users/${id}/active`, { method: 'PUT', body: JSON.stringify({ is_active }) }),
  resetUserPassword: (id, new_password) =>
    request(`/admin/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ new_password }) }),
  deleteUser: (id) =>
    request(`/admin/users/${id}`, { method: 'DELETE' }),
  getAdminStats: () => request('/admin/stats'),
  getFeaturedLoadouts: () => request('/admin/featured-loadouts'),
  toggleFeatured: (id, is_featured) =>
    request(`/admin/loadouts/${id}/featured`, { method: 'PUT', body: JSON.stringify({ is_featured }) }),
};
