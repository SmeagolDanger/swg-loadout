import React, { useState } from 'react';
import { api } from '../api';
import { Search, Package, Crosshair } from 'lucide-react';

export default function LootLookup() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('component');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.lootLookup(query.trim(), searchType);
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-hull-100 flex items-center gap-2 mb-6">
        <Search size={24} className="text-plasma-400" /> LOOT LOOKUP
      </h1>

      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2 flex-1">
          <select value={searchType} onChange={e => setSearchType(e.target.value)} className="w-40 text-sm">
            <option value="component">By Component</option>
            <option value="npc">By NPC</option>
          </select>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchType === 'component' ? 'Search for a component...' : 'Search for an NPC...'}
            className="flex-1 text-sm"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-1.5">
          <Search size={14} /> {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="bg-laser-red/10 border border-laser-red/30 rounded-lg px-3 py-2 text-sm text-laser-red mb-4">{error}</div>
      )}

      {results !== null && results.length === 0 && (
        <div className="text-center py-12">
          <Package size={40} className="text-hull-500 mx-auto mb-3" />
          <p className="text-hull-400">No results found for "{query}"</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-hull-300 mb-2">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
          {results.map((r, i) => (
            <div key={i} className="card px-4 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display font-semibold text-hull-100">
                    <Crosshair size={14} className="inline mr-1.5 text-plasma-400" />
                    {r.npc_string || r.npc_type}
                  </div>
                  <div className="text-xs text-hull-300 mt-0.5 space-x-3">
                    <span>Type: <span className="text-hull-200">{r.npc_type}</span></span>
                    <span>Ship: <span className="text-hull-200">{r.ship_type || '—'}</span></span>
                    <span>Rolls: <span className="text-hull-200 font-mono">{r.loot_rolls}</span></span>
                    <span>Drop Rate: <span className="text-hull-200 font-mono">{r.drop_rate}</span></span>
                  </div>
                </div>
                <span className="text-[10px] bg-hull-600 text-hull-300 border border-hull-500 rounded px-1.5 py-0.5 font-mono">
                  {r.loot_group}
                </span>
              </div>
              {r.drops && r.drops.length > 0 && (
                <div className="mt-2 pt-2 border-t border-hull-500/30">
                  <p className="text-[10px] font-display text-hull-400 mb-1 tracking-wider">DROPS:</p>
                  <div className="flex flex-wrap gap-1">
                    {r.drops.map((d, j) => (
                      <span key={j} className="text-[11px] bg-hull-800 border border-hull-500/50 rounded px-1.5 py-0.5 text-hull-200">
                        {d}
                      </span>
                    ))}
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
