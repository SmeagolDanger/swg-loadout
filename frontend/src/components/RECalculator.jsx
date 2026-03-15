import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  FlaskConical, ArrowLeftRight, Save, FolderOpen, Trash2, Star,
  Info, BarChart3, ChevronDown, ChevronUp,
} from 'lucide-react';
import RECalculatorExport from './RECalculatorExport';

// ── Rarity tier colors from STAJ.txt in-game macro scheme ────
// D tier (#29db35): < 1 in 100  — common
// C tier (#007fff): 1 in 100–1k — uncommon
// B tier (#f399ff): 1 in 1k–10k — rare
// A tier (#ffcc00): 1 in 10k+   — very rare
// Unicorn (#ff69b4): ⋆ marker   — exceptional (pink, not in file)
// Reward (#ff8080): fixed reward stat
const TIER_COLORS = {
  A:       '#ffcc00',
  B:       '#f399ff',
  C:       '#007fff',
  D:       '#29db35',
  unicorn: '#ff69b4',
  reward:  '#ff8080',
};
function tierStyle(tier) {
  return tier && TIER_COLORS[tier] ? { color: TIER_COLORS[tier] } : {};
}

function rarityStyle(display) {
  if (!display || display === '—') return {};
  if (display.includes('⋆')) return { color: '#ff69b4' };
  if (display === 'Reward') return { color: '#ff8080' };
  if (display.toLowerCase().includes('improbable')) return { color: '#ffcc00' };
  const match = display.match(/1 in ([\d.]+)([BMk]?)/);
  if (!match) return {};
  const suffix = match[2];
  const num = parseFloat(match[1]) * (suffix === 'B' ? 1e9 : suffix === 'M' ? 1e6 : suffix === 'k' ? 1e3 : 1);
  if (num >= 10_000) return { color: '#ffcc00' }; // A — gold
  if (num >= 1_000)  return { color: '#f399ff' }; // B — purple-pink
  if (num >= 100)    return { color: '#007fff' }; // C — blue
  return { color: '#29db35' };                    // D — green
}

function getDeltaColor(delta) {
  if (delta === '' || delta === null || delta === undefined) return '';
  const d = Math.abs(parseFloat(delta));
  if (d <= 0.08) return '#4ade80';
  if (d <= 0.33) return '#a3e635';
  if (d <= 0.5)  return '#facc15';
  if (d <= 0.67) return '#fb923c';
  return '#f87171';
}

const RE_BONUS = [2, 3, 3, 4, 4, 5, 5, 6, 7, 7];

