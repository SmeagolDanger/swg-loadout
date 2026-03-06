import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../../api';
import {
  Trophy, ChevronDown, ChevronUp, Search, Filter, Clipboard, HelpCircle,
  Plus, Edit2, Trash2, Check, X, User, Users, Star
} from 'lucide-react';

const CATEGORY_ICONS = {
  exploration: '🌍', combat: '⚔️', loot: '💎', profession: '🔧',
  event: '🎉', badge: '🏅', space: '🚀', other: '📦',
};

export default function CollectionsPage() {
  const { user } = useAuth();

  // Data
  const [collections, setCollections] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [charDetail, setCharDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showNewChar, setShowNewChar] = useState(false);
  const [newChar, setNewChar] = useState({ name: '', server: 'Legends', species: '', profession: '', combat_level: 1, guild: '' });

  // ── Load data ──────────────────────────────────────────────────────
  useEffect(() => {
    loadCollections();
    if (user) loadMyCharacters();
  }, [user]);

  useEffect(() => {
    if (selectedCharId) loadCharDetail(selectedCharId);
    else setCharDetail(null);
  }, [selectedCharId]);

  const loadCollections = async () => {
    try {
      const data = await api.getCollections();
      setCollections(data);
    } catch (e) { console.error('Failed to load collections:', e); }
    finally { setLoading(false); }
  };

  const loadMyCharacters = async () => {
    try {
      const data = await api.getCharacters({ user_id: user.id, limit: 50 });
      setCharacters(data.characters || []);
      // Auto-select first character if none selected
      if (!selectedCharId && data.characters?.length > 0) {
        setSelectedCharId(data.characters[0].id);
      }
    } catch (e) { console.error('Failed to load characters:', e); }
  };

  const loadCharDetail = async (id) => {
    try {
      const data = await api.getCharacter(id);
      setCharDetail(data);
    } catch (e) { console.error('Failed to load character:', e); }
  };

  // ── Collection tracking ────────────────────────────────────────────
  const completedSet = useMemo(() => {
    if (!charDetail?.completed_collections) return new Set();
    return new Set(charDetail.completed_collections.map(c => c.item_id));
  }, [charDetail]);

  const toggleCollection = useCallback(async (itemId) => {
    if (!selectedCharId || !user) return;
    try {
      if (completedSet.has(itemId)) {
        await api.uncollectItem(selectedCharId, itemId);
      } else {
        await api.collectItem(selectedCharId, itemId);
      }
      await loadCharDetail(selectedCharId);
    } catch (e) { console.error('Toggle failed:', e); }
  }, [selectedCharId, user, completedSet]);

  // ── Character creation ─────────────────────────────────────────────
  const handleCreateChar = async () => {
    if (!newChar.name.trim()) return;
    try {
      await api.createCharacter(newChar);
      setNewChar({ name: '', server: 'Legends', species: '', profession: '', combat_level: 1, guild: '' });
      setShowNewChar(false);
      await loadMyCharacters();
    } catch (e) { console.error('Create failed:', e); }
  };

  // ── Derived stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalItems = 0, totalCompleted = 0;
    collections.forEach(g => {
      g.items?.forEach(i => {
        totalItems++;
        if (completedSet.has(i.id)) totalCompleted++;
      });
    });
    const pct = totalItems > 0 ? ((totalCompleted / totalItems) * 100).toFixed(1) : '0.0';
    return { totalItems, totalCompleted, pct };
  }, [collections, completedSet]);

  const categories = useMemo(() =>
    [...new Set(collections.map(g => g.category))].sort(),
    [collections]
  );

  // ── Filtering ──────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return collections
      .filter(g => !categoryFilter || g.category === categoryFilter)
      .map(g => {
        if (!searchQuery) return g;
        const q = searchQuery.toLowerCase();
        const filtered = g.items?.filter(i =>
          i.name.toLowerCase().includes(q) ||
          (i.notes || '').toLowerCase().includes(q)
        ) || [];
        return filtered.length > 0 ? { ...g, items: filtered } : null;
      })
      .filter(Boolean);
  }, [collections, categoryFilter, searchQuery]);

  // ── Clipboard ──────────────────────────────────────────────────────
  const copyWaypoint = (text) => {
    const match = text?.match(/\/wp\s+[^\n;]+/);
    if (match) navigator.clipboard.writeText(match[0]);
  };

  const toggleGroup = (id) => {
    setExpandedGroups(prev => ({ ...prev, [id]: prev[id] === false ? true : (prev[id] === true ? false : false) }));
  };
  const isExpanded = (id) => expandedGroups[id] !== false;

  // ── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-plasma-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-hull-200 font-display tracking-wider">LOADING COLLECTIONS...</p>
        </div>
      </div>
    );
  }

  const selectedChar = characters.find(c => c.id === selectedCharId);
  const canToggle = selectedChar && user && (selectedChar.user_id === user.id || user.is_admin);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-slide-up">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-plasma-500/20 border border-plasma-500/40 flex items-center justify-center">
            <Trophy size={20} className="text-plasma-400" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-wider text-hull-50">
              COLLECTION <span className="text-plasma-400">TRACKER</span>
            </h1>
            <p className="text-hull-300 text-xs font-mono">{stats.totalItems} ITEMS ACROSS {collections.length} CATEGORIES</p>
          </div>
        </div>

        {/* Character selector */}
        {user && (
          <div className="flex items-center gap-2">
            <select
              className="text-sm min-w-[180px]"
              value={selectedCharId || ''}
              onChange={e => setSelectedCharId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">-- Select Character --</option>
              {characters.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.profession || 'Unknown'}</option>
              ))}
            </select>
            <button className="btn-primary text-xs py-2 px-3" onClick={() => setShowNewChar(!showNewChar)}>
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── New Character Form ────────────────────────────────── */}
      {showNewChar && (
        <div className="card mb-4 p-4">
          <h3 className="font-display text-plasma-400 text-sm tracking-wider mb-3">NEW CHARACTER</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <input placeholder="Character name *" value={newChar.name}
              onChange={e => setNewChar(p => ({ ...p, name: e.target.value }))} />
            <input placeholder="Species" value={newChar.species}
              onChange={e => setNewChar(p => ({ ...p, species: e.target.value }))} />
            <input placeholder="Profession" value={newChar.profession}
              onChange={e => setNewChar(p => ({ ...p, profession: e.target.value }))} />
            <input placeholder="Guild" value={newChar.guild}
              onChange={e => setNewChar(p => ({ ...p, guild: e.target.value }))} />
            <input type="number" placeholder="Combat Level" value={newChar.combat_level}
              onChange={e => setNewChar(p => ({ ...p, combat_level: parseInt(e.target.value) || 1 }))} />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={handleCreateChar}>Create</button>
              <button className="btn-ghost" onClick={() => setShowNewChar(false)}><X size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats Bar ─────────────────────────────────────────── */}
      <div className="card mb-4 p-4">
        {selectedChar && (
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="font-display font-bold text-plasma-400">{selectedChar.name}</span>
            <span className="font-mono text-xs text-hull-300">
              {selectedChar.species} {selectedChar.profession} CL{selectedChar.combat_level}
            </span>
            {selectedChar.guild && (
              <span className="font-mono text-xs text-laser-yellow">&lt;{selectedChar.guild}&gt;</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex justify-between mb-1">
              <span className="text-hull-200 text-xs font-display tracking-wider">COMPLETION</span>
              <span className="font-display font-bold text-xs text-laser-yellow">
                {stats.totalCompleted}/{stats.totalItems} ({stats.pct}%)
              </span>
            </div>
            <div className="w-full h-2 bg-hull-600 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${stats.pct}%`,
                  background: 'linear-gradient(90deg, #00d4ff, #ffaa00)',
                }}
              />
            </div>
          </div>
          {[
            { label: 'COLLECTED', val: stats.totalCompleted, color: 'text-plasma-400' },
            { label: 'REMAINING', val: stats.totalItems - stats.totalCompleted, color: 'text-hull-300' },
            { label: 'CATEGORIES', val: collections.length, color: 'text-laser-yellow' },
          ].map(s => (
            <div key={s.label} className="text-center px-3">
              <div className={`font-display font-bold text-lg ${s.color}`}>{s.val}</div>
              <div className="text-hull-300 text-[10px] font-display tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>

        {!selectedChar && user && (
          <div className="mt-3 text-xs text-hull-300 bg-plasma-glow border border-hull-500/30 rounded-lg px-3 py-2">
            Select a character above to start tracking collections, or browse read-only.
          </div>
        )}
        {!user && (
          <div className="mt-3 text-xs text-hull-300 bg-laser-yellow/5 border border-hull-500/30 rounded-lg px-3 py-2">
            Sign in to create characters and track your collection progress.
          </div>
        )}
      </div>

      {/* ── Search & Filters ──────────────────────────────────── */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hull-300" />
          <input
            className="w-full pl-9 text-sm"
            placeholder="Search collections..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className={`btn-ghost text-xs ${!categoryFilter ? 'text-plasma-400 bg-hull-700' : ''}`}
          onClick={() => setCategoryFilter(null)}
        >ALL</button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`btn-ghost text-xs ${categoryFilter === cat ? 'text-plasma-400 bg-hull-700' : ''}`}
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
          >
            {CATEGORY_ICONS[cat] || '📦'} {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── Collection Groups ─────────────────────────────────── */}
      <div className="space-y-3">
        {filteredGroups.map(group => {
          const items = group.items || [];
          const groupCompleted = items.filter(i => completedSet.has(i.id)).length;
          const groupPct = items.length > 0 ? Math.round((groupCompleted / items.length) * 100) : 0;
          const expanded = isExpanded(group.id);

          return (
            <div key={group.id} className="card overflow-hidden">
              {/* Group header */}
              <button
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-hull-600/30 transition-colors"
                onClick={() => toggleGroup(group.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{CATEGORY_ICONS[group.category] || '📦'}</span>
                  <div className="text-left">
                    <div className="font-display font-semibold text-hull-50 text-sm tracking-wider">
                      {group.name.toUpperCase()}
                    </div>
                    <div className="font-mono text-[10px] text-hull-300">
                      {group.category.toUpperCase()} // {groupCompleted}/{items.length} COLLECTED
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-hull-600 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-plasma-500 transition-all duration-300"
                      style={{ width: `${groupPct}%` }}
                    />
                  </div>
                  <span className={`font-display font-bold text-sm w-10 text-right ${groupPct === 100 ? 'text-laser-yellow' : 'text-hull-200'}`}>
                    {groupPct}%
                  </span>
                  {expanded ? <ChevronUp size={16} className="text-hull-300" /> : <ChevronDown size={16} className="text-hull-300" />}
                </div>
              </button>

              {/* Description */}
              {expanded && group.description && (
                <div className="px-4 py-2 text-xs text-hull-300 italic border-t border-hull-500/30">
                  {group.description}
                </div>
              )}

              {/* Items grid */}
              {expanded && (
                <div className="border-t border-hull-500/30">
                  {items.map(item => {
                    const isCompleted = completedSet.has(item.id);
                    const waypoint = item.notes?.match(/\/wp\s+[^\n;]+/)?.[0];

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 px-4 py-2 text-sm border-b border-hull-500/20 last:border-b-0 transition-colors
                          ${isCompleted ? 'bg-plasma-500/5' : 'hover:bg-hull-600/20'}
                          ${canToggle ? 'cursor-pointer' : ''}`}
                        onClick={canToggle ? () => toggleCollection(item.id) : undefined}
                        title={canToggle ? (isCompleted ? 'Click to uncollect' : 'Click to mark collected') : ''}
                      >
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all
                          ${isCompleted
                            ? 'bg-plasma-500/30 border-plasma-500 text-plasma-400'
                            : 'border-hull-400 text-transparent'}`}
                        >
                          <Check size={12} />
                        </div>

                        {/* Name */}
                        <span className={`flex-1 font-body ${isCompleted ? 'text-hull-200 line-through' : 'text-hull-50'}`}>
                          {item.name}
                        </span>

                        {/* Waypoint copy */}
                        {waypoint && (
                          <button
                            className="p-1 rounded hover:bg-hull-500/40 text-hull-300 hover:text-plasma-400 transition-colors"
                            title={waypoint}
                            onClick={e => { e.stopPropagation(); copyWaypoint(item.notes); }}
                          >
                            <Clipboard size={13} />
                          </button>
                        )}

                        {/* Notes tooltip */}
                        {item.notes && (
                          <div className="relative group">
                            <HelpCircle size={13} className="text-hull-400 group-hover:text-plasma-400 transition-colors" />
                            <div className="tooltip hidden group-hover:block -translate-x-full -translate-y-full whitespace-pre-wrap max-w-xs">
                              {item.notes}
                            </div>
                          </div>
                        )}

                        {/* Difficulty badge */}
                        {item.difficulty && (
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded tracking-wider
                            ${item.difficulty === 'easy' ? 'bg-laser-green/10 text-laser-green' :
                              item.difficulty === 'hard' ? 'bg-laser-red/10 text-laser-red' :
                              item.difficulty === 'rare' ? 'bg-laser-yellow/10 text-laser-yellow' :
                              'bg-hull-500/30 text-hull-300'}`}
                          >
                            {item.difficulty.toUpperCase()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredGroups.length === 0 && (
        <div className="text-center py-12 text-hull-300 font-display">
          No collections found matching your search.
        </div>
      )}
    </div>
  );
}
