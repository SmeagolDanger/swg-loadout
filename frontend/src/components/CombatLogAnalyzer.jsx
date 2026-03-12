import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Axe,
  BarChart3,
  Coins,
  Download,
  FileUp,
  HeartPulse,
  ScrollText,
  Swords,
  Upload,
  Users,
} from 'lucide-react';

const PROFESSION_OPTIONS = [
  'Commando',
  'Bounty Hunter',
  'Officer',
  'Spy',
  'Medic',
  'Smuggler',
  'Entertainer',
  'Jedi',
  'Trader',
  'Unknown',
];

const PROFESSION_COLORS = {
  Commando: 'bg-orange-500',
  'Bounty Hunter': 'bg-rose-500',
  Officer: 'bg-lime-400',
  Spy: 'bg-yellow-300',
  Medic: 'bg-violet-400',
  Smuggler: 'bg-pink-400',
  Entertainer: 'bg-cyan-400',
  Jedi: 'bg-sky-400',
  Trader: 'bg-slate-400',
  Unknown: 'bg-hull-400',
};

const PROFESSION_NAME_OVERRIDES_DEFAULT = {
  Dexeridix: 'Commando',
  ChickenRat: 'Bounty Hunter',
};

const PROFESSION_ABILITY_MAP = {
  Commando: [
    'commando area cold',
    'focused beam',
    'lethal beam',
    'riddle armor',
    'suppressing fire',
    'acid beam',
    'flame cone',
    'plasma grenade',
    'rocket',
  ],
  'Bounty Hunter': [
    'eye shot',
    'leg shot',
    'torso shot',
    'head shot',
    'body shot',
    'missile',
    'flamethrower',
    'sniper shot',
    'carbine burst',
  ],
  Officer: ['focus fire', 'called shot', 'cover', 'fire maneuver', 'tactical superiority'],
  Spy: ['ambush', 'feign death', 'vital strike', 'puncture', 'shrapnel', 'cloak'],
  Medic: ['bacta', 'heal', 'revive', 'resuscitate', 'diagnosis', 'stim'],
  Smuggler: ['lucky shot', 'dirty trick', 'low blow', 'pistol whip', 'disarming shot'],
  Entertainer: ['favor of the elders', 'inspire', 'flourish', 'dance', 'music', 'perform'],
  Jedi: ['force', 'lightsaber', 'saber throw', 'force lightning', 'force choke'],
  Trader: ['assembly', 'experimentation', 'sampling', 'crafting'],
};

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

function formatPercent(value) {
  return `${(value || 0).toFixed(1)}%`;
}

function professionColorClass(profession) {
  return PROFESSION_COLORS[profession] || PROFESSION_COLORS.Unknown;
}

function inferProfessionFromAbilities(abilities = []) {
  const scores = Object.fromEntries(PROFESSION_OPTIONS.map((profession) => [profession, 0]));
  const normalized = abilities
    .filter(Boolean)
    .map((entry) => (typeof entry === 'string' ? entry : entry.name || ''))
    .map((name) => String(name).toLowerCase());

  for (const [profession, patterns] of Object.entries(PROFESSION_ABILITY_MAP)) {
    for (const ability of normalized) {
      for (const pattern of patterns) {
        if (ability.includes(pattern)) scores[profession] += 3;
      }
    }
  }

  const ranked = Object.entries(scores)
    .filter(([profession]) => profession !== 'Unknown')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (!ranked.length || ranked[0][1] <= 0) return 'Unknown';
  return ranked[0][0];
}

