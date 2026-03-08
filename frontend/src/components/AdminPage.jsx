import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import ModsAdminTab from './ModsAdminTab';
import {
  Shield, Users, Star, BarChart3, Search, ChevronDown,
  Trash2, Key, UserX, UserCheck, X, Check, AlertTriangle, Sparkles, ExternalLink, Download
} from 'lucide-react';

const ROLES = ['user', 'admin', 'collection_admin'];
const TABS = [
  { key: 'users', label: 'Users', icon: Users },
  { key: 'featured', label: 'Featured', icon: Star },
  { key: 'starters', label: 'Starters', icon: Sparkles },
  { key: 'mods', label: 'Mods', icon: Download },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('users');

  if (!user?.role || (user.role !== 'admin' && !user.is_admin)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Shield size={48} className="text-laser-red mx-auto mb-4" />
        <h2 className="font-display text-xl text-hull-100 tracking-wider">ACCESS DENIED</h2>
        <p className="text-hull-300 text-sm mt-2">Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 animate-slide-up">
      <div className="panel mb-6">
        <div className="panel-header flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[rgba(255,51,68,0.15)] border border-[rgba(255,51,68,0.30)] flex items-center justify-center">
          <Shield size={20} className="text-laser-red" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl tracking-wider text-hull-50">
            ADMIN <span className="text-laser-red">PANEL</span>
          </h1>
          <p className="text-hull-100 text-xs font-mono tracking-wide">ROLE: {(user.role || 'admin').toUpperCase()}</p>
        </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-hull-400/40 pb-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-display text-sm tracking-wide transition-all border
              ${tab === t.key
                ? 'bg-hull-700 text-plasma-300 border-hull-300/60 shadow-glow'
                : 'text-hull-100 border-transparent hover:text-white hover:bg-hull-700/70 hover:border-hull-400/40'}`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'featured' && <FeaturedTab />}
      {tab === 'starters' && <StarterBuildsTab />}
      {tab === 'mods' && <ModsAdminTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Users Tab
// ═════════════════════════════════════════════════════════════════════

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers({ search, role: roleFilter, page, limit: 50 });
      setUsers(data);
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, page]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      flash(`Role updated to ${newRole}`);
      load();
    } catch (e) {
      flash(e.message || 'Failed to update role');
    }
  };

  const handleToggleActive = async (u) => {
    try {
      await api.updateUserActive(u.id, !u.is_active);
      flash(`User ${u.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch (e) {
      flash(e.message || 'Failed to toggle status');
    }
  };

  const handleResetPassword = async (u) => {
    const pw = prompt(`New password for ${u.username} (min 6 chars):`);
    if (!pw || pw.length < 6) return;
    try {
      await api.resetUserPassword(u.id, pw);
      flash('Password reset');
    } catch (e) {
      flash(e.message || 'Failed to reset password');
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Delete user "${u.username}" and ALL their data? This cannot be undone.`)) return;
    try {
      await api.deleteUser(u.id);
      flash('User deleted');
      setExpandedUser(null);
      load();
    } catch (e) {
      flash(e.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="toolbar mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hull-300" />
          <input
            className="w-full pl-9 text-sm"
            placeholder="Search users..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="text-sm min-w-[140px]"
        >
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {message && (
        <div className="mb-4 text-xs text-laser-yellow bg-[rgba(255,170,0,0.05)] border border-[rgba(255,170,0,0.20)] rounded-lg px-3 py-2 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')}><X size={12} /></button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-plasma-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-hull-200 font-display text-sm tracking-wider">LOADING USERS...</p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {users.map(u => (
              <div key={u.id} className="card overflow-hidden border-hull-300/50">
                <button
                  className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-hull-600/45 transition-colors text-left"
                  onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-hull-50 text-sm">{u.username}</span>
                      <span className={`badge ${u.role === 'admin'
  ? 'badge-admin'
  : u.role === 'collection_admin'
    ? 'badge-collection'
    : 'badge-neutral'}`}>
                        {(u.role || 'user').toUpperCase()}
                      </span>
                      {!u.is_active && (
                        <span className="badge bg-[rgba(255,51,68,0.12)] text-red-200 border-[rgba(255,51,68,0.40)]">
                          DISABLED
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-hull-200 font-mono mt-1 truncate">
                      {u.email} · {u.display_name || '—'}
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-hull-100 font-mono shrink-0">
                    <span title="Loadouts">{u.loadout_count}L</span>
                    <span title="Components">{u.component_count}C</span>
                    <span title="Characters">{u.character_count}Ch</span>
                  </div>
                  <ChevronDown size={14} className={`text-hull-400 transition-transform ${expandedUser === u.id ? 'rotate-180' : ''}`} />
                </button>

                {expandedUser === u.id && (
                  <div className="px-4 pb-4 border-t border-hull-500/30 pt-3 animate-slide-up">
                    <div className="flex flex-wrap gap-3 items-center">
                      <div>
                        <label className="block text-[10px] font-display text-hull-300 tracking-wider mb-1">ROLE</label>
                        <select
                          value={u.role || 'user'}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="text-sm min-w-[160px]"
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>

                      <div className="flex gap-2 items-end">
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`btn-ghost text-xs flex items-center gap-1 ${u.is_active ? 'text-laser-yellow' : 'text-laser-green'}`}
                          title={u.is_active ? 'Deactivate user' : 'Activate user'}
                        >
                          {u.is_active ? <><UserX size={13} /> Deactivate</> : <><UserCheck size={13} /> Activate</>}
                        </button>
                        <button
                          onClick={() => handleResetPassword(u)}
                          className="btn-ghost text-xs flex items-center gap-1 text-hull-200"
                        >
                          <Key size={13} /> Reset PW
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="btn-ghost text-xs flex items-center gap-1 text-laser-red"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-hull-600/60 border border-hull-400/40 rounded-xl px-3 py-2.5">
                        <div className="text-hull-200 font-display tracking-[0.14em] text-[10px]">JOINED</div>
                        <div className="text-hull-50 font-mono mt-1">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</div>
                      </div>
                      <div className="bg-hull-600/60 border border-hull-400/40 rounded-xl px-3 py-2.5">
                        <div className="text-hull-200 font-display tracking-[0.14em] text-[10px]">LOADOUTS</div>
                        <div className="text-hull-50 font-mono mt-1">{u.loadout_count}</div>
                      </div>
                      <div className="bg-hull-600/60 border border-hull-400/40 rounded-xl px-3 py-2.5">
                        <div className="text-hull-200 font-display tracking-[0.14em] text-[10px]">COMPONENTS</div>
                        <div className="text-hull-50 font-mono mt-1">{u.component_count}</div>
                      </div>
                      <div className="bg-hull-600/60 border border-hull-400/40 rounded-xl px-3 py-2.5">
                        <div className="text-hull-200 font-display tracking-[0.14em] text-[10px]">CHARACTERS</div>
                        <div className="text-hull-50 font-mono mt-1">{u.character_count}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {users.length === 0 && (
            <div className="text-center py-12 text-hull-200 font-display">No users found.</div>
          )}

          {users.length >= 50 && (
            <div className="flex justify-center gap-2 mt-4">
              {page > 1 && <button className="btn-ghost text-xs" onClick={() => setPage(p => p - 1)}>Previous</button>}
              <span className="text-xs text-hull-300 font-display self-center">Page {page}</span>
              <button className="btn-ghost text-xs" onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Featured Loadouts Tab
// ═════════════════════════════════════════════════════════════════════

function FeaturedTab() {
  const [featured, setFeatured] = useState([]);
  const [allLoadouts, setAllLoadouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPublic, setShowPublic] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [feat, pub] = await Promise.all([
        api.getFeaturedLoadouts(),
        api.getPublicLoadouts(),
      ]);
      setFeatured(feat);
      setAllLoadouts(pub);
    } catch (e) {
      console.error('Failed to load:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleToggle = async (id, currentlyFeatured) => {
    try {
      await api.toggleFeatured(id, !currentlyFeatured);
      flash(currentlyFeatured ? 'Removed from featured' : 'Added to featured');
      load();
    } catch (e) {
      flash(e.message || 'Failed to update');
    }
  };

  const featuredIds = new Set(featured.map(f => f.id));
  const unfeaturedPublic = allLoadouts.filter(l => !featuredIds.has(l.id));

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-2 border-plasma-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div className="mb-4 text-xs text-laser-yellow bg-[rgba(255,170,0,0.05)] border border-[rgba(255,170,0,0.20)] rounded-lg px-3 py-2 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')}><X size={12} /></button>
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-display text-sm text-plasma-400 tracking-wider mb-2 flex items-center gap-2">
          <Star size={14} /> FEATURED LOADOUTS ({featured.length})
        </h3>
        {featured.length === 0 ? (
          <div className="text-sm text-hull-300 py-4">No featured loadouts yet. Feature a public loadout below.</div>
        ) : (
          <div className="space-y-1">
            {featured.map(lo => (
              <div key={lo.id} className="card px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-display font-semibold text-hull-50 text-sm">{lo.name}</span>
                  <span className="text-xs text-hull-300 ml-2 font-mono">{lo.chassis}</span>
                  <span className="text-xs text-hull-400 ml-2">by {lo.owner_name}</span>
                </div>
                <button
                  onClick={() => handleToggle(lo.id, true)}
                  className="btn-ghost text-xs text-laser-red flex items-center gap-1"
                >
                  <X size={13} /> Unfeature
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <button
          className="btn-ghost text-xs mb-2 flex items-center gap-1"
          onClick={() => setShowPublic(!showPublic)}
        >
          <ChevronDown size={14} className={`transition-transform ${showPublic ? 'rotate-180' : ''}`} />
          {showPublic ? 'Hide' : 'Show'} public loadouts ({unfeaturedPublic.length})
        </button>

        {showPublic && (
          <div className="space-y-1">
            {unfeaturedPublic.map(lo => (
              <div key={lo.id} className="card px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-display font-semibold text-hull-50 text-sm">{lo.name}</span>
                  <span className="text-xs text-hull-300 ml-2 font-mono">{lo.chassis}</span>
                  <span className="text-xs text-hull-400 ml-2">by {lo.owner_name}</span>
                </div>
                <button
                  onClick={() => handleToggle(lo.id, false)}
                  className="btn-primary text-xs flex items-center gap-1"
                >
                  <Star size={13} /> Feature
                </button>
              </div>
            ))}
            {unfeaturedPublic.length === 0 && (
              <div className="text-sm text-hull-300 py-4">No unfeatured public loadouts.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function StarterBuildsTab() {
  const [starters, setStarters] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getStarterLoadouts();
      setStarters(data);
    } catch (error) {
      console.error('Failed to load starter builds:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-2 border-plasma-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="font-display text-sm text-plasma-400 tracking-wider mb-1 flex items-center gap-2">
            <Sparkles size={14} /> STARTER BUILDS
          </h3>
          <p className="text-sm text-hull-200">
            Build curated starter loadouts in the main builder, then save them with starter mode enabled.
          </p>
        </div>
        <a href="/tools?starter=1" className="btn-primary text-xs flex items-center gap-1 whitespace-nowrap">
          <Sparkles size={13} /> Open Starter Builder
        </a>
      </div>

      {starters.length === 0 ? (
        <div className="text-sm text-hull-300 py-4">No starter builds published yet.</div>
      ) : (
        <div className="space-y-2">
          {starters.map((starter) => (
            <div key={starter.id} className="card px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-semibold text-hull-50 text-sm">{starter.name}</span>
                  <span className="text-xs text-hull-300 font-mono">{starter.chassis}</span>
                </div>
                {starter.starter_description && (
                  <p className="text-xs text-hull-200 mt-1">{starter.starter_description}</p>
                )}
                <div className="text-xs text-hull-400 mt-1">by {starter.owner_name}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/tools?loadout=${starter.id}&starter=1`}
                  className="btn-ghost text-xs flex items-center gap-1"
                >
                  <ExternalLink size={13} /> Edit in Builder
                </a>
                <a
                  href="/tools/starters"
                  className="btn-ghost text-xs flex items-center gap-1"
                >
                  <Users size={13} /> Public View
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Stats Tab
// ═════════════════════════════════════════════════════════════════════

function StatsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAdminStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-2 border-plasma-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      </div>
    );
  }

  const cards = [
    { label: 'TOTAL USERS', value: stats.total_users, color: 'text-plasma-400' },
    { label: 'ACTIVE USERS', value: stats.active_users, color: 'text-laser-green' },
    { label: 'LOADOUTS', value: stats.total_loadouts, color: 'text-plasma-400' },
    { label: 'PUBLIC', value: stats.public_loadouts, color: 'text-hull-200' },
    { label: 'FEATURED', value: stats.featured_loadouts, color: 'text-laser-yellow' },
    { label: 'COMPONENTS', value: stats.total_components, color: 'text-hull-200' },
    { label: 'CHARACTERS', value: stats.total_characters, color: 'text-plasma-400' },
    { label: 'COLL. GROUPS', value: stats.total_collection_groups, color: 'text-hull-200' },
    { label: 'COLL. ITEMS', value: stats.total_collection_items, color: 'text-hull-200' },
    { label: 'ITEMS COLLECTED', value: stats.total_items_collected, color: 'text-laser-green' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(c => (
        <div key={c.label} className="card-strong p-6 text-center">
          <div className={`font-display font-bold text-3xl ${c.color}`}>{c.value.toLocaleString()}</div>
          <div className="text-hull-200 text-[11px] font-display tracking-[0.22em] mt-2">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