export default function RECalculator() {
  const { user } = useAuth();
  const [compType, setCompType] = useState('');
  const [level, setLevel] = useState('');
  const [statDefs, setStatDefs] = useState([]);
  const [inputs, setInputs] = useState({});
  const [direction, setDirection] = useState(1);
  const [matchTarget, setMatchTarget] = useState('Average Rarity');
  const [result, setResult] = useState(null);
  const [brandTable, setBrandTable] = useState(null);
  const [showBrands, setShowBrands] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projects, setProjects] = useState([]);
  const [showProjects, setShowProjects] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) api.getREProjects().then(setProjects).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!compType) { setStatDefs([]); setResult(null); return; }
    api.getREStats(compType).then(data => {
      setStatDefs(data.stats || []);
      setInputs({});
      setResult(null);
      setBrandTable(null);
    }).catch(console.error);
  }, [compType]);

  const analyze = useCallback(() => {
    if (!compType || !level || statDefs.length === 0) { setResult(null); return; }
    const rawStats = statDefs.map((_, i) => {
      const val = inputs[`stat${i}`];
      return val !== undefined && val !== '' ? val : '';
    });
    if (rawStats.every(s => s === '')) { setResult(null); return; }

    setLoading(true);
    api.analyzeRE({ comp_type: compType, level: parseInt(level), raw_stats: rawStats, matching_target: matchTarget, direction })
      .then(data => { setResult(data); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [compType, level, inputs, matchTarget, direction, statDefs]);

  useEffect(() => {
    const t = setTimeout(analyze, 300);
    return () => clearTimeout(t);
  }, [analyze]);

  const fetchBrandTable = () => {
    if (!compType || !level) return;
    const rawStats = statDefs.map((_, i) => inputs[`stat${i}`] || '');
    api.getBrandTable({ comp_type: compType, level: parseInt(level), raw_stats: rawStats, direction })
      .then(data => { setBrandTable(data); setShowBrands(true); })
      .catch(console.error);
  };

  const handleSave = async () => {
    if (!user || !projectName || !compType || !level) return;
    const stats = statDefs.map((_, i) => parseFloat(inputs[`stat${i}`]) || 0);
    await api.saveREProject({ name: projectName, comp_type: compType, re_level: parseInt(level), stats });
    const p = await api.getREProjects();
    setProjects(p);
  };

  const handleLoad = (project) => {
    setCompType(project.comp_type);
    setLevel(project.re_level.toString());
    setProjectName(project.name);
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

  const hasInput = Object.values(inputs).some(v => v !== '' && v !== undefined);
  const matchTargetOptions = ['Average Rarity', 'Best Stat', 'Worst Stat', ...statDefs.map(s => s.name)];

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <FlaskConical size={22} className="text-plasma-400" />
        <h1 className="font-display text-2xl font-bold tracking-wider text-hull-100">RE CALCULATOR</h1>
        {result && (
          <RECalculatorExport
            compType={compType} level={level} statDefs={statDefs}
            inputs={inputs} result={result} matchTarget={matchTarget}
            projectName={projectName}
          />
        )}
      </div>

      {/* Controls bar */}
      <div className="card mb-5">
        <div className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Component type */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-display text-hull-300 tracking-[0.14em] mb-1.5">COMPONENT TYPE</label>
              <select value={compType} onChange={e => { setCompType(e.target.value); setLevel(''); }}
                className="w-full text-sm">
                <option value="">Select...</option>
                {['Armor','Booster','Capacitor','Droid Interface','Engine','Reactor','Shield','Weapon'].map(t =>
                  <option key={t} value={t}>{t}</option>
                )}
              </select>
            </div>

            {/* RE Level */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-display text-hull-300 tracking-[0.14em] mb-1.5">RE LEVEL</label>
              <select value={level} onChange={e => setLevel(e.target.value)}
                className="w-full text-sm" disabled={!compType}>
                <option value="">Select...</option>
                {[1,2,3,4,5,6,7,8,9,10].map(l =>
                  <option key={l} value={l}>Level {l} ({RE_BONUS[l-1]}%)</option>
                )}
              </select>
            </div>

            {/* Project (logged in) */}
            {user && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-display text-hull-300 tracking-[0.14em] mb-1.5">PROJECT</label>
                <div className="flex gap-1">
                  <input value={projectName} onChange={e => setProjectName(e.target.value)}
                    placeholder="Project name…" className="flex-1 text-sm" />
                  <button onClick={handleSave} disabled={!projectName || !compType}
                    title="Save" className="p-2 rounded hover:bg-hull-600 text-hull-300 hover:text-plasma-400 disabled:opacity-40">
                    <Save size={15} />
                  </button>
                  <button onClick={() => setShowProjects(v => !v)}
                    title="Load" className="p-2 rounded hover:bg-hull-600 text-hull-300 hover:text-plasma-400">
                    <FolderOpen size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Direction + Clear */}
            <div className="flex items-center gap-2 pb-0.5">
              <button onClick={() => setDirection(d => d === 1 ? -1 : 1)}
                disabled={!compType}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-hull-500/50 bg-hull-700/60 text-xs font-medium text-hull-200 hover:text-plasma-300 hover:border-plasma-500/40 disabled:opacity-40 transition-colors">
                <ArrowLeftRight size={13} />
                {direction === 1 ? 'RAW → POST' : 'POST → RAW'}
              </button>
              <button onClick={handleClear}
                className="px-3 py-2 rounded-lg border border-hull-500/50 bg-hull-700/60 text-xs font-medium text-hull-300 hover:text-hull-100 hover:border-hull-400/50 transition-colors">
                CLEAR
              </button>
            </div>
          </div>

          {/* Saved projects list */}
          {showProjects && projects.length > 0 && (
            <div className="mt-3 pt-3 border-t border-hull-500/30 space-y-0.5">
              {projects.map(p => (
                <div key={p.id}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-hull-600/60 cursor-pointer"
                  onClick={() => handleLoad(p)}>
                  <span className="text-sm text-hull-100 flex-1">{p.name}</span>
                  <span className="text-xs text-hull-400">{p.comp_type} · L{p.re_level}</span>
                  <button onClick={e => {
                    e.stopPropagation();
                    api.deleteREProject(p.id).then(() => api.getREProjects().then(setProjects));
                  }} className="p-1 rounded hover:bg-hull-500/60 text-hull-400 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {(!compType || !level) && (
        <div className="text-center py-20">
          <FlaskConical size={44} className="text-hull-600 mx-auto mb-4" />
          <p className="text-hull-400 text-sm">Select a component type and RE level to begin analysis</p>
        </div>
      )}

      {/* Main analysis layout */}
      {compType && level && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

          {/* ── LEFT: Stat input table ── */}
          <div className="xl:col-span-5 2xl:col-span-5">
            <div className="card h-full">
              <div className="card-header">
                {direction === 1 ? 'INPUT RAW STATS' : 'INPUT POST-RE STATS'}
              </div>

              {/* Column headers */}
              <div className="px-4 pt-3 pb-1">
                <div className="flex items-center gap-1 sm:gap-2 text-[10px] font-display text-hull-400 tracking-[0.14em]">
                  <span className="w-14 sm:w-28 shrink-0">STAT</span>
                  <span className="w-[66px] sm:w-[88px] shrink-0 text-center">INPUT</span>
                  <span className="w-[52px] sm:w-[72px] shrink-0 text-right">{direction === 1 ? 'POST-RE' : 'RAW'}</span>
                  <span className="flex-1 text-right">RARITY</span>
                  <span className="w-[42px] sm:w-[52px] shrink-0 text-right">LOG Δ</span>
                </div>
              </div>

              {/* Stat rows */}
              <div className="px-2 pb-3 space-y-0.5">
                {statDefs.map((stat, i) => {
                  const r = result?.stats?.[i];
                  const deltaColor = r ? getDeltaColor(r.log_delta) : '';
                  const isUnicorn = r?.is_unicorn;
                  const rStyle = r?.tier ? tierStyle(r.tier) : rarityStyle(r?.rarity_display);

                  return (
                    <div key={i}
                      className="flex items-center gap-1 sm:gap-2 px-2 py-2 rounded-lg hover:bg-hull-700/50 transition-colors group">
                      {/* Stat name */}
                      <span className="w-14 sm:w-28 shrink-0 text-sm font-medium flex items-center gap-1"
                        style={isUnicorn ? { color: '#ff69b4' } : {}}>
                        {isUnicorn && <Star size={11} style={{ color: '#ff69b4' }} className="shrink-0" />}
                        <span className={`truncate ${isUnicorn ? '' : 'text-hull-200'}`}>{stat.name}</span>
                      </span>

                      {/* Input */}
                      <div className="w-[66px] sm:w-[88px] shrink-0">
                        <input
                          type="number" step="any"
                          value={inputs[`stat${i}`] ?? ''}
                          onChange={e => setInputs(prev => ({ ...prev, [`stat${i}`]: e.target.value }))}
                          className="w-full text-sm font-mono text-right py-1.5 px-2 !bg-hull-800/80 focus:!bg-hull-800"
                        />
                      </div>

                      {/* Post-RE / Raw */}
                      {r?.rounding_note && r.rounding_note !== 'none' && r.rounding_note !== '' ? (() => {
                        const worse = r.rounding_note === 'round' ? r.rounding_dir : r.rounding_pre;
                        const better = r.output;
                        const doRound = r.rounding_note === 'round';
                        const badgeColor = doRound ? '#f59e0b' : '#60a5fa';
                        const tipText = doRound
                          ? `PRE-ROUND your input before REing.\nRounding first: ${better}\nFull precision: ${worse?.toFixed(3)}`
                          : `DO NOT PRE-ROUND before REing.\nFull precision: ${better}\nIf pre-rounded: ${worse?.toFixed(3)}`;
                        return (
                          <span className="w-[52px] sm:w-[72px] shrink-0 flex flex-col items-end gap-px cursor-help" title={tipText}>
                            <span className="flex items-center gap-0.5">
                              <Info size={10} style={{ color: badgeColor }} className="shrink-0" />
                              <span className="text-sm font-mono leading-tight" style={{ color: badgeColor }}>
                                {better}
                              </span>
                            </span>
                            <span className="text-[9px] font-mono leading-tight text-hull-500 line-through text-right w-full">
                              {worse?.toFixed(3)}
                            </span>
                          </span>
                        );
                      })() : (
                        <span className="w-[52px] sm:w-[72px] shrink-0 text-sm font-mono text-right text-hull-200">
                          {r?.output || '—'}
                        </span>
                      )}

                      {/* Rarity */}
                      <span className="flex-1 text-sm font-mono text-right font-medium" style={rStyle}>
                        {r?.rarity_display || '—'}
                      </span>

                      {/* Log delta */}
                      <span className="w-[42px] sm:w-[52px] shrink-0 text-xs font-mono text-right tabular-nums"
                        style={{ color: deltaColor || '#6b7280' }}>
                        {r?.log_delta !== '' && r?.log_delta !== undefined && r?.log_delta !== null
                          ? `${parseFloat(r.log_delta) >= 0 ? '+' : ''}${parseFloat(r.log_delta).toFixed(2)}`
                          : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Summary + Matching ── */}
          <div className="xl:col-span-7 2xl:col-span-7 space-y-4">

            {/* Analysis summary */}
            {result && (
              <div className="card">
                <div className="card-header"><Info size={15} /> ANALYSIS SUMMARY</div>
                <div className="px-5 py-4">
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div>
                      <p className="text-[10px] font-display text-hull-400 tracking-[0.14em] mb-1">TARGET RARITY</p>
                      <p className="font-display text-xl font-bold text-hull-100">
                        {result.target_rarity_display || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-display text-hull-400 tracking-[0.14em] mb-1">UNICORN THRESHOLD</p>
                      <p className="font-display text-xl font-bold" style={{ color: '#ff69b4' }}>
                        ⋆{result.unicorn_threshold || '—'}⋆
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-display text-hull-400 tracking-[0.14em] mb-1">RE BONUS</p>
                      <p className="font-display text-xl font-bold text-plasma-400">
                        {RE_BONUS[parseInt(level) - 1]}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stat matching */}
            <div className="card">
              <div className="card-header"><BarChart3 size={15} /> STAT MATCHING</div>
              <div className="px-4 py-3">
                <div className="mb-4">
                  <label className="block text-[10px] font-display text-hull-300 tracking-[0.14em] mb-1.5">MATCHING TARGET</label>
                  <select value={matchTarget} onChange={e => setMatchTarget(e.target.value)}
                    className="w-full sm:w-72 text-sm" disabled={!hasInput}>
                    {matchTargetOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {result?.stats && hasInput ? (
                  <>
                    {/* Column headers */}
                    <div className="flex items-center gap-2 sm:gap-3 text-[10px] font-display text-hull-400 tracking-[0.14em] px-2 mb-1">
                      <span className="flex-1">STAT</span>
                      <span className="w-[82px] sm:w-[100px] shrink-0 text-right">MATCH RAW</span>
                      <span className="w-[90px] sm:w-[110px] shrink-0 text-right">MATCH POST-RE</span>
                    </div>
                    <div className="space-y-0.5">
                      {result.stats.map((stat, i) => {
                        const hasVal = stat.input !== '' && stat.input !== undefined;
                        return (
                          <div key={i}
                            className="flex items-center gap-2 sm:gap-3 px-2 py-2 rounded-lg hover:bg-hull-700/50 transition-colors">
                            <span className={`flex-1 text-sm font-medium ${hasVal ? 'text-hull-200' : 'text-hull-500'}`}>
                              {stat.name}
                            </span>
                            <span className={`w-[82px] sm:w-[100px] shrink-0 text-sm font-mono text-right ${hasVal ? 'text-hull-100' : 'text-hull-500 italic'}`}>
                              {stat.match_value || '—'}
                            </span>
                            <span className={`w-[90px] sm:w-[110px] shrink-0 text-sm font-mono text-right font-medium ${!hasVal ? 'text-hull-500 italic' : ''}`}
                              style={hasVal ? (stat.tier ? tierStyle(stat.tier) : rarityStyle(result.stats[i]?.rarity_display)) : {}}>
                              {stat.match_post || '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-hull-500 text-sm">Enter at least one stat value to see matching results</p>
                  </div>
                )}
              </div>
            </div>

            {/* Brand breakdown toggle */}
            {hasInput && (
              <button
                onClick={showBrands ? () => setShowBrands(false) : fetchBrandTable}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-hull-500/40 bg-hull-800/60 text-xs font-display font-semibold tracking-[0.14em] text-hull-300 hover:text-hull-100 hover:border-hull-400/60 transition-colors">
                <BarChart3 size={14} />
                {showBrands ? 'HIDE' : 'SHOW'} BRAND RARITY BREAKDOWN
                {showBrands ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}

            {/* Brand table */}
            {showBrands && brandTable && (
              <div className="card animate-slide-up">
                <div className="card-header"><BarChart3 size={15} /> BRAND RARITY TABLE</div>
                <div className="p-3 overflow-x-auto">
                  <table className="w-full text-xs min-w-[400px]">
                    <thead>
                      <tr className="text-hull-400 font-display tracking-wider">
                        <th className="text-left py-1.5 px-2 sticky left-0 bg-hull-700 font-medium">Brand</th>
                        {brandTable.table.map((col, i) => (
                          <th key={i} className="text-right py-1.5 px-2 whitespace-nowrap font-medium">{col.stat}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {brandTable.brand_names.map((name, j) => (
                        <tr key={j} className="border-t border-hull-600/30 hover:bg-hull-600/20 transition-colors">
                          <td className="py-1.5 px-2 text-hull-200 font-medium sticky left-0 bg-hull-700 whitespace-nowrap">{name}</td>
                          {brandTable.table.map((col, i) => {
                            const rarity = col.brands[j]?.rarity || '—';
                            return (
                              <td key={i} className="py-1.5 px-2 text-right font-mono"
                                style={rarityStyle(rarity)}>
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

      {/* Loading indicator */}
      {loading && (
        <div className="fixed bottom-5 right-5 bg-hull-700 border border-hull-500/60 rounded-xl px-3 py-2 text-xs text-hull-200 flex items-center gap-2 shadow-xl">
          <div className="w-3 h-3 border border-plasma-400 border-t-transparent rounded-full animate-spin" />
          Calculating…
        </div>
      )}
    </div>
  );
}
