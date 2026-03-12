import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Axe,
  ChevronDown,
  ChevronUp,
  Coins,
  Download,
  FileUp,
  Filter,
  HeartPulse,
  Plus,
  ScrollText,
  Search,
  ShieldQuestion,
  Sparkles,
  Swords,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

const PROFESSION_COLORS = {
  Jedi: '#00B3FF',
  'Bounty Hunter': '#C41E3A',
  Commando: '#C69B6D',
  Officer: '#ABD473',
  Spy: '#FFF569',
  Medic: '#8787ED',
  Smuggler: '#F48CBA',
  Entertainer: '#FF8800',
  Trader: '#8F8F8F',
  Unknown: '#6ec7ff',
};

const PROFESSION_LABELS = ['Jedi', 'Bounty Hunter', 'Commando', 'Officer', 'Spy', 'Medic', 'Smuggler', 'Entertainer', 'Trader'];

const ABILITY_PROFESSION_MAP = {
  ambush: 'Bounty Hunter',
  assault: 'Bounty Hunter',
  burn: 'Bounty Hunter',
  'razor net': 'Bounty Hunter',
  'tangle net': 'Bounty Hunter',
  fumble: 'Bounty Hunter',
  'plasma mine': 'Commando',
  'cluster bomb': 'Commando',
  bomblet: 'Commando',
  'focus beam': 'Commando',
  'lethal beam': 'Commando',
  mine: 'Commando',
  'cryoban grenade': 'Commando',
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

function canonicalProfessionLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Unknown';
  const key = raw.toLowerCase();
  const map = {
    jedi: 'Jedi',
    bh: 'Bounty Hunter',
    bountyhunter: 'Bounty Hunter',
    'bounty hunter': 'Bounty Hunter',
    commando: 'Commando',
    officer: 'Officer',
    spy: 'Spy',
    medic: 'Medic',
    smuggler: 'Smuggler',
    entertainer: 'Entertainer',
    trader: 'Trader',
  };
  return PROFESSION_COLORS[raw] ? raw : map[key] || 'Unknown';
}

function professionColor(value) {
  return PROFESSION_COLORS[canonicalProfessionLabel(value)] || PROFESSION_COLORS.Unknown;
}

