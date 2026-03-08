import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Music4, Plus, Minus, RefreshCcw, Save, Sparkles, Link2 } from 'lucide-react';
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

  function changeBuff(buffName, delta) {
    setCategories((current) => updateBuffAssignments(current, buffName, delta));
  }

  function handleClearAll() {
    setCategories((current) => clearEntBuffAssignments(current));
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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-slide-up">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-4 py-2 text-xs font-display tracking-[0.25em] text-hull-200 uppercase mb-4">
            <Music4 size={14} className="text-plasma-400" />
            Social Tools
          </div>
          <h1 className="font-display font-bold text-3xl tracking-wider text-hull-50 mb-2">
            Entertainer Buff Builder
          </h1>
          <p className="text-hull-200 max-w-3xl">
            Build an entertainer buff package, keep track of the 20-point cap, and generate a ready-to-send request message based on the published source tool.
          </p>
        </div>

        <div className="card px-4 py-3 min-w-[18rem]">
          <div className="text-[11px] font-display tracking-[0.18em] uppercase text-hull-300 mb-2">Selection summary</div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-3xl font-display text-hull-50">{pointsAssigned}</div>
              <div className="text-xs text-hull-300">of {ENT_BUFF_POINTS_MAX} points assigned</div>
            </div>
            <div className="w-24 h-24 rounded-full border border-plasma-500/30 bg-plasma-500/10 flex items-center justify-center">
              <div className="text-center">
                <div className="text-plasma-300 font-display text-2xl">{selectedBuffTexts.length}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-hull-300">buffs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="rounded-2xl border border-plasma-400/40 bg-plasma-500/10 px-4 py-3 text-sm text-plasma-200">
          {toast}
        </div>
      ) : null}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <section className="space-y-4 min-w-0">
          <div className="grid lg:grid-cols-2 gap-4">
            {categories.map((category) => (
              <div key={category.name} className="card p-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400">
                    {category.name}
                  </h2>
                  <span className="badge badge-neutral">{category.buffs.length}</span>
                </div>

                <div className="space-y-3">
                  {category.buffs.map((buff) => {
                    const increaseAllowed = canIncreaseBuff(categories, buff);
                    const isSelected = buff.assignments > 0;
                    return (
                      <div
                        key={buff.name}
                        className={`rounded-2xl border p-4 transition-all ${
                          isSelected
                            ? 'border-plasma-400/50 bg-plasma-500/10'
                            : 'border-hull-400/40 bg-hull-800/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="text-hull-50 font-medium">{buff.name}</div>
                            <div className="text-xs text-hull-300 mt-1">{buff.description}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="badge badge-neutral">{buff.cost} pt{buff.cost === 1 ? '' : 's'}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="text-sm text-hull-200">
                            <span className="text-hull-300">Effect:</span> {formatBuffEffect(buff)}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="btn-ghost px-3"
                              onClick={() => changeBuff(buff.name, -1)}
                              disabled={buff.assignments <= 0}
                            >
                              <Minus size={16} />
                            </button>
                            <div className="min-w-[6rem] rounded-xl border border-hull-400/40 bg-hull-900/70 px-3 py-2 text-center text-sm text-hull-50">
                              {buff.assignments} / {buff.maxAssignments}
                            </div>
                            <button
                              type="button"
                              className="btn-ghost px-3"
                              onClick={() => changeBuff(buff.name, 1)}
                              disabled={!increaseAllowed}
                            >
                              <Plus size={16} />
                            </button>
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

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400">
                Selected Buffs
              </h2>
              <span className="badge badge-neutral">{selectedBuffTexts.length}</span>
            </div>

            {selectedBuffTexts.length ? (
              <div className="space-y-2">
                {selectedBuffTexts.map((buffText) => (
                  <div key={buffText} className="rounded-xl border border-hull-400/40 bg-hull-800/60 px-3 py-2 text-sm text-hull-100">
                    {buffText}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-hull-400/40 bg-hull-800/60 px-3 py-4 text-sm text-hull-300">
                Select buffs from the list to build a request.
              </div>
            )}

            {selectedBuffTexts.length ? (
              <button type="button" className="btn-secondary w-full mt-4 justify-center" onClick={handleClearAll}>
                <RefreshCcw size={16} /> Clear All
              </button>
            ) : null}
          </div>

          <div className="card p-4 space-y-4">
            <div>
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400 mb-2">
                Request Message
              </h2>
              <textarea
                value={requestText}
                readOnly
                rows={4}
                placeholder="Select buffs to generate a request message."
                className="resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={handleCopyRequest} disabled={!requestText}>
                <Copy size={16} /> Copy Request
              </button>
              <button type="button" className="btn-ghost" onClick={handleCopyShareLink}>
                <Link2 size={16} /> Copy Share Link
              </button>
            </div>
          </div>

          <div className="card p-4 space-y-4">
            <div>
              <h2 className="font-display font-semibold tracking-[0.16em] uppercase text-sm text-plasma-400 mb-2">
                Request Template
              </h2>
              <p className="text-sm text-hull-300 mb-3">
                Use <code>%Buffs%</code> for the original capitalization or <code>%buffs%</code> for lowercase formatting.
              </p>
              <input value={requestTemplate} onChange={(event) => setRequestTemplate(event.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={handleApplyTemplate}>
                <Save size={16} /> Save Template
              </button>
              <button type="button" className="btn-ghost" onClick={handleResetTemplate}>
                <RefreshCcw size={16} /> Reset Template
              </button>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3 text-hull-50 font-display tracking-wide">
              <Sparkles size={16} className="text-plasma-400" />
              Source Notes
            </div>
            <div className="space-y-2 text-sm text-hull-200">
              <p>This builder recreates the published entertainer buff tool logic for Legends, including the 20-point cap, request template tokens, and shareable assignment string format.</p>
              <p>Selections are stored in the URL with the <code>q</code> parameter so you can bookmark or share a build directly.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
