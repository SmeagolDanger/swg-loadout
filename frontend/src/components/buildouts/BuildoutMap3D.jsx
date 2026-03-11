import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Grip,
  LocateFixed,
  Rotate3D,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { clamp, formatCoord, projectIsoPoint, toRadians } from './utils';

const DEFAULT_CAMERA = {
  yaw: -42,
  pitch: 24,
  zoom: 1,
  panX: 0,
  panY: 0,
};

const VIEW_PRESETS = {
  iso: { yaw: -42, pitch: 24 },
  top: { yaw: 0, pitch: 88 },
  front: { yaw: 0, pitch: 10 },
  side: { yaw: 90, pitch: 10 },
};

function flattenPoints(items) {
  return items.flatMap((item) => {
    if (Array.isArray(item?.coordinates)) {
      return [item.coordinates];
    }

    if (Array.isArray(item) && typeof item[0] === 'number') {
      return [item];
    }

    return [];
  });
}

function buildCubeEdges(bounds) {
  const min = bounds?.min ?? -8160;
  const max = bounds?.max ?? 8160;
  const corners = [
    [min, min, min],
    [max, min, min],
    [max, max, min],
    [min, max, min],
    [min, min, max],
    [max, min, max],
    [max, max, max],
    [min, max, max],
  ];

  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  return { corners, edges };
}