function normalizeAbilityName(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .trim()
    .replace(/^(with|using)\s+/, '')
    .replace(/\bmine\s*\d*\s*:\s*/g, '')
    .replace(/(?:[\s.\-]+and\s+(?:\d+\s+points\s+blocked|strikes\s+through|hits|glances|crits|critical(?:ly)?\s+hits?|punishing\s+blows)(?:\s+\(\d+%.*?\))?)/gi, '')
    .replace(/\s+(?:hits|glances|crits|critical(?:ly)?\s+hits?|strikes\s+through|punishing\s+blows)\b.*$/gi, '')
    .replace(/\.and\b/gi, '')
    .replace(/[\(\[][^)\]]*[\)\]]/g, '')
    .replace(/\bmark\s*\d+\b/gi, '')
    .replace(/\b[ivxlcdm]+\b/gi, '')
    .replace(/\b\d+\b/g, '')
    .replace(/\bmine\s+plasma\s+mine\b/gi, 'plasma mine')
    .replace(/[.,!?;:]+$/g, '')
    .replace(/[.:\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferProfessionFromActor(actor) {
  const tallies = {};
  for (const ability of actor?.abilities || []) {
    const normalized = normalizeAbilityName(ability.name);
    const cls = ABILITY_PROFESSION_MAP[normalized] || (normalized.startsWith('burn') ? 'Bounty Hunter' : '');
    if (!cls) continue;
    const weight = (ability.uses || 0) + (ability.hits || 0) + ((ability.directDamage || 0) + (ability.dotDamage || 0) + (ability.healing || 0)) / 10000;
    tallies[cls] = (tallies[cls] || 0) + weight;
  }
  let best = 'Unknown';
  let bestVal = -1;
  for (const [cls, val] of Object.entries(tallies)) {
    if (val > bestVal) {
      best = cls;
      bestVal = val;
    }
  }
  return best;
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

function EventBadge({ event }) {
  const tone = {
    attack: 'text-laser-yellow border-laser-yellow/30 bg-laser-yellow/10',
    dot: 'text-laser-red border-laser-red/30 bg-laser-red/10',
    heal: 'text-green-300 border-green-400/30 bg-green-500/10',
    perform: 'text-plasma-300 border-plasma-400/30 bg-plasma-500/10',
    utility: 'text-hull-200 border-hull-400/30 bg-hull-700/70',
  }[event.type] || 'text-hull-200 border-hull-400/30 bg-hull-700/70';

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${tone}`}>{event.type}</span>;
}

function roleTone(role) {
  if (role === 'player') return 'text-green-200 border-green-400/30 bg-green-500/10';
  if (role === 'npc') return 'text-laser-yellow border-laser-yellow/30 bg-laser-yellow/10';
  return 'text-hull-200 border-hull-400/30 bg-hull-700/70';
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Math.round(value || 0));
}

function formatRate(value) {
  return Number.isFinite(value) ? value.toFixed(value >= 100 ? 0 : 1) : '0.0';
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function downloadCsv(filename, headers, rows) {
  const escape = (value) => {
    const stringValue = value == null ? '' : String(value);
    if (/[",\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
    return stringValue;
  };
  const lines = [headers.map(escape).join(',')];
  rows.forEach((row) => lines.push(row.map(escape).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function OverviewBarChart({ title, subtitle, rows, valueKey, formatter = formatNumber }) {
  const maxValue = Math.max(1, ...rows.map((row) => row[valueKey] || 0));
  return (
    <div className="card min-w-0 p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-hull-400">{subtitle}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {PROFESSION_LABELS.map((profession) => (
            <span key={profession} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-hull-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: professionColor(profession) }} />
              {profession}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {rows.length ? rows.map((row) => {
          const value = row[valueKey] || 0;
          const width = Math.max(4, Math.round((value / maxValue) * 100));
          return (
            <div key={row.name} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm text-hull-100">{row.name}</div>
                <div className="truncate text-[11px] text-hull-400">{canonicalProfessionLabel(row.profession)}</div>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-hull-900/80">
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${width}%`, backgroundColor: professionColor(row.profession) }} />
              </div>
              <div className="shrink-0 rounded-full border border-hull-400/30 bg-hull-800/80 px-2.5 py-1 text-xs text-hull-100">{formatter(value)}</div>
            </div>
          );
        }) : <div className="rounded-2xl border border-hull-400/30 bg-hull-800/40 px-4 py-6 text-sm text-hull-300">No data available yet.</div>}
      </div>
    </div>
  );
}

function GroupChip({ name, profession, removable = false, onRemove }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-hull-400/30 bg-hull-800/70 px-3 py-1.5 text-xs text-hull-100">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: professionColor(profession) }} />
      {name}
      <span className="text-hull-400">{canonicalProfessionLabel(profession)}</span>
      {removable ? (
        <button type="button" onClick={() => onRemove(name)} className="ml-1 text-hull-300 hover:text-hull-100">
          <X size={12} />
        </button>
      ) : null}
    </span>
  );
}

function InsightRow({ entry, inGroup, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(entry.name)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
        inGroup
          ? 'border-green-400/30 bg-green-500/10 text-green-100'
          : 'border-hull-400/30 bg-hull-900/60 text-hull-100 hover:border-plasma-400/40'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate font-medium">{entry.name}</div>
          <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: `${professionColor(entry.profession)}55`, color: professionColor(entry.profession) }}>
            {canonicalProfessionLabel(entry.profession)}
          </span>
        </div>
        <div className="mt-1 text-xs opacity-80">
          {entry.reason || `score ${entry.score} · atk ${entry.attacks} · heals ${entry.heals} · perf ${entry.performs}`}
        </div>
      </div>
      <span className="shrink-0 rounded-full border border-current/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]">
        {inGroup ? 'In group' : 'Add'}
      </span>
    </button>
  );
}

