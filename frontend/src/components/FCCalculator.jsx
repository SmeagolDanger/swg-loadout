import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Cpu, ArrowUp, ArrowDown, Minus, Info, Save, FolderOpen,
  Trash2, Copy, Check, GripVertical
} from 'lucide-react';

const FC_MEMORY = { 1: 20, 2: 40, 3: 70, 4: 110, 5: 125, 6: 150 };

export default function FCCalculator() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [fcName, setFcName] = useState('');
  const [fcLevel, setFcLevel] = useState('');
  const [dcs, setDcs] = useState('');
  const [slots, setSlots] = useState(Array(15).fill(''));
  const [included, setIncluded] = useState(Array(15).fill(false));
  const [cooldowns, setCooldowns] = useState(null);
  const [loadouts, setLoadouts] = useState([]);
  const [showLoadouts, setShowLoadouts] = useState(false);
  const [macro, setMacro] = useState('');
  const [copied, setCopied] = useState(false);
  const [showEffects, setShowEffects] = useState(null);

  useEffect(() => {
    api.getFCPrograms().then(setPrograms).catch(console.error);
    if (user) api.getFCLoadouts().then(setLoadouts).catch(() => {});
  }, [user]);

  const usedNames = slots.filter(s => s);
  const availablePrograms = programs.filter(p => !usedNames.includes(p.name) || true);

  // Recalculate cooldowns
  const recalc = useCallback(() => {
    if (!fcLevel || slots.every(s => !s)) { setCooldowns(null); return; }
    api.calcCooldowns({ program_names: slots, dcs: parseFloat(dcs) || 0 })
      .then(setCooldowns).catch(console.error);
  }, [slots, dcs, fcLevel]);

  useEffect(() => { recalc(); }, [recalc]);

  const maxMemory = FC_MEMORY[parseInt(fcLevel)] || 0;
  const totalMemory = cooldowns?.total_memory || 0;
  const overMemory = totalMemory > maxMemory;

  const filledCount = slots.filter(s => s).length;

  const setSlot = (idx, val) => {
    const next = [...slots];
    next[idx] = val;
    setSlots(next);
  };

  const toggleIncluded = (idx) => {
    const next = [...included];
    next[idx] = !next[idx];
    setIncluded(next);
  };

  const removeSlot = (idx) => {
    const next = [...slots];
    const nextIncl = [...included];
    next.splice(idx, 1);
    next.push('');
    nextIncl.splice(idx, 1);
    nextIncl.push(false);
    setSlots(next);
    setIncluded(nextIncl);
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    const next = [...slots]; const nextIncl = [...included];
    [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
    [nextIncl[idx], nextIncl[idx - 1]] = [nextIncl[idx - 1], nextIncl[idx]];
    setSlots(next);
    setIncluded(nextIncl);
  };

  const moveDown = (idx) => {
    if (idx >= 14) return;
    const next = [...slots]; const nextIncl = [...included];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    [nextIncl[idx], nextIncl[idx + 1]] = [nextIncl[idx + 1], nextIncl[idx]];
    setSlots(next);
    setIncluded(nextIncl);
  };

  const handleGenMacro = async () => {
    const res = await api.generateMacro({ program_names: slots, included, dcs: parseFloat(dcs) || 0 });
    setMacro(res.macro);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(macro);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!user || !fcName || !fcLevel) return;
    await api.saveFCLoadout({ name: fcName, fc_level: parseInt(fcLevel), dcs: parseFloat(dcs) || 0, programs: slots, included });
    setLoadouts(await api.getFCLoadouts());
  };

  const handleLoad = (lo) => {
    setFcName(lo.name);
    setFcLevel(lo.fc_level.toString());
    setDcs(lo.dcs?.toString() || '');
    const s = [...lo.programs]; while (s.length < 15) s.push('');
    const inc = [...lo.included]; while (inc.length < 15) inc.push(false);
    setSlots(s);
    setIncluded(inc);
    setShowLoadouts(false);
  };

  const handleClear = () => {
    setSlots(Array(15).fill(''));
    setIncluded(Array(15).fill(false));
    setMacro('');
    setCooldowns(null);
  };

  const getProgInfo = (name) => programs.find(p => p.name === name);

  // Available programs for a given slot (exclude already used, except self)
  const getAvailable = (idx) => {
    const used = new Set(slots.filter((s, i) => s && i !== idx));
    return programs.filter(p => !used.has(p.name));
  };

  return (
    <div className="max-w-5xl mx-auto px-3 md:px-6 py-4 md:py-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-hull-50 flex items-center gap-2 mb-6">
        <Cpu size={24} className="text-plasma-400" /> FC CALCULATOR
      </h1>

      {/* Header config */}
      <div className="card mb-4">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-display text-hull-200 tracking-wider mb-1">FC NAME</label>
            <input value={fcName} onChange={e => setFcName(e.target.value)} placeholder="My FC..." className="w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs font-display text-hull-200 tracking-wider mb-1">FC LEVEL</label>
            <select value={fcLevel} onChange={e => setFcLevel(e.target.value)} className="w-full">
              <option value="">Select...</option>
              {[1,2,3,4,5,6].map(l => <option key={l} value={l}>Level {l} ({FC_MEMORY[l]} memory)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-display text-hull-200 tracking-wider mb-1">DROID CMD SPEED</label>
            <input type="number" value={dcs} onChange={e => setDcs(e.target.value)} placeholder="DCS..." className="w-full text-sm" />
          </div>
          <div className="flex items-end gap-1">
            {user && (
              <>
                <button onClick={handleSave} disabled={!fcName || !fcLevel}
                  className="p-2 rounded hover:bg-hull-600 text-hull-200 hover:text-plasma-400" title="Save"><Save size={16} /></button>
                <button onClick={() => setShowLoadouts(!showLoadouts)}
                  className="p-2 rounded hover:bg-hull-600 text-hull-200 hover:text-plasma-400" title="Load"><FolderOpen size={16} /></button>
              </>
            )}
            <button onClick={handleClear} className="btn-ghost text-xs">Clear</button>
          </div>
        </div>

        {/* Memory bar */}
        {fcLevel && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-display text-hull-200">MEMORY</span>
              <span className={`font-mono font-bold ${overMemory ? 'text-laser-red' : 'text-hull-100'}`}>
                {totalMemory} / {maxMemory}
              </span>
            </div>
            <div className="h-2 bg-hull-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${overMemory ? 'bg-laser-red' : 'bg-plasma-500'}`}
                style={{ width: `${Math.min((totalMemory / maxMemory) * 100, 100)}%` }} />
            </div>
          </div>
        )}

        {/* Loadout list */}
        {showLoadouts && loadouts.length > 0 && (
          <div className="px-4 pb-3 border-t border-hull-500/30 pt-3 animate-slide-up space-y-1">
            {loadouts.map(lo => (
              <div key={lo.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-hull-600 cursor-pointer"
                onClick={() => handleLoad(lo)}>
                <span className="text-sm text-hull-50 flex-1">{lo.name}</span>
                <span className="text-xs text-hull-300">L{lo.fc_level} DCS:{lo.dcs}</span>
                <button onClick={e => { e.stopPropagation(); api.deleteFCLoadout(lo.id).then(() => api.getFCLoadouts().then(setLoadouts)); }}
                  className="p-1 rounded hover:bg-hull-500 text-hull-300 hover:text-laser-red"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {!fcLevel ? (
        <div className="text-center py-16">
          <Cpu size={48} className="text-hull-400 mx-auto mb-4" />
          <p className="text-hull-200">Select an FC level to begin configuring programs</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Program slots */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="card-header">PROGRAM SLOTS</div>
              <div className="p-3 space-y-1">
                {/* Header */}
                <div className="grid grid-cols-12 gap-1 text-[10px] font-display text-hull-300 tracking-wider px-1 mb-1">
                  <span className="col-span-1">⊕</span>
                  <span className="col-span-5">PROGRAM</span>
                  <span className="col-span-2 text-center">MEM</span>
                  <span className="col-span-2 text-center">CD</span>
                  <span className="col-span-2 text-center">ACTIONS</span>
                </div>
                {slots.map((slot, i) => {
                  const cd = cooldowns?.programs?.[i];
                  const isActive = i <= filledCount;
                  const prog = slot ? getProgInfo(slot) : null;
                  return (
                    <div key={i} className={`grid grid-cols-12 gap-1 items-center py-1 rounded ${
                      isActive ? 'hover:bg-hull-600/30' : 'opacity-40'
                    }`}>
                      <div className="col-span-1">
                        <input type="checkbox" checked={included[i]} onChange={() => toggleIncluded(i)}
                          disabled={!slot}
                          className="w-4 h-4 accent-plasma-500 rounded" />
                      </div>
                      <div className="col-span-5">
                        <select value={slot} onChange={e => setSlot(i, e.target.value)}
                          disabled={!isActive}
                          className="w-full text-xs !py-1">
                          <option value="">—</option>
                          {getAvailable(i).map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                        </select>
                      </div>
                      <span className="col-span-2 text-center text-xs font-mono text-hull-100">{cd?.memory || ''}</span>
                      <span className="col-span-2 text-center text-xs font-mono text-hull-100">{cd?.cooldown ? `${cd.cooldown}s` : ''}</span>
                      <div className="col-span-2 flex justify-center gap-0.5">
                        {slot && (
                          <>
                            <button onClick={() => moveUp(i)} className="p-0.5 rounded hover:bg-hull-500 text-hull-200"><ArrowUp size={12} /></button>
                            <button onClick={() => moveDown(i)} className="p-0.5 rounded hover:bg-hull-500 text-hull-200"><ArrowDown size={12} /></button>
                            <button onClick={() => setShowEffects(showEffects === i ? null : i)} className="p-0.5 rounded hover:bg-hull-500 text-hull-200"><Info size={12} /></button>
                            <button onClick={() => removeSlot(i)} className="p-0.5 rounded hover:bg-hull-500 text-hull-200 hover:text-laser-red"><Minus size={12} /></button>
                          </>
                        )}
                      </div>
                      {showEffects === i && prog && (
                        <div className="col-span-12 bg-hull-800 rounded-lg p-2 mt-1 animate-slide-up">
                          <p className="text-xs font-display text-plasma-400 mb-1">{prog.name}</p>
                          <p className="text-xs text-hull-200">Target: {prog.target} · Memory: {prog.size}</p>
                          {prog.effects.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {prog.effects.map((e, j) => <li key={j} className="text-xs text-hull-100">• {e}</li>)}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Macro panel */}
          <div className="space-y-4">
            <div className="card">
              <div className="card-header"><Copy size={16} /> MACRO</div>
              <div className="p-3">
                <button onClick={handleGenMacro} disabled={!included.some(Boolean)}
                  className="btn-primary w-full mb-3">Generate Macro</button>
                {macro && (
                  <>
                    <pre className="bg-hull-800 rounded-lg p-3 text-xs font-mono text-hull-100 overflow-x-auto whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {macro}
                    </pre>
                    <button onClick={handleCopy}
                      className="btn-primary w-full mt-2 flex items-center justify-center gap-1.5">
                      {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy to Clipboard</>}
                    </button>
                  </>
                )}
                {!macro && (
                  <p className="text-hull-200 text-xs text-center py-4">
                    Check programs to include in the macro, then click Generate
                  </p>
                )}
              </div>
            </div>

            {/* Quick reference */}
            <div className="card">
              <div className="card-header"><Info size={16} /> FC LEVELS</div>
              <div className="p-3 space-y-0.5">
                {Object.entries(FC_MEMORY).map(([lv, mem]) => (
                  <div key={lv} className={`flex justify-between text-xs py-0.5 px-1 rounded ${
                    lv === fcLevel ? 'bg-plasma-500/10 text-plasma-400' : 'text-hull-200'
                  }`}>
                    <span className="font-display">Level {lv}</span>
                    <span className="font-mono">{mem} memory</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
