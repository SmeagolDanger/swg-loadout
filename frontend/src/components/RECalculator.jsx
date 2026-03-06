import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  FlaskConical, ChevronDown, ChevronRight, ArrowLeftRight, Save,
  FolderOpen, Trash2, Star, Info, BarChart3
} from 'lucide-react';

function getDeltaColor(delta) {
  if (delta === '' || delta === null || delta === undefined) return '';
  const d = Math.abs(parseFloat(delta));
  if (d <= 0.08) return '#00ff00';
  if (d <= 0.33) return '#88ff00';
  if (d <= 0.5) return '#ffff00';
  if (d <= 0.67) return '#ff8800';
  return '#ff3344';
}

export default function RECalculator() {
  const { user } = useAuth();
  const [compType, setCompType] = useState('');
  const [level, setLevel] = useState('');
  const [statDefs, setStatDefs] = useState([]);
  const [inputs, setInputs] = useState({});
  const [direction, setDirection] = useState(1); // 1=raw→post, -1=post→raw
  const [matchTarget, setMatchTarget] = useState('Average Rarity');
  const [result, setResult] = useState(null);
  const [brandTable, setBrandTable] = useState(null);
  const [showBrands, setShowBrands] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projects, setProjects] = useState([]);
  const [showProjects, setShowProjects] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load projects
  useEffect(() => {
    if (user) api.getREProjects().then(setProjects).catch(() => {});
  }, [user]);

  // Load stat definitions when component type changes
  useEffect(() => {
    if (!compType) { setStatDefs([]); setResult(null); return; }
    api.getREStats(compType).then(data => {
      setStatDefs(data.stats || []);
      setInputs({});
      setResult(null);
      setBrandTable(null);
    }).catch(console.error);
  }, [compType]);

  // Analyze when inputs change
  const analyze = useCallback(() => {
    if (!compType || !level || statDefs.length === 0) { setResult(null); return; }

    const rawStats = statDefs.map((s, i) => {
      const val = inputs[`stat${i}`];
      return val !== undefined && val !== '' ? val : '';
    });

    // Skip if all empty
    if (rawStats.every(s => s === '')) { setResult(null); return; }

    setLoading(true);
    api.analyzeRE({
      comp_type: compType,
      level: parseInt(level),
      raw_stats: rawStats,
      matching_target: matchTarget,
      direction,
    }).then(data => {
      setResult(data);
      setLoading(false);
    }).catch(e => { console.error(e); setLoading(false); });
  }, [compType, level, inputs, matchTarget, direction, statDefs]);

  useEffect(() => {
    const timer = setTimeout(analyze, 300);
    return () => clearTimeout(timer);
  }, [analyze]);

  const fetchBrandTable = () => {
    if (!compType || !level) return;
    const rawStats = statDefs.map((s, i) => inputs[`stat${i}`] || '');
    api.getBrandTable({
      comp_type: compType, level: parseInt(level), raw_stats: rawStats, direction,
    }).then(data => { setBrandTable(data); setShowBrands(true); }).catch(console.error);
  };

  const handleInputChange = (idx, val) => {
    setInputs(prev => ({ ...prev, [`stat${idx}`]: val }));
  };

  const handleSave = async () => {
    if (!user || !projectName || !compType || !level) return;
    const stats = statDefs.map((s, i) => parseFloat(inputs[`stat${i}`]) || 0);
    await api.saveREProject({ name: projectName, comp_type: compType, re_level: parseInt(level), stats });
    const p = await api.getREProjects();
    setProjects(p);
  };

  const handleLoad = (project) => {
    setCompType(project.comp_type);
    setLevel(project.re_level.toString());
    setProjectName(project.name);
    // Defer setting inputs until statDefs load
    setTimeout(() => {
      const newInputs = {};
      project.stats.forEach((v, i) => { if (v) newInputs[`stat${i}`] = v; });
      setInputs(newInputs);
    }, 300);
    setShowProjects(false);
  };

  const handleClear = () => {
    setInputs({});
    setResult(null);
    setBrandTable(null);
    setProjectName('');
  };

  const matchTargetOptions = ['Average Rarity', 'Best Stat', 'Worst Stat',
    ...statDefs.map(s => s.name)];

  const hasInput = Object.values(inputs).some(v => v !== '' && v !== undefined);

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-hull-100 flex items-center gap-2 mb-6">
        <FlaskConical size={24} className="text-plasma-400" /> RE CALCULATOR
      </h1>

      {/* Top bar: Component type, level, project */}
      <div className="card mb-4">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-display text-hull-300 tracking-wider mb-1">COMPONENT TYPE</label>
              <select value={compType} onChange={e => { setCompType(e.target.value); setLevel(''); }}
                className="w-full">
                <option value="">Select...</option>
                {['Armor', 'Booster', 'Capacitor', 'Droid Interface', 'Engine', 'Reactor', 'Shield', 'Weapon'].map(t =>
                  <option key={t} value={t}>{t}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-display text-hull-300 tracking-wider mb-1">RE LEVEL</label>
              <select value={level} onChange={e => setLevel(e.target.value)}
                className="w-full" disabled={!compType}>
                <option value="">Select...</option>
                {[1,2,3,4,5,6,7,8,9,10].map(l =>
                  <option key={l} value={l}>Level {l} ({[2,3,3,4,4,5,5,6,7,7][l-1]}%)</option>
                )}
              </select>
            </div>
            {user && (
              <div>
                <label className="block text-xs font-display text-hull-300 tracking-wider mb-1">PROJECT</label>
                <div className="flex gap-1">
                  <input value={projectName} onChange={e => setProjectName(e.target.value)}
                    placeholder="Project name..." className="flex-1 text-sm" />
                  <button onClick={handleSave} disabled={!projectName || !compType}
                    className="p-2 rounded hover:bg-hull-600 text-hull-300 hover:text-plasma-400" title="Save">
                    <Save size={16} />
                  </button>
                  <button onClick={() => setShowProjects(!showProjects)}
                    className="p-2 rounded hover:bg-hull-600 text-hull-300 hover:text-plasma-400" title="Load">
                    <FolderOpen size={16} />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-end gap-2">
              <button onClick={() => setDirection(d => d === 1 ? -1 : 1)}
                className="btn-ghost text-xs flex items-center gap-1" disabled={!compType}>
                <ArrowLeftRight size={14} />
                {direction === 1 ? 'Raw → Post' : 'Post → Raw'}
              </button>
              <button onClick={handleClear} className="btn-ghost text-xs">Clear</button>
            </div>
          </div>

          {/* Project list */}
          {showProjects && projects.length > 0 && (
            <div className="mt-3 pt-3 border-t border-hull-500/30 animate-slide-up space-y-1">
              {projects.map(p => (
                <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-hull-600 cursor-pointer"
                  onClick={() => handleLoad(p)}>
                  <span className="text-sm text-hull-100 flex-1">{p.name}</span>
                  <span className="text-xs text-hull-400">{p.comp_type} L{p.re_level}</span>
                  <button onClick={e => { e.stopPropagation(); api.deleteREProject(p.id).then(() => api.getREProjects().then(setProjects)); }}
                    className="p-1 rounded hover:bg-hull-500 text-hull-400 hover:text-laser-red">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!compType || !level ? (
        <div className="text-center py-16">
          <FlaskConical size={48} className="text-hull-500 mx-auto mb-4" />
          <p className="text-hull-400">Select a component type and RE level to begin analysis</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Input stats + output */}
          <div className="lg:col-span-5">
            <div className="card">
              <div className="card-header">
                {direction === 1 ? 'INPUT RAW STATS' : 'INPUT POST-RE STATS'}
              </div>
              <div className="p-3">
                <div className="space-y-1">
                  <div className="grid grid-cols-12 gap-1 text-[10px] font-display text-hull-400 tracking-wider px-1 mb-1">
                    <span className="col-span-3">STAT</span>
                    <span className="col-span-2 text-center">INPUT</span>
                    <span className="col-span-2 text-center">{direction === 1 ? 'POST-RE' : 'RAW'}</span>
                    <span className="col-span-3 text-center">RARITY</span>
                    <span className="col-span-2 text-center">LOG Δ</span>
                  </div>
                  {statDefs.map((stat, i) => {
                    const r = result?.stats?.[i];
                    const deltaColor = r ? getDeltaColor(r.log_delta) : '';
                    return (
                      <div key={i} className="grid grid-cols-12 gap-1 items-center py-0.5">
                        <span className={`col-span-3 text-xs font-medium truncate ${r?.is_unicorn ? 'text-laser-yellow' : 'text-hull-200'}`}>
                          {r?.is_unicorn && <Star size={10} className="inline mr-0.5 text-laser-yellow" />}
                          {stat.name}
                        </span>
                        <div className="col-span-2">
                          <input
                            type="number" step="any"
                            value={inputs[`stat${i}`] ?? ''}
                            onChange={e => handleInputChange(i, e.target.value)}
                            className="w-full text-xs font-mono text-center py-0.5 px-1 !bg-hull-800"
                          />
                        </div>
                        <span className="col-span-2 text-xs font-mono text-center text-hull-200">
                          {r?.output || '—'}
                        </span>
                        <span className={`col-span-3 text-[11px] font-mono text-center ${
                          r?.rarity_display?.includes('⋆') ? 'text-laser-yellow' :
                          r?.rarity_display === 'Reward' ? 'text-laser-green' : 'text-hull-200'
                        }`}>
                          {r?.rarity_display || '—'}
                        </span>
                        <span className="col-span-2 text-xs font-mono text-center" style={{ color: deltaColor || undefined }}>
                          {r?.log_delta !== '' && r?.log_delta !== undefined
                            ? `${parseFloat(r.log_delta) >= 0 ? '+' : ''}${parseFloat(r.log_delta).toFixed(2)}`
                            : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Matching + summary */}
          <div className="lg:col-span-7 space-y-4">
            {/* Summary card */}
            {result && (
              <div className="card">
                <div className="card-header"><Info size={16} /> ANALYSIS SUMMARY</div>
                <div className="p-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] font-display text-hull-400 tracking-wider">TARGET RARITY</span>
                      <p className="text-lg font-mono text-hull-100 font-bold">
                        {result.target_rarity_display || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-display text-hull-400 tracking-wider">UNICORN THRESHOLD</span>
                      <p className="text-lg font-mono text-laser-yellow">
                        ⋆{result.unicorn_threshold || '—'}⋆
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-display text-hull-400 tracking-wider">RE BONUS</span>
                      <p className="text-lg font-mono text-plasma-400">
                        {[2,3,3,4,4,5,5,6,7,7][parseInt(level)-1]}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Matching config + results */}
            <div className="card">
              <div className="card-header"><BarChart3 size={16} /> STAT MATCHING</div>
              <div className="p-3">
                <div className="mb-3">
                  <label className="block text-xs font-display text-hull-300 tracking-wider mb-1">MATCHING TARGET</label>
                  <select value={matchTarget} onChange={e => setMatchTarget(e.target.value)}
                    className="w-full sm:w-64 text-sm" disabled={!hasInput}>
                    {matchTargetOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {result?.stats && hasInput && (
                  <div className="space-y-0.5">
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-display text-hull-400 tracking-wider px-1 mb-1">
                      <span>STAT</span>
                      <span className="text-center">MATCH RAW</span>
                      <span className="text-center">MATCH POST-RE</span>
                    </div>
                    {result.stats.map((stat, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2 items-center py-0.5 px-1">
                        <span className="text-xs text-hull-200 font-medium">{stat.name}</span>
                        <span className={`text-xs font-mono text-center ${
                          stat.input !== '' ? 'text-hull-100' : 'text-hull-400 italic'
                        }`}>
                          {stat.match_value || '—'}
                        </span>
                        <span className={`text-xs font-mono text-center ${
                          stat.input !== '' ? 'text-hull-100' : 'text-hull-400 italic'
                        }`}>
                          {stat.match_post || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {!hasInput && (
                  <p className="text-hull-500 text-sm text-center py-4">
                    Enter at least one stat value to see matching results
                  </p>
                )}
              </div>
            </div>

            {/* Brand rarity table toggle */}
            {hasInput && (
              <button onClick={fetchBrandTable}
                className="btn-primary w-full flex items-center justify-center gap-2">
                <BarChart3 size={16} /> Show Brand Rarity Breakdown
              </button>
            )}

            {/* Brand table */}
            {showBrands && brandTable && (
              <div className="card animate-slide-up">
                <div className="card-header cursor-pointer" onClick={() => setShowBrands(false)}>
                  <BarChart3 size={16} /> BRAND RARITY TABLE
                  <ChevronDown size={14} className="ml-auto text-hull-400" />
                </div>
                <div className="p-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-hull-400 font-display tracking-wider">
                        <th className="text-left py-1 px-1 sticky left-0 bg-hull-700">Brand</th>
                        {brandTable.table.map((col, i) => (
                          <th key={i} className="text-center py-1 px-2 whitespace-nowrap">{col.stat}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {brandTable.brand_names.map((name, j) => (
                        <tr key={j} className="border-t border-hull-600/30 hover:bg-hull-600/20">
                          <td className="py-1 px-1 text-hull-200 font-medium sticky left-0 bg-hull-700 whitespace-nowrap">
                            {name}
                          </td>
                          {brandTable.table.map((col, i) => {
                            const brand = col.brands[j];
                            const rarity = brand?.rarity || '-';
                            return (
                              <td key={i} className="py-1 px-2 text-center font-mono text-hull-300">
                                {rarity}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed bottom-4 right-4 bg-hull-700 border border-hull-500 rounded-lg px-3 py-2 text-xs text-hull-300 flex items-center gap-2 shadow-lg">
          <div className="w-3 h-3 border border-plasma-500 border-t-transparent rounded-full animate-spin" />
          Calculating...
        </div>
      )}
    </div>
  );
}
