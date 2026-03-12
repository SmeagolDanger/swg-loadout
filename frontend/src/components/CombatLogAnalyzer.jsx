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

function roleTone(role) {
  if (role === 'player') return 'text-green-200 border-green-400/30 bg-green-500/10';
  if (role === 'npc') return 'text-laser-yellow border-laser-yellow/30 bg-laser-yellow/10';
  return 'text-hull-200 border-hull-400/30 bg-hull-700/70';
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

function GroupChip({ name, removable = false, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-400/30 bg-green-500/10 px-3 py-1 text-xs text-green-200">
      <UserCheck size={12} />
      {name}
      {removable ? (
        <button type="button" onClick={() => onRemove(name)} className="ml-1 text-green-200/80 hover:text-green-100">
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
          {entry.suggestedPlayer ? (
            <span className="rounded-full border border-plasma-400/30 bg-plasma-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-plasma-200">
              suggested
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-xs opacity-80">
          score {entry.score} · atk {entry.attacks} · heals {entry.heals} · perf {entry.performs} · util {entry.utilities}
        </div>
      </div>
      <span className="shrink-0 rounded-full border border-current/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]">
        {inGroup ? 'In group' : 'Add'}
      </span>
    </button>
  );
}

function RosterManager({
  actorInsights,
  groupMembers,
  onToggle,
  manualName,
  setManualName,
  onManualAdd,
}) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const groupSet = useMemo(() => new Set(groupMembers), [groupMembers]);

  const suggestions = useMemo(() => actorInsights.filter((entry) => entry.suggestedPlayer), [actorInsights]);
  const others = useMemo(() => actorInsights.filter((entry) => !entry.suggestedPlayer), [actorInsights]);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredSuggestions = suggestions.filter((entry) => !normalizedQuery || entry.name.toLowerCase().includes(normalizedQuery));
  const filteredOthers = others.filter((entry) => !normalizedQuery || entry.name.toLowerCase().includes(normalizedQuery));
  const visibleOthers = showAll ? filteredOthers : filteredOthers.slice(0, 12);

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
            <Users size={14} className="text-plasma-400" />
            Group Roster
          </div>
          <h2 className="mt-1 text-xl font-display text-hull-50">Review suggested group members</h2>
          <p className="mt-1 max-w-3xl text-sm text-hull-300">
            Suggestions favor combat-source names that look like actual player short names in SWG combat logs. Confirm the real group from the shortlist instead of trusting broad actor guesses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => filteredSuggestions.forEach((entry) => !groupSet.has(entry.name) && onToggle(entry.name))}
          >
            <UserPlus size={15} /> Add suggested
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => groupMembers.forEach((name) => onToggle(name))}
            disabled={!groupMembers.length}
          >
            <X size={15} /> Clear group
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
              <Search size={14} className="text-plasma-400" /> Search names
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter detected names"
                className="flex-1 rounded-xl border border-hull-400/40 bg-hull-900/80 px-3 py-2 text-hull-50 placeholder:text-hull-400 focus:border-plasma-400/50 focus:outline-none"
              />
              <div className="text-xs text-hull-300 self-center">{actorInsights.length} names seen</div>
            </div>
          </div>

          <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
              <Sparkles size={14} className="text-plasma-400" /> Suggested players
            </div>
            <div className="space-y-2">
              {filteredSuggestions.length ? (
                filteredSuggestions.map((entry) => (
                  <InsightRow key={entry.name} entry={entry} inGroup={groupSet.has(entry.name)} onToggle={onToggle} />
                ))
              ) : (
                <div className="rounded-xl border border-hull-400/30 bg-hull-900/50 px-3 py-3 text-sm text-hull-300">
                  No suggested players matched your filter.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
              <UserCheck size={14} className="text-plasma-400" /> Current group
            </div>
            <div className="flex flex-wrap gap-2">
              {groupMembers.length ? (
                groupMembers.slice().sort((a, b) => a.localeCompare(b)).map((name) => (
                  <GroupChip key={name} name={name} removable onRemove={onToggle} />
                ))
              ) : (
                <div className="text-sm text-hull-300">No confirmed group members yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
              <Plus size={14} className="text-plasma-400" /> Add manually
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder="Enter player name"
                className="flex-1 rounded-xl border border-hull-400/40 bg-hull-900/80 px-3 py-2 text-hull-50 placeholder:text-hull-400 focus:border-plasma-400/50 focus:outline-none"
              />
              <button type="button" onClick={onManualAdd} className="btn-secondary whitespace-nowrap">
                <UserCheck size={15} /> Add to group
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
              <span className="inline-flex items-center gap-2"><ShieldQuestion size={14} className="text-plasma-400" /> Other seen names</span>
              {filteredOthers.length > 12 ? (
                <button type="button" className="text-xs text-plasma-300 hover:text-plasma-200" onClick={() => setShowAll((value) => !value)}>
                  {showAll ? (<span className="inline-flex items-center gap-1">Show less <ChevronUp size={14} /></span>) : (<span className="inline-flex items-center gap-1">Show all <ChevronDown size={14} /></span>)}
                </button>
              ) : null}
            </div>
            <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-1">
              {visibleOthers.length ? (
                visibleOthers.map((entry) => (
                  <InsightRow key={entry.name} entry={entry} inGroup={groupSet.has(entry.name)} onToggle={onToggle} />
                ))
              ) : (
                <div className="rounded-xl border border-hull-400/30 bg-hull-900/50 px-3 py-3 text-sm text-hull-300">
                  No other names matched your filter.
                </div>
              )}
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
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState('');
  const [actorTypeFilter, setActorTypeFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [manualName, setManualName] = useState('');

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/swgCombatLog.worker.js', import.meta.url), { type: 'module' });
    const worker = workerRef.current;

    worker.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'parsed') {
        setResult(payload);
        setSelectedEncounterId(payload.encounters?.[0]?.id || '');
        setGroupMembers([]);
        setParsing(false);
        setError('');
      }
      if (type === 'error') {
        setParsing(false);
        setError(payload?.message || 'Failed to parse logs.');
      }
    };

    return () => worker.terminate();
  }, []);

  const groupSet = useMemo(() => new Set(groupMembers), [groupMembers]);

  const derivedRoleMap = useMemo(() => {
    const map = new Map();
    (result?.actors || []).forEach((actor) => {
      if (groupSet.has(actor.name)) {
        map.set(actor.name, 'player');
      } else if (actor.role === 'npc') {
        map.set(actor.name, 'npc');
      } else {
        map.set(actor.name, 'unknown');
      }
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
      actors: selectedEncounterRaw.actors.map((actor) => ({
        ...actor,
        role: derivedRoleMap.get(actor.name) || actor.role || 'unknown',
      })),
      abilities: selectedEncounterRaw.abilities.map((entry) => ({
        ...entry,
        actorRole: derivedRoleMap.get(entry.actor) || 'unknown',
      })),
      events: selectedEncounterRaw.events.map((event) => ({
        ...event,
        actorRole: derivedRoleMap.get(event.actor) || event.actorRole || 'unknown',
        targetRole: derivedRoleMap.get(event.target) || event.targetRole || 'unknown',
      })),
    };
  }, [selectedEncounterRaw, derivedRoleMap]);

  const normalizedFilter = nameFilter.trim().toLowerCase();

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
    downloadCsv(
      `${selectedEncounter.label.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_actors.csv`,
      ['Actor', 'Role', 'Damage', 'DoT', 'Healing', 'Crits', 'Misses'],
      filteredEncounterActors.map((actor) => [actor.name, actor.role, actor.totalDamage, actor.dotDamage, actor.healing, actor.crits, actor.misses]),
    );
  }

  function exportAbilitiesCsv() {
    if (!selectedEncounter) return;
    downloadCsv(
      `${selectedEncounter.label.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_abilities.csv`,
      ['Actor', 'Role', 'Ability', 'Uses', 'Damage', 'Healing'],
      filteredEncounterAbilities.map((entry) => [entry.actor, entry.actorRole || derivedRoleMap.get(entry.actor) || 'unknown', entry.ability, entry.uses, entry.damage, entry.healing]),
    );
  }

  function exportEventsCsv() {
    if (!selectedEncounter) return;
    downloadCsv(
      `${selectedEncounter.label.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_events.csv`,
      ['Time', 'Actor', 'Actor Role', 'Target', 'Target Role', 'Type', 'Ability', 'Amount', 'Raw'],
      filteredEncounterEvents.map((event) => [event.timestamp, event.actor, event.actorRole, event.target, event.targetRole, event.type, event.ability, event.amount, event.raw]),
    );
  }

  return (
    <div className="mx-auto max-w-[95rem] animate-slide-up space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-4 py-2 text-xs font-display uppercase tracking-[0.25em] text-hull-200">
            <ScrollText size={14} className="text-plasma-400" />
            Combat Log Tools
          </div>
          <h1 className="mb-2 font-display text-3xl font-bold tracking-wider text-hull-50">Combat Log Analyzer</h1>
          <p className="max-w-3xl text-hull-200">
            Original parser built for this site from your uploaded SWG chat logs. Review the detected roster, confirm the real group, and then slice encounters with something less embarrassing than blind heuristics.
          </p>
        </div>

        <label className="card min-w-[18rem] cursor-pointer px-4 py-4 transition-colors hover:border-plasma-400/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-plasma-400/30 bg-plasma-500/10">
              <Upload size={18} className="text-plasma-300" />
            </div>
            <div>
              <div className="text-sm font-medium text-hull-50">Upload chat logs</div>
              <div className="text-xs text-hull-300">Select one or more SWG chat log .txt files</div>
            </div>
          </div>
          <input type="file" accept=".txt,text/plain" multiple className="hidden" onChange={handleFilesChange} />
        </label>
      </div>

      {error ? <div className="rounded-2xl border border-laser-red/40 bg-laser-red/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

      {!files.length ? (
        <div className="card space-y-3 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-hull-400/40 bg-hull-800/70">
            <FileUp size={24} className="text-plasma-400" />
          </div>
          <div className="text-xl font-display text-hull-50">Drop in one or more chat logs</div>
          <p className="mx-auto max-w-2xl text-hull-200">
            The parser matches the combat, heal, DoT, perform, and group-credit patterns found in your uploaded sample logs. It uses original site code, not lifted analyzer code.
          </p>
        </div>
      ) : null}

      {parsing ? (
        <div className="card p-8 text-center text-hull-200">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-plasma-500 border-t-transparent" />
          Parsing combat logs… because 20 years of MMO combat text apparently needed a second job.
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <StatCard icon={Activity} label="Events" value={formatNumber(result.summary.totalEvents)} />
            <StatCard icon={Axe} label="Total Damage" value={formatNumber(result.summary.totalDamage)} hint={`${formatNumber(result.summary.directDamage)} direct · ${formatNumber(result.summary.dotDamage)} DoT`} />
            <StatCard icon={HeartPulse} label="Healing" value={formatNumber(result.summary.totalHealing)} />
            <StatCard icon={Coins} label="Credits" value={formatNumber(result.summary.totalSharedCredits + result.summary.totalLootedCredits)} hint={`${formatNumber(result.summary.totalSharedCredits)} shared · ${formatNumber(result.summary.totalLootedCredits)} looted`} />
            <StatCard icon={Swords} label="Encounters" value={result.summary.encounterCount} hint={`${result.summary.actorCount} actors seen`} />
          </div>

          <RosterManager
            actorInsights={result.actorInsights || []}
            groupMembers={groupMembers}
            onToggle={toggleGroupMember}
            manualName={manualName}
            setManualName={setManualName}
            onManualAdd={addManualGroupMember}
          />

          <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="card p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
                  <ScrollText size={14} className="text-plasma-400" /> Encounters
                </div>
                <div className="space-y-2">
                  {result.encounters.map((encounter) => (
                    <button
                      key={encounter.id}
                      type="button"
                      onClick={() => setSelectedEncounterId(encounter.id)}
                      className={`w-full rounded-2xl border px-3 py-2 text-left transition-colors ${
                        selectedEncounter?.id === encounter.id
                          ? 'border-plasma-400/40 bg-plasma-500/10'
                          : 'border-hull-400/30 bg-hull-800/60 hover:border-hull-300/50'
                      }`}
                    >
                      <div className="text-sm font-medium text-hull-50">{encounter.label}</div>
                      <div className="mt-1 text-xs text-hull-300">{encounter.startTime} · {formatDuration(encounter.durationSec)} · {formatNumber(encounter.totalDamage)} dmg</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
                  <Filter size={14} className="text-plasma-400" /> Filters
                </div>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-hull-300">Actor role</span>
                    <select value={actorTypeFilter} onChange={(event) => setActorTypeFilter(event.target.value)} className="w-full rounded-xl border border-hull-400/40 bg-hull-900/80 px-3 py-2 text-hull-50">
                      <option value="all">All</option>
                      <option value="player">Group</option>
                      <option value="npc">NPC</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-hull-300">Search</span>
                    <div className="relative">
                      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hull-400" />
                      <input value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="Actor, target, ability…" className="w-full rounded-xl border border-hull-400/40 bg-hull-900/80 py-2 pl-9 pr-3 text-hull-50 placeholder:text-hull-400" />
                    </div>
                  </label>
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
                        <div>
                          <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">Actor Summary</div>
                          <h2 className="mt-1 text-xl font-display text-hull-50">{selectedEncounter.label}</h2>
                        </div>
                        <button type="button" onClick={exportActorsCsv} className="btn-ghost self-start md:self-center">
                          <Download size={15} /> Export actors CSV
                        </button>
                      </div>
                      <div className="space-y-3">
                        {filteredEncounterActors.map((actor) => (
                          <div key={actor.name} className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="truncate text-sm font-medium text-hull-50">{actor.name}</div>
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${roleTone(actor.role)}`}>{actor.role === 'player' ? 'group' : actor.role}</span>
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
                          <button type="button" onClick={exportAbilitiesCsv} className="btn-ghost self-start md:self-center">
                            <Download size={15} /> Export abilities CSV
                          </button>
                        </div>
                        <div className="space-y-2">
                          {filteredEncounterAbilities.slice(0, 12).map((entry) => (
                            <div key={`${entry.actor}-${entry.ability}`} className="flex items-center justify-between gap-3 rounded-2xl border border-hull-400/30 bg-hull-800/50 px-3 py-2.5">
                              <div className="min-w-0">
                                <div className="truncate text-sm text-hull-50">{entry.ability}</div>
                                <div className="text-xs text-hull-300">{entry.actor}</div>
                              </div>
                              <div className="shrink-0 text-right text-xs text-hull-200">
                                <div>{formatNumber(entry.damage)} dmg</div>
                                <div>{formatNumber(entry.healing)} heal · {entry.uses} uses</div>
                              </div>
                            </div>
                          ))}
                          {!filteredEncounterAbilities.length ? <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4 text-sm text-hull-300">No abilities match the current filter.</div> : null}
                        </div>
                      </div>

                      <div className="card p-4">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">Recent Event Feed</div>
                          <button type="button" onClick={exportEventsCsv} className="btn-ghost self-start md:self-center">
                            <Download size={15} /> Export events CSV
                          </button>
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
