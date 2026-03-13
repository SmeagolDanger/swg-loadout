import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Axe,
  BarChart3,
  Coins,
  Download,
  FileUp,
  Gem,
  HeartPulse,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Upload,
} from 'lucide-react';

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

function professionColor(profession) {
  return {
    Jedi: 'bg-sky-400',
    'Bounty Hunter': 'bg-rose-500',
    Commando: 'bg-amber-300',
    Officer: 'bg-lime-400',
    Spy: 'bg-yellow-300',
    Medic: 'bg-violet-400',
    Smuggler: 'bg-pink-400',
    Entertainer: 'bg-orange-400',
    Trader: 'bg-slate-400',
    Unknown: 'bg-hull-400',
  }[profession] || 'bg-hull-400';
}

const PROFESSION_OVERRIDES = {
  Dexeridix: 'Commando',
  ChickenRat: 'Bounty Hunter',
};

function inferProfession(actor) {
  if (PROFESSION_OVERRIDES[actor?.name]) return PROFESSION_OVERRIDES[actor.name];
  const names = (actor?.abilities || []).map((entry) => String(entry.name || '').toLowerCase());
  const joined = names.join(' | ');
  const has = (...terms) => terms.some((term) => joined.includes(term.toLowerCase()));
  if (has('commando area cold', 'focused beam', 'lethal beam', 'riddle armor', 'suppressing fire')) return 'Commando';
  if (has('eye shot', 'leg shot', 'torso shot', 'head shot', 'body shot', 'missile', 'rocket', 'flamethrower')) return 'Bounty Hunter';
  if (has('focus fire', 'cover', 'called shot', 'tactical superiority')) return 'Officer';
  if (has('heal', 'bacta', 'revive', 'resuscitate', 'diagnosis')) return 'Medic';
  if (has('ambush', 'feign death', 'vital strike', 'puncture', 'shrapnel', 'cloak')) return 'Spy';
  if (has('lucky shot', 'dirty trick', 'low blow', 'pistol whip', 'disarming shot')) return 'Smuggler';
  if (has('favor of the elders', 'inspire', 'entertain')) return 'Entertainer';
  if (has('force ', 'lightsaber', 'saber')) return 'Jedi';
  return 'Unknown';
}

function ChartPanel({ title, subtitle, items }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="card p-4">
      <div className="mb-4">
        <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-hull-400">{subtitle}</div> : null}
      </div>
      <div className="space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.name} className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_5.5rem] items-center gap-3">
            <div className="truncate text-sm text-hull-100">{item.name}</div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-hull-800/80">
                <div className={`h-full rounded-full ${professionColor(item.profession)}`} style={{ width: `${Math.max(3, (item.value / maxValue) * 100)}%` }} />
              </div>
            </div>
            <div className="text-right text-xs text-hull-200">{item.label}</div>
          </div>
        )) : <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4 text-sm text-hull-300">No data yet.</div>}
      </div>
    </div>
  );
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