function RosterManager({ actorInsights, groupMembers, professionByActor, onToggle, manualName, setManualName, onManualAdd }) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const groupSet = useMemo(() => new Set(groupMembers), [groupMembers]);
  const normalized = query.trim().toLowerCase();
  const suggestions = actorInsights.filter((entry) => entry.suggestedPlayer && (!normalized || entry.name.toLowerCase().includes(normalized)));
  const others = actorInsights.filter((entry) => !entry.suggestedPlayer && (!normalized || entry.name.toLowerCase().includes(normalized)));
  const visibleOthers = showAll ? others : others.slice(0, 12);

  return (
    <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
              <Search size={14} className="text-plasma-400" /> Search names
            </div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter seen names" className="w-full rounded-xl border border-hull-400/40 bg-hull-900/80 px-3 py-2 text-hull-50 placeholder:text-hull-400 focus:border-plasma-400/50 focus:outline-none" />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300"><Sparkles size={14} className="text-plasma-400" /> Suggested group members</div>
            <div className="space-y-2">
              {suggestions.length ? suggestions.map((entry) => <InsightRow key={entry.name} entry={entry} inGroup={groupSet.has(entry.name)} onToggle={onToggle} />) : <div className="rounded-xl border border-hull-400/30 bg-hull-900/50 px-3 py-3 text-sm text-hull-300">No suggested players matched your filter.</div>}
            </div>
          </div>
        </section>
        <section className="space-y-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300"><UserCheck size={14} className="text-plasma-400" /> Current group</div>
            <div className="flex flex-wrap gap-2">
              {groupMembers.length ? groupMembers.slice().sort((a, b) => a.localeCompare(b)).map((name) => <GroupChip key={name} name={name} profession={professionByActor.get(name)} removable onRemove={onToggle} />) : <div className="text-sm text-hull-300">No confirmed group members yet.</div>}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300"><Plus size={14} className="text-plasma-400" /> Add manually</div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Enter player name" className="flex-1 rounded-xl border border-hull-400/40 bg-hull-900/80 px-3 py-2 text-hull-50 placeholder:text-hull-400 focus:border-plasma-400/50 focus:outline-none" />
              <button type="button" onClick={onManualAdd} className="btn-secondary whitespace-nowrap"><UserPlus size={15} /> Add</button>
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
              <span className="inline-flex items-center gap-2"><ShieldQuestion size={14} className="text-plasma-400" /> Other seen names</span>
              {others.length > 12 ? <button type="button" className="text-xs text-plasma-300 hover:text-plasma-200" onClick={() => setShowAll((v) => !v)}>{showAll ? <span className="inline-flex items-center gap-1">Show less <ChevronUp size={14} /></span> : <span className="inline-flex items-center gap-1">Show all <ChevronDown size={14} /></span>}</button> : null}
            </div>
            <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-1">
              {visibleOthers.length ? visibleOthers.map((entry) => <InsightRow key={entry.name} entry={entry} inGroup={groupSet.has(entry.name)} onToggle={onToggle} />) : <div className="rounded-xl border border-hull-400/30 bg-hull-900/50 px-3 py-3 text-sm text-hull-300">No additional names matched your filter.</div>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function CombatLogAnalyzer() {
  const workerRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [selectedEncounterId, setSelectedEncounterId] = useState('');
  const [actorTypeFilter, setActorTypeFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [manualName, setManualName] = useState('');
  const [showRosterTools, setShowRosterTools] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/swgCombatLog.worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'parsed') {
        setResult(payload);
        setParsing(false);
        setSelectedEncounterId(payload.encounters?.[0]?.id || '');
        setGroupMembers(payload.suggestedPlayers || []);
      } else if (type === 'error') {
        setError(payload?.message || 'Failed to parse logs.');
        setParsing(false);
      }
    };
    return () => worker.terminate();
  }, []);

  const groupSet = useMemo(() => new Set(groupMembers), [groupMembers]);

  const derivedRoleMap = useMemo(() => {
    const map = new Map();
    (result?.actors || []).forEach((actor) => {
      if (groupSet.has(actor.name)) map.set(actor.name, 'player');
      else if (actor.role === 'npc') map.set(actor.name, 'npc');
      else map.set(actor.name, 'unknown');
    });
    return map;
  }, [result, groupSet]);

  const selectedEncounterRaw = useMemo(() => {
    if (!result?.encounters?.length) return null;
    return result.encounters.find((encounter) => encounter.id === selectedEncounterId) || result.encounters[0];
  }, [result, selectedEncounterId]);

  const selectedEncounter = useMemo(() => {
    if (!selectedEncounterRaw) return null;
    return {
      ...selectedEncounterRaw,
      actors: selectedEncounterRaw.actors.map((actor) => ({ ...actor, role: derivedRoleMap.get(actor.name) || actor.role || 'unknown' })),
      abilities: selectedEncounterRaw.abilities.map((entry) => ({ ...entry, actorRole: derivedRoleMap.get(entry.actor) || 'unknown' })),
      events: selectedEncounterRaw.events.map((event) => ({ ...event, actorRole: derivedRoleMap.get(event.actor) || event.actorRole || 'unknown', targetRole: derivedRoleMap.get(event.target) || event.targetRole || 'unknown' })),
    };
  }, [selectedEncounterRaw, derivedRoleMap]);

  const normalizedFilter = nameFilter.trim().toLowerCase();
  const allEvents = useMemo(() => (result?.encounters || []).flatMap((encounter) => encounter.events || []), [result]);

  const professionByActor = useMemo(() => {
    const map = new Map();
    for (const actor of result?.summary?.actors || []) map.set(actor.name, inferProfessionFromActor(actor));
    return map;
  }, [result]);

  const overviewRows = useMemo(() => {
    const eventActors = new Map();
    const ensure = (name) => {
      if (!name) return null;
      if (!eventActors.has(name)) eventActors.set(name, { name, damageDone: 0, healingDone: 0, damageTaken: 0, actions: 0 });
      return eventActors.get(name);
    };
    for (const event of allEvents) {
      const actor = ensure(event.actor);
      const target = ensure(event.target);
      if (actor && ['attack', 'dot', 'heal', 'perform', 'utility'].includes(event.type)) actor.actions += 1;
      if (event.type === 'attack' || event.type === 'dot') {
        if (actor) actor.damageDone += event.amount || 0;
        if (target) target.damageTaken += event.amount || 0;
      } else if (event.type === 'heal') {
        if (actor) actor.healingDone += event.amount || 0;
      }
    }
    const actors = Array.from(eventActors.values()).map((actor) => {
      const encounterPresence = (result?.encounters || []).filter((encounter) => (encounter.events || []).some((event) => event.actor === actor.name)).length || 1;
      return { ...actor, avgApm: actor.actions / Math.max(1, encounterPresence), profession: professionByActor.get(actor.name) || 'Unknown' };
    });
    return {
      sortedDamage: actors.filter((a) => a.damageDone > 0).sort((a, b) => b.damageDone - a.damageDone).slice(0, 10),
      sortedHealing: actors.filter((a) => a.healingDone > 0).sort((a, b) => b.healingDone - a.healingDone).slice(0, 10),
      sortedTaken: actors.filter((a) => a.damageTaken > 0).sort((a, b) => b.damageTaken - a.damageTaken).slice(0, 10),
      sortedApm: actors.filter((a) => a.actions > 0).sort((a, b) => b.avgApm - a.avgApm).slice(0, 10),
    };
  }, [allEvents, professionByActor, result]);

  const filteredEncounterActors = useMemo(() => {
    if (!selectedEncounter) return [];
    return selectedEncounter.actors.filter((actor) => {
      const rolePass = actorTypeFilter === 'all' || actor.role === actorTypeFilter;
      const namePass = !normalizedFilter || actor.name.toLowerCase().includes(normalizedFilter);
      return rolePass && namePass;
    });
  }, [selectedEncounter, actorTypeFilter, normalizedFilter]);

  const filteredEncounterAbilities = useMemo(() => {
    if (!selectedEncounter) return [];
    return selectedEncounter.abilities.filter((entry) => {
      const actorRole = entry.actorRole || derivedRoleMap.get(entry.actor) || 'unknown';
      const rolePass = actorTypeFilter === 'all' || actorRole === actorTypeFilter;
      const text = `${entry.actor} ${entry.ability}`.toLowerCase();
      const namePass = !normalizedFilter || text.includes(normalizedFilter);
      return rolePass && namePass;
    });
  }, [selectedEncounter, derivedRoleMap, actorTypeFilter, normalizedFilter]);

  const filteredEncounterEvents = useMemo(() => {
    if (!selectedEncounter) return [];
    return selectedEncounter.events.filter((event) => {
      const rolePass = actorTypeFilter === 'all' || event.actorRole === actorTypeFilter || event.targetRole === actorTypeFilter;
      const text = `${event.actor} ${event.target} ${event.ability} ${event.raw}`.toLowerCase();
      const namePass = !normalizedFilter || text.includes(normalizedFilter);
      return rolePass && namePass;
    });
  }, [selectedEncounter, actorTypeFilter, normalizedFilter]);

  async function handleFilesChange(event) {
    const selected = Array.from(event.target.files || []);
    setFiles(selected);
    setResult(null);
    setSelectedEncounterId('');
    setGroupMembers([]);
    setError('');
    if (!selected.length) return;
    setParsing(true);
    const texts = await Promise.all(selected.map(async (file) => ({ name: file.name, text: await file.text() })));
    workerRef.current.postMessage({ type: 'parseLogs', payload: { files: texts } });
  }

  function toggleGroupMember(name) {
    setGroupMembers((current) => (current.includes(name) ? current.filter((value) => value !== name) : [...current, name]));
  }

  function addManualGroupMember() {
    const value = manualName.trim();
    if (!value) return;
    setGroupMembers((current) => (current.includes(value) ? current : [...current, value]));
    setManualName('');
  }

  function exportActorsCsv() {
    if (!selectedEncounter) return;
    downloadCsv(`${selectedEncounter.label.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_actors.csv`, ['Actor', 'Role', 'Damage', 'DoT', 'Healing', 'Crits', 'Misses'], filteredEncounterActors.map((actor) => [actor.name, actor.role, actor.totalDamage, actor.dotDamage, actor.healing, actor.crits, actor.misses]));
  }

  function exportAbilitiesCsv() {
    if (!selectedEncounter) return;
    downloadCsv(`${selectedEncounter.label.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_abilities.csv`, ['Actor', 'Role', 'Ability', 'Uses', 'Damage', 'Healing'], filteredEncounterAbilities.map((entry) => [entry.actor, entry.actorRole || derivedRoleMap.get(entry.actor) || 'unknown', entry.ability, entry.uses, entry.damage, entry.healing]));
  }

  function exportEventsCsv() {
    if (!selectedEncounter) return;
    downloadCsv(`${selectedEncounter.label.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_events.csv`, ['Time', 'Actor', 'Actor Role', 'Target', 'Target Role', 'Type', 'Ability', 'Amount', 'Raw'], filteredEncounterEvents.map((event) => [event.timestamp, event.actor, event.actorRole, event.target, event.targetRole, event.type, event.ability, event.amount, event.raw]));
  }

  return (
    <div className="mx-auto max-w-[95rem] animate-slide-up space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-4 py-2 text-xs font-display uppercase tracking-[0.25em] text-hull-200">
            <ScrollText size={14} className="text-plasma-400" /> Combat Log Tools
          </div>
          <h1 className="mb-2 font-display text-3xl font-bold tracking-wider text-hull-50">Combat Log Analyzer</h1>
          <p className="max-w-3xl text-hull-200">Open on charts first, tweak the roster only when needed. Profession colors are inferred from parsed ability use and can be corrected by changing the group list.</p>
        </div>
        <label className="card min-w-[18rem] cursor-pointer px-4 py-4 transition-colors hover:border-plasma-400/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-plasma-400/30 bg-plasma-500/10"><Upload size={18} className="text-plasma-300" /></div>
            <div><div className="text-sm font-medium text-hull-50">Upload chat logs</div><div className="text-xs text-hull-300">Select one or more SWG chat log .txt files</div></div>
          </div>
          <input type="file" accept=".txt,text/plain" multiple className="hidden" onChange={handleFilesChange} />
        </label>
      </div>

      {error ? <div className="rounded-2xl border border-laser-red/40 bg-laser-red/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

      {!files.length ? <div className="card space-y-3 p-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-hull-400/40 bg-hull-800/70"><FileUp size={24} className="text-plasma-400" /></div><div className="text-xl font-display text-hull-50">Drop in one or more chat logs</div><p className="mx-auto max-w-2xl text-hull-200">The parser uses your site’s original analyzer logic. It reads combat, DoT, heals, performs, and credit lines, then opens on encounter dashboards instead of making you manage a roster for fun.</p></div> : null}
      {parsing ? <div className="card p-8 text-center text-hull-200"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-plasma-500 border-t-transparent" />Parsing combat logs… because MMO text apparently needed another career.</div> : null}

      {result ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <StatCard icon={Activity} label="Events" value={formatNumber(result.summary.totalEvents)} />
            <StatCard icon={Axe} label="Total Damage" value={formatNumber(result.summary.totalDamage)} hint={`${formatNumber(result.summary.directDamage)} direct · ${formatNumber(result.summary.dotDamage)} DoT`} />
            <StatCard icon={HeartPulse} label="Healing" value={formatNumber(result.summary.totalHealing)} />
            <StatCard icon={Coins} label="Credits" value={formatNumber(result.summary.totalSharedCredits + result.summary.totalLootedCredits)} hint={`${formatNumber(result.summary.totalSharedCredits)} shared · ${formatNumber(result.summary.totalLootedCredits)} looted`} />
            <StatCard icon={Swords} label="Encounters" value={result.summary.encounterCount} hint={`${result.summary.actorCount} actors seen`} />
          </div>

          <div className="card p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300"><Users size={14} className="text-plasma-400" /> Current group</div>
                <h2 className="mt-1 text-xl font-display text-hull-50">Initial load opens on the useful stuff</h2>
                <p className="mt-1 text-sm text-hull-300">Suggested group members are applied automatically so the dashboard makes sense on first load. Open roster tools only if you need to correct who counts as a real player.</p>
              </div>
              <button type="button" className="btn-ghost self-start lg:self-center" onClick={() => setShowRosterTools((value) => !value)}><Users size={15} /> {showRosterTools ? 'Hide roster tools' : 'Manage roster'}</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {groupMembers.length ? groupMembers.slice().sort((a, b) => a.localeCompare(b)).map((name) => <GroupChip key={name} name={name} profession={professionByActor.get(name)} removable={showRosterTools} onRemove={toggleGroupMember} />) : <div className="text-sm text-hull-300">No group members confirmed yet.</div>}
            </div>
            {showRosterTools ? <div className="mt-4"><RosterManager actorInsights={(result.actorInsights || []).map((entry) => ({ ...entry, profession: professionByActor.get(entry.name) || 'Unknown' }))} groupMembers={groupMembers} professionByActor={professionByActor} onToggle={toggleGroupMember} manualName={manualName} setManualName={setManualName} onManualAdd={addManualGroupMember} /></div> : null}
          </div>

          <div className="grid gap-4 2xl:grid-cols-2">
            <OverviewBarChart title="Damage done by source" subtitle="Initial load overview" rows={overviewRows.sortedDamage} valueKey="damageDone" />
            <OverviewBarChart title="Healing done by source" subtitle="Top healing actors" rows={overviewRows.sortedHealing} valueKey="healingDone" />
            <OverviewBarChart title="Damage taken by source" subtitle="Incoming damage sustained" rows={overviewRows.sortedTaken} valueKey="damageTaken" />
            <OverviewBarChart title="Actions per minute (APM)" subtitle="Average actions across seen encounters" rows={overviewRows.sortedApm} valueKey="avgApm" formatter={formatRate} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="card p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300"><ScrollText size={14} className="text-plasma-400" /> Encounters</div>
                <div className="space-y-2">
                  {result.encounters.map((encounter) => (
                    <button key={encounter.id} type="button" onClick={() => setSelectedEncounterId(encounter.id)} className={`w-full rounded-2xl border px-3 py-2 text-left transition-colors ${selectedEncounter?.id === encounter.id ? 'border-plasma-400/40 bg-plasma-500/10' : 'border-hull-400/30 bg-hull-800/60 hover:border-hull-300/50'}`}>
                      <div className="text-sm font-medium text-hull-50">{encounter.label}</div>
                      <div className="mt-1 text-xs text-hull-300">{encounter.startTime} · {formatDuration(encounter.durationSec)} · {formatNumber(encounter.totalDamage)} dmg</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="card p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300"><Filter size={14} className="text-plasma-400" /> Filters</div>
                <div className="space-y-3">
                  <label className="block"><span className="mb-1 block text-xs text-hull-300">Actor role</span><select value={actorTypeFilter} onChange={(event) => setActorTypeFilter(event.target.value)} className="w-full rounded-xl border border-hull-400/40 bg-hull-900/80 px-3 py-2 text-hull-50"><option value="all">All</option><option value="player">Group</option><option value="npc">NPC</option><option value="unknown">Unknown</option></select></label>
                  <label className="block"><span className="mb-1 block text-xs text-hull-300">Search</span><div className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hull-400" /><input value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="Actor, target, ability…" className="w-full rounded-xl border border-hull-400/40 bg-hull-900/80 py-2 pl-9 pr-3 text-hull-50 placeholder:text-hull-400" /></div></label>
                </div>
              </div>
            </aside>

            <section className="space-y-4 min-w-0">
              {selectedEncounter ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard icon={Swords} label="Encounter Damage" value={formatNumber(selectedEncounter.totalDamage)} hint={`${formatRate(selectedEncounter.dps)} DPS`} />
                    <StatCard icon={HeartPulse} label="Encounter Healing" value={formatNumber(selectedEncounter.healing)} hint={`${formatRate(selectedEncounter.hps)} HPS`} />
                    <StatCard icon={ScrollText} label="Duration" value={formatDuration(selectedEncounter.durationSec)} hint={`${selectedEncounter.eventCount} events`} />
                    <StatCard icon={Coins} label="Encounter Credits" value={formatNumber(selectedEncounter.credits)} hint={selectedEncounter.dominantNpc ? `Named from ${selectedEncounter.dominantNpc}` : 'No dominant NPC found'} />
                  </div>

                  <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                    <div className="card min-w-0 p-4">
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div><div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">Actor Summary</div><h2 className="mt-1 text-xl font-display text-hull-50">{selectedEncounter.label}</h2></div>
                        <button type="button" onClick={exportActorsCsv} className="btn-ghost self-start md:self-center"><Download size={15} /> Export actors CSV</button>
                      </div>
                      <div className="space-y-3">
                        {filteredEncounterActors.map((actor) => (
                          <div key={actor.name} className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: professionColor(professionByActor.get(actor.name)) }} />
                                  <div className="truncate text-sm font-medium text-hull-50">{actor.name}</div>
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${roleTone(actor.role)}`}>{actor.role === 'player' ? 'group' : actor.role}</span>
                                  <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: `${professionColor(professionByActor.get(actor.name))}55`, color: professionColor(professionByActor.get(actor.name)) }}>{canonicalProfessionLabel(professionByActor.get(actor.name))}</span>
                                </div>
                                <div className="mt-1 text-xs text-hull-300">{formatNumber(actor.totalDamage)} damage · {formatNumber(actor.healing)} healing · {actor.crits} crits</div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-right text-xs text-hull-200 sm:grid-cols-4">
                                <div><div className="text-hull-400">Direct</div><div>{formatNumber(actor.directDamage)}</div></div>
                                <div><div className="text-hull-400">DoT</div><div>{formatNumber(actor.dotDamage)}</div></div>
                                <div><div className="text-hull-400">Hits</div><div>{actor.hits}</div></div>
                                <div><div className="text-hull-400">Misses</div><div>{actor.misses}</div></div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {!filteredEncounterActors.length ? <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4 text-sm text-hull-300">No actors match the current filter.</div> : null}
                      </div>
                    </div>

                    <div className="space-y-4 min-w-0">
                      <div className="card p-4">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">Top Abilities</div>
                          <button type="button" onClick={exportAbilitiesCsv} className="btn-ghost self-start md:self-center"><Download size={15} /> Export abilities CSV</button>
                        </div>
                        <div className="space-y-2">
                          {filteredEncounterAbilities.slice(0, 12).map((entry) => (
                            <div key={`${entry.actor}-${entry.ability}`} className="flex items-center justify-between gap-3 rounded-2xl border border-hull-400/30 bg-hull-800/50 px-3 py-2.5">
                              <div className="min-w-0"><div className="truncate text-sm text-hull-50">{entry.ability}</div><div className="text-xs text-hull-300">{entry.actor}</div></div>
                              <div className="shrink-0 text-right text-xs text-hull-200"><div>{formatNumber(entry.damage)} dmg</div><div>{formatNumber(entry.healing)} heal · {entry.uses} uses</div></div>
                            </div>
                          ))}
                          {!filteredEncounterAbilities.length ? <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4 text-sm text-hull-300">No abilities match the current filter.</div> : null}
                        </div>
                      </div>

                      <div className="card p-4">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">Recent Event Feed</div>
                          <button type="button" onClick={exportEventsCsv} className="btn-ghost self-start md:self-center"><Download size={15} /> Export events CSV</button>
                        </div>
                        <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
                          {filteredEncounterEvents.slice().reverse().map((event, index) => (
                            <div key={`${event.timestamp}-${event.actor}-${event.target}-${index}`} className="rounded-2xl border border-hull-400/30 bg-hull-800/50 px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <EventBadge event={event} />
                                <span className="text-xs text-hull-400">{event.timestamp}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${roleTone(event.actorRole)}`}>{event.actorRole === 'player' ? 'group' : event.actorRole}</span>
                                {event.target ? <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${roleTone(event.targetRole)}`}>{event.targetRole === 'player' ? 'group' : event.targetRole}</span> : null}
                              </div>
                              <div className="mt-2 text-sm text-hull-50">{event.actor}{event.target ? ` → ${event.target}` : ''}{event.ability ? ` · ${event.ability}` : ''}</div>
                              <div className="mt-1 text-xs text-hull-300">{event.amount ? `${formatNumber(event.amount)} points` : 'Utility / non-damage event'} · {event.raw}</div>
                            </div>
                          ))}
                          {!filteredEncounterEvents.length ? <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4 text-sm text-hull-300">No events match the current filter.</div> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
