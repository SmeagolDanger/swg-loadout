import React, { useMemo } from 'react';

import { COLORS } from './constants';
import { projectPoint } from './utils';

export default function ProjectionPanel({ title, axes, data, visible, selectedSpawns, bounds, staticPathIds }) {
  const size = 340;
  const padding = 26;

  const pathPoints = useMemo(() => {
    if (!data?.best_static_path?.ordered_spawn_ids?.length) return [];
    const lookup = new Map(data.spawns.map((spawn) => [spawn.id, spawn]));
    return staticPathIds.map((id) => lookup.get(id)).filter(Boolean);
  }, [data, staticPathIds]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="font-display text-sm tracking-[0.14em] uppercase text-hull-100">{title}</h3>
        <span className="text-xs text-hull-300">
          {axes.map((axis) => ['X', 'Y', 'Z'][axis]).join(' / ')}
        </span>
      </div>

      <div className="rounded-2xl border border-hull-400/50 bg-hull-900/80 p-2 overflow-hidden">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto block">
          <rect x="0" y="0" width={size} height={size} fill="rgba(7,12,24,0.96)" rx="18" />
          <line x1={padding} x2={size - padding} y1={size / 2} y2={size / 2} stroke="rgba(125,138,170,0.18)" strokeWidth="1" />
          <line x1={size / 2} x2={size / 2} y1={padding} y2={size - padding} stroke="rgba(125,138,170,0.18)" strokeWidth="1" />
          <rect x={padding} y={padding} width={size - padding * 2} height={size - padding * 2} fill="none" stroke="rgba(125,138,170,0.34)" strokeWidth="1.5" rx="8" />

          {visible.statics && data?.statics?.map((point, index) => {
            const [x, y] = projectPoint(point, axes, size, padding, bounds);
            return <path key={`static-${index}`} d={`M ${x - 4} ${y + 4} L ${x} ${y - 4} L ${x + 4} ${y + 4} Z`} fill={COLORS.statics} opacity="0.9" />;
          })}

          {visible.minorStations && data?.minor_stations?.map((point, index) => {
            const [x, y] = projectPoint(point, axes, size, padding, bounds);
            return <rect key={`minor-${index}`} x={x - 3.5} y={y - 3.5} width="7" height="7" rx="1.5" fill={COLORS.minorStations} />;
          })}

          {visible.majorStations && data?.major_stations?.map((point, index) => {
            const [x, y] = projectPoint(point, axes, size, padding, bounds);
            return <circle key={`major-${index}`} cx={x} cy={y} r="5.5" fill={COLORS.majorStations} stroke="rgba(255,255,255,0.55)" strokeWidth="1" />;
          })}

          {visible.beacons && data?.beacons?.map((point, index) => {
            const [x, y] = projectPoint(point, axes, size, padding, bounds);
            return <circle key={`beacon-${index}`} cx={x} cy={y} r="3.5" fill={COLORS.beacons} />;
          })}

          {visible.asteroids && data?.asteroids?.map((point, index) => {
            const [x, y] = projectPoint(point, axes, size, padding, bounds);
            return <circle key={`asteroid-${index}`} cx={x} cy={y} r="2.6" fill={COLORS.asteroids} opacity="0.75" />;
          })}

          {pathPoints.length > 1 && (
            <polyline
              points={pathPoints.map((spawn) => projectPoint(spawn.coordinates, axes, size, padding, bounds).join(',')).join(' ')}
              fill="none"
              stroke={COLORS.path}
              strokeWidth="2"
              strokeDasharray="5 4"
              opacity="0.9"
            />
          )}

          {(selectedSpawns || []).map((spawn) => {
            const [x, y] = projectPoint(spawn.coordinates, axes, size, padding, bounds);
            const projectedPatrol = (spawn.patrol_points || []).map((point) => projectPoint(point, axes, size, padding, bounds).join(','));

            return (
              <g key={`spawn-${spawn.id}`}>
                {projectedPatrol.length > 1 && (
                  <polyline
                    points={projectedPatrol.join(' ')}
                    fill="none"
                    stroke={COLORS.patrol}
                    strokeWidth="1.8"
                    opacity="0.85"
                  />
                )}
                {projectedPatrol.map((pair, index) => {
                  const [pointX, pointY] = pair.split(',').map(Number);
                  return (
                    <circle
                      key={`${spawn.id}-patrol-${index}`}
                      cx={pointX}
                      cy={pointY}
                      r={index === 0 ? 4 : 2.5}
                      fill={index === 0 ? '#00ff88' : '#c7ffe0'}
                      opacity="0.95"
                    />
                  );
                })}
                <circle cx={x} cy={y} r="5.2" fill={COLORS.selected} stroke="rgba(255,255,255,0.75)" strokeWidth="1.2" />
              </g>
            );
          })}

          {visible.spawns && data?.spawns?.map((spawn) => {
            if ((selectedSpawns || []).some((item) => item.id === spawn.id)) return null;
            const [x, y] = projectPoint(spawn.coordinates, axes, size, padding, bounds);
            return <circle key={`spawn-base-${spawn.id}`} cx={x} cy={y} r="2.6" fill={COLORS.spawns} opacity="0.55" />;
          })}
        </svg>
      </div>
    </div>
  );
}
