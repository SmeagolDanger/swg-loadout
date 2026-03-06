import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Users, Copy, Eye, User, ExternalLink } from 'lucide-react';

export default function PublicLoadouts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadouts, setLoadouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.getPublicLoadouts().then(setLoadouts).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCopy = async (loadout) => {
    if (!user) { alert('Sign in to copy loadouts'); return; }
    const name = prompt('Name for your copy:', `${loadout.name} (Copy)`);
    if (!name) return;
    try {
      await api.duplicateLoadout(loadout.id, name);
      alert('Loadout copied to your collection!');
    } catch (e) {
      alert(e.message);
    }
  };

  const SLOT_LABELS = ['Reactor', 'Engine', 'Booster', 'Shield', 'Front Armor', 'Rear Armor', 'Capacitor', 'Cargo Hold', 'Droid Interface'];
  const SLOT_KEYS = ['reactor', 'engine', 'booster', 'shield', 'front_armor', 'rear_armor', 'capacitor', 'cargo_hold', 'droid_interface'];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-hull-100 flex items-center gap-2 mb-6">
        <Users size={24} className="text-plasma-400" /> COMMUNITY LOADOUTS
      </h1>

      {loading ? (
        <div className="text-center py-12 text-hull-200">Loading community loadouts...</div>
      ) : loadouts.length === 0 ? (
        <div className="text-center py-16">
          <Users size={48} className="text-hull-500 mx-auto mb-4" />
          <p className="text-hull-200 text-lg">No public loadouts shared yet.</p>
          <p className="text-hull-500 text-sm mt-1">Be the first to share a build with the community!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {loadouts.map(l => (
            <div key={l.id} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-display font-bold text-hull-100 text-lg">{l.name}</h3>
                    <p className="text-sm text-plasma-400 font-display">{l.chassis}</p>
                  </div>
                  <div className="text-xs text-hull-200 font-display flex items-center gap-1">
                    <User size={12} /> {l.owner_name}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-hull-200 mb-3">
                  {SLOT_LABELS.map((label, i) => {
                    const val = l[SLOT_KEYS[i]];
                    if (!val || val === 'None') return null;
                    return (
                      <span key={i}>{label}: <span className="text-hull-100">{val}</span></span>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                    className="btn-ghost text-xs flex items-center gap-1">
                    <Eye size={12} /> {expanded === l.id ? 'Less' : 'Details'}
                  </button>
                  <button onClick={() => navigate(`/tools?loadout=${l.id}`)}
                    className="btn-ghost text-xs flex items-center gap-1">
                    <ExternalLink size={12} /> View in Builder
                  </button>
                  {user && (
                    <button onClick={() => handleCopy(l)}
                      className="btn-primary text-xs flex items-center gap-1">
                      <Copy size={12} /> Copy to My Loadouts
                    </button>
                  )}
                </div>
              </div>

              {expanded === l.id && (
                <div className="px-4 pb-4 border-t border-hull-500/30 pt-3 animate-slide-up">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    <span className="text-hull-200">Mass: <span className="text-hull-100 font-mono">{l.mass}</span></span>
                    {[1,2,3,4,5,6,7,8].map(i => {
                      const val = l[`slot${i}`];
                      if (!val || val === 'None') return null;
                      return <span key={i} className="text-hull-200">Slot {i}: <span className="text-hull-100">{val}</span></span>;
                    })}
                    {l.ro_level !== 'None' && <span className="text-hull-200">Reactor OL: <span className="text-laser-yellow font-mono">{l.ro_level}</span></span>}
                    {l.eo_level !== 'None' && <span className="text-hull-200">Engine OL: <span className="text-laser-yellow font-mono">{l.eo_level}</span></span>}
                    {l.co_level !== 'None' && <span className="text-hull-200">Cap OC: <span className="text-laser-yellow font-mono">{l.co_level}</span></span>}
                    {l.wo_level !== 'None' && <span className="text-hull-200">Weapon OL: <span className="text-laser-yellow font-mono">{l.wo_level}</span></span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
