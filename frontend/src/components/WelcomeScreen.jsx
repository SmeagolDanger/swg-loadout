import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useModuleConfig } from '../context/ModuleConfigContext';
import { Crosshair, Download, Flag, Music4, Orbit, Sparkles, Trophy, Users, Wrench } from 'lucide-react';

const ROW_THEMES = {
  top: {
    accent: 'text-cyan-300',
    border: 'border-cyan-400/30',
    glow: 'hover:border-cyan-400/50 hover:shadow-[0_0_24px_rgba(34,211,238,0.18)]',
  },
  middle: {
    accent: 'text-fuchsia-300',
    border: 'border-fuchsia-400/30',
    glow: 'hover:border-fuchsia-400/50 hover:shadow-[0_0_24px_rgba(232,121,249,0.18)]',
  },
  bottom: {
    accent: 'text-laser-yellow',
    border: 'border-laser-yellow/30',
    glow: 'hover:border-laser-yellow/50 hover:shadow-[0_0_24px_rgba(255,214,10,0.15)]',
  },
};

const ENTRY_ROWS = [
  {
    key: 'top',
    cards: [
      {
        to: '/tools',
        moduleKey: 'tools',
        title: 'Space Tools',
        subtitle: 'Builders, calculators, loot, and other practical shipyard tools.',
        icon: Crosshair,
        chips: ['Builder', 'Calculators', 'Community'],
      },
      {
        to: '/tools/buildouts',
        moduleKey: 'buildouts',
        title: 'Buildout Maps',
        subtitle: 'Parse SWG space buildout tabs, inspect patrol paths, and copy waypoint strings.',
        icon: Orbit,
        chips: ['Zones', 'Spawners', 'Waypoints'],
      },
      {
        to: '/tools/gcw',
        moduleKey: 'gcw',
        title: 'GCW Calculator',
        subtitle: 'Project next-week faction rank, inspect decay breakpoints, and verify the math.',
        icon: Flag,
        chips: ['Empire', 'Rebel', 'Decay', 'Ranks'],
      },
    ],
  },
  {
    key: 'middle',
    cards: [
      {
        to: '/tools/ent-buffs',
        moduleKey: 'ent',
        title: 'Ent Buffs',
        subtitle: 'Plan entertainer buff packages, stay inside the cap, and copy a ready-to-send request.',
        icon: Music4,
        chips: ['20 Points', 'Request Text', 'Share Link'],
      },
      {
        to: '/tools/starters',
        moduleKey: 'nav:/tools/starters',
        title: 'Starter Builds',
        subtitle: 'Browse curated starter ship setups and load them into the builder cleanly.',
        icon: Sparkles,
        chips: ['Curated', 'Beginner', 'Templates'],
      },
      {
        to: '/tools/community',
        moduleKey: 'nav:/tools/community',
        title: 'Community Builds',
        subtitle: 'Browse public player builds, inspect their parts, and copy the ones worth remixing.',
        icon: Users,
        chips: ['Public', 'Shared', 'Remix'],
      },
    ],
  },
  {
    key: 'bottom',
    cards: [
      {
        to: '/mods',
        moduleKey: 'mods',
        title: 'Game Mods',
        subtitle: 'Browse curated downloads with screenshots, install notes, and bundled zip packages.',
        icon: Download,
        chips: ['Curated', 'Screenshots', 'Downloads'],
      },
      {
        to: '/collections',
        moduleKey: 'collections',
        title: 'Collections',
        subtitle: 'Track badges, characters, leaderboard progress, and other completion goals.',
        icon: Trophy,
        chips: ['Tracker', 'Characters', 'Leaderboard'],
      },
    ],
  },
];

function WelcomeCard({ card, theme }) {
  return (
    <Link
      to={card.to}
      className={`group card border ${theme.border} ${theme.glow} transition-all duration-200 px-5 py-5 md:px-6 md:py-6 min-h-[13.25rem] flex flex-col justify-between`}
    >
      <div>
        <div className={`w-10 h-10 rounded-xl bg-hull-800 border ${theme.border} flex items-center justify-center mb-4`}>
          <card.icon size={20} className={theme.accent} />
        </div>
        <h2 className="font-display font-bold text-[1.75rem] leading-none tracking-wider text-hull-50 mb-3">
          {card.title}
        </h2>
        <p className="text-hull-200 text-sm leading-6 mb-4 max-w-[32rem]">
          {card.subtitle}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {card.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-hull-500/50 bg-hull-800/70 px-2.5 py-1 text-[10px] font-display tracking-wide text-hull-200"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isEnabled } = useModuleConfig();

  const loadoutId = searchParams.get('loadout');

  useEffect(() => {
    if (loadoutId) {
      navigate(`/tools?loadout=${loadoutId}`, { replace: true });
    }
  }, [loadoutId, navigate]);

  if (loadoutId) return null;

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,214,10,0.10),transparent_30%)] pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 animate-slide-up relative">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-4 py-2 text-xs font-display tracking-[0.25em] text-hull-200 uppercase mb-4">
            <Wrench size={14} className="text-plasma-400" />
            Choose Your Interface
          </div>
          <h1 className="font-display font-bold text-3xl md:text-5xl tracking-wider text-hull-50 mb-3">
            SWG:L <span className="text-plasma-400">COMMAND DECK</span>
          </h1>
          <p className="text-hull-200 text-sm md:text-base leading-relaxed">Choose where to start.</p>
        </div>

        <div className="space-y-5 md:space-y-6">
          {ENTRY_ROWS.map((row) => {
            const theme = ROW_THEMES[row.key];
            const visibleCards = row.cards.filter((card) => isEnabled(card.moduleKey));
            if (!visibleCards.length) return null;
            const count = visibleCards.length;
            const rowClasses =
              count === 1
                ? 'max-w-md mx-auto'
                : count === 2
                  ? 'max-w-4xl mx-auto grid md:grid-cols-2 gap-5 md:gap-6'
                  : 'grid md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6';

            return (
              <div key={row.key} className={rowClasses}>
                {visibleCards.map((card) => (
                  <WelcomeCard key={card.to} card={card} theme={theme} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
