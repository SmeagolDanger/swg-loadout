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
    // Don't redirect, let caller handle it
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
};
