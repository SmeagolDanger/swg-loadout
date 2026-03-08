import React, { useMemo, useState } from 'react';
import { Calculator, ChevronRight, Flag, Info, Shield, TrendingDown, TrendingUp } from 'lucide-react';
import {
  GCW_DECAY_ESTIMATES,
  GCW_RANKS,
  getFactionRankTitle,
  predictGCWRank,
} from '../utils/gcwCalculator';

const QUICK_POINTS = [0, 2500, 5000, 6001, 6500, 7202, 10000, 12002];

function StatCard({ label, value, hint, tone = 'neutral' }) {
  const toneClass = {
    good: 'text-green-300 border-green-400/30 bg-green-500/10',
    warn: 'text-laser-yellow border-laser-yellow/30 bg-laser-yellow/10',
    bad: 'text-laser-red border-laser-red/30 bg-laser-red/10',
    neutral: 'text-plasma-200 border-hull-400/40 bg-hull-800/60',
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] font-display tracking-[0.18em] uppercase opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-display text-hull-50">{value}</div>
      {hint ? <div className="mt-1 text-xs text-hull-300">{hint}</div> : null}
    </div>
  );
}

export default function GCWCalculator() {
  const [faction, setFaction] = useState('imperial');
  const [rankNumber, setRankNumber] = useState(7);
  const [rankPercent, setRankPercent] = useState('50');
  const [gcwPoints, setGcwPoints] = useState('6001');

  const prediction = useMemo(() => {
    try {
      return {
        data: predictGCWRank({ rankNumber, rankPercent, gcwPoints }),
        error: '',
      };
    } catch (error) {
      return {
        data: null,
        error: error.message || 'Prediction failed',
      };
    }
  }, [gcwPoints, rankNumber, rankPercent]);

  const selectedRank = GCW_RANKS.find((rank) => rank.Rank === Number(rankNumber)) || GCW_RANKS[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-slide-up">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-4 py-2 text-xs font-display tracking-[0.25em] text-hull-200 uppercase mb-4">
            <Flag size={14} className="text-plasma-400" />
            Galactic Civil War Tools
          </div>
          <h1 className="font-display font-bold text-3xl tracking-wider text-hull-50 mb-2">
            GCW Rank Calculator
          </h1>
          <p className="text-hull-200 max-w-3xl">
            Recreated from the public GCW calculator source and restyled to match the SWG Loadouts interface.
          </p>
        </div>

        <div className="card px-4 py-3 min-w-[18rem]">
          <div className="text-[11px] font-display tracking-[0.18em] uppercase text-hull-300 mb-2">Quick weekly point presets</div>
          <div className="flex flex-wrap gap-2">
            {QUICK_POINTS.map((value) => (
              <button
                key={value}
                type="button"
                className="btn-ghost text-xs"
                onClick={() => setGcwPoints(String(value))}
              >
                {value.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {prediction.error ? (
        <div className="rounded-2xl border border-laser-red/40 bg-laser-red/10 px-4 py-3 text-sm text-red-100">
          {prediction.error}
        </div>
      ) : null}

      <div className="grid xl:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
        <aside className="space-y-4">
          <div className="card p-4 space-y-4">
            <div>
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400 mb-3">
                Inputs
              </h2>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setFaction('imperial')}
                  className={`btn-ghost justify-center ${faction === 'imperial' ? 'border-plasma-400/50 text-plasma-300 bg-plasma-500/10' : ''}`}
                >
                  <Shield size={16} /> Empire
                </button>
                <button
                  type="button"
                  onClick={() => setFaction('rebel')}
                  className={`btn-ghost justify-center ${faction === 'rebel' ? 'border-laser-yellow/50 text-laser-yellow bg-laser-yellow/10' : ''}`}
                >
                  <Flag size={16} /> Rebel
                </button>
              </div>

              <label className="text-xs text-hull-200 mb-2 block">Current rank</label>
              <select value={rankNumber} onChange={(event) => setRankNumber(Number(event.target.value))}>
                {GCW_RANKS.map((rank) => (
                  <option key={rank.Rank} value={rank.Rank}>
                    Rank {rank.Rank}: {getFactionRankTitle(rank, faction)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-hull-200 mb-2 block">Visible progress %</label>
                <div className="text-[11px] text-hull-300 mb-2">Matches the original calculator by using the whole-number portion only.</div>
                <input
                  type="number"
                  min="0"
                  max="99.99"
                  step="0.01"
                  value={rankPercent}
                  onChange={(event) => setRankPercent(event.target.value)}
                  placeholder="50"
                />
              </div>
              <div>
                <label className="text-xs text-hull-200 mb-2 block">Weekly GCW points</label>
                <input
                  type="number"
                  min="0"
                  max="10000000"
                  step="1"
                  value={gcwPoints}
                  onChange={(event) => setGcwPoints(event.target.value)}
                  placeholder="6001"
                />
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400 mb-3">
              Decay breakpoints
            </h2>
            <div className="space-y-2">
              {GCW_DECAY_ESTIMATES.map((entry) => {
                const rank = GCW_RANKS.find((item) => item.Rank === entry.rank);
                const active = entry.rank === selectedRank.Rank;
                return (
                  <div
                    key={entry.rank}
                    className={`rounded-xl border px-3 py-3 flex items-center justify-between gap-3 ${
                      active ? 'border-plasma-400/50 bg-plasma-500/10' : 'border-hull-400/40 bg-hull-800/60'
                    }`}
                  >
                    <div>
                      <div className="text-sm text-hull-50">{getFactionRankTitle(rank, faction)}</div>
                      <div className="text-xs text-hull-300">Rank {entry.rank}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg text-hull-50">{entry.value.toLocaleString()}</div>
                      <div className="text-[11px] text-hull-300 uppercase tracking-wide">points to offset</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="space-y-4 min-w-0">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Current rating"
              value={prediction.data ? prediction.data.currentRating.toLocaleString() : '—'}
              hint={`${getFactionRankTitle(selectedRank, faction)} estimated from visible progress`}
            />
            <StatCard
              label="Rating change"
              value={prediction.data ? `${prediction.data.finalRatingAdjustment >= 0 ? '+' : ''}${prediction.data.finalRatingAdjustment.toLocaleString()}` : '—'}
              hint={prediction.data ? `After decay and cap rules` : ''}
              tone={prediction.data?.finalRatingAdjustment > 0 ? 'good' : prediction.data?.finalRatingAdjustment < 0 ? 'bad' : 'neutral'}
            />
            <StatCard
              label="Next rating"
              value={prediction.data ? prediction.data.nextRating.toLocaleString() : '—'}
              hint={prediction.data ? `Rank ${prediction.data.nextRank.Rank} next Saturday` : ''}
              tone="warn"
            />
            <StatCard
              label="Next rank"
              value={prediction.data ? getFactionRankTitle(prediction.data.nextRank, faction) : '—'}
              hint={prediction.data ? `${prediction.data.nextPercent.toFixed(2)}% into rank` : ''}
              tone="neutral"
            />
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={18} className="text-plasma-400" />
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400">
                Prediction breakdown
              </h2>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="rounded-2xl border border-hull-400/40 bg-hull-800/60 p-4">
                  <div className="flex items-center gap-2 text-hull-50 font-display tracking-wide mb-2">
                    <TrendingUp size={16} className="text-green-300" />
                    Earned rating before decay
                  </div>
                  <div className="text-2xl font-display text-hull-50">
                    {prediction.data ? prediction.data.totalEarnedRating.toLocaleString() : '—'}
                  </div>
                  <p className="text-sm text-hull-300 mt-2">
                    Matches the original calculator behavior, including truncating visible progress to a whole percent before prediction.
                  </p>
                </div>

                <div className="rounded-2xl border border-hull-400/40 bg-hull-800/60 p-4">
                  <div className="flex items-center gap-2 text-hull-50 font-display tracking-wide mb-2">
                    <TrendingDown size={16} className="text-laser-yellow" />
                    Decay handling
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-hull-300">Decay balance</div>
                      <div className="text-hull-50 font-display">{selectedRank.RatingDecayBalance.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-hull-300">Max weekly loss</div>
                      <div className="text-hull-50 font-display">{selectedRank.MaxRatingDecay.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-hull-300">Floor</div>
                      <div className="text-hull-50 font-display">{selectedRank.RatingDecayFloor.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-hull-400/40 bg-hull-800/60 p-4">
                <div className="flex items-center gap-2 text-hull-50 font-display tracking-wide mb-4">
                  <Info size={16} className="text-plasma-400" />
                  Source-aligned calculation steps
                </div>
                <div className="space-y-3 text-sm text-hull-200">
                  <div className="flex justify-between gap-3 border-b border-hull-500/30 pb-2">
                    <span>Points to offset decay</span>
                    <span className="font-display text-hull-50">{prediction.data ? prediction.data.pointsToOffsetDecay.toLocaleString() : '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-hull-500/30 pb-2">
                    <span>Total earned after decay</span>
                    <span className="font-display text-hull-50">{prediction.data ? prediction.data.totalEarnedRatingAfterDecay.toLocaleString() : '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-hull-500/30 pb-2">
                    <span>Capped adjustment</span>
                    <span className="font-display text-hull-50">{prediction.data ? prediction.data.cappedRatingAdjustment.toLocaleString() : '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-hull-500/30 pb-2">
                    <span>Current rank range</span>
                    <span className="font-display text-hull-50">{selectedRank.MinRating.toLocaleString()} - {selectedRank.MaxRating.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between gap-3 pb-2">
                    <span>Next progress estimate</span>
                    <span className="font-display text-hull-50">{prediction.data ? `${prediction.data.nextPercent.toFixed(2)}%` : '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5 overflow-x-auto">
            <div className="flex items-center gap-2 mb-4">
              <ChevronRight size={16} className="text-plasma-400" />
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400">
                Rank table from the source repo
              </h2>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-hull-300 border-b border-hull-500/30">
                  <th className="py-2 pr-4">Rank</th>
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Rating range</th>
                  <th className="py-2 pr-4">Cap</th>
                  <th className="py-2 pr-4">Decay</th>
                  <th className="py-2 pr-4">Max loss</th>
                </tr>
              </thead>
              <tbody>
                {GCW_RANKS.map((rank) => (
                  <tr
                    key={rank.Rank}
                    className={`border-b border-hull-500/20 ${rank.Rank === selectedRank.Rank ? 'bg-plasma-500/5' : ''}`}
                  >
                    <td className="py-2 pr-4 text-hull-50">{rank.Rank}</td>
                    <td className="py-2 pr-4 text-hull-100">{getFactionRankTitle(rank, faction)}</td>
                    <td className="py-2 pr-4 text-hull-200">{rank.MinRating.toLocaleString()} - {rank.MaxRating.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-hull-200">{rank.RatingEarningCap.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-hull-200">{rank.RatingDecayBalance.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-hull-200">{rank.MaxRatingDecay.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
