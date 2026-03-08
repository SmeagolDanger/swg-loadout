import React, { useMemo, useRef, useState } from 'react';
import { Crosshair, LocateFixed, Minus, Plus, RotateCcw } from 'lucide-react';

import { COLORS } from './constants';
import { clamp, formatCoord, getSpawnCoords, projectMapPoint } from './utils';

const MAP_SIZE = 1000;
const PADDING = 64;
const MIN_SCALE = 0.8;
const MAX_SCALE = 10;
const FIT_MARGIN = 120;

function getSvgPoint(event, svgElement) {
  const rect = svgElement.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * MAP_SIZE,
    y: ((event.clientY - rect.top) / rect.height) * MAP_SIZE,
  };
}

function zoomAroundPoint(currentScale, currentOffset, nextScale, point) {
  const scaleRatio = nextScale / currentScale;
  return {
    x: point.x - (point.x - currentOffset.x) * scaleRatio,
    y: point.y - (point.y - currentOffset.y) * scaleRatio,
  };
}

function buildFitTransform(points) {
  if (!points.length) {
    return { scale: 1, offset: { x: 0, y: 0 } };
  }

  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 40);
  const height = Math.max(maxY - minY, 40);
  const nextScale = clamp(
    Math.min((MAP_SIZE - FIT_MARGIN * 2) / width, (MAP_SIZE - FIT_MARGIN * 2) / height),
    MIN_SCALE,
    MAX_SCALE,
  );

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    scale: nextScale,
    offset: {
      x: MAP_SIZE / 2 - centerX * nextScale,
      y: MAP_SIZE / 2 - centerY * nextScale,
    },
  };
}

function renderDiamond(point, size) {
  return `M ${point[0]} ${point[1] - size} L ${point[0] + size} ${point[1]} L ${point[0]} ${point[1] + size} L ${point[0] - size} ${point[1]} Z`;
}

