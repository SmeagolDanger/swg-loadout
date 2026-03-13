import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkPlus,
  Copy,
  Info,
  Link2,
  Minus,
  Music4,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  ENT_BUFF_POINTS_MAX,
  ENT_BUFF_REQUEST_TEMPLATE_DEFAULT,
  buildRequestText,
  buildSelectedBuffEffects,
  buildSelectedBuffTexts,
  calculateAssignedPoints,
  canIncreaseBuff,
  clearEntBuffAssignments,
  cloneEntBuffCategories,
  parseAssignments,
  serializeAssignments,
  updateBuffAssignments,
} from '../utils/entBuffs';

const STORAGE_KEY = 'ent-buff-request-template';
const SAVED_BUFFS_KEY = 'ent-buff-saved-builds';

function loadSavedBuilds() {
  try {
    return JSON.parse(window.localStorage.getItem(SAVED_BUFFS_KEY) || '[]');
  } catch {
    return [];
  }
}

function SavedBuildsModal({ savedBuilds, onLoad, onDelete, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-md overflow-hidden p-0 shadow-2xl">
        <div className="flex items-center justify-between border-b border-hull-500/40 px-4 py-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-plasma-400">
            Saved Builds
          </h2>
          <button
            type="button"
            className="btn-ghost h-7 w-7 justify-center p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3 space-y-2">
          {savedBuilds.length === 0 ? (
            <div className="rounded-lg border border-hull-400/40 bg-hull-800/60 px-3 py-4 text-center text-sm text-hull-300">
              No saved builds yet.
            </div>
          ) : (
            savedBuilds.map((build) => (
              <div
                key={build.id ?? build.name}
                className="flex items-center gap-2 rounded-xl border border-hull-400/40 bg-hull-800/60 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-hull-100" title={build.name}>
                  {build.name}
                </span>
                <button
                  type="button"
                  className="btn-secondary shrink-0 px-2.5 py-1.5 text-xs"
                  onClick={() => { onLoad(build); onClose(); }}
                >
                  Load
                </button>
                <button
                  type="button"
                  className="btn-ghost h-7 w-7 shrink-0 justify-center p-0 text-hull-400 hover:text-red-400"
                  onClick={() => onDelete(build.id, build.name)}
                  aria-label={`Delete ${build.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatBuffEffect(buff) {
  return `${buff.prefix || ''}${buff.effect}${buff.suffix || ''}`;
}

function copyToClipboard(text) {
  if (!text) return Promise.resolve(false);
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'absolute';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(area);
  return Promise.resolve(Boolean(copied));
}

function InfoTip({ title, lines = [] }) {
  return (
    <div className="relative group shrink-0">
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-hull-500/40 bg-hull-800/70 text-hull-300 transition-colors hover:border-plasma-400/50 hover:text-plasma-300"
        aria-label={title}
      >
        <Info size={14} />
      </button>
      <div className="pointer-events-none absolute right-0 top-9 z-30 hidden w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-hull-400/60 bg-hull-900/95 p-3 text-left shadow-2xl group-hover:block group-focus-within:block">
        <div className="text-sm font-medium text-hull-50">{title}</div>
        <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-hull-200">
          {lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}


export default function EntBuffBuilder() {
  const { user } = useAuth();
  const [categories, setCategories] = useState(() => cloneEntBuffCategories());
  const [requestTemplate, setRequestTemplate] = useState(ENT_BUFF_REQUEST_TEMPLATE_DEFAULT);
  const [toast, setToast] = useState('');
  const [savedBuilds, setSavedBuilds] = useState(() => loadSavedBuilds());
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const saveInputRef = useRef(null);

  const fetchBuildsFromApi = useCallback(async () => {
    try {
      const data = await api.getEntBuffBuilds();
      setSavedBuilds(data);
    } catch {
      // fall back to localStorage if API fails
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchBuildsFromApi();
    } else {
      setSavedBuilds(loadSavedBuilds());
    }
  }, [user, fetchBuildsFromApi]);

  useEffect(() => {
    const storedTemplate = window.localStorage.getItem(STORAGE_KEY);
    if (storedTemplate) {
      setRequestTemplate(storedTemplate);
    }

    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setCategories(parseAssignments(q));
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const serialized = serializeAssignments(categories);
    if (serialized.split('|').some((value) => Number(value) > 0)) {
      params.set('q', serialized);
    } else {
      params.delete('q');
    }
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', next);
  }, [categories]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const pointsAssigned = useMemo(() => calculateAssignedPoints(categories), [categories]);
  const selectedBuffTexts = useMemo(() => buildSelectedBuffTexts(categories), [categories]);
  const selectedBuffEffects = useMemo(() => buildSelectedBuffEffects(categories), [categories]);
  const requestText = useMemo(() => buildRequestText(categories, requestTemplate), [categories, requestTemplate]);
  const pointsRemaining = ENT_BUFF_POINTS_MAX - pointsAssigned;

  function changeBuff(buffName, delta) {
    setCategories((current) => updateBuffAssignments(current, buffName, delta));
  }

  function handleClearAll() {
    setCategories((current) => clearEntBuffAssignments(current));
    setToast('Selection cleared');
  }

  function handleApplyTemplate() {
    window.localStorage.setItem(STORAGE_KEY, requestTemplate);
    setToast('Template saved');
  }

  function handleResetTemplate() {
    window.localStorage.setItem(STORAGE_KEY, ENT_BUFF_REQUEST_TEMPLATE_DEFAULT);
    setRequestTemplate(ENT_BUFF_REQUEST_TEMPLATE_DEFAULT);
    setToast('Template reset');
  }

  async function handleCopyRequest() {
    const ok = await copyToClipboard(requestText);
    setToast(ok ? 'Request copied' : 'Unable to copy request');
  }

  async function handleCopyShareLink() {
    const ok = await copyToClipboard(window.location.href);
    setToast(ok ? 'Share link copied' : 'Unable to copy share link');
  }

  function handleOpenSaveInput() {
    setSaveName('');
    setShowSaveInput(true);
    setTimeout(() => saveInputRef.current?.focus(), 0);
  }

  async function handleConfirmSave() {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    const serialized = serializeAssignments(categories);
    setShowSaveInput(false);
    setSaveName('');
    if (user) {
      try {
        await api.saveEntBuffBuild(trimmed, serialized);
        await fetchBuildsFromApi();
        setToast(`Saved "${trimmed}"`);
      } catch {
        setToast('Failed to save build');
      }
    } else {
      const updated = [
        { name: trimmed, serialized },
        ...savedBuilds.filter((b) => b.name !== trimmed),
      ];
      setSavedBuilds(updated);
      window.localStorage.setItem(SAVED_BUFFS_KEY, JSON.stringify(updated));
      setToast(`Saved "${trimmed}"`);
    }
  }

  function handleLoadBuild(build) {
    setCategories(parseAssignments(build.serialized));
    setToast(`Loaded "${build.name}"`);
  }

  async function handleDeleteSaved(id, name) {
    if (user) {
      try {
        await api.deleteEntBuffBuild(id);
        setSavedBuilds((prev) => prev.filter((b) => b.id !== id));
      } catch {
        setToast('Failed to delete build');
      }
    } else {
      const updated = savedBuilds.filter((b) => b.name !== name);
      setSavedBuilds(updated);
      window.localStorage.setItem(SAVED_BUFFS_KEY, JSON.stringify(updated));
    }
  }

  return (
    <div className="mx-auto w-full max-w-[95rem] overflow-x-clip px-4 py-4 animate-slide-up">
      <div className="w-full max-w-full space-y-4">
        <div className="card w-full max-w-full overflow-hidden px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* title */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Music4 size={13} className="shrink-0 text-plasma-400" />
              <h1 className="min-w-0 truncate font-display text-lg font-bold tracking-wider text-hull-50">
                Entertainer Buff Builder
              </h1>
              <InfoTip
                title="How this works"
                lines={[
                  'Pick buff packages until you reach the 20-point entertainer cap.',
                  'Use the request template tokens %Buffs% or %buffs% to insert your current selection.',
                  'Selections are stored in the q= URL parameter so you can bookmark or share the build.',
                ]}
              />
            </div>

            {/* stats */}
            <div className="flex shrink-0 items-center divide-x divide-hull-500/40 rounded-xl border border-hull-500/40 bg-hull-800/60">
              {[
                { label: 'Assigned', value: pointsAssigned, color: 'text-green-300' },
                { label: 'Remaining', value: pointsRemaining, color: pointsRemaining === 0 ? 'text-laser-yellow' : 'text-hull-100' },
                { label: 'Selected', value: selectedBuffTexts.length, color: 'text-hull-100' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-baseline gap-1.5 px-3 py-1.5">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-hull-400">{label}</span>
                  <span className={`font-display text-base font-semibold leading-none ${color}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* actions */}
            <div className="flex shrink-0 items-center divide-x divide-hull-500/40 rounded-xl border border-hull-500/40 bg-hull-800/60 overflow-hidden">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-plasma-300 transition-colors hover:bg-hull-700/60 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleCopyRequest}
                disabled={!requestText}
              >
                <Copy size={13} className="shrink-0" /> Request
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-hull-300 transition-colors hover:bg-hull-700/60"
                onClick={handleCopyShareLink}
              >
                <Link2 size={13} className="shrink-0" /> Share
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-hull-300 transition-colors hover:bg-hull-700/60 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleOpenSaveInput}
                disabled={!selectedBuffTexts.length}
              >
                <BookmarkPlus size={13} className="shrink-0" /> Save
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-hull-300 transition-colors hover:bg-hull-700/60"
                onClick={() => setShowSavedModal(true)}
              >
                <Bookmark size={13} className="shrink-0" /> Saved
                {savedBuilds.length > 0 && (
                  <span className="badge badge-neutral ml-1 shrink-0">{savedBuilds.length}</span>
                )}
              </button>
            </div>
          </div>

          {showSaveInput && (
            <div className="mt-3 flex items-center gap-2">
              <input
                ref={saveInputRef}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmSave();
                  if (e.key === 'Escape') setShowSaveInput(false);
                }}
                placeholder="Build name…"
                className="flex-1 text-sm"
                maxLength={64}
              />
              <button
                type="button"
                className="btn-secondary shrink-0 px-3 py-2 text-xs"
                onClick={handleConfirmSave}
                disabled={!saveName.trim()}
              >
                <Save size={14} className="shrink-0" /> Save
              </button>
              <button
                type="button"
                className="btn-ghost h-8 w-8 shrink-0 justify-center p-0"
                onClick={() => setShowSaveInput(false)}
                aria-label="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {toast ? (
            <div className="mt-3 rounded-xl border border-plasma-400/40 bg-plasma-500/10 px-3 py-2 text-sm text-plasma-200">
              {toast}
            </div>
          ) : null}
        </div>

        <div className="grid w-full min-w-0 max-w-full items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="min-w-0 max-w-full space-y-4">
            <div className="grid w-full min-w-0 max-w-full gap-3 xl:grid-cols-2 2xl:grid-cols-3">
              {categories.map((category) => (
                <div key={category.name} className="card min-w-0 max-w-full p-3">
                  <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                    <h2 className="min-w-0 truncate font-display text-xs font-semibold uppercase tracking-[0.16em] text-plasma-400">
                      {category.name}
                    </h2>
                    <span className="badge badge-neutral shrink-0">{category.buffs.length}</span>
                  </div>

                  <div className="w-full min-w-0 max-w-full space-y-2">
                    {category.buffs.map((buff) => {
                      const increaseAllowed = canIncreaseBuff(categories, buff);
                      const isSelected = buff.assignments > 0;

                      return (
                        <div
                          key={buff.name}
                          className={`w-full min-w-0 max-w-full rounded-xl border px-3 py-2.5 transition-all ${
                            isSelected
                              ? 'border-plasma-400/50 bg-plasma-500/10'
                              : 'border-hull-400/40 bg-hull-800/60'
                          }`}
                        >
                          <div className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="block min-w-0 truncate text-sm font-medium text-hull-50 sm:whitespace-normal sm:overflow-visible"
                                title={buff.name}
                              >
                                {buff.name}
                              </span>
                              <InfoTip
                                title={buff.name}
                                lines={[
                                  `Cost: ${buff.cost} point${buff.cost === 1 ? '' : 's'} per package`,
                                  `Max packages: ${buff.maxAssignments}`,
                                  `Effect: ${formatBuffEffect(buff)}`,
                                  buff.description,
                                ]}
                              />
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <span className="badge badge-neutral min-w-[4rem] shrink-0 justify-center text-center sm:min-w-[4.25rem]">
                                {buff.assignments}/{buff.maxAssignments}
                              </span>

                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  className="btn-ghost h-8 w-8 shrink-0 justify-center p-0"
                                  onClick={() => changeBuff(buff.name, -1)}
                                  disabled={buff.assignments <= 0}
                                  aria-label={`Decrease ${buff.name}`}
                                >
                                  <Minus size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary h-8 w-8 shrink-0 justify-center p-0"
                                  onClick={() => changeBuff(buff.name, 1)}
                                  disabled={!increaseAllowed}
                                  aria-label={`Increase ${buff.name}`}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="min-w-0 max-w-full space-y-3 xl:sticky xl:top-20">
            <div className="card w-full min-w-0 max-w-full overflow-hidden space-y-3 p-4">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <h2 className="min-w-0 truncate font-display text-xs font-semibold uppercase tracking-[0.16em] text-plasma-400">
                  Request Message
                </h2>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn-ghost min-w-0 px-2.5 py-1.5 text-xs"
                    onClick={handleApplyTemplate}
                  >
                    <Save size={14} className="shrink-0" /> <span className="truncate">Save</span>
                  </button>
                  <button
                    type="button"
                    className="btn-ghost min-w-0 px-2.5 py-1.5 text-xs"
                    onClick={handleResetTemplate}
                  >
                    <RefreshCcw size={14} className="shrink-0" /> <span className="truncate">Reset</span>
                  </button>
                </div>
              </div>

              <input
                value={requestTemplate}
                onChange={(event) => setRequestTemplate(event.target.value)}
              />
              <textarea
                value={requestText}
                readOnly
                rows={4}
                placeholder="Select buffs to generate a request message."
                className="resize-none text-sm"
              />
            </div>

            <div className="card w-full min-w-0 max-w-full overflow-hidden p-4">
              <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
                <h2 className="min-w-0 truncate font-display text-xs font-semibold uppercase tracking-[0.16em] text-plasma-400">
                  Selected Buffs
                </h2>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="badge badge-neutral shrink-0">{selectedBuffTexts.length}</span>
                  {!!selectedBuffTexts.length && (
                    <button
                      type="button"
                      className="btn-ghost min-w-0 px-2.5 py-1.5 text-xs"
                      onClick={handleClearAll}
                    >
                      <RefreshCcw size={14} className="shrink-0" /> <span className="truncate">Clear</span>
                    </button>
                  )}
                </div>
              </div>

              {selectedBuffEffects.length ? (
                <div className="w-full min-w-0 max-w-full space-y-1">
                  {selectedBuffEffects.map((effectText) => (
                    <div
                      key={effectText}
                      className="flex min-w-0 items-center gap-2 px-1 py-0.5 text-sm text-hull-100"
                    >
                      <span className="shrink-0 text-plasma-400">›</span>
                      <span className="min-w-0 break-words">{effectText}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-hull-400/40 bg-hull-800/60 px-3 py-3 text-sm text-hull-300">
                  Select one or more buffs to build a request.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {showSavedModal && (
        <SavedBuildsModal
          savedBuilds={savedBuilds}
          onLoad={handleLoadBuild}
          onDelete={handleDeleteSaved}
          onClose={() => setShowSavedModal(false)}
        />
      )}
    </div>
  );
}