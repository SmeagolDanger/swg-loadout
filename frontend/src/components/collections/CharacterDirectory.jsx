import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { Users, Search, Edit2, Trash2, Eye, ChevronRight, Plus, X } from 'lucide-react';

export default function CharacterDirectory() {
  const { user } = useAuth();
  const [myChars, setMyChars] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChar, setSelectedChar] = useState(null);
  const [charStats, setCharStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (user) loadMyChars();
    setLoading(false);
  }, [user]);

  const loadMyChars = async () => {
    try {
      const data = await api.getCharacters({ user_id: user.id, limit: 50 });
      setMyChars(data.characters || []);
    } catch (e) { console.error(e); }
  };

  const doSearch = async () => {
    try {
      const data = await api.getCharacters({ search: searchQuery, limit: 50 });
      setSearchResults(data.characters || []);
    } catch (e) { console.error(e); }
  };

  const viewChar = async (id) => {
    try {
      const [detail, stats] = await Promise.all([
        api.getCharacter(id),
        api.getCharacterStats(id),
      ]);
      setSelectedChar(detail);
      setCharStats(stats);
    } catch (e) { console.error(e); }
  };

  const deleteChar = async (id) => {
    if (!confirm('Delete this character and all their collection progress?')) return;
    try {
      await api.deleteCharacter(id);
      setMyChars(prev => prev.filter(c => c.id !== id));
      if (selectedChar?.id === id) { setSelectedChar(null); setCharStats(null); }
    } catch (e) { console.error(e); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.updateCharacter(editing.id, editing);
      setEditing(null);
      loadMyChars();
      if (selectedChar?.id === editing.id) viewChar(editing.id);
    } catch (e) { console.error(e); }
  };

  const CharCard = ({ char, isMine }) => (
    <div className="card p-4 hover:border-plasma-500/30 transition-all cursor-pointer group"
      onClick={() => viewChar(char.id)}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-hull-50 group-hover:text-plasma-400 transition-colors">
          {char.name}
        </h3>
        <ChevronRight size={16} className="text-hull-400 group-hover:text-plasma-400 transition-colors" />
      </div>
      <div className="flex gap-2 flex-wrap text-xs font-mono text-hull-300">
        {char.species && <span>{char.species}</span>}
        {char.profession && <span className="text-hull-200">{char.profession}</span>}
        <span>CL{char.combat_level}</span>
      </div>
      {char.guild && (
        <div className="text-xs font-mono text-laser-yellow mt-1">&lt;{char.guild}&gt;</div>
      )}
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-hull-300">{char.owner_name || char.username}</span>
        <span className="text-plasma-400 font-display">{char.collection_count || 0} collected</span>
      </div>
      {isMine && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-hull-500/30">
          <button className="btn-ghost text-xs flex items-center gap-1 py-1 px-2"
            onClick={e => { e.stopPropagation(); setEditing({ ...char }); }}>
            <Edit2 size={12} /> Edit
          </button>
          <button className="btn-danger text-xs flex items-center gap-1 py-1 px-2"
            onClick={e => { e.stopPropagation(); deleteChar(char.id); }}>
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-plasma-500/20 border border-plasma-500/40 flex items-center justify-center">
          <Users size={20} className="text-plasma-400" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl tracking-wider text-hull-50">
            CHARACTER <span className="text-plasma-400">DIRECTORY</span>
          </h1>
          <p className="text-hull-300 text-xs font-mono">BROWSE & MANAGE CHARACTERS</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: chars list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hull-300" />
              <input className="w-full pl-9 text-sm" placeholder="Search by name, profession, guild, or owner..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
              />
            </div>
            <button className="btn-primary text-sm" onClick={doSearch}>Search</button>
          </div>

          {/* My Characters */}
          {user && myChars.length > 0 && (
            <>
              <h2 className="font-mono text-xs text-hull-300 tracking-widest">MY CHARACTERS</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myChars.map(c => <CharCard key={c.id} char={c} isMine />)}
              </div>
            </>
          )}

          {/* Search Results */}
          {searchResults && (
            <>
              <h2 className="font-mono text-xs text-hull-300 tracking-widest mt-4">
                SEARCH RESULTS ({searchResults.length})
              </h2>
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {searchResults.map(c => <CharCard key={c.id} char={c} isMine={user && c.user_id === user.id} />)}
                </div>
              ) : (
                <p className="text-hull-300 text-sm">No characters found.</p>
              )}
            </>
          )}
        </div>

        {/* Right column: detail panel */}
        <div>
          {selectedChar ? (
            <div className="card p-4 sticky top-20">
              <h2 className="font-display font-bold text-lg text-plasma-400 mb-1">{selectedChar.name}</h2>
              <div className="font-mono text-xs text-hull-300 mb-3">
                {selectedChar.species} {selectedChar.profession} CL{selectedChar.combat_level}
                {selectedChar.guild && <span className="text-laser-yellow ml-2">&lt;{selectedChar.guild}&gt;</span>}
              </div>
              {selectedChar.bio && (
                <p className="text-sm text-hull-200 mb-3 border-l-2 border-hull-500 pl-3">{selectedChar.bio}</p>
              )}

              {/* Category breakdown */}
              {charStats?.breakdown && (
                <div className="space-y-2 mt-4">
                  <h3 className="font-display text-xs text-hull-300 tracking-widest">CATEGORY BREAKDOWN</h3>
                  {charStats.breakdown.filter(b => b.total_items > 0).map(b => {
                    const pct = Math.round((b.completed_items / b.total_items) * 100);
                    return (
                      <div key={b.group_id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-hull-200 truncate">{b.group_name}</span>
                          <span className="text-hull-300 font-mono">{b.completed_items}/{b.total_items}</span>
                        </div>
                        <div className="w-full h-1 bg-hull-600 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-plasma-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="section-divider" />
                  <div className="flex justify-between text-sm font-display">
                    <span className="text-hull-200">TOTAL</span>
                    <span className="text-plasma-400 font-bold">
                      {charStats.totalCompleted}/{charStats.totalItems}
                      ({charStats.totalItems > 0 ? Math.round((charStats.totalCompleted / charStats.totalItems) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-6 text-center text-hull-300 text-sm">
              <Eye size={24} className="mx-auto mb-2 text-hull-400" />
              Select a character to view their collection breakdown.
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-hull-900/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditing(null)}>
          <div className="card p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-plasma-400 tracking-wider mb-4">EDIT CHARACTER</h3>
            <div className="space-y-3">
              <input placeholder="Name" value={editing.name}
                onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
              <input placeholder="Species" value={editing.species}
                onChange={e => setEditing(p => ({ ...p, species: e.target.value }))} />
              <input placeholder="Profession" value={editing.profession}
                onChange={e => setEditing(p => ({ ...p, profession: e.target.value }))} />
              <input placeholder="Guild" value={editing.guild}
                onChange={e => setEditing(p => ({ ...p, guild: e.target.value }))} />
              <input type="number" placeholder="Combat Level" value={editing.combat_level}
                onChange={e => setEditing(p => ({ ...p, combat_level: parseInt(e.target.value) || 1 }))} />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="edit-public" checked={editing.is_public}
                  onChange={e => setEditing(p => ({ ...p, is_public: e.target.checked }))} />
                <label htmlFor="edit-public" className="text-sm text-hull-200">Public profile</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button className="btn-primary flex-1" onClick={saveEdit}>Save</button>
                <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
