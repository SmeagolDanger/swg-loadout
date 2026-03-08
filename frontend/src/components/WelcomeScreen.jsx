import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Crosshair, Trophy, ArrowRight, Wrench, Orbit, Flag, Music4 } from 'lucide-react';

const ENTRY_CARDS = [
  {
    to: '/tools',
    title: 'Space Tools',
    subtitle: 'Build loadouts, compare components, check loot tables, and use the core space calculators in one place.',
    icon: Crosshair,
    accent: 'text-plasma-400',
    border: 'border-plasma-500/40',
    glow: 'hover:shadow-glow hover:border-plasma-500/60',
    chips: ['Builder', 'Calculators', 'Community'],
  },
  {
    to: '/tools/buildouts',
    title: 'Buildout Maps',
    subtitle: 'Browse SWG space buildout tabs, inspect patrol paths, and copy waypoint strings from an interactive map.',
    icon: Orbit,
    accent: 'text-cyan-300',
    border: 'border-cyan-400/30',
    glow: 'hover:border-cyan-400/50 hover:shadow-[0_0_24px_rgba(34,211,238,0.18)]',
    chips: ['Zones', 'Spawners', 'Waypoints'],
  },
  {
    to: '/collections',
    title: 'Collections',
    subtitle: 'Track badges, characters, leaderboard progress, and collection completion across your roster.',
    icon: Trophy,
    accent: 'text-laser-yellow',
    border: 'border-laser-yellow/30',
    glow: 'hover:border-laser-yellow/50 hover:shadow-[0_0_24px_rgba(255,214,10,0.15)]',
    chips: ['Tracker', 'Characters', 'Leaderboard'],
  },
  {
    to: '/tools/gcw',
    title: 'GCW Calculator',
    subtitle: 'Estimate next-week faction rank, review decay breakpoints, and plan around weekly GCW point totals.',
    icon: Flag,
    accent: 'text-laser-yellow',
    border: 'border-laser-yellow/30',
    glow: 'hover:border-laser-yellow/50 hover:shadow-[0_0_24px_rgba(255,214,10,0.15)]',
    chips: ['Empire', 'Rebel', 'Decay', 'Ranks'],
  },
  {
    to: '/tools/ent-buffs',
    title: 'Ent Buff Builder',
    subtitle: 'Assemble entertainer buff packages, stay within the point cap, and generate a ready-to-send request message.',
    icon: Music4,
    accent: 'text-fuchsia-300',
    border: 'border-fuchsia-400/30',
    glow: 'hover:border-fuchsia-400/50 hover:shadow-[0_0_24px_rgba(232,121,249,0.18)]',
    chips: ['Buffs', 'Requests', 'Share Links'],
  },
];

function cardPlacement(index) {
  if (index === 3) return 'xl:col-start-2';
  if (index === 4) return 'xl:col-start-4';
  return '';
}

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16 animate-slide-up relative">
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-4 py-2 text-xs font-display tracking-[0.25em] text-hull-200 uppercase mb-5">
            <Wrench size={14} className="text-plasma-400" />
            Choose a Section
          </div>
          <h1 className="font-display font-bold text-3xl md:text-5xl tracking-wider text-hull-50 mb-4">
            SWG:L <span className="text-plasma-400">COMMAND DECK</span>
          </h1>
          <p className="text-hull-200 text-sm md:text-base leading-relaxed">
            Open the toolset you need and jump straight into it.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-6 gap-6">
          {ENTRY_CARDS.map((card, index) => (
            <Link
              key={card.to}
              to={card.to}
              className={`group card p-6 md:p-8 border ${card.border} ${card.glow} transition-all duration-200 min-h-[18.5rem] flex flex-col justify-between xl:col-span-2 ${cardPlacement(index)}`}
            >
              <div>
                <div className={`w-14 h-14 rounded-2xl bg-hull-800 border ${card.border} flex items-center justify-center mb-6`}>
                  <card.icon size={28} className={card.accent} />
                </div>
                <h2 className="font-display font-bold text-2xl tracking-wider text-hull-50 mb-3">
                  {card.title}
                </h2>
                <p className="text-hull-200 leading-relaxed mb-6">
                  {card.subtitle}
                </p>
                <div className="flex flex-wrap gap-2">
                  {card.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-hull-500/50 bg-hull-800/70 px-3 py-1 text-xs font-display tracking-wide text-hull-200"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <span className="font-display text-sm tracking-[0.2em] uppercase text-hull-300">Open Tool</span>
                <div className="inline-flex items-center gap-2 btn-primary group-hover:translate-x-1 transition-transform duration-200">
                  Launch <ArrowRight size={16} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