function resolveProfession(actor, overrides) {
  return overrides[actor.name] || inferProfessionFromAbilities(actor.abilities || []);
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

function ChartPanel({ title, subtitle, items }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="card p-4">
      <div className="mb-4">
        <div className="text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-hull-400">{subtitle}</div> : null}
      </div>
      <div className="space-y-2">
        {items.length ? (
          items.map((item) => (
            <div key={item.name} className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_5.5rem] items-center gap-3">
              <div className="truncate text-sm text-hull-100">{item.name}</div>
              <div className="min-w-0">
                <div className="h-2.5 overflow-hidden rounded-full bg-hull-800/80">
                  <div
                    className={`h-full rounded-full ${professionColorClass(item.profession)}`}
                    style={{ width: `${Math.max(3, (item.value / maxValue) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-right text-xs text-hull-200">{item.label}</div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-4 text-sm text-hull-300">No data yet.</div>
        )}
      </div>
    </div>
  );
}

function ProfessionConfig({ actors, overrides, setOverrides }) {
  const [open, setOpen] = useState(false);

  const sortedActors = useMemo(() => [...actors].sort((a, b) => a.name.localeCompare(b.name)), [actors]);

  function setOverride(name, profession) {
    setOverrides((current) => {
      const next = { ...current };
      if (!profession || profession === 'Auto') delete next[name];
      else next[name] = profession;
      return next;
    });
  }

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-display uppercase tracking-[0.16em] text-hull-300">
            <BarChart3 size={14} className="text-plasma-400" /> Profession Color Legend
          </div>
          <div className="mt-1 text-sm text-hull-200">Colors are inferred from observed abilities. Override any actor if the parser guesses wrong.</div>
        </div>
        <button type="button" className="btn-ghost self-start lg:self-center" onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide profession config' : 'Configure professions'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-hull-200">
        {PROFESSION_OPTIONS.map((profession) => (
          <span key={profession} className="inline-flex items-center gap-2 rounded-full border border-hull-400/30 bg-hull-800/50 px-3 py-1">
            <span className={`h-2.5 w-2.5 rounded-full ${professionColorClass(profession)}`} />
            {profession}
          </span>
        ))}
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedActors.map((actor) => (
            <label key={actor.name} className="rounded-2xl border border-hull-400/30 bg-hull-800/50 p-3">
              <div className="mb-2 text-sm font-medium text-hull-100">{actor.name}</div>
              <select
                className="w-full rounded-xl border border-hull-400/40 bg-hull-900/80 px-3 py-2 text-sm text-hull-50"
                value={overrides[actor.name] || 'Auto'}
                onChange={(event) => setOverride(actor.name, event.target.value)}
              >
                <option value="Auto">Auto</option>
                {PROFESSION_OPTIONS.filter((value) => value !== 'Unknown').map((profession) => (
                  <option key={profession} value={profession}>
                    {profession}
                  </option>
                ))}
                <option value="Unknown">Unknown</option>
              </select>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CombatLogAnalyzer() {
  const workerRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [professionOverrides, setProfessionOverrides] = useState(() => {
    try {
      return {
        ...PROFESSION_NAME_OVERRIDES_DEFAULT,
        ...(JSON.parse(window.localStorage.getItem('swg-log-profession-overrides') || '{}')),
      };
    } catch {
      return { ...PROFESSION_NAME_OVERRIDES_DEFAULT };
    }
  });

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

  useEffect(() => {
    window.localStorage.setItem('swg-log-profession-overrides', JSON.stringify(professionOverrides));
  }, [professionOverrides]);

  const dashboardActors = useMemo(() => {
    return (result?.summary?.actors || []).map((actor) => {
      const profession = resolveProfession(actor, professionOverrides);
      const totalActions = actor.actionCount || actor.abilities?.reduce((sum, ability) => sum + (ability.uses || 0), 0) || 0;
      return { ...actor, profession, totalActions };
    });
  }, [result, professionOverrides]);

  const totalDurationSeconds = result?.summary?.totalDurationSec || 0;
  const dashboardDurationMinutes = Math.max(totalDurationSeconds / 60, 1 / 60);
  const allEvents = useMemo(() => result?.encounters?.flatMap((encounter) => encounter.events || []) || [], [result]);

  const overviewMetrics = useMemo(() => {
    const crits = dashboardActors.reduce((sum, actor) => sum + (actor.crits || 0), 0);
    const misses = dashboardActors.reduce((sum, actor) => sum + (actor.misses || 0), 0);
    const glances = dashboardActors.reduce((sum, actor) => sum + (actor.glances || 0), 0);
    const totalActions = dashboardActors.reduce((sum, actor) => sum + (actor.totalActions || 0), 0);
    const supportActions = dashboardActors.reduce((sum, actor) => sum + (actor.performs || 0) + (actor.utility || 0), 0);
    const uniqueAbilities = new Set(dashboardActors.flatMap((actor) => (actor.abilities || []).map((ability) => ability.name))).size;
    const biggestHit = allEvents.reduce((max, event) => Math.max(max, event.amount || 0), 0);
    const topDamageActor = [...dashboardActors].sort((a, b) => b.totalDamage - a.totalDamage)[0];
    const topHealActor = [...dashboardActors].sort((a, b) => b.healing - a.healing)[0];
    const critRate = totalActions > 0 ? (crits / totalActions) * 100 : 0;
    const apm = totalActions / dashboardDurationMinutes;

    return {
      crits,
      misses,
      glances,
      supportActions,
      uniqueAbilities,
      biggestHit,
      topDamageActor,
      topHealActor,
      critRate,
      apm,
    };
  }, [dashboardActors, allEvents, dashboardDurationMinutes]);

  const chartData = useMemo(() => {
    const top = (items) => [...items].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 10);
    return {
      damageDone: top(
        dashboardActors
          .filter((actor) => actor.totalDamage > 0)
          .map((actor) => ({ name: actor.name, profession: actor.profession, value: actor.totalDamage, label: formatNumber(actor.totalDamage) })),
      ),
      healingDone: top(
        dashboardActors
          .filter((actor) => actor.healing > 0)
          .map((actor) => ({ name: actor.name, profession: actor.profession, value: actor.healing, label: formatNumber(actor.healing) })),
      ),
      damageTaken: top(
        dashboardActors
          .filter((actor) => (actor.takenDamage || 0) > 0)
          .map((actor) => ({ name: actor.name, profession: actor.profession, value: actor.takenDamage || 0, label: formatNumber(actor.takenDamage || 0) })),
      ),
      apm: top(
        dashboardActors
          .filter((actor) => actor.totalActions > 0)
          .map((actor) => {
            const apm = actor.totalActions / dashboardDurationMinutes;
            return { name: actor.name, profession: actor.profession, value: apm, label: formatRate(apm) };
          }),
      ),
    };
  }, [dashboardActors, dashboardDurationMinutes]);

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

  function exportOverviewCsv() {
    if (!dashboardActors.length) return;
    downloadCsv(
      'combat_log_overview.csv',
      ['Actor', 'Profession', 'Damage', 'DoT', 'Healing', 'Damage Taken', 'Crits', 'Misses', 'Actions'],
      dashboardActors.map((actor) => [
        actor.name,
        actor.profession,
        actor.totalDamage,
        actor.dotDamage,
        actor.healing,
        actor.takenDamage || 0,
        actor.crits || 0,
        actor.misses || 0,
        actor.totalActions || 0,
      ]),
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
            Load one or more SWG combat logs for an immediate overview of damage, healing, incoming damage, and activity. The low-value lower sections are gone so the useful part actually gets the screen.
          </p>
        </div>

        <div className="flex gap-3">
          {dashboardActors.length ? (
            <button type="button" onClick={exportOverviewCsv} className="btn-ghost self-start xl:self-center">
              <Download size={15} /> Export overview CSV
            </button>
          ) : null}
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
      </div>

      {error ? <div className="rounded-2xl border border-laser-red/40 bg-laser-red/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

      {!files.length ? (
        <div className="card space-y-3 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-hull-400/40 bg-hull-800/70">
            <FileUp size={24} className="text-plasma-400" />
          </div>
          <div className="text-xl font-display text-hull-50">Drop in one or more chat logs</div>
          <p className="mx-auto max-w-2xl text-hull-200">
            This opens straight into the overview dashboard. Because making roster management look like the whole product was a bad idea, and now we are all pretending to be surprised.
          </p>
        </div>
      ) : null}

      {parsing ? (
        <div className="card p-8 text-center text-hull-200">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-plasma-500 border-t-transparent" />
          Parsing combat logs…
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <StatCard icon={Activity} label="Events" value={formatNumber(result.summary.totalEvents)} />
            <StatCard icon={Axe} label="Total Damage" value={formatNumber(result.summary.totalDamage)} hint={`${formatNumber(result.summary.directDamage)} direct · ${formatNumber(result.summary.dotDamage)} DoT`} />
            <StatCard icon={HeartPulse} label="Healing" value={formatNumber(result.summary.totalHealing)} hint={`${formatNumber(overviewMetrics.supportActions)} support actions observed`} />
            <StatCard icon={Coins} label="Credits" value={formatNumber(result.summary.totalSharedCredits + result.summary.totalLootedCredits)} hint={`${formatNumber(result.summary.totalSharedCredits)} shared · ${formatNumber(result.summary.totalLootedCredits)} looted`} />
            <StatCard icon={Swords} label="Encounters" value={result.summary.encounterCount} hint={`${result.summary.actorCount} actors seen · ${formatDuration(totalDurationSeconds)}`} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <StatCard icon={Activity} label="Crit Rate" value={formatPercent(overviewMetrics.critRate)} hint={`${formatNumber(overviewMetrics.crits)} crits · ${formatNumber(overviewMetrics.misses)} misses`} />
            <StatCard icon={BarChart3} label="Average APM" value={formatRate(overviewMetrics.apm)} hint={`${formatNumber(overviewMetrics.glances)} glances`} />
            <StatCard icon={Axe} label="Biggest Hit" value={formatNumber(overviewMetrics.biggestHit)} hint={overviewMetrics.topDamageActor ? `${overviewMetrics.topDamageActor.name} top damage` : 'No damage events'} />
            <StatCard icon={HeartPulse} label="Top Healer" value={overviewMetrics.topHealActor ? overviewMetrics.topHealActor.name : '—'} hint={overviewMetrics.topHealActor ? `${formatNumber(overviewMetrics.topHealActor.healing)} healing` : 'No healing events'} />
            <StatCard icon={Users} label="Unique Abilities" value={formatNumber(overviewMetrics.uniqueAbilities)} hint={`${result.summary.actorCount} total actors`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartPanel title="Damage Done by Source" subtitle="Top overall combat output" items={chartData.damageDone} />
            <ChartPanel title="Healing Done by Source" subtitle="Top overall healing output" items={chartData.healingDone} />
            <ChartPanel title="Damage Taken by Source" subtitle="Incoming damage sustained" items={chartData.damageTaken} />
            <ChartPanel title="Actions per Minute" subtitle="All counted attacks, heals, performs, and utility actions" items={chartData.apm} />
          </div>

          <ProfessionConfig actors={dashboardActors} overrides={professionOverrides} setOverrides={setProfessionOverrides} />
        </>
      ) : null}
    </div>
  );
}
