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

  const handleLoad = (proj) => {
    setProjectName(proj.name);
    setCompType(proj.comp_type);
    setLevel(String(proj.re_level));
    const newInputs = {};
    proj.stats.forEach((v, i) => { if (v) newInputs[`stat${i}`] = String(v); });
    setInputs(newInputs);
    setShowProjects(false);
  };

  const handleDelete = async (id) => {
    await api.deleteREProject(id);
    setProjects(projects.filter(p => p.id !== id));
  };

  const targetOptions = ['Average Rarity', 'Best Stat', 'Worst Stat', ...statDefs.map(s => s.name)];

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-plasma-500/10 border border-plasma-500/20">
              <FlaskConical className="w-4 h-4 text-plasma-400" />
              <span className="text-sm font-display tracking-[0.16em] text-plasma-300">
                RE CALCULATOR
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="col-span-2 lg:col-span-1">
                <label className="block text-xs font-display tracking-[0.14em] text-hull-400 mb-1.5">COMPONENT</label>
                <select value={compType} onChange={e => setCompType(e.target.value)}>
                  <option value="">Select type</option>
                  {api.componentTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-display tracking-[0.14em] text-hull-400 mb-1.5">RE LEVEL</label>
                <select value={level} onChange={e => setLevel(e.target.value)}>
                  <option value="">Level</option>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(l =>
                    <option key={l} value={l}>{l} (+{RE_BONUS[l - 1]}%)</option>
                  )}
                </select>
              </div>
              <div className="col-span-2 lg:col-span-2">
                <label className="block text-xs font-display tracking-[0.14em] text-hull-400 mb-1.5">MATCH TARGET</label>
                <select value={matchTarget} onChange={e => setMatchTarget(e.target.value)}>
                  {targetOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-display tracking-[0.14em] text-hull-400 mb-1.5">DIRECTION</label>
                <button
                  className="w-full btn-secondary py-2.5"
                  onClick={() => setDirection(direction === 1 ? -1 : 1)}
                  title="Toggle input/output direction"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span className="text-xs">{direction === 1 ? 'Raw → Post-RE' : 'Post-RE → Raw'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Save / load projects */}
          {user && (
            <div className="w-full lg:w-auto flex flex-col gap-2">
              <label className="block text-xs font-display tracking-[0.14em] text-hull-400">SAVE PROJECT</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="Project name"
                  className="min-w-0 w-full lg:w-44"
                />
                <button className="btn-primary" onClick={handleSave} disabled={!projectName}>
                  <Save className="w-4 h-4" />
                </button>
                <button className="btn-secondary" onClick={() => setShowProjects(!showProjects)}>
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Project dropdown */}
        {showProjects && user && (
          <div className="mt-4 pt-4 border-t border-hull-700/60">
            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {projects.length === 0 && (
                <p className="text-sm text-hull-500">No saved projects yet</p>
              )}
              {projects.map(proj => (
                <div key={proj.id} className="flex items-center gap-2 p-2 rounded-lg bg-hull-800/60 border border-hull-700/60">
                  <button className="flex-1 text-left min-w-0" onClick={() => handleLoad(proj)}>
                    <div className="text-sm font-medium text-hull-100 truncate">{proj.name}</div>
                    <div className="text-xs text-hull-400">
                      {proj.comp_type} • L{proj.re_level}
                    </div>
                  </button>
                  <button className="btn-ghost p-2" onClick={() => handleDelete(proj.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
                  const isUnicorn = Boolean(r?.is_unicorn);
                  const rStyle = r?.tier ? tierStyle(r.tier) : rarityStyle(r?.rarity_display);
                  const nameStyle = r?.tier ? tierStyle(r.tier) : { color: '#e5e7eb' };

                  return (
                    <div key={i}
                      className="flex items-center gap-1 sm:gap-2 px-2 py-2 rounded-lg hover:bg-hull-700/50 transition-colors group">
                      {/* Stat name */}
                      <span className="w-14 sm:w-28 shrink-0 text-sm font-medium flex items-center gap-1" style={nameStyle}>
                        {isUnicorn && <Star size={11} style={{ color: '#ff69b4' }} className="shrink-0" />}
                        <span className="truncate">{stat.name}</span>
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

          {/* ── CENTER: Summary ── */}
          <div className="xl:col-span-3 2xl:col-span-3">
            <div className="card h-full">
              <div className="card-header">ANALYSIS SUMMARY</div>

              {loading && (
                <div className="p-6 text-center text-sm text-hull-400">Analyzing…</div>
              )}

              {!loading && result && (
                <div className="p-4 space-y-4">
                  {/* Summary metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-hull-700/60 bg-hull-800/60 p-3">
                      <div className="text-[11px] font-display tracking-[0.14em] text-hull-400 mb-1">TARGET RARITY</div>
                      <div className="text-xl font-display font-semibold" style={result.target_tier ? tierStyle(result.target_tier) : rarityStyle(result.target_rarity_display)}>
                        {result.target_rarity_display || '—'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-hull-700/60 bg-hull-800/60 p-3">
                      <div className="text-[11px] font-display tracking-[0.14em] text-hull-400 mb-1">UNICORN THRESHOLD</div>
                      <div className="text-xl font-display font-semibold" style={{ color: '#ff69b4' }}>
                        ⋆{result.unicorn_threshold || '—'}⋆
                      </div>
                    </div>
                  </div>

                  {/* Quick legend */}
                  <div className="rounded-xl border border-hull-700/60 bg-hull-800/40 p-3 space-y-2">
                    <div className="text-[11px] font-display tracking-[0.14em] text-hull-400">STAJ TIERS</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span style={{ color: '#ffcc00' }}>A</span> <span className="text-hull-300">10k+</span></div>
                      <div><span style={{ color: '#f399ff' }}>B</span> <span className="text-hull-300">1k+</span></div>
                      <div><span style={{ color: '#007fff' }}>C</span> <span className="text-hull-300">100+</span></div>
                      <div><span style={{ color: '#29db35' }}>D</span> <span className="text-hull-300">&lt;100</span></div>
                    </div>
                    <div className="text-sm">
                      <span style={{ color: '#ff69b4' }}>⋆ Unicorn</span>
                      <span className="text-hull-400"> • separate from STAJ tier</span>
                    </div>
                  </div>

                  {/* Export */}
                  <RECalculatorExport
                    compType={compType}
                    level={level}
                    statDefs={statDefs}
                    inputs={inputs}
                    result={result}
                    direction={direction}
                    matchTarget={matchTarget}
                  />
                </div>
              )}

              {!loading && !result && (
                <div className="p-6 text-center text-sm text-hull-500">
                  Enter one or more stat values to begin analysis.
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Matching values ── */}
          <div className="xl:col-span-4 2xl:col-span-4">
            <div className="card h-full">
              <button
                type="button"
                className="card-header w-full flex items-center justify-between"
                onClick={() => setShowBrands(v => !v)}
              >
                <span>MATCHING VALUES</span>
                {showBrands ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <div className="p-3">
                {result ? (
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
                            <span
                              className={`w-[90px] sm:w-[110px] shrink-0 text-sm font-mono text-right font-medium flex items-center justify-end gap-1 ${!hasVal ? 'text-hull-500 italic' : ''}`}
                              style={hasVal ? (stat.tier ? tierStyle(stat.tier) : rarityStyle(result.stats[i]?.rarity_display)) : {}}
                            >
                              {stat.is_unicorn && <Star size={11} style={{ color: '#ff69b4' }} className="shrink-0" />}
                              <span>{stat.match_post || '—'}</span>
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
            <div className="mt-4">
              <button className="btn-secondary w-full" onClick={fetchBrandTable}>
                <BarChart3 className="w-4 h-4" />
                <span>Show Brand Breakdown</span>
              </button>
            </div>

            {showBrands && brandTable && (
              <div className="card mt-4">
                <div className="card-header">BRAND RARITY BREAKDOWN</div>
                <div className="p-3 space-y-4 max-h-[32rem] overflow-auto">
                  {brandTable.table.map((row, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="text-sm font-medium text-hull-100">{row.stat}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {row.brands.map((b, j) => (
                          <div key={j} className="rounded-lg border border-hull-700/60 bg-hull-800/50 px-2 py-1.5">
                            <div className="text-xs text-hull-400 truncate">{b.name}</div>
                            <div className="text-sm font-mono" style={rarityStyle(b.rarity)}>{b.rarity}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}