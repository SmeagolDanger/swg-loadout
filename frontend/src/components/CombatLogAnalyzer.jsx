import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Axe,
  Download,
  FileUp,
  HeartPulse,
  Shield,
  Sparkles,
  Swords,
  Timer,
  Upload,
  Users,
  Wrench,
} from 'lucide-react';

const CLASS_COLORS = {
  Jedi: '#00B3FF',
  'Bounty Hunter': '#C41E3A',
  Commando: '#C69B6D',
  Officer: '#ABD473',
  Spy: '#FFF569',
  Medic: '#8787ED',
  Smuggler: '#F48CBA',
  Entertainer: '#FF8800',
  Trader: '#8F8F8F',
  Unknown: '#6B7280',
};

const LEGENDS_CLASSES = ['Jedi', 'Bounty Hunter', 'Commando', 'Officer', 'Spy', 'Medic', 'Smuggler', 'Entertainer', 'Trader', 'Unknown'];

const DEFAULT_PROFESSION_OVERRIDES = {
  Dexeridix: 'Commando',
  ChickenRat: 'Bounty Hunter',
};

const PROFESSION_STORAGE_KEY = 'swg-log-analyzer-profession-overrides';

const ABILITY_CLASS_MAP = {
  ambush: 'Bounty Hunter',
  assault: 'Bounty Hunter',
  burn: 'Bounty Hunter',
  'razor net': 'Bounty Hunter',
  'tangle net': 'Bounty Hunter',
  fumble: 'Bounty Hunter',
  'cluster bomb': 'Commando',
  bomblet: 'Commando',
  'focus beam': 'Commando',
  'focused beam': 'Commando',
  'lethal beam': 'Commando',
  mine: 'Commando',
  'plasma mine': 'Commando',
  'cryoban grenade': 'Commando',
  'riddle armor': 'Commando',
  sure: 'Officer',
  'sure shot': 'Officer',
  overcharge: 'Officer',
  'paint target': 'Officer',
  'artillery strike': 'Officer',
  'core bomb': 'Officer',
  flurry: 'Jedi',
  strike: 'Jedi',
  sweep: 'Jedi',
  'force shockwave': 'Jedi',
  maelstrom: 'Jedi',
  'force drain': 'Jedi',
  'force lightning': 'Jedi',
  'force throw': 'Jedi',
  'precision strike': 'Smuggler',
  'concussion shot': 'Smuggler',
  'covering fire': 'Smuggler',
  'fan shot': 'Smuggler',
  'brawler strike': 'Smuggler',
  'pin down': 'Smuggler',
  'pistol whip': 'Smuggler',
  'razor slash': 'Spy',
  'blaster burst': 'Spy',
  "assassin's mark": 'Spy',
  assassinate: 'Spy',
  "spy's fang": 'Spy',
  'bacta burst': 'Medic',
  'bacta spray': 'Medic',
  'bacta ampule': 'Medic',
  'vital strike': 'Medic',
  'nerve gas': 'Medic',
};

function normalizeAbilityName(raw) {
  if (!raw) return '';
  let s = raw.toLowerCase().trim();
  s = s.replace(/^(with|using)\s+/, '');
  s = s.replace(/\bmine\s*\d*\s*:\s*/g, '');
  s = s.replace(/(?:[\s.\-]+and\s+(?:\d+\s+points\s+blocked|strikes\s+through|hits|glances|crits|critical(?:ly)?\s+hits?|punishing\s+blows)(?:\s+\(\d+%.*?\))?)/gi, '');
  s = s.replace(/\band\s+punishing\s+blows\b/gi, '');
  s = s.replace(/\s+(?:hits|glances|crits|critical(?:ly)?\s+hits?|strikes\s+through|punishing\s+blows)\b.*$/gi, '');
  s = s.replace(/\.and\b/gi, '');
  s = s.replace(/[\(\[][^)\]]*[\)\]]/g, '');
  s = s.replace(/\bmark\s*\d+\b/gi, '').replace(/\b[ivxlcdm]+\b/gi, '').replace(/\b\d+\b/g, '');
  s = s.replace(/\bmine\s+plasma\s+mine\b/gi, 'plasma mine');
  s = s.replace(/[.,!?;:]+$/g, '');
  s = s.replace(/[.:\-–—]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function abilityToClass(raw) {
  const base = normalizeAbilityName(raw);
  if (ABILITY_CLASS_MAP[base]) return ABILITY_CLASS_MAP[base];
  if (base.startsWith('burn')) return 'Bounty Hunter';
  return undefined;
}

function inferClasses(rows, perAbility, overrides = {}) {
  const result = {};
  for (const row of rows || []) {
    if (overrides[row.name]) {
      result[row.name] = overrides[row.name];
      continue;
    }
    const tallies = {};
    const abilities = perAbility?.[row.name] || {};
    for (const [ability, stats] of Object.entries(abilities)) {
      const cls = abilityToClass(ability);
      if (!cls) continue;
      tallies[cls] = (tallies[cls] || 0) + (stats?.hits || 0);
    }
    let best = 'Unknown';
    let bestVal = -1;
    for (const [cls, val] of Object.entries(tallies)) {
      if (val > bestVal) {
        best = cls;
        bestVal = val;
      }
    }
    result[row.name] = best;
  }
  return result;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Math.round(value || 0));
}

