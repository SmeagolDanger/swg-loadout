import React from 'react';
import { Boxes, Copy, Map, Radio } from 'lucide-react';

import { copyText, formatCoord } from './utils';

export default function SelectionDetails({ activeSpawn, selectedSpawns, setToast }) {
  if (!activeSpawn) {
    return (
      <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 px-4 py-8 text-sm text-hull-200">
        Pick one or more spawners from the list. The first selected item drives the details panel so the layout stays readable.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-display text-hull-50 mb-1">{activeSpawn.name}</h3>
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-neutral">{activeSpawn.spawner_type}</span>
          <span className="badge badge-neutral">{activeSpawn.spawn_count} spawn</span>
          <span className="badge badge-neutral">{activeSpawn.respawn}</span>
        </div>
      </div>

      <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 p-4 space-y-3 text-sm">
        <div className="stat-row px-0 py-0">
          <span className="stat-label">Coordinates</span>
          <span className="stat-value">
            {formatCoord(activeSpawn.coordinates[0])}, {formatCoord(activeSpawn.coordinates[1])}, {formatCoord(activeSpawn.coordinates[2])}
          </span>
        </div>
        <div className="stat-row px-0 py-0">
          <span className="stat-label">Behavior</span>
          <span className="stat-value">{activeSpawn.behavior || 'N/A'}</span>
        </div>
        <div className="stat-row px-0 py-0">
          <span className="stat-label">Spawn Shell</span>
          <span className="stat-value">{activeSpawn.spawn_shell[0]}m - {activeSpawn.spawn_shell[1]}m</span>
        </div>
        <div className="stat-row px-0 py-0">
          <span className="stat-label">Circle Shell</span>
          <span className="stat-value">{activeSpawn.circle_shell[0]}m - {activeSpawn.circle_shell[1]}m</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-display text-sm tracking-[0.14em] uppercase text-hull-100">Ships</h4>
          <span className="text-xs text-hull-300">{activeSpawn.ships?.length || 0}</span>
        </div>
        <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 p-3 max-h-40 overflow-auto">
          {activeSpawn.ships?.length ? (
            <ul className="space-y-2 text-sm text-hull-100">
              {activeSpawn.ships.map((ship, index) => (
                <li key={`${ship}-${index}`} className="flex items-start gap-2">
                  <Boxes size={14} className="mt-0.5 text-plasma-400 shrink-0" />
                  <span>{ship}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-hull-200">No ship entries found.</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-display text-sm tracking-[0.14em] uppercase text-hull-100">Patrol Points</h4>
          <span className="text-xs text-hull-300">{activeSpawn.patrol_points?.length || 0}</span>
        </div>
        <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 p-3 max-h-44 overflow-auto">
          {activeSpawn.patrol_points?.length ? (
            <ul className="space-y-2 text-sm text-hull-100">
              {activeSpawn.patrol_points.map((point, index) => (
                <li key={`${activeSpawn.id}-point-${index}`} className="flex items-start gap-2">
                  <Radio size={14} className={`mt-0.5 shrink-0 ${index === 0 ? 'text-laser-green' : 'text-hull-200'}`} />
                  <span>{formatCoord(point[0])}, {formatCoord(point[1])}, {formatCoord(point[2])}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-hull-200">This entry does not use patrol points.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => copyText(activeSpawn.waypoint, 'Waypoint', setToast)}>
          <Copy size={16} /> Copy Waypoint
        </button>
        <button
          className="btn-secondary"
          onClick={() => copyText(selectedSpawns.map((spawn) => spawn.waypoint).join(''), 'Selected waypoints', setToast)}
          disabled={!selectedSpawns.length}
        >
          <Map size={16} /> Copy Selected
        </button>
      </div>
    </div>
  );
}
