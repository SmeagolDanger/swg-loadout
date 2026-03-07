import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import {
  Trophy, ChevronDown, ChevronUp, Search, Clipboard, HelpCircle,
  Plus, Edit2, Trash2, Check, X, Shield
} from 'lucide-react';

const CATEGORY_ICONS = {
  exploration: '🌍', combat: '⚔️', loot: '💎', profession: '🔧',
  event: '🎉', badge: '🏅', space: '🚀', other: '📦',
};

const EMPTY_CHAR = { name: '', server: 'Legends', species: '', profession: '', combat_level: 1, guild: '' };
const EMPTY_GROUP = { name: '', icon: 'default', category: 'other', description: '' };
const EMPTY_ITEM = { group_id: '', name: '', notes: '', difficulty: 'medium' };

function AdminModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card w-full max-w-xl p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="font-display text-plasma-400 text-sm tracking-wider">{title}</h3>
          <button className="btn-ghost p-2" onClick={onClose}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CollectionsPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const [collections, setCollections] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [charDetail, setCharDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showNewChar, setShowNewChar] = useState(false);
  const [newChar, setNewChar] = useState(EMPTY_CHAR);

  const [adminMessage, setAdminMessage] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP);
  const [editingItem, setEditingItem] = useState(null);
  const [creatingItemForGroup, setCreatingItemForGroup] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);

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
    } catch (e) {
      console.error('Failed to load collections:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMyCharacters = async () => {
    try {
      const data = await api.getCharacters({ user_id: user.id, limit: 50 });
      setCharacters(data.characters || []);
      if (!selectedCharId && data.characters?.length > 0) {
        setSelectedCharId(data.characters[0].id);
      }
    } catch (e) {
      console.error('Failed to load characters:', e);
    }
  };

  const loadCharDetail = async (id) => {
    try {
      const data = await api.getCharacter(id);
      setCharDetail(data);
    } catch (e) {
      console.error('Failed to load character:', e);
    }
  };

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
    } catch (e) {
      console.error('Toggle failed:', e);
    }
  }, [selectedCharId, user, completedSet]);

  const handleCreateChar = async () => {
    if (!newChar.name.trim()) return;
    try {
      await api.createCharacter(newChar);
      setNewChar(EMPTY_CHAR);
      setShowNewChar(false);
      await loadMyCharacters();
    } catch (e) {
      console.error('Create failed:', e);
    }
  };

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

  const filteredGroups = useMemo(() => {
    return collections
      .filter(g => !categoryFilter || g.category === categoryFilter)
      .map(g => {
        if (!searchQuery) return g;
        const q = searchQuery.toLowerCase();
        const groupMatches = g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q);
        if (groupMatches) return g;
        const filtered = g.items?.filter(i =>
          i.name.toLowerCase().includes(q) ||
          (i.notes || '').toLowerCase().includes(q)
        ) || [];
        return filtered.length > 0 ? { ...g, items: filtered } : null;
      })
      .filter(Boolean);
  }, [collections, categoryFilter, searchQuery]);

  const copyWaypoint = (text) => {
    const match = text?.match(/\/wp\s+[^\n;]+/);
    if (match) navigator.clipboard.writeText(match[0]);
  };

  const toggleGroup = (id) => {
    setExpandedGroups(prev => ({ ...prev, [id]: prev[id] === false ? true : (prev[id] === true ? false : false) }));
  };
  const isExpanded = (id) => expandedGroups[id] !== false;

  const openCreateGroup = () => {
    setGroupForm(EMPTY_GROUP);
    setEditingGroup(null);
    setCreatingGroup(true);
  };

  const openEditGroup = (group) => {
    setGroupForm({
      name: group.name || '',
      icon: group.icon || 'default',
      category: group.category || 'other',
      description: group.description || '',
    });
    setCreatingGroup(false);
    setEditingGroup(group);
  };

  const saveGroup = async () => {
    try {
      if (!groupForm.name.trim()) return;
      if (creatingGroup) {
        await api.createCollectionGroup(groupForm);
        setAdminMessage('Category created. Miracles do happen.');
      } else if (editingGroup) {
        await api.updateCollectionGroup(editingGroup.id, groupForm);
        setAdminMessage('Category updated. Bureaucracy prevails.');
      }
      setEditingGroup(null);
      setCreatingGroup(false);
      setGroupForm(EMPTY_GROUP);
      await loadCollections();
    } catch (e) {
      setAdminMessage(e.message || 'Failed to save category');
    }
  };

  const openCreateItem = (group) => {
    setEditingItem(null);
    setCreatingItemForGroup(group);
    setItemForm({ group_id: group.id, name: '', notes: '', difficulty: 'medium' });
  };

  const openEditItem = (group, item) => {
    setCreatingItemForGroup(group);
    setEditingItem(item);
    setItemForm({
      group_id: group.id,
      name: item.name || '',
      notes: item.notes || '',
      difficulty: item.difficulty || 'medium',
    });
  };

  const saveItem = async () => {
    try {
      if (!itemForm.name.trim()) return;
      if (editingItem) {
        await api.updateCollectionItem(editingItem.id, {
          name: itemForm.name,
          notes: itemForm.notes,
          difficulty: itemForm.difficulty,
        });
        setAdminMessage('Collection item updated. Tiny empire maintained.');
      } else {
        await api.createCollectionItem({
          group_id: Number(itemForm.group_id),
          name: itemForm.name,
          notes: itemForm.notes,
          difficulty: itemForm.difficulty,
        });
        setAdminMessage('Collection item created. Another checkbox for humanity.');
      }
      setEditingItem(null);
      setCreatingItemForGroup(null);
      setItemForm(EMPTY_ITEM);
      await loadCollections();
    } catch (e) {
      setAdminMessage(e.message || 'Failed to save item');
    }
  };

  const handleDeleteItem = async (item) => {
    const ok = window.confirm(`Delete "${item.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await api.deleteCollectionItem(item.id);
      setAdminMessage('Collection item deleted. Into the void it goes.');
      await loadCollections();
    } catch (e) {
      setAdminMessage(e.message || 'Failed to delete item');
    }
  };

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

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isAdmin && (
            <button className="btn-primary text-xs py-2 px-3" onClick={openCreateGroup}>
              <Plus size={14} />
              <span className="ml-1">ADD CATEGORY</span>
            </button>
          )}
          {user && (
            <>
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
            </>
          )}
        </div>
      </div>

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
        {isAdmin && (
          <div className="mt-3 text-xs text-plasma-300 bg-plasma-500/5 border border-plasma-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <Shield size={14} />
            Admin mode enabled. You can edit categories and collection items from this page now, because apparently shipping admin tools matters.
          </div>
        )}
        {adminMessage && (
          <div className="mt-3 text-xs text-laser-yellow bg-laser-yellow/5 border border-laser-yellow/20 rounded-lg px-3 py-2">
            {adminMessage}
          </div>
        )}
      </div>

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

      <div className="space-y-3">
        {filteredGroups.map(group => {
          const items = group.items || [];
          const groupCompleted = items.filter(i => completedSet.has(i.id)).length;
          const groupPct = items.length > 0 ? Math.round((groupCompleted / items.length) * 100) : 0;
          const expanded = isExpanded(group.id);

          return (
            <div key={group.id} className="card overflow-hidden">
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
                  {isAdmin && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button className="btn-ghost p-2 text-plasma-400" onClick={() => openCreateItem(group)} title="Add item">
                        <Plus size={14} />
                      </button>
                      <button className="btn-ghost p-2 text-hull-200" onClick={() => openEditGroup(group)} title="Edit category">
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
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

              {expanded && group.description && (
                <div className="px-4 py-2 text-xs text-hull-300 italic border-t border-hull-500/30">
                  {group.description}
                </div>
              )}

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
                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all
                          ${isCompleted
                            ? 'bg-plasma-500/30 border-plasma-500 text-plasma-400'
                            : 'border-hull-400 text-transparent'}`}
                        >
                          <Check size={12} />
                        </div>

                        <span className={`flex-1 font-body ${isCompleted ? 'text-hull-200 line-through' : 'text-hull-50'}`}>
                          {item.name}
                        </span>

                        {waypoint && (
                          <button
                            className="p-1 rounded hover:bg-hull-500/40 text-hull-300 hover:text-plasma-400 transition-colors"
                            title={waypoint}
                            onClick={e => { e.stopPropagation(); copyWaypoint(item.notes); }}
                          >
                            <Clipboard size={13} />
                          </button>
                        )}

                        {item.notes && (
                          <div className="relative group" onClick={e => e.stopPropagation()}>
                            <HelpCircle size={13} className="text-hull-400 group-hover:text-plasma-400 transition-colors" />
                            <div className="tooltip hidden group-hover:block -translate-x-full -translate-y-full whitespace-pre-wrap max-w-xs">
                              {item.notes}
                            </div>
                          </div>
                        )}

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

                        {isAdmin && (
                          <div className="flex items-center gap-1 ml-1" onClick={e => e.stopPropagation()}>
                            <button className="btn-ghost p-2 text-hull-200" onClick={() => openEditItem(group, item)} title="Edit item">
                              <Edit2 size={13} />
                            </button>
                            <button className="btn-ghost p-2 text-laser-red" onClick={() => handleDeleteItem(item)} title="Delete item">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {items.length === 0 && (
                    <div className="px-4 py-4 text-xs text-hull-300">No items in this category yet.</div>
                  )}
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

      {(creatingGroup || editingGroup) && (
        <AdminModal title={creatingGroup ? 'CREATE CATEGORY' : 'EDIT CATEGORY'} onClose={() => { setCreatingGroup(false); setEditingGroup(null); }}>
          <div className="space-y-3">
            <input placeholder="Category / group name" value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Icon key" value={groupForm.icon} onChange={e => setGroupForm(p => ({ ...p, icon: e.target.value }))} />
              <select value={groupForm.category} onChange={e => setGroupForm(p => ({ ...p, category: e.target.value }))}>
                {Object.keys(CATEGORY_ICONS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <textarea placeholder="Description" rows="4" value={groupForm.description} onChange={e => setGroupForm(p => ({ ...p, description: e.target.value }))} />
            <div className="flex gap-2 pt-2">
              <button className="btn-primary flex-1" onClick={saveGroup}>{creatingGroup ? 'Create Category' : 'Save Category'}</button>
              <button className="btn-ghost" onClick={() => { setCreatingGroup(false); setEditingGroup(null); }}>Cancel</button>
            </div>
          </div>
        </AdminModal>
      )}

      {(creatingItemForGroup || editingItem) && (
        <AdminModal title={editingItem ? 'EDIT COLLECTION ITEM' : 'CREATE COLLECTION ITEM'} onClose={() => { setCreatingItemForGroup(null); setEditingItem(null); }}>
          <div className="space-y-3">
            <select value={itemForm.group_id} onChange={e => setItemForm(p => ({ ...p, group_id: e.target.value }))} disabled={!!editingItem}>
              <option value="">Select category</option>
              {collections.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <input placeholder="Item name" value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} />
            <select value={itemForm.difficulty} onChange={e => setItemForm(p => ({ ...p, difficulty: e.target.value }))}>
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
              <option value="rare">rare</option>
            </select>
            <textarea placeholder="Notes, hints, or waypoint text" rows="6" value={itemForm.notes} onChange={e => setItemForm(p => ({ ...p, notes: e.target.value }))} />
            <div className="flex gap-2 pt-2">
              <button className="btn-primary flex-1" onClick={saveItem}>{editingItem ? 'Save Item' : 'Create Item'}</button>
              <button className="btn-ghost" onClick={() => { setCreatingItemForGroup(null); setEditingItem(null); }}>Cancel</button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
