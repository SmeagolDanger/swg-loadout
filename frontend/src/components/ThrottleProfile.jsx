import React from 'react';
import { Activity } from 'lucide-react';

function getThreeColorGradient(per) {
  if (per < 50) {
    const r = Math.round((per * 2) / 100 * (255 - 221) + 221);
    const g = Math.round((per * 2) / 100 * 204);
    return `rgb(${r}, ${g}, 0)`;
  } else {
    const r = Math.round((1 - (per - 50) * 2 / 100) * 255);
    return `rgb(${r}, 204, 0)`;
  }
}

export default function ThrottleProfile({ profile, chassis }) {
  if (!profile || profile.length === 0) return null;

  return (
    <div className="card">
      <div className="card-header"><Activity size={16} /> THROTTLE PROFILE</div>
      <div className="p-3">
        {chassis && (
          <div className="text-xs text-hull-200 mb-3 font-mono text-center">
            Min: {chassis.min_throttle} / Opt: {chassis.opt_throttle} / Max: {chassis.max_throttle}
          </div>
        )}

        <div className="flex gap-0.5">
          <div className="w-16 space-y-0.5">
            <div className="text-[10px] font-display text-hull-400 text-center py-1">SPEED</div>
            {profile.map((p, i) => (
              <div key={i} className="text-xs font-mono text-hull-200 text-center py-1">
                {p.throttle}
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-0.5">
            <div className="text-[10px] font-display text-hull-400 text-center py-1">MAX PY MOD</div>
            {profile.map((p, i) => {
              const color = getThreeColorGradient(p.pyr_modifier);
              const width = `${Math.max(p.pyr_modifier / 1.6, 10)}%`;
              return (
                <div key={i} className="relative h-6 flex items-center">
                  <div
                    className="absolute inset-y-0 left-0 rounded-r-sm opacity-25"
                    style={{ backgroundColor: color, width }}
                  />
                  <span
                    className="relative z-10 text-xs font-mono font-bold px-2 w-full text-center"
                    style={{ color }}
                  >
                    {p.pyr_modifier}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