function formatRate(value) {
  if (!Number.isFinite(value)) return '0.0';
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function readStoredOverrides() {
  try {
    const raw = window.localStorage.getItem(PROFESSION_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFESSION_OVERRIDES };
    return { ...DEFAULT_PROFESSION_OVERRIDES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROFESSION_OVERRIDES };
  }
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-hull-400/40 bg-hull-800/60 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.18em] text-hull-300">
        <Icon size={14} className="text-plasma-400" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-display text-hull-50">{value}</div>
      {hint ? <div className="mt-1 text-xs text-hull-300">{hint}</div> : null}
    </div>
  );
}

function ChartPanel({ title, subtitle, items }) {
  const maxValue = Math.max(...items.map((item) => item.value || 0), 1);
  return (
    <div className="card p-4">
      <div className="mb-4">
        <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-hull-400">{subtitle}</div> : null}
      </div>
      <div className="space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.name} className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_5.25rem] items-center gap-3">
            <div className="truncate text-sm text-hull-100">{item.name}</div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-hull-800/80">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(3, (item.value / maxValue) * 100)}%`, backgroundColor: item.color || CLASS_COLORS.Unknown }}
                />
              </div>
            </div>
            <div className="text-right text-xs text-hull-200">{item.label}</div>
          </div>
        )) : <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4 text-sm text-hull-300">No parsed data yet.</div>}
      </div>
    </div>
  );
}

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function downloadCsv(filename, headers, rows) {
  const content = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function CombatLogAnalyzer() {
  const workerRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [professionOverrides, setProfessionOverrides] = useState(DEFAULT_PROFESSION_OVERRIDES);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    setProfessionOverrides(readStoredOverrides());
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/swgCombatLog.worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event) => {
      const { type, payload: nextPayload, error: nextError } = event.data || {};
      if (type === 'done') {
        setPayload(nextPayload);
        setParsing(false);
        setError('');
      } else if (type === 'error') {
        setParsing(false);
        setError(nextError || 'Failed to parse logs.');
      }
    };
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFESSION_STORAGE_KEY, JSON.stringify(professionOverrides));
    } catch {
      // ignore
    }
  }, [professionOverrides]);

  const actorRows = useMemo(() => {
    const rows = payload?.rows || [];
    const classMap = inferClasses(rows, payload?.perAbility || {}, professionOverrides);
    return rows
      .map((row) => ({
        ...row,
        profession: classMap[row.name] || 'Unknown',
        color: CLASS_COLORS[classMap[row.name] || 'Unknown'] || CLASS_COLORS.Unknown,
        actionCount: (payload?.perAbility?.[row.name] ? Object.values(payload.perAbility[row.name]).reduce((sum, item) => sum + (item?.hits || 0), 0) : 0) +
          (payload?.healEvents?.filter((event) => event.src === row.name).length || 0) +
          (payload?.utilityEvents?.filter((event) => event.src === row.name).length || 0),
      }))
      .sort((a, b) => b.damageDealt - a.damageDealt || b.healingDone - a.healingDone || a.name.localeCompare(b.name));
  }, [payload, professionOverrides]);

  const overview = useMemo(() => {
    if (!payload) return null;
    const totalDamage = actorRows.reduce((sum, row) => sum + (row.damageDealt || 0), 0);
    const totalHealing = actorRows.reduce((sum, row) => sum + (row.healingDone || 0), 0);
    const totalTaken = Object.values(payload.perTaken || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    const duration = Math.max(1, payload.duration || 0);
    const damageEvents = payload.damageEvents || [];
    const critCount = damageEvents.filter((event) => String(event.flags || '').includes('crit')).length;
    const glanceCount = damageEvents.filter((event) => String(event.flags || '').includes('glance')).length;
    const biggestHit = damageEvents.reduce((max, event) => Math.max(max, Number(event.amount || 0)), 0);
    const uniqueAbilities = new Set([
      ...Object.values(payload.perAbility || {}).flatMap((abilities) => Object.keys(abilities || {})),
      ...(payload.utilityEvents || []).map((event) => event.ability),
      ...(payload.healEvents || []).map((event) => event.ability),
    ].filter(Boolean));
    const topHealer = actorRows.reduce((best, row) => (row.healingDone > (best?.healingDone || 0) ? row : best), null);
    const apmAvg = actorRows.length ? actorRows.reduce((sum, row) => sum + (row.actionCount || 0) / Math.max(duration / 60, 1 / 60), 0) / actorRows.length : 0;
    return {
      totalDamage,
      totalHealing,
      totalTaken,
      duration,
      eventCount: payload.debug?.parsed || (payload.damageEvents?.length || 0) + (payload.healEvents?.length || 0) + (payload.utilityEvents?.length || 0),
      critCount,
      glanceCount,
      biggestHit,
      uniqueAbilities: uniqueAbilities.size,
      topHealer,
      apmAvg,
      actorsSeen: actorRows.length,
    };
  }, [payload, actorRows]);

  const damageChart = useMemo(() => actorRows.slice(0, 10).map((row) => ({ name: row.name, value: row.damageDealt, label: formatNumber(row.damageDealt), color: row.color })), [actorRows]);
  const healingChart = useMemo(() => actorRows.filter((row) => row.healingDone > 0).slice(0, 10).sort((a, b) => b.healingDone - a.healingDone).map((row) => ({ name: row.name, value: row.healingDone, label: formatNumber(row.healingDone), color: row.color })), [actorRows]);
  const takenChart = useMemo(() => {
    const profMap = Object.fromEntries(actorRows.map((row) => [row.name, row.color]));
    return Object.entries(payload?.perTaken || {})
      .map(([name, value]) => ({ name, value: Number(value || 0), label: formatNumber(value), color: profMap[name] || CLASS_COLORS.Unknown }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [payload, actorRows]);
  const apmChart = useMemo(() => {
    const durationMins = Math.max((overview?.duration || 1) / 60, 1 / 60);
    return actorRows
      .map((row) => ({ name: row.name, value: row.actionCount / durationMins, label: formatRate(row.actionCount / durationMins), color: row.color }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [actorRows, overview]);

  const exportRowsCsv = () => {
    downloadCsv(
      'combat-log-overview.csv',
      ['Name', 'Profession', 'Damage', 'Healing', 'Damage Taken', 'APM'],
      actorRows.map((row) => [
        row.name,
        row.profession,
        Math.round(row.damageDealt || 0),
        Math.round(row.healingDone || 0),
        Math.round(payload?.perTaken?.[row.name] || 0),
        formatRate(row.actionCount / Math.max((overview?.duration || 1) / 60, 1 / 60)),
      ]),
    );
  };

  const handleParse = async () => {
    if (!files.length || !workerRef.current) return;
    setParsing(true);
    setError('');
    setPayload(null);
    try {
      const texts = await Promise.all(files.map((file) => file.text()));
      workerRef.current.postMessage({ type: 'parse', text: texts.join('\n'), collectUnparsed: false });
    } catch (err) {
      setParsing(false);
      setError(err instanceof Error ? err.message : 'Unable to read selected files.');
    }
  };

  const visibleNames = useMemo(() => actorRows.map((row) => row.name), [actorRows]);

  return (
    <div className="mx-auto max-w-[120rem] space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl space-y-2">
          <h1 className="font-display text-3xl text-hull-50">Combat Log Analyzer</h1>
          <p className="max-w-3xl text-hull-200">
            Overview-first SWG log parsing with the same parser logic as the reference analyzer. Upload one or more combat log files to get source damage, healing, damage taken, and APM right away.
          </p>
        </div>

        <div className="card w-full max-w-xl p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-plasma-400/30 bg-plasma-500/10 p-3 text-plasma-300">
              <Upload size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-hull-50">Upload chat logs</div>
              <div className="mt-1 text-xs text-hull-300">Select one or more SWG combat `.txt` logs.</div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="btn-ghost cursor-pointer">
              <FileUp size={15} /> Choose files
              <input
                type="file"
                accept=".txt,text/plain"
                multiple
                className="hidden"
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
            </label>
            <button type="button" className="btn-primary" disabled={!files.length || parsing} onClick={handleParse}>
              <Axe size={15} /> {parsing ? 'Parsing…' : 'Parse logs'}
            </button>
            {payload ? (
              <button type="button" className="btn-ghost" onClick={exportRowsCsv}>
                <Download size={15} /> Export CSV
              </button>
            ) : null}
          </div>
          {files.length ? <div className="mt-3 text-xs text-hull-300">{files.length} file{files.length === 1 ? '' : 's'} selected</div> : null}
          {error ? <div className="mt-3 rounded-xl border border-laser-red/30 bg-laser-red/10 px-3 py-2 text-sm text-laser-red">{error}</div> : null}
        </div>
      </div>

      {overview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            <StatCard icon={Activity} label="Events" value={formatNumber(overview.eventCount)} hint={`${overview.actorsSeen} actors seen`} />
            <StatCard icon={Swords} label="Total Damage" value={formatNumber(overview.totalDamage)} hint={`${formatRate(overview.totalDamage / Math.max(overview.duration, 1))} DPS`} />
            <StatCard icon={HeartPulse} label="Healing" value={formatNumber(overview.totalHealing)} hint={overview.topHealer ? `${overview.topHealer.name} top healer` : 'No healing found'} />
            <StatCard icon={Shield} label="Damage Taken" value={formatNumber(overview.totalTaken)} hint="Incoming damage sustained" />
            <StatCard icon={Timer} label="Duration" value={formatDuration(overview.duration)} hint={`${formatRate(overview.apmAvg)} avg APM`} />
            <StatCard icon={Sparkles} label="Biggest Hit" value={formatNumber(overview.biggestHit)} hint={`${formatNumber(overview.critCount)} crits`} />
            <StatCard icon={Wrench} label="Unique Abilities" value={formatNumber(overview.uniqueAbilities)} hint={`${formatNumber(overview.glanceCount)} glances`} />
            <StatCard icon={Users} label="Top Healer" value={overview.topHealer?.name || '—'} hint={overview.topHealer ? formatNumber(overview.topHealer.healingDone) : 'No healing found'} />
          </div>

          <div className="grid gap-4 2xl:grid-cols-2">
            <ChartPanel title="Damage done by source" subtitle="Top overall combat output" items={damageChart} />
            <ChartPanel title="Healing done by source" subtitle="Top overall healing output" items={healingChart} />
            <ChartPanel title="Damage taken by source" subtitle="Incoming damage sustained" items={takenChart} />
            <ChartPanel title="Actions per minute" subtitle="All counted attacks, heals, performs, and utility actions" items={apmChart} />
          </div>

          <div className="card p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">Profession color legend</div>
                <div className="mt-1 text-sm text-hull-200">Colors follow the reference analyzer profession palette and are inferred from observed abilities, with optional per-name overrides.</div>
              </div>
              <button type="button" className="btn-ghost self-start xl:self-center" onClick={() => setShowConfig((value) => !value)}>
                Configure professions
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {LEGENDS_CLASSES.map((profession) => (
                <span key={profession} className="inline-flex items-center gap-2 rounded-full border border-hull-400/30 bg-hull-800/50 px-3 py-1 text-xs text-hull-100">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CLASS_COLORS[profession] }} />
                  {profession}
                </span>
              ))}
            </div>
            {showConfig ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-hull-400/30 bg-hull-900/50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-hull-200">Override a name when the ability-based class guess is wrong.</div>
                  <button
                    type="button"
                    className="btn-ghost self-start sm:self-center"
                    onClick={() => setProfessionOverrides({ ...DEFAULT_PROFESSION_OVERRIDES })}
                  >
                    Reset defaults
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleNames.map((name) => {
                    const current = professionOverrides[name] || '';
                    return (
                      <label key={name} className="rounded-xl border border-hull-400/30 bg-hull-800/50 p-3 text-sm text-hull-100">
                        <div className="truncate font-medium text-hull-50">{name}</div>
                        <select
                          className="mt-2 w-full rounded-xl border border-hull-400/40 bg-hull-900/80 px-3 py-2 text-sm text-hull-50"
                          value={current}
                          onChange={(event) => {
                            const value = event.target.value;
                            setProfessionOverrides((prev) => {
                              const next = { ...prev };
                              if (value) next[name] = value;
                              else delete next[name];
                              return next;
                            });
                          }}
                        >
                          <option value="">Auto detect</option>
                          {LEGENDS_CLASSES.filter((profession) => profession !== 'Unknown').map((profession) => (
                            <option key={profession} value={profession}>{profession}</option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
