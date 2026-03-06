import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Search, Package, Crosshair, Target, ChevronDown } from 'lucide-react';

const COMP_TYPES = ['Armor', 'Booster', 'Capacitor', 'Droid Interface', 'Engine', 'Reactor', 'Shield', 'Weapon'];

export default function LootLookup() {
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('component');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [bsComp, setBsComp] = useState('');
  const [bsLevel, setBsLevel] = useState('');
  const [bsStat, setBsStat] = useState('');
  const [bsValue, setBsValue] = useState('');
  const [bsStats, setBsStats] = useState([]);
  const [bsResults, setBsResults] = useState(null);
  const [bsLoading, setBsLoading] = useState(false);
  const [bsExpanded, setBsExpanded] = useState(20);

  useEffect(() => {
    if (!bsComp) { setBsStats([]); return; }
    api.getREStats(bsComp).then(data => {
      setBsStats(data.stats?.map(s => s.name) || []);
      setBsStat(''); setBsValue('');
    }).catch(() => {});
  }, [bsComp]);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError('');
    try { setResults(await api.lootLookup(query.trim(), searchType)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleBestSources = async () => {
    if (!bsComp || !bsLevel) return;
    setBsLoading(true); setBsResults(null); setBsExpanded(20);
    try { setBsResults(await api.getBestSources(bsComp, parseInt(bsLevel), bsStat, parseFloat(bsValue) || 0)); }
    catch (err) { setError(err.message); }
    finally { setBsLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-hull-50 flex items-center gap-2 mb-6">
        <Search size={24} className="text-plasma-400" /> LOOT LOOKUP
      </h1>

      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab('search')}
          className={`px-4 py-2 rounded-lg font-display text-sm font-semibold tracking-wide transition-all ${tab === 'search' ? 'bg-hull-700 text-plasma-400 shadow-glow' : 'text-hull-100 hover:bg-hull-700'}`}>
          <Search size={14} className="inline mr-1.5" />Search
        </button>
        <button onClick={() => setTab('best')}
          className={`px-4 py-2 rounded-lg font-display text-sm font-semibold tracking-wide transition-all ${tab === 'best' ? 'bg-hull-700 text-plasma-400 shadow-glow' : 'text-hull-100 hover:bg-hull-700'}`}>
          <Target size={14} className="inline mr-1.5" />Best Sources
        </button>
      </div>

      {tab === 'search' && (
        <>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex gap-2 flex-1">
              <select value={searchType} onChange={e => setSearchType(e.target.value)} className="w-40 text-sm">
                <option value="component">By Component</option>
                <option value="npc">By NPC</option>
              </select>
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder={searchType === 'component' ? 'Search for a component...' : 'Search for an NPC...'}
                className="flex-1 text-sm" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-1.5">
              <Search size={14} /> {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
          {error && <div className="bg-laser-red/10 border border-laser-red/30 rounded-lg px-3 py-2 text-sm text-laser-red mb-4">{error}</div>}
          {results !== null && results.length === 0 && (
            <div className="text-center py-12">
              <Package size={40} className="text-hull-400 mx-auto mb-3" />
              <p className="text-hull-200">No results found for "{query}"</p>
            </div>
          )}
          {results && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-hull-200 mb-2">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
              {results.map((r, i) => (
                <div key={i} className="card px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-display font-semibold text-hull-50">
                        <Crosshair size={14} className="inline mr-1.5 text-plasma-400" />{r.npc_string || r.npc_type}
                      </div>
                      <div className="text-xs text-hull-200 mt-0.5 space-x-3">
                        <span>Type: <span className="text-hull-100">{r.npc_type}</span></span>
                        <span>Ship: <span className="text-hull-100">{r.ship_type || '—'}</span></span>
                        <span>Rolls: <span className="text-hull-100 font-mono">{r.loot_rolls}</span></span>
                        <span>Drop Rate: <span className="text-hull-100 font-mono">{r.drop_rate}</span></span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-hull-600 text-hull-200 border border-hull-500 rounded px-1.5 py-0.5 font-mono">{r.loot_group}</span>
                  </div>
                  {r.drops?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-hull-500/30">
                      <p className="text-[10px] font-display text-hull-300 mb-1 tracking-wider">DROPS:</p>
                      <div className="flex flex-wrap gap-1">
                        {r.drops.map((d, j) => (
                          <span key={j} className="text-[11px] bg-hull-800 border border-hull-500/50 rounded px-1.5 py-0.5 text-hull-100">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'best' && (
        <>
          <div className="card mb-4">
            <div className="card-header"><Target size={16} /> FIND BEST DROP SOURCES</div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-display text-hull-200 tracking-wider mb-1">COMPONENT</label>
                  <select value={bsComp} onChange={e => setBsComp(e.target.value)} className="w-full text-sm">
                    <option value="">Select...</option>
                    {COMP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-display text-hull-200 tracking-wider mb-1">RE LEVEL</label>
                  <select value={bsLevel} onChange={e => setBsLevel(e.target.value)} className="w-full text-sm">
                    <option value="">Select...</option>
                    {[1,2,3,4,5,6,7,8,9,10].map(l => <option key={l} value={l}>Level {l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-display text-hull-200 tracking-wider mb-1">STAT (optional)</label>
                  <select value={bsStat} onChange={e => setBsStat(e.target.value)} className="w-full text-sm" disabled={!bsComp}>
                    <option value="">Any (drop rate only)</option>
                    {bsStats.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-display text-hull-200 tracking-wider mb-1">MIN VALUE</label>
                  <input type="number" step="any" value={bsValue} onChange={e => setBsValue(e.target.value)}
                    placeholder="Target value..." className="w-full text-sm" disabled={!bsStat} />
                </div>
                <div className="flex items-end">
                  <button onClick={handleBestSources} disabled={bsLoading || !bsComp || !bsLevel}
                    className="btn-primary w-full flex items-center justify-center gap-1.5">
                    <Target size={14} /> {bsLoading ? 'Calculating...' : 'Find Sources'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-hull-200">
                Calculates combined drop rate × brand distribution{bsStat ? ' × stat rarity' : ''} across all NPC sources.
              </p>
            </div>
          </div>

          {bsResults !== null && bsResults.length === 0 && (
            <div className="text-center py-12">
              <Package size={40} className="text-hull-400 mx-auto mb-3" />
              <p className="text-hull-200">No sources found for this combination</p>
            </div>
          )}

          {bsResults && bsResults.length > 0 && (
            <div className="card">
              <div className="card-header">TOP SOURCES
                <span className="ml-auto text-xs text-hull-200 font-mono normal-case">{bsResults.length} sources</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-display text-hull-200 tracking-wider border-b border-hull-500/30">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">NPC SOURCE</th>
                      <th className="text-left py-2 px-3">ODDS</th>
                      <th className="text-left py-2 px-3">UNIT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bsResults.slice(0, bsExpanded).map((r, i) => (
                      <tr key={i} className="border-t border-hull-600/20 hover:bg-hull-600/20">
                        <td className="py-1.5 px-3 text-hull-200 font-mono text-xs">{i + 1}</td>
                        <td className="py-1.5 px-3 text-hull-50 font-medium">{r.npc}</td>
                        <td className="py-1.5 px-3 font-mono text-plasma-400">{r.odds}</td>
                        <td className="py-1.5 px-3 text-hull-200 text-xs">{r.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {bsExpanded < bsResults.length && (
                <div className="p-3 text-center border-t border-hull-500/30">
                  <button onClick={() => setBsExpanded(e => e + 50)}
                    className="btn-ghost text-xs flex items-center gap-1 mx-auto">
                    <ChevronDown size={14} /> Show more ({bsResults.length - bsExpanded} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