export default function CombatLogAnalyzer() {
  const workerRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/swgCombatLog.worker.js', import.meta.url), { type: 'module' });
    const worker = workerRef.current;
    worker.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'parsed') {
        setResult(payload);
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

  async function handleFilesChange(event) {
    const selected = Array.from(event.target.files || []);
    setFiles(selected);
    setResult(null);
    setError('');
    if (!selected.length) return;
    setParsing(true);
    const texts = await Promise.all(selected.map(async (file) => ({ name: file.name, text: await file.text() })));
    workerRef.current.postMessage({ type: 'parseLogs', payload: { files: texts } });
  }

  const actors = useMemo(() => (result?.summary?.actors || []).map((actor) => ({
    ...actor,
    profession: inferProfession(actor),
    totalActions: actor.activeActionCount || 0,
    critRate: actor.hits + actor.crits > 0 ? (actor.crits / (actor.hits + actor.crits)) * 100 : 0,
    biggestAbilityHit: Math.max(0, ...(actor.abilities || []).map((ability) => ability.directDamage || 0)),
  })), [result]);

  const durationMinutes = useMemo(() => Math.max((result?.summary?.totalDurationSec || 0) / 60, 1 / 60), [result]);

  const topHealer = useMemo(() => actors.slice().sort((a, b) => b.healing - a.healing)[0] || null, [actors]);

  const chartData = useMemo(() => {
    const top = (items) => items.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 10);
    return {
      damageDone: top(actors.filter((a) => a.totalDamage > 0).map((a) => ({ name: a.name, profession: a.profession, value: a.totalDamage, label: formatNumber(a.totalDamage) }))),
      healingDone: top(actors.filter((a) => a.healing > 0).map((a) => ({ name: a.name, profession: a.profession, value: a.healing, label: formatNumber(a.healing) }))),
      damageTaken: top(actors.filter((a) => a.takenDamage > 0).map((a) => ({ name: a.name, profession: a.profession, value: a.takenDamage, label: formatNumber(a.takenDamage) }))),
      apm: top(actors.filter((a) => a.totalActions > 0).map((a) => {
        const apm = a.totalActions / durationMinutes;
        return { name: a.name, profession: a.profession, value: apm, label: formatRate(apm) };
      })),
      lootCredits: top((result?.summary?.looters || []).filter((a) => a.lootedCredits + a.sharedCredits > 0).map((a) => ({ name: a.name, profession: inferProfession(a), value: a.lootedCredits + a.sharedCredits, label: formatNumber(a.lootedCredits + a.sharedCredits) }))),
    };
  }, [actors, durationMinutes, result]);

  const professionLegend = useMemo(() => {
    const seen = new Map();
    actors.forEach((actor) => {
      if (!seen.has(actor.profession)) seen.set(actor.profession, professionColor(actor.profession));
    });
    return Array.from(seen.entries());
  }, [actors]);

  function exportLootCsv() {
    if (!result?.summary?.looters?.length) return;
    downloadCsv(
      'loot_breakdown.csv',
      ['Actor', 'Looted Credits', 'Shared Credits', 'Split Credits', 'Loot Items', 'Top Items'],
      result.summary.looters.map((actor) => [
        actor.name,
        actor.lootedCredits,
        actor.sharedCredits,
        actor.splitCredits,
        actor.lootItems,
        (actor.items || []).slice(0, 5).map((item) => `${item.name} x${item.count}`).join(' | '),
      ]),
    );
  }

  return (
    <div className="mx-auto max-w-[95rem] animate-slide-up space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-4 py-2 text-xs font-display uppercase tracking-[0.25em] text-hull-200">
            <ScrollText size={14} className="text-plasma-400" />
            Log Parser
          </div>
          <h1 className="mb-2 font-display text-3xl font-bold tracking-wider text-hull-50">SWG Log Parser</h1>
          <p className="max-w-3xl text-hull-200">
            Combat is only part of the story. This parser summarizes combat, loot, quest/progression, and system notices from uploaded SWG logs, with per-character breakdowns where the logs support them.
          </p>
        </div>

        <label className="card min-w-[18rem] cursor-pointer px-4 py-4 transition-colors hover:border-plasma-400/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-plasma-400/30 bg-plasma-500/10">
              <Upload size={18} className="text-plasma-300" />
            </div>
            <div>
              <div className="text-sm font-medium text-hull-50">Upload log files</div>
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
          <div className="text-xl font-display text-hull-50">Drop in one or more SWG logs</div>
          <p className="mx-auto max-w-2xl text-hull-200">
            Parses combat lines, healing, DoTs, performs, loot credits, loot items, quest receipts, ability unlocks, and common loot/system notices from the uploaded logs.
          </p>
        </div>
      ) : null}

      {parsing ? (
        <div className="card p-8 text-center text-hull-200">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-plasma-500 border-t-transparent" />
          Parsing logs. Because apparently the galaxy needed a second layer of bureaucracy.
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <StatCard icon={Activity} label="Parsed Events" value={formatNumber(result.summary.totalEvents)} hint={`${formatNumber(result.summary.combatEventCount)} combat · ${formatNumber(result.summary.logEventCount)} log`} />
            <StatCard icon={Axe} label="Total Damage" value={formatNumber(result.summary.totalDamage)} hint={`${formatNumber(result.summary.directDamage)} direct · ${formatNumber(result.summary.dotDamage)} DoT`} />
            <StatCard icon={HeartPulse} label="Healing" value={formatNumber(result.summary.totalHealing)} hint={`${formatDuration(result.summary.totalDurationSec)} total duration`} />
            <StatCard icon={Coins} label="Loot Credits" value={formatNumber(result.summary.totalLootedCredits + result.summary.totalSharedCredits)} hint={`${formatNumber(result.summary.totalLootedCredits)} looted · ${formatNumber(result.summary.totalSharedCredits)} shared`} />
            <StatCard icon={Gem} label="Loot Items" value={formatNumber(result.summary.totalLootItems)} hint={`${formatNumber(result.summary.uniqueLootItems)} unique items`} />
            <StatCard icon={Swords} label="Encounters" value={result.summary.encounterCount} hint={`${result.summary.actorCount} actors seen`} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <StatCard icon={Sparkles} label="Quests / Unlocks" value={formatNumber(result.summary.questCount + result.summary.abilityUnlockCount)} hint={`${result.summary.questCount} quests · ${result.summary.abilityUnlockCount} unlocks`} />
            <StatCard icon={Shield} label="Loot Notices" value={formatNumber(result.summary.lootNoticeCount)} hint={`${result.summary.systemNoticeCount} other system notices`} />
            <StatCard icon={BarChart3} label="Top Healer" value={topHealer?.name || '—'} hint={topHealer ? formatNumber(topHealer.healing) : ''} />
            <StatCard icon={BarChart3} label="Unique Abilities" value={formatNumber(new Set(actors.flatMap((a) => (a.abilities || []).map((b) => b.name))).size)} />
            <StatCard icon={BarChart3} label="Biggest Hit" value={formatNumber(Math.max(0, ...actors.map((a) => a.biggestAbilityHit || 0)))} />
            <StatCard icon={BarChart3} label="Avg APM" value={formatRate(actors.length ? actors.reduce((sum, a) => sum + (a.totalActions / durationMinutes), 0) / actors.length : 0)} hint="Attack / heal / perform actions" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartPanel title="Damage Done by Source" subtitle="Top overall combat output" items={chartData.damageDone} />
            <ChartPanel title="Healing Done by Source" subtitle="Top overall healing output" items={chartData.healingDone} />
            <ChartPanel title="Damage Taken by Source" subtitle="Incoming damage sustained" items={chartData.damageTaken} />
            <ChartPanel title="Actions per Minute" subtitle="Player-triggered combat actions only" items={chartData.apm} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="card p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">Loot Overview</div>
                  <div className="mt-1 text-xs text-hull-400">Credits and item looting parsed from chat/system lines.</div>
                </div>
                <button type="button" onClick={exportLootCsv} className="btn-ghost">
                  <Download size={15} /> Export loot CSV
                </button>
              </div>
              <ChartPanel title="Loot Credits by Character" subtitle="Looted + shared credits" items={chartData.lootCredits} />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4">
                  <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">Loot by Character</div>
                  <div className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                    {(result.summary.looters || []).map((actor) => (
                      <div key={actor.name} className="rounded-xl border border-hull-400/30 bg-hull-800/60 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm text-hull-50">{actor.name}</div>
                            <div className="text-xs text-hull-300">{formatNumber(actor.lootedCredits)} looted · {formatNumber(actor.sharedCredits)} shared · {actor.lootItems} items</div>
                          </div>
                          <div className="text-right text-xs text-hull-200">{actor.items?.length || 0} unique</div>
                        </div>
                        {actor.items?.length ? <div className="mt-2 break-words text-xs text-hull-300">{actor.items.slice(0, 6).map((item) => `${item.name} x${item.count}`).join(' · ')}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4">
                  <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">Recent Loot / Log Notices</div>
                  <div className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                    {(result.summary.recentLoot || []).map((event, index) => (
                      <div key={`${event.timestamp}-${event.raw}-${index}`} className="rounded-xl border border-hull-400/30 bg-hull-800/60 px-3 py-2.5 text-xs text-hull-200">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-hull-100">{event.actor || 'System'}{event.item ? ` · ${event.item}` : event.ability ? ` · ${event.ability}` : ''}</div>
                          <div className="text-hull-400">{event.timestamp}</div>
                        </div>
                        <div className="mt-1 break-words text-hull-300">{event.raw}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
                    <BarChart3 size={14} className="text-plasma-400" /> Profession Color Legend
                  </div>
                  <div className="mt-1 text-sm text-hull-200">Colors are inferred from observed abilities and used for the overview bars.</div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-hull-200">
                  {professionLegend.map(([profession, color]) => (
                    <span key={profession} className="inline-flex items-center gap-2 rounded-full border border-hull-400/30 bg-hull-800/50 px-3 py-1">
                      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                      {profession}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4">
                <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">What counts as APM here</div>
                <div className="mt-2 text-sm text-hull-200">Attacks, heals, performs, and explicit utility actions like free shots or bacta infusions. Passive DoT ticks and simple gain messages are excluded so the rate does not drift upward from follow-on log lines.</div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
