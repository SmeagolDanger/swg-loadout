import React from 'react';
import { Link } from 'react-router-dom';
import { Crosshair, Trophy, ArrowRight, Wrench, Users } from 'lucide-react';

const ENTRY_CARDS = [
  {
    to: '/tools',
    title: 'Space Tools',
    subtitle: 'Builders, calculators, loot, and the usual glorious spreadsheet-adjacent obsession.',
    icon: Crosshair,
    accent: 'text-plasma-400',
    border: 'border-plasma-500/40',
    glow: 'hover:shadow-glow hover:border-plasma-500/60',
    chips: ['Builder', 'Calculators', 'Community'],
  },
  {
    to: '/collections',
    title: 'Collections',
    subtitle: 'Track badges, characters, leaderboard progress, and other completionist rituals.',
    icon: Trophy,
    accent: 'text-laser-yellow',
    border: 'border-laser-yellow/30',
    glow: 'hover:border-laser-yellow/50 hover:shadow-[0_0_24px_rgba(255,214,10,0.15)]',
    chips: ['Tracker', 'Characters', 'Leaderboard'],
  },
];

export default function WelcomeScreen() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,214,10,0.10),transparent_30%)] pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16 animate-slide-up relative">
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-4 py-2 text-xs font-display tracking-[0.25em] text-hull-200 uppercase mb-5">
            <Wrench size={14} className="text-plasma-400" />
            Choose Your Interface
          </div>
          <h1 className="font-display font-bold text-3xl md:text-5xl tracking-wider text-hull-50 mb-4">
            SWG:L <span className="text-plasma-400">COMMAND DECK</span>
          </h1>
          <p className="text-hull-200 text-sm md:text-base leading-relaxed">
            Start in the section you actually want instead of cramming every tool into one header like a garage drawer full of mystery screws.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {ENTRY_CARDS.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className={`group card p-6 md:p-8 border ${card.border} ${card.glow} transition-all duration-200 min-h-[19rem] flex flex-col justify-between`}
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
                <span className="font-display text-sm tracking-[0.2em] uppercase text-hull-300">Enter Section</span>
                <div className="inline-flex items-center gap-2 btn-primary group-hover:translate-x-1 transition-transform duration-200">
                  Open <ArrowRight size={16} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <div className="card p-4 flex items-start gap-3">
            <Crosshair size={18} className="text-plasma-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-display text-sm tracking-wider text-hull-50">Focused tools view</h3>
              <p className="text-hull-300 text-sm">Loadout tools only show loadout navigation. Less header soup, fewer crimes against spacing.</p>
            </div>
          </div>
          <div className="card p-4 flex items-start gap-3">
            <Users size={18} className="text-laser-yellow mt-0.5 shrink-0" />
            <div>
              <h3 className="font-display text-sm tracking-wider text-hull-50">Focused collections view</h3>
              <p className="text-hull-300 text-sm">Collections pages keep their own navigation grouped together instead of elbowing calculators in the ribs.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
