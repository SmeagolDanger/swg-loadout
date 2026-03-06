import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Box, Trash2, Copy, Globe, Lock, Eye } from 'lucide-react';

export default function LoadoutManager() {
  const [loadouts, setLoadouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.getLoadouts().then(setLoadouts).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this loadout permanently?')) return;
    try {
      await api.deleteLoadout(id);
      setSelected(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDuplicate = async (loadout) => {
    const name = prompt('Name for the duplicate:', `${loadout.name} (Copy)`);
    if (!name) return;
    try {
      await api.duplicateLoadout(loadout.id, name);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleTogglePublic = async (loadout) => {
    try {
      await api.updateLoadout(loadout.id, { ...loadout, is_public: !loadout.is_public });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-hull-100 flex items-center gap-2 mb-6">
        <Box size={24} className="text-plasma-400" /> MY LOADOUTS
      </h1>

      {loading ? (
        <div className="text-center py-12 text-hull-400">Loading loadouts...</div>
      ) : loadouts.length === 0 ? (
        <div className="text-center py-16">
          <Box size={48} className="text-hull-500 mx-auto mb-4" />
          <p className="text-hull-400 text-lg">No loadouts saved yet.</p>
          <p className="text-hull-500 text-sm mt-1">Use the Loadout Builder to create and save your first build.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {loadouts.map(l => (
            <div
              key={l.id}
              className={`card p-4 cursor-pointer transition-all hover:border-plasma-500/40
                ${selected?.id === l.id ? 'border-plasma-500/50 shadow-plasma' : ''}`}
              onClick={() => setSelected(selected?.id === l.id ? null : l)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-display font-bold text-hull-100 text-lg">{l.name}</h3>
                  <p className="text-sm text-plasma-400 font-display">{l.chassis}</p>
                </div>
                <div className="flex items-center gap-1">
                  {l.is_public ? (
                    <span className="text-[10px] bg-laser-green/15 text-laser-green border border-laser-green/30 rounded px-1.5 py-0.5 font-display">
                      <Globe size={10} className="inline mr-0.5" />PUBLIC
                    </span>
                  ) : (
                    <span className="text-[10px] bg-hull-600 text-hull-300 border border-hull-500 rounded px-1.5 py-0.5 font-display">
                      <Lock size={10} className="inline mr-0.5" />PRIVATE
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-hull-300">
                <span>Reactor: <span className="text-hull-100">{l.reactor !== 'None' ? l.reactor : '—'}</span></span>
                <span>Engine: <span className="text-hull-100">{l.engine !== 'None' ? l.engine : '—'}</span></span>
                <span>Shield: <span className="text-hull-100">{l.shield !== 'None' ? l.shield : '—'}</span></span>
                <span>Booster: <span className="text-hull-100">{l.booster !== 'None' ? l.booster : '—'}</span></span>
                <span>Cap: <span className="text-hull-100">{l.capacitor !== 'None' ? l.capacitor : '—'}</span></span>
                <span>Mass: <span className="text-hull-100 font-mono">{l.mass}</span></span>
              </div>

              {selected?.id === l.id && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-hull-500/30 animate-slide-up">
                  <button onClick={(e) => { e.stopPropagation(); handleDuplicate(l); }}
                    className="btn-ghost text-xs flex items-center gap-1"><Copy size={12} /> Duplicate</button>
                  <button onClick={(e) => { e.stopPropagation(); handleTogglePublic(l); }}
                    className="btn-ghost text-xs flex items-center gap-1">
                    {l.is_public ? <><Lock size={12} /> Make Private</> : <><Globe size={12} /> Make Public</>}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }}
                    className="btn-danger text-xs flex items-center gap-1 ml-auto"><Trash2 size={12} /> Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
