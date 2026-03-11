import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Boxes,
  Copy,
  Disc3,
  FileUp,
  Map as MapIcon,
  Orbit,
  Radio,
  RefreshCcw,
  Route as RouteIcon,
  Satellite,
  Search,
} from 'lucide-react';

import { api } from '../api';
import BuildoutMap3D from './buildouts/BuildoutMap3D';
import SelectionDetails from './buildouts/SelectionDetails';
import { COLORS, LAYER_OPTIONS, LEGEND_ITEMS } from './buildouts/constants';
import { copyText, getSearchText } from './buildouts/utils';

const LEGEND_ICONS = {
  Satellite,
  Boxes,
  Disc3,
  Radio,
  Orbit,
};

export default function BuildoutExplorer() {
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('space_corellia');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [toast, setToast] = useState('');
  const [uploading, setUploading] = useState(false);
  const [visible, setVisible] = useState({
    spawns: true,
    statics: true,
    minorStations: true,
    majorStations: true,
    beacons: true,
    asteroids: true,
  });

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const zoneList = await api.getBuildoutZones();
        if (!active) return;
        setZones(zoneList);
        setSelectedZone(zoneList[0]?.id || 'space_corellia');
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load buildout zones');
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedZone) return;

    let active = true;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const result = await api.getBuildoutZone(selectedZone);
        if (!active) return;
        setData(result);
        setSelectedIds(result.spawns[0] ? [result.spawns[0].id] : []);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to parse zone');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedZone]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredSpawns = useMemo(() => {
    if (!data?.spawns) return [];
    const query = search.trim().toLowerCase();
    if (!query) return data.spawns;
    return data.spawns.filter((spawn) => getSearchText(spawn).includes(query));
  }, [data, search]);

  const filteredIdSet = useMemo(() => new Set(filteredSpawns.map((spawn) => spawn.id)), [filteredSpawns]);

  const selectedSpawns = useMemo(() => {
    if (!data?.spawns) return [];
    const spawnLookup = new Map(data.spawns.map((spawn) => [spawn.id, spawn]));
    return selectedIds.map((id) => spawnLookup.get(id)).filter(Boolean);
  }, [data, selectedIds]);

  const activeSpawn = selectedSpawns[0] || null;
  const staticPathIds = data?.best_static_path?.ordered_spawn_ids || [];

  function selectOnly(id) {
    setSelectedIds([id]);
  }

  function toggleSelection(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const result = await api.parseBuildoutFile(file);
      setData(result);
      setSelectedZone('');
      setSelectedIds(result.spawns[0] ? [result.spawns[0].id] : []);
      setToast(`Loaded ${file.name}`);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  return (
    <div className="max-w-[95rem] mx-auto px-3 sm:px-4 py-5 md:py-8 space-y-4 md:space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-4 py-2 text-xs font-display tracking-[0.25em] text-hull-200 uppercase mb-4">
            <Orbit size={14} className="text-plasma-400" />
            Space Buildout Explorer
          </div>
          <h1 className="font-display font-bold text-3xl tracking-wider text-hull-50 mb-2">
            Mission &amp; Spawn Tactical Map
          </h1>
          <p className="text-hull-200 max-w-3xl">
            Browse bundled zones or upload a buildout tab, inspect spawners, and work directly in a rotatable 3D space view instead of flattening everything into polite lies.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full lg:w-auto">
          <button
            className="btn-secondary w-full sm:w-auto justify-center"
            onClick={() => data && copyText(data.waypoints_all, 'All waypoints', setToast)}
            disabled={!data}
          >
            <Copy size={16} /> Copy All Waypoints
          </button>
          <button
            className="btn-secondary w-full sm:w-auto justify-center"
            onClick={() => data?.best_static_path && copyText(data.best_static_path.waypoints, 'Static path', setToast)}
            disabled={!data?.best_static_path}
          >
            <RouteIcon size={16} /> Copy Static Path
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-plasma-400/40 bg-plasma-500/10 px-4 py-3 text-sm text-plasma-200">
          {toast}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid xl:grid-cols-[320px_minmax(0,1fr)_370px] gap-4 md:gap-6 items-start">
        <aside className="space-y-4 order-2 xl:order-1">
          <div className="card p-4 space-y-4">
            <div>
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400 mb-2">
                Source
              </h2>
              <label className="text-xs text-hull-200 mb-2 block">Bundled zone</label>
              <select value={selectedZone} onChange={(event) => setSelectedZone(event.target.value)}>
                {!selectedZone && <option value="">Custom upload</option>}
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-hull-400/60 bg-hull-700/60 p-3">
              <label className="text-xs text-hull-200 mb-2 block">Upload custom .tab</label>
              <label className="btn-ghost w-full cursor-pointer justify-center">
                <FileUp size={16} /> {uploading ? 'Parsing...' : 'Choose Buildout File'}
                <input type="file" accept=".tab" className="hidden" onChange={handleUpload} />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-hull-200 block">Search spawners</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-hull-300" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, behavior, ships..."
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400 mb-3">
              Map Layers
            </h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-1 gap-2 text-sm text-hull-100">
              {LAYER_OPTIONS.map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-hull-400/50 bg-hull-700/50 px-3 py-2 cursor-pointer"
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={visible[key]}
                    onChange={() => setVisible((current) => ({ ...current, [key]: !current[key] }))}
                    className="!w-4 !h-4 accent-cyan-400"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <div className="text-xs font-display tracking-[0.16em] uppercase text-plasma-400 mb-2">Zone Items</div>
              <div className="text-2xl font-display text-hull-50">{data?.spawns?.length || 0}</div>
              <div className="text-xs text-hull-300">Spawner entries</div>
            </div>
            <div className="card p-4">
              <div className="text-xs font-display tracking-[0.16em] uppercase text-plasma-400 mb-2">Selection</div>
              <div className="text-2xl font-display text-hull-50">{selectedIds.length}</div>
              <div className="text-xs text-hull-300">Active markers</div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400">
                Spawner List
              </h2>
              <span className="badge badge-neutral">{filteredSpawns.length}</span>
            </div>

            <div className="max-h-[26rem] md:max-h-[34rem] overflow-auto space-y-2 pr-1">
              {loading ? (
                <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 px-4 py-10 text-center text-hull-200">
                  <RefreshCcw size={18} className="mx-auto mb-3 animate-spin text-plasma-400" />
                  Parsing buildout...
                </div>
              ) : filteredSpawns.length === 0 ? (
                <div className="rounded-xl border border-hull-400/50 bg-hull-700/50 px-4 py-6 text-sm text-hull-200">
                  No spawners match that filter.
                </div>
              ) : (
                filteredSpawns.map((spawn) => {
                  const active = selectedIds.includes(spawn.id);
                  return (
                    <button
                      key={spawn.id}
                      onClick={(event) => (event.shiftKey ? toggleSelection(spawn.id) : selectOnly(spawn.id))}
                      className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${
                        active
                          ? 'border-plasma-400/70 bg-plasma-500/10 shadow-glow'
                          : 'border-hull-400/50 bg-hull-700/50 hover:bg-hull-700 hover:border-hull-300/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-hull-50 truncate">
                            {spawn.name || `Spawner ${spawn.id}`}
                          </div>
                          <div className="text-xs text-hull-300 truncate">{spawn.spawner_type || 'Unknown type'}</div>
                        </div>
                        <span className="badge badge-neutral shrink-0">{spawn.spawn_count ?? 0}</span>
                      </div>

                      <div className="mt-2 text-xs text-hull-300 leading-relaxed break-words">
                        X {Number(spawn.coordinates?.[0] || 0).toFixed(0)} · Y {Number(spawn.coordinates?.[1] || 0).toFixed(0)} · Z {Number(spawn.coordinates?.[2] || 0).toFixed(0)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        <section className="space-y-4 order-1 xl:order-2 min-w-0">
          <BuildoutMap3D
            data={data}
            visible={visible}
            selectedIds={selectedIds}
            filteredIdSet={filteredIdSet}
            searchActive={Boolean(search.trim())}
            activeSpawn={activeSpawn}
            staticPathIds={staticPathIds}
            colors={COLORS}
            onSelectSpawn={selectOnly}
            onToggleSpawn={toggleSelection}
          />

          <div className="card p-4">
            <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400 mb-3">
              Legend
            </h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {LEGEND_ITEMS.map((item) => {
                const Icon = LEGEND_ICONS[item.icon];
                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-hull-400/50 bg-hull-700/50 px-3 py-3 flex items-center gap-3"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center border"
                      style={{
                        color: item.color,
                        borderColor: `${item.color}66`,
                        backgroundColor: `${item.color}14`,
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-hull-50">{item.label}</div>
                      <div className="text-xs text-hull-300">{item.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-4 order-3">
          <SelectionDetails activeSpawn={activeSpawn} selectedSpawns={selectedSpawns} setToast={setToast} />

          <div className="card p-4 space-y-3 text-sm text-hull-200">
            <div className="font-display tracking-[0.16em] uppercase text-plasma-400 text-sm">Selection Actions</div>
            <button
              className="btn-secondary w-full justify-center"
              onClick={() =>
                selectedSpawns.length &&
                copyText(
                  selectedSpawns.map((spawn) => spawn.waypoint).join('\n'),
                  'Selected waypoints',
                  setToast
                )
              }
              disabled={!selectedSpawns.length}
            >
              <MapIcon size={16} /> Copy Selected Waypoints
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