export default function BuildoutMap({
  data,
  visible,
  selectedIds,
  onSelectSpawn,
  onToggleSpawn,
  staticPathIds,
}) {
  const svgRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hoveredSpawn, setHoveredSpawn] = useState(null);
  const [cursorPoint, setCursorPoint] = useState(null);
  const dragStateRef = useRef(null);

  const bounds = data?.bounds || { min: -8160, max: 8160 };
  const span = bounds.max - bounds.min || 1;
  const usable = MAP_SIZE - PADDING * 2;

  const projected = useMemo(() => {
    if (!data) {
      return {
        spawns: [],
        statics: [],
        minorStations: [],
        majorStations: [],
        beacons: [],
        asteroids: [],
        staticPath: [],
      };
    }

    const project = (point) => projectMapPoint(point, MAP_SIZE, PADDING, bounds);
    const spawnLookup = new Map();

    const spawns = (data.spawns || []).map((spawn) => {
      const coords = getSpawnCoords(spawn);
      const projectedPoint = project(coords);
      const projectedPatrol = (spawn.patrol_points || []).map(project);
      const projectedSpawn = {
        ...spawn,
        coords,
        point: projectedPoint,
        patrol: projectedPatrol,
      };
      spawnLookup.set(spawn.id, projectedSpawn);
      return projectedSpawn;
    });

    return {
      spawns,
      statics: (data.statics || []).map(project),
      minorStations: (data.minor_stations || []).map(project),
      majorStations: (data.major_stations || []).map(project),
      beacons: (data.beacons || []).map(project),
      asteroids: (data.asteroids || []).map(project),
      staticPath: (staticPathIds || []).map((id) => spawnLookup.get(id)?.point).filter(Boolean),
    };
  }, [bounds, data, staticPathIds]);

  const selectedSpawns = useMemo(
    () => projected.spawns.filter((spawn) => selectedIds.includes(spawn.id)),
    [projected.spawns, selectedIds],
  );

  function resetView() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function fitSelected() {
    if (!selectedSpawns.length) return;
    const next = buildFitTransform(selectedSpawns.map((spawn) => spawn.point));
    setScale(next.scale);
    setOffset(next.offset);
  }

  function applyZoom(nextScale, point = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 }) {
    setScale((currentScale) => {
      const clamped = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      setOffset((currentOffset) => zoomAroundPoint(currentScale, currentOffset, clamped, point));
      return clamped;
    });
  }

  function handleWheel(event) {
    event.preventDefault();
    if (!svgRef.current) return;
    const point = getSvgPoint(event, svgRef.current);
    const delta = event.deltaY > 0 ? 0.88 : 1.12;
    applyZoom(scale * delta, point);
  }

  function handlePointerDown(event) {
    if (!svgRef.current) return;
    const point = getSvgPoint(event, svgRef.current);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startPoint: point,
      startOffset: offset,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!svgRef.current) return;
    const point = getSvgPoint(event, svgRef.current);

    const baseX = (point.x - offset.x) / scale;
    const baseY = (point.y - offset.y) / scale;
    const worldX = bounds.min + ((baseX - PADDING) / usable) * span;
    const worldZ = bounds.min + ((MAP_SIZE - PADDING - baseY) / usable) * span;
    setCursorPoint({ x: worldX, z: worldZ });

    if (!dragStateRef.current) return;

    const dx = point.x - dragStateRef.current.startPoint.x;
    const dy = point.y - dragStateRef.current.startPoint.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragStateRef.current.moved = true;
    }

    setOffset({
      x: dragStateRef.current.startOffset.x + dx,
      y: dragStateRef.current.startOffset.y + dy,
    });
  }

  function handlePointerUp(event) {
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleSpawnClick(event, spawnId) {
    event.stopPropagation();
    if (dragStateRef.current?.moved) return;
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      onToggleSpawn(spawnId);
      return;
    }
    onSelectSpawn(spawnId);
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400 mb-1">
            Interactive Tactical Map
          </h2>
          <p className="text-sm text-hull-200">
            Pan, zoom, click markers, and shift-click to build a multi-selection without squinting at three projection cards like a cave surveyor.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => applyZoom(scale * 1.2)}>
            <Plus size={16} /> Zoom In
          </button>
          <button type="button" className="btn-ghost" onClick={() => applyZoom(scale / 1.2)}>
            <Minus size={16} /> Zoom Out
          </button>
          <button type="button" className="btn-ghost" onClick={fitSelected} disabled={!selectedSpawns.length}>
            <LocateFixed size={16} /> Fit Selected
          </button>
          <button type="button" className="btn-ghost" onClick={resetView}>
            <RotateCcw size={16} /> Reset View
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-hull-400/50 bg-hull-900/80 overflow-hidden relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
          className="w-full h-auto block aspect-square touch-none select-none"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            dragStateRef.current = null;
            setHoveredSpawn(null);
            setCursorPoint(null);
          }}
        >
          <defs>
            <clipPath id="buildout-map-clip">
              <rect x={0} y={0} width={MAP_SIZE} height={MAP_SIZE} rx={24} />
            </clipPath>
          </defs>

          <rect x={0} y={0} width={MAP_SIZE} height={MAP_SIZE} fill="rgba(5, 10, 20, 0.98)" />

          <g clipPath="url(#buildout-map-clip)" transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
            {Array.from({ length: 9 }).map((_, index) => {
              const x = PADDING + (usable / 8) * index;
              const y = PADDING + (usable / 8) * index;
              return (
                <React.Fragment key={`grid-${index}`}>
                  <line x1={x} x2={x} y1={PADDING} y2={MAP_SIZE - PADDING} stroke="rgba(125,138,170,0.12)" strokeWidth={1} />
                  <line x1={PADDING} x2={MAP_SIZE - PADDING} y1={y} y2={y} stroke="rgba(125,138,170,0.12)" strokeWidth={1} />
                </React.Fragment>
              );
            })}

            <line
              x1={PADDING}
              x2={MAP_SIZE - PADDING}
              y1={MAP_SIZE / 2}
              y2={MAP_SIZE / 2}
              stroke="rgba(125,138,170,0.22)"
              strokeWidth={2}
            />
            <line
              x1={MAP_SIZE / 2}
              x2={MAP_SIZE / 2}
              y1={PADDING}
              y2={MAP_SIZE - PADDING}
              stroke="rgba(125,138,170,0.22)"
              strokeWidth={2}
            />
            <rect
              x={PADDING}
              y={PADDING}
              width={usable}
              height={usable}
              fill="none"
              stroke="rgba(125,138,170,0.34)"
              strokeWidth={2}
              rx={18}
            />

            {visible.asteroids && projected.asteroids.map((point, index) => (
              <circle key={`asteroid-${index}`} cx={point[0]} cy={point[1]} r={2.7} fill={COLORS.asteroids} opacity={0.6} />
            ))}

            {visible.statics && projected.statics.map((point, index) => (
              <path key={`static-${index}`} d={renderDiamond(point, 5)} fill={COLORS.statics} opacity={0.9} />
            ))}

            {visible.minorStations && projected.minorStations.map((point, index) => (
              <rect key={`minor-${index}`} x={point[0] - 4} y={point[1] - 4} width={8} height={8} rx={2} fill={COLORS.minorStations} />
            ))}

            {visible.majorStations && projected.majorStations.map((point, index) => (
              <circle
                key={`major-${index}`}
                cx={point[0]}
                cy={point[1]}
                r={7}
                fill={COLORS.majorStations}
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={1.6}
              />
            ))}

            {visible.beacons && projected.beacons.map((point, index) => (
              <g key={`beacon-${index}`}>
                <circle cx={point[0]} cy={point[1]} r={3.5} fill={COLORS.beacons} />
                <circle cx={point[0]} cy={point[1]} r={8} fill="none" stroke="rgba(245, 158, 11, 0.25)" strokeWidth={1.2} />
              </g>
            ))}

            {projected.staticPath.length > 1 && (
              <polyline
                points={projected.staticPath.map((point) => point.join(',')).join(' ')}
                fill="none"
                stroke={COLORS.path}
                strokeWidth={2.5}
                strokeDasharray="10 8"
                opacity={0.85}
              />
            )}

            {projected.spawns.map((spawn) => {
              const isSelected = selectedIds.includes(spawn.id);
              const isHovered = hoveredSpawn?.id === spawn.id;
              const markerRadius = isSelected ? 7.5 : isHovered ? 5.5 : 4;

              return (
                <g
                  key={`spawn-${spawn.id}`}
                  onMouseEnter={() => setHoveredSpawn(spawn)}
                  onMouseLeave={() => setHoveredSpawn((current) => (current?.id === spawn.id ? null : current))}
                  onClick={(event) => handleSpawnClick(event, spawn.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {isSelected && spawn.patrol.length > 1 && (
                    <polyline
                      points={spawn.patrol.map((point) => point.join(',')).join(' ')}
                      fill="none"
                      stroke={COLORS.patrol}
                      strokeWidth={2}
                      opacity={0.85}
                    />
                  )}

                  {isSelected && spawn.patrol.map((point, index) => (
                    <circle
                      key={`${spawn.id}-patrol-${index}`}
                      cx={point[0]}
                      cy={point[1]}
                      r={index === 0 ? 4.5 : 3}
                      fill={index === 0 ? '#00ff88' : '#c7ffe0'}
                      opacity={0.95}
                    />
                  ))}

                  {isSelected && (
                    <circle
                      cx={spawn.point[0]}
                      cy={spawn.point[1]}
                      r={13}
                      fill="none"
                      stroke="rgba(250, 204, 21, 0.28)"
                      strokeWidth={2}
                    />
                  )}

                  <circle
                    cx={spawn.point[0]}
                    cy={spawn.point[1]}
                    r={markerRadius}
                    fill={isSelected ? COLORS.selected : COLORS.spawns}
                    stroke={isSelected ? 'rgba(255,255,255,0.8)' : isHovered ? 'rgba(255,255,255,0.4)' : 'transparent'}
                    strokeWidth={isSelected || isHovered ? 1.4 : 0}
                    opacity={isSelected ? 1 : 0.72}
                  />
                </g>
              );
            })}
          </g>

          <g pointerEvents="none">
            <text x={22} y={30} fill="rgba(180, 190, 210, 0.86)" fontSize="20" fontFamily="system-ui, sans-serif">+Z</text>
            <text x={MAP_SIZE - 42} y={MAP_SIZE / 2 - 12} fill="rgba(180, 190, 210, 0.86)" fontSize="20" fontFamily="system-ui, sans-serif">+X</text>
            <text x={20} y={MAP_SIZE - 24} fill="rgba(140, 155, 180, 0.86)" fontSize="16" fontFamily="system-ui, sans-serif">-X</text>
            <text x={MAP_SIZE / 2 + 10} y={MAP_SIZE - 20} fill="rgba(140, 155, 180, 0.86)" fontSize="16" fontFamily="system-ui, sans-serif">-Z</text>
          </g>
        </svg>

        {hoveredSpawn && (
          <div className="absolute left-4 top-4 max-w-xs rounded-xl border border-hull-400/60 bg-hull-800/95 px-3 py-2 shadow-2xl backdrop-blur-sm pointer-events-none">
            <div className="text-sm font-medium text-hull-50 truncate">
              {hoveredSpawn.name || `Spawner ${hoveredSpawn.id}`}
            </div>
            <div className="text-xs text-hull-300 truncate">{hoveredSpawn.spawner_type || 'Spawner'}</div>
            <div className="text-xs text-hull-200 mt-1">
              X {formatCoord(hoveredSpawn.coords[0])} · Y {formatCoord(hoveredSpawn.coords[1])} · Z {formatCoord(hoveredSpawn.coords[2])}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 px-4 py-3 text-hull-100">
          <div className="text-xs uppercase tracking-[0.16em] text-plasma-400 mb-1">Viewport</div>
          <div className="font-medium">{Math.round(scale * 100)}% zoom</div>
          <div className="text-xs text-hull-300 mt-1">Drag to pan. Wheel to zoom. Shift-click to multi-select.</div>
        </div>

        <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 px-4 py-3 text-hull-100">
          <div className="text-xs uppercase tracking-[0.16em] text-plasma-400 mb-1">Cursor</div>
          {cursorPoint ? (
            <div className="font-medium">
              X {formatCoord(cursorPoint.x)} · Z {formatCoord(cursorPoint.z)}
            </div>
          ) : (
            <div className="text-hull-300">Move across the map</div>
          )}
        </div>

        <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 px-4 py-3 text-hull-100">
          <div className="text-xs uppercase tracking-[0.16em] text-plasma-400 mb-1">Selection</div>
          <div className="font-medium">{selectedSpawns.length} selected</div>
          <div className="text-xs text-hull-300 mt-1">Click once to focus one spawn. Shift-click to add more.</div>
        </div>
      </div>
    </div>
  );
}
