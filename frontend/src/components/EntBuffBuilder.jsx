import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Info,
  Link2,
  Minus,
  Music4,
  Plus,
  RefreshCcw,
  Save,
} from 'lucide-react';
import {
  ENT_BUFF_POINTS_MAX,
  ENT_BUFF_REQUEST_TEMPLATE_DEFAULT,
  buildRequestText,
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
      <div className="pointer-events-none absolute right-0 top-9 z-30 hidden w-72 rounded-xl border border-hull-400/60 bg-hull-900/95 p-3 text-left shadow-2xl group-hover:block group-focus-within:block">
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

function SummaryPill({ label, value, tone = 'neutral' }) {
  const toneClass =
    tone === 'good'
      ? 'border-green-400/30 bg-green-500/10 text-green-200'
      : tone === 'warn'
        ? 'border-laser-yellow/40 bg-laser-yellow/10 text-laser-yellow'
        : 'border-hull-400/40 bg-hull-800/70 text-hull-100';

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">{label}</div>
      <div className="font-display text-lg leading-none mt-1">{value}</div>
    </div>
  );
}

export default function EntBuffBuilder() {
  const [categories, setCategories] = useState(() => cloneEntBuffCategories());
  const [requestTemplate, setRequestTemplate] = useState(ENT_BUFF_REQUEST_TEMPLATE_DEFAULT);
  const [toast, setToast] = useState('');

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

  return (
    <div className="max-w-[95rem] mx-auto w-full overflow-x-hidden px-3 sm:px-4 py-6 space-y-4 animate-slide-up">
      <div className="card p-4 lg:p-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-3 py-1.5 text-[11px] font-display tracking-[0.22em] text-hull-200 uppercase mb-3">
              <Music4 size={13} className="text-plasma-400" />
              Social Tools
            </div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-2xl tracking-wider text-hull-50">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 xl:min-w-0 xl:max-w-[34rem] w-full">
            <SummaryPill label="Assigned" value={pointsAssigned} tone="good" />
            <SummaryPill label="Remaining" value={pointsRemaining} tone={pointsRemaining === 0 ? 'warn' : 'neutral'} />
            <SummaryPill label="Selected" value={selectedBuffTexts.length} />
            <div className="sm:col-span-2 lg:col-span-2 flex flex-wrap sm:flex-nowrap items-stretch sm:items-center justify-stretch sm:justify-end gap-2 min-w-0">
              <button type="button" className="btn-secondary text-xs px-3 py-2 flex-1 sm:flex-none min-w-0 justify-center" onClick={handleCopyRequest} disabled={!requestText}>
                <Copy size={15} /> Request
              </button>
              <button type="button" className="btn-ghost text-xs px-3 py-2 flex-1 sm:flex-none min-w-0 justify-center" onClick={handleCopyShareLink}>
                <Link2 size={15} /> Share
              </button>
            </div>
          </div>
        </div>

        {toast ? (
          <div className="mt-3 rounded-xl border border-plasma-400/40 bg-plasma-500/10 px-3 py-2 text-sm text-plasma-200">
            {toast}
          </div>
        ) : null}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_24rem] gap-4 items-start">
        <section className="space-y-4 min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
            {categories.map((category) => (
              <div key={category.name} className="card p-3">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-xs text-plasma-400">
                    {category.name}
                  </h2>
                  <span className="badge badge-neutral">{category.buffs.length}</span>
                </div>

                <div className="space-y-2">
                  {category.buffs.map((buff) => {
                    const increaseAllowed = canIncreaseBuff(categories, buff);
                    const isSelected = buff.assignments > 0;
                    return (
                      <div
                        key={buff.name}
                        className={`rounded-xl border px-3 py-2.5 transition-all ${
                          isSelected
                            ? 'border-plasma-400/50 bg-plasma-500/10'
                            : 'border-hull-400/40 bg-hull-800/60'
                        }`}
                      >
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                          <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate text-sm font-medium text-hull-50">{buff.name}</span>
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
                          </div>

                          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2 sm:gap-3 min-w-0">
                            <span className="badge badge-neutral shrink-0">
                              {buff.assignments}/{buff.maxAssignments}
                            </span>

                            <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
                              <button
                                type="button"
                                className="btn-ghost h-8 w-8 p-0 justify-center"
                                onClick={() => changeBuff(buff.name, -1)}
                                disabled={buff.assignments <= 0}
                                aria-label={`Decrease ${buff.name}`}
                              >
                                <Minus size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn-secondary h-8 w-8 p-0 justify-center"
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

        <aside className="space-y-3 xl:sticky xl:top-20">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-xs text-plasma-400">
                Request Message
              </h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button type="button" className="btn-ghost text-xs px-2.5 py-1.5 flex-1 sm:flex-none justify-center" onClick={handleApplyTemplate}>
                  <Save size={14} /> Save
                </button>
                <button type="button" className="btn-ghost text-xs px-2.5 py-1.5 flex-1 sm:flex-none justify-center" onClick={handleResetTemplate}>
                  <RefreshCcw size={14} /> Reset
                </button>
              </div>
            </div>

            <input value={requestTemplate} onChange={(event) => setRequestTemplate(event.target.value)} />
            <textarea
              value={requestText}
              readOnly
              rows={4}
              placeholder="Select buffs to generate a request message."
              className="resize-none text-sm"
            />
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-xs text-plasma-400">
                Selected Buffs
              </h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="badge badge-neutral">{selectedBuffTexts.length}</span>
                {!!selectedBuffTexts.length && (
                  <button type="button" className="btn-ghost text-xs px-2.5 py-1.5 flex-1 sm:flex-none justify-center" onClick={handleClearAll}>
                    <RefreshCcw size={14} /> Clear
                  </button>
                )}
              </div>
            </div>

            {selectedBuffTexts.length ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-1 gap-2">
                {selectedBuffTexts.map((buffText) => (
                  <div key={buffText} className="rounded-lg border border-hull-400/40 bg-hull-800/60 px-3 py-2 text-xs text-hull-100">
                    {buffText}
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
  );
}
