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
  Sparkles,
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

function BuffInfo({ buff }) {
  return (
    <div className="relative group shrink-0">
      <button
        type="button"
        className="w-6 h-6 rounded-full border border-hull-400/40 bg-hull-800/80 text-hull-300 hover:text-plasma-300 hover:border-plasma-400/40 flex items-center justify-center transition-colors"
        aria-label={`Details for ${buff.name}`}
      >
        <Info size={12} />
      </button>
      <div className="pointer-events-none absolute right-0 top-8 z-20 w-72 rounded-xl border border-hull-400/50 bg-hull-900/95 backdrop-blur px-3 py-3 text-xs text-hull-200 shadow-2xl opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0">
        <div className="font-medium text-hull-50 mb-1">{buff.name}</div>
        <div className="text-hull-300 mb-2">{buff.description}</div>
        <div className="text-plasma-300">Effect: {formatBuffEffect(buff)}</div>
        <div className="text-hull-300 mt-1">
          Cost {buff.cost} point{buff.cost === 1 ? '' : 's'} • Max {buff.maxAssignments}
        </div>
      </div>
    </div>
  );
}

function BuffRow({ buff, categories, onChange }) {
  const increaseAllowed = canIncreaseBuff(categories, buff);
  const isSelected = buff.assignments > 0;

  return (
    <div
      className={`rounded-xl border px-3 py-2 transition-all ${
        isSelected
          ? 'border-plasma-400/45 bg-plasma-500/8'
          : 'border-hull-400/35 bg-hull-800/55'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-sm font-medium text-hull-50 truncate">{buff.name}</div>
            <span className="badge badge-neutral shrink-0">{buff.cost} pt</span>
          </div>
          <div className="mt-1 text-[11px] text-hull-300 truncate">
            {formatBuffEffect(buff)}
          </div>
        </div>
        <BuffInfo buff={buff} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-hull-400">
          {buff.assignments} / {buff.maxAssignments}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="btn-ghost h-8 w-8 px-0 justify-center"
            onClick={() => onChange(buff.name, -1)}
            disabled={buff.assignments <= 0}
            aria-label={`Decrease ${buff.name}`}
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            className="btn-ghost h-8 w-8 px-0 justify-center"
            onClick={() => onChange(buff.name, 1)}
            disabled={!increaseAllowed}
            aria-label={`Increase ${buff.name}`}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
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
    const timer = window.setTimeout(() => setToast(''), 2600);
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
    setToast('Selections cleared');
  }

  function handleApplyTemplate() {
    window.localStorage.setItem(STORAGE_KEY, requestTemplate);
    setToast('Request template saved');
  }

  function handleResetTemplate() {
    window.localStorage.setItem(STORAGE_KEY, ENT_BUFF_REQUEST_TEMPLATE_DEFAULT);
    setRequestTemplate(ENT_BUFF_REQUEST_TEMPLATE_DEFAULT);
    setToast('Request template reset');
  }

  async function handleCopyRequest() {
    const ok = await copyToClipboard(requestText);
    setToast(ok ? 'Request copied to clipboard' : 'Unable to copy request');
  }

  async function handleCopyShareLink() {
    const ok = await copyToClipboard(window.location.href);
    setToast(ok ? 'Share link copied to clipboard' : 'Unable to copy share link');
  }

  return (
    <div className="max-w-[96rem] mx-auto px-4 py-6 space-y-4 animate-slide-up">
      <div className="flex flex-col 2xl:flex-row 2xl:items-end 2xl:justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-4 py-2 text-[11px] font-display tracking-[0.25em] text-hull-200 uppercase mb-3">
            <Music4 size={14} className="text-plasma-400" />
            Social Tools
          </div>
          <h1 className="font-display font-bold text-3xl tracking-wider text-hull-50 mb-2">
            Entertainer Buff Builder
          </h1>
          <p className="text-hull-200 max-w-3xl text-sm lg:text-base">
            Build a compact entertainer package, stay inside the 20-point cap, and generate a shareable request message.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full 2xl:w-auto 2xl:min-w-[28rem]">
          <div className="card px-4 py-3 text-center">
            <div className="text-[11px] font-display tracking-[0.18em] uppercase text-hull-300">Assigned</div>
            <div className="text-2xl font-display text-hull-50 mt-1">{pointsAssigned}</div>
          </div>
          <div className="card px-4 py-3 text-center">
            <div className="text-[11px] font-display tracking-[0.18em] uppercase text-hull-300">Remaining</div>
            <div className="text-2xl font-display text-plasma-300 mt-1">{pointsRemaining}</div>
          </div>
          <div className="card px-4 py-3 text-center">
            <div className="text-[11px] font-display tracking-[0.18em] uppercase text-hull-300">Selected</div>
            <div className="text-2xl font-display text-hull-50 mt-1">{selectedBuffTexts.length}</div>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="rounded-xl border border-plasma-400/40 bg-plasma-500/10 px-4 py-2 text-sm text-plasma-200">
          {toast}
        </div>
      ) : null}

      <div className="grid 2xl:grid-cols-[minmax(0,1fr)_350px] gap-4 items-start">
        <section className="space-y-4 min-w-0">
          <div className="grid xl:grid-cols-3 lg:grid-cols-2 gap-4">
            {categories.map((category) => (
              <div key={category.name} className="card p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400">
                    {category.name}
                  </h2>
                  <span className="badge badge-neutral">{category.buffs.length}</span>
                </div>

                <div className="space-y-2.5">
                  {category.buffs.map((buff) => (
                    <BuffRow
                      key={buff.name}
                      buff={buff}
                      categories={categories}
                      onChange={changeBuff}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4 2xl:sticky 2xl:top-20">
          <div className="card p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400">
                Selected Buffs
              </h2>
              <span className="badge badge-neutral">{selectedBuffTexts.length}</span>
            </div>

            {selectedBuffTexts.length ? (
              <div className="flex flex-wrap gap-2 max-h-48 overflow-auto pr-1">
                {selectedBuffTexts.map((buffText) => (
                  <div
                    key={buffText}
                    className="rounded-full border border-hull-400/40 bg-hull-800/70 px-3 py-1.5 text-xs text-hull-100"
                  >
                    {buffText}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-hull-400/40 bg-hull-800/45 px-3 py-4 text-sm text-hull-300">
                Add buffs to see your package summary here.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={handleClearAll}>
                <RefreshCcw size={16} /> Clear
              </button>
              <button type="button" className="btn-secondary" onClick={handleCopyRequest} disabled={!requestText}>
                <Copy size={16} /> Copy Request
              </button>
              <button type="button" className="btn-ghost" onClick={handleCopyShareLink}>
                <Link2 size={16} /> Share Link
              </button>
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div>
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400 mb-2">
                Request Preview
              </h2>
              <textarea
                value={requestText}
                readOnly
                rows={4}
                className="min-h-[6.5rem] resize-none"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2 text-hull-50 font-display tracking-wide text-sm">
                <Save size={15} className="text-plasma-400" />
                Template
              </div>
              <input value={requestTemplate} onChange={(event) => setRequestTemplate(event.target.value)} />
              <p className="text-xs text-hull-300 mt-2">
                Use <code>%Buffs%</code> for original capitalization or <code>%buffs%</code> for lowercase formatting.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={handleApplyTemplate}>
                <Save size={16} /> Save Template
              </button>
              <button type="button" className="btn-ghost" onClick={handleResetTemplate}>
                <RefreshCcw size={16} /> Reset
              </button>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2 text-hull-50 font-display tracking-wide text-sm">
              <Sparkles size={15} className="text-plasma-400" />
              Quick Notes
            </div>
            <div className="space-y-2 text-xs text-hull-200 leading-relaxed">
              <p>Hover the info icon on any buff to see the full effect and source-style description.</p>
              <p>Selections are saved into the page URL with the <code>q</code> parameter so you can bookmark or share a build directly.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