export default function BuildoutMap3D({
  data,
  visible,
  selectedIds,
  filteredIdSet,
  searchActive,
  activeSpawn,
  staticPathIds,
  colors,
  onSelectSpawn,
  onToggleSpawn,
}) {
  const frameRef = useRef(null);
  const [frameSize, setFrameSize] = useState({ width: 820, height: 620 });
  const [camera, setCamera] = useState(DEFAULT_CAMERA);
  const [hovered, setHovered] = useState(null);
  const [dragState, setDragState] = useState(null);

  useEffect(() => {
    if (!frameRef.current || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      const minFrame = width < 640 ? 300 : 420;
      setFrameSize({
        width: Math.max(minFrame, width),
        height: Math.max(minFrame, entry.contentRect.height),
      });
    });

    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const cameraRadians = useMemo(
    () => ({ yaw: toRadians(camera.yaw), pitch: toRadians(camera.pitch) }),
    [camera.pitch, camera.yaw]
  );

  const pathCoordinateMap = useMemo(() => {
    const lookup = new Map();
    (data?.spawns || []).forEach((spawn) => {
      lookup.set(spawn.id, spawn.coordinates);
    });
    return lookup;
  }, [data]);

  const allCoords = useMemo(() => {
    if (!data) return [];
    return [
      ...flattenPoints(data.spawns || []),
      ...flattenPoints(data.statics || []),
      ...flattenPoints(data.minor_stations || []),
      ...flattenPoints(data.major_stations || []),
      ...flattenPoints(data.beacons || []),
      ...flattenPoints(data.asteroids || []),
    ];
  }, [data]);

  const projectionMetrics = useMemo(() => {
    const width = frameSize.width;
    const height = frameSize.height;
    const minDimension = Math.min(width, height);

    if (!allCoords.length) {
      return {
        width,
        height,
        centerX: width / 2 + camera.panX,
        centerY: height / 2 + camera.panY,
        baseScale: minDimension * 0.035 * camera.zoom,
        midX: 0,
        midY: 0,
      };
    }

    const rotated = allCoords.map((coords) => projectIsoPoint(coords, cameraRadians, 1));
    const xs = rotated.map((point) => point.x);
    const ys = rotated.map((point) => point.y);
    const spanX = Math.max(...xs) - Math.min(...xs) || 1;
    const spanY = Math.max(...ys) - Math.min(...ys) || 1;
    const paddingRatio = 0.78;
    const baseScale = Math.min((width * paddingRatio) / spanX, (height * paddingRatio) / spanY) * camera.zoom;

    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const centerX = width / 2 - midX * baseScale + camera.panX;
    const centerY = height / 2 - midY * baseScale + camera.panY;

    return { width, height, centerX, centerY, baseScale, midX, midY };
  }, [allCoords, camera.panX, camera.panY, camera.zoom, cameraRadians, frameSize.height, frameSize.width]);

  const cube = useMemo(() => buildCubeEdges(data?.bounds), [data?.bounds]);

  const projectedCube = useMemo(
    () =>
      cube.corners.map((corner) => {
        const point = projectIsoPoint(corner, cameraRadians, projectionMetrics.baseScale);
        return {
          x: projectionMetrics.centerX + point.x,
          y: projectionMetrics.centerY - point.y,
          depth: point.depth,
        };
      }),
    [cameraRadians, cube.corners, projectionMetrics.baseScale, projectionMetrics.centerX, projectionMetrics.centerY]
  );

  const markerLayers = useMemo(() => {
    if (!data) return [];

    const buildPoint = (coordinates, kind, options = {}) => {
      const point = projectIsoPoint(coordinates, cameraRadians, projectionMetrics.baseScale);
      return {
        x: projectionMetrics.centerX + point.x,
        y: projectionMetrics.centerY - point.y,
        depth: point.depth,
        screenScale: point.scale,
        coordinates,
        kind,
        ...options,
      };
    };

    const layers = [];

    if (visible.statics) {
      (data.statics || []).forEach((coordinates, index) => {
        layers.push(
          buildPoint(coordinates, 'statics', {
            id: `static-${index}`,
            radius: 3.1,
            opacity: 0.92,
            label: `Static ship ${index + 1}`,
          })
        );
      });
    }

    if (visible.minorStations) {
      (data.minor_stations || []).forEach((coordinates, index) => {
        layers.push(
          buildPoint(coordinates, 'minorStations', {
            id: `minor-${index}`,
            radius: 4.4,
            opacity: 0.95,
            label: `Minor station ${index + 1}`,
          })
        );
      });
    }

    if (visible.majorStations) {
      (data.major_stations || []).forEach((coordinates, index) => {
        layers.push(
          buildPoint(coordinates, 'majorStations', {
            id: `major-${index}`,
            radius: 5.2,
            opacity: 0.96,
            label: `Major station ${index + 1}`,
          })
        );
      });
    }

    if (visible.beacons) {
      (data.beacons || []).forEach((coordinates, index) => {
        layers.push(
          buildPoint(coordinates, 'beacons', {
            id: `beacon-${index}`,
            radius: 3.4,
            opacity: 0.9,
            label: `Beacon ${index + 1}`,
          })
        );
      });
    }

    if (visible.asteroids) {
      (data.asteroids || []).forEach((coordinates, index) => {
        layers.push(
          buildPoint(coordinates, 'asteroids', {
            id: `asteroid-${index}`,
            radius: 2.8,
            opacity: 0.8,
            label: `Asteroid ${index + 1}`,
          })
        );
      });
    }

    if (visible.spawns) {
      (data.spawns || []).forEach((spawn) => {
        const selected = selectedIdSet.has(spawn.id);
        const matched = !searchActive || filteredIdSet.has(spawn.id);
        layers.push(
          buildPoint(spawn.coordinates, 'spawns', {
            id: `spawn-${spawn.id}`,
            spawnId: spawn.id,
            selected,
            clickable: true,
            radius: selected ? 6.2 : 4.1,
            opacity: matched ? (selected ? 1 : 0.96) : 0.16,
            label: spawn.name,
            subtitle: spawn.spawner_type,
            payload: spawn,
          })
        );
      });
    }

    return layers.sort((a, b) => a.depth - b.depth);
  }, [
    cameraRadians,
    data,
    filteredIdSet,
    projectionMetrics.baseScale,
    projectionMetrics.centerX,
    projectionMetrics.centerY,
    searchActive,
    selectedIdSet,
    visible,
  ]);

  const projectedStaticPath = useMemo(() => {
    if (!staticPathIds?.length) return [];
    return staticPathIds
      .map((id) => pathCoordinateMap.get(id))
      .filter(Boolean)
      .map((coords) => {
        const point = projectIsoPoint(coords, cameraRadians, projectionMetrics.baseScale);
        return {
          x: projectionMetrics.centerX + point.x,
          y: projectionMetrics.centerY - point.y,
        };
      });
  }, [cameraRadians, pathCoordinateMap, projectionMetrics.baseScale, projectionMetrics.centerX, projectionMetrics.centerY, staticPathIds]);

  const projectedPatrolPath = useMemo(() => {
    if (!activeSpawn?.patrol_points?.length) return [];
    return activeSpawn.patrol_points.map((coords) => {
      const point = projectIsoPoint(coords, cameraRadians, projectionMetrics.baseScale);
      return {
        x: projectionMetrics.centerX + point.x,
        y: projectionMetrics.centerY - point.y,
      };
    });
  }, [activeSpawn, cameraRadians, projectionMetrics.baseScale, projectionMetrics.centerX, projectionMetrics.centerY]);

  function updateCamera(partial) {
    setCamera((current) => ({ ...current, ...partial }));
  }

  function setViewPreset(name) {
    const preset = VIEW_PRESETS[name];
    if (!preset) return;
    setCamera((current) => ({ ...current, ...preset }));
  }

  function resetView() {
    setCamera(DEFAULT_CAMERA);
    setHovered(null);
  }

  function fitSelected() {
    if (!selectedIds.length || !data?.spawns?.length) {
      resetView();
      return;
    }

    const selectedPoints = data.spawns
      .filter((spawn) => selectedIdSet.has(spawn.id))
      .map((spawn) => spawn.coordinates);

    if (!selectedPoints.length) {
      resetView();
      return;
    }

    const rotated = selectedPoints.map((coords) => projectIsoPoint(coords, cameraRadians, 1));
    const xs = rotated.map((point) => point.x);
    const ys = rotated.map((point) => point.y);
    const spanX = Math.max(...xs) - Math.min(...xs) || 1;
    const spanY = Math.max(...ys) - Math.min(...ys) || 1;
    const width = frameSize.width;
    const height = frameSize.height;
    const zoom = clamp(Math.min((width * 0.42) / spanX, (height * 0.42) / spanY), 0.65, 5);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const normalizedScale = projectionMetrics.baseScale / Math.max(camera.zoom, 0.0001);

    setCamera((current) => ({
      ...current,
      zoom,
      panX: -(centerX - projectionMetrics.midX) * normalizedScale * zoom,
      panY: (centerY - projectionMetrics.midY) * normalizedScale * zoom,
    }));
  }

  function handleWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.12 : 0.12;
    setCamera((current) => ({
      ...current,
      zoom: clamp(Number((current.zoom + delta).toFixed(2)), 0.4, 6),
    }));
  }

  function handlePointerDown(event) {
    if (event.target?.dataset?.marker === 'true') return;
    setDragState({
      mode: event.shiftKey ? 'pan' : 'rotate',
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  function handlePointerMove(event) {
    if (dragState) {
      const dx = event.clientX - dragState.clientX;
      const dy = event.clientY - dragState.clientY;

      if (dragState.mode === 'pan') {
        setCamera((current) => ({
          ...current,
          panX: current.panX + dx,
          panY: current.panY + dy,
        }));
      } else {
        setCamera((current) => ({
          ...current,
          yaw: current.yaw + dx * 0.32,
          pitch: clamp(current.pitch - dy * 0.22, -88, 88),
        }));
      }

      setDragState({ ...dragState, clientX: event.clientX, clientY: event.clientY });
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setHovered((current) =>
      current && current.kind === 'marker'
        ? current
        : {
            kind: 'cursor',
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          }
    );
  }

  function handlePointerLeave() {
    setDragState(null);
    setHovered(null);
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400 mb-1">
            3D Tactical Map
          </h2>
          <p className="text-sm text-hull-200 max-w-2xl">
            Rotate the zone, shift-drag to pan, mouse-wheel to zoom, and click markers to inspect actual 3D placement instead of pretending three flat projections are cinematic.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-display tracking-[0.14em] uppercase">
          <button className="btn-ghost" onClick={() => updateCamera({ zoom: clamp(camera.zoom + 0.18, 0.4, 6) })}>
            <ZoomIn size={15} /> Zoom In
          </button>
          <button className="btn-ghost" onClick={() => updateCamera({ zoom: clamp(camera.zoom - 0.18, 0.4, 6) })}>
            <ZoomOut size={15} /> Zoom Out
          </button>
          <button className="btn-ghost" onClick={fitSelected}>
            <LocateFixed size={15} /> Fit Selected
          </button>
          <button className="btn-ghost" onClick={resetView}>
            <RotateCcw size={15} /> Reset View
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_260px] gap-4 items-start">
        <div
          ref={frameRef}
          className="relative h-[34rem] rounded-2xl border border-hull-400/50 bg-[radial-gradient(circle_at_top,#08203a_0%,#020817_58%,#02040a_100%)] overflow-hidden cursor-grab active:cursor-grabbing"
        >
          <svg
            viewBox={`0 0 ${projectionMetrics.width} ${projectionMetrics.height}`}
            className="w-full h-full"
            onWheel={handleWheel}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={() => setDragState(null)}
            onMouseLeave={handlePointerLeave}
          >
            <defs>
              <pattern id="buildout-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(125,211,252,0.08)" strokeWidth="1" />
              </pattern>
              <filter id="map-glow">
                <feGaussianBlur stdDeviation="2.8" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect width={projectionMetrics.width} height={projectionMetrics.height} fill="url(#buildout-grid)" />

            {cube.edges.map(([startIndex, endIndex], index) => {
              const start = projectedCube[startIndex];
              const end = projectedCube[endIndex];
              return (
                <line
                  key={`cube-${index}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="rgba(125,211,252,0.16)"
                  strokeWidth="1.2"
                  strokeDasharray="5 7"
                />
              );
            })}

            <line
              x1={projectionMetrics.centerX}
              y1={18}
              x2={projectionMetrics.centerX}
              y2={projectionMetrics.height - 18}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
            <line
              x1={18}
              y1={projectionMetrics.centerY}
              x2={projectionMetrics.width - 18}
              y2={projectionMetrics.centerY}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />

            {projectedStaticPath.length > 1 && (
              <polyline
                points={projectedStaticPath.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={colors.path}
                strokeWidth="2"
                strokeDasharray="7 6"
                opacity="0.88"
              />
            )}

            {projectedPatrolPath.length > 1 && (
              <polyline
                points={projectedPatrolPath.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={colors.patrol}
                strokeWidth="2.6"
                opacity="0.9"
              />
            )}

            {markerLayers.map((point) => {
              const color = point.selected ? colors.selected : colors[point.kind] || colors.spawns;
              const radius = point.radius * point.screenScale;

              if (!point.clickable) {
                return (
                  <circle
                    key={point.id}
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    fill={color}
                    opacity={point.opacity}
                  />
                );
              }

              return (
                <g key={point.id}>
                  {point.selected && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={radius + 4}
                      fill="none"
                      stroke={colors.selected}
                      strokeWidth="1.5"
                      opacity="0.95"
                      filter="url(#map-glow)"
                    />
                  )}
                  <circle
                    data-marker="true"
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    fill={color}
                    stroke={point.selected ? '#fff4a6' : '#dff8ff'}
                    strokeWidth={point.selected ? '1.5' : '0.7'}
                    opacity={point.opacity}
                    className="cursor-pointer"
                    onMouseEnter={() => setHovered({ kind: 'marker', point })}
                    onMouseLeave={() => setHovered(null)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (event.shiftKey) {
                        onToggleSpawn(point.spawnId);
                      } else {
                        onSelectSpawn(point.spawnId);
                      }
                    }}
                  />
                </g>
              );
            })}

            <text x={18} y={28} fill="#7dd3fc" fontSize="14" className="font-display">+Y</text>
            <text x={projectionMetrics.width - 34} y={projectionMetrics.centerY - 8} fill="#7dd3fc" fontSize="14" className="font-display">+X</text>
            <text x={projectionMetrics.centerX + 10} y={projectionMetrics.height - 18} fill="#7dd3fc" fontSize="14" className="font-display">+Z</text>
          </svg>

          {hovered?.kind === 'marker' && (
            <div className="absolute left-4 bottom-4 max-w-xs rounded-xl border border-hull-300/50 bg-hull-900/90 px-3 py-2 text-xs text-hull-100 backdrop-blur-md pointer-events-none">
              <div className="font-display text-plasma-300 tracking-[0.14em] uppercase mb-1">{hovered.point.label}</div>
              {hovered.point.subtitle && <div className="text-hull-200 mb-1">{hovered.point.subtitle}</div>}
              <div>
                {formatCoord(hovered.point.coordinates[0])}, {formatCoord(hovered.point.coordinates[1])}, {formatCoord(hovered.point.coordinates[2])}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-display tracking-[0.16em] uppercase text-plasma-400">
              <Rotate3D size={15} /> View Presets
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-display tracking-[0.14em] uppercase">
              <button className="btn-ghost justify-center" onClick={() => setViewPreset('iso')}>Iso</button>
              <button className="btn-ghost justify-center" onClick={() => setViewPreset('top')}>Top</button>
              <button className="btn-ghost justify-center" onClick={() => setViewPreset('front')}>Front</button>
              <button className="btn-ghost justify-center" onClick={() => setViewPreset('side')}>Side</button>
            </div>
          </div>

          <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-display tracking-[0.16em] uppercase text-plasma-400">
              <Grip size={15} /> Camera Controls
            </div>
            <label className="block text-xs text-hull-200">
              Yaw
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={camera.yaw}
                onChange={(event) => updateCamera({ yaw: Number(event.target.value) })}
                className="w-full mt-2"
              />
            </label>
            <label className="block text-xs text-hull-200">
              Pitch
              <input
                type="range"
                min="-88"
                max="88"
                step="1"
                value={camera.pitch}
                onChange={(event) => updateCamera({ pitch: Number(event.target.value) })}
                className="w-full mt-2"
              />
            </label>
          </div>

          <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 p-4 space-y-2 text-sm">
            <div className="stat-row px-0 py-0">
              <span className="stat-label">Viewport</span>
              <span className="stat-value">{Math.round(camera.zoom * 100)}% zoom</span>
            </div>
            <div className="stat-row px-0 py-0">
              <span className="stat-label">Rotation</span>
              <span className="stat-value">{Math.round(camera.yaw)}° / {Math.round(camera.pitch)}°</span>
            </div>
            <div className="stat-row px-0 py-0">
              <span className="stat-label">Selection</span>
              <span className="stat-value">{selectedIds.length} active</span>
            </div>
            <div className="stat-row px-0 py-0">
              <span className="stat-label">Cursor</span>
              <span className="stat-value">{hovered?.kind === 'marker' ? 'Marker hover' : 'Orbit / pan'}</span>
            </div>
          </div>

          <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 p-4 text-sm text-hull-200 space-y-2">
            <div className="flex items-center gap-2 text-xs font-display tracking-[0.16em] uppercase text-plasma-400">
              <Crosshair size={15} /> Notes
            </div>
            <p>Drag to orbit the camera. Hold <span className="text-hull-50">Shift</span> while dragging to pan.</p>
            <p>Static route is shown as a dashed yellow path. Patrol points for the active spawn render in green.</p>
            <p>Search dims unrelated spawners on the map so the useful ones stop hiding in the crowd.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
