import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Filter, Search, Tag } from 'lucide-react';

import { api } from '../api';
import { formatBytes, splitModTags } from '../utils/mods';


export default function ModsBrowser() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [mods, setMods] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getMods({ featured: undefined })
      .then((data) => {
        if (!active) return;
        setMods(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load mods');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const availableCategories = useMemo(() => {
    const values = Array.from(new Set(mods.map((mod) => (mod.category || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return ['all', ...values];
  }, [mods]);

  useEffect(() => {
    if (category !== 'all' && !availableCategories.includes(category)) {
      setCategory('all');
    }
  }, [availableCategories, category]);

  const filteredMods = useMemo(() => {
    const query = search.trim().toLowerCase();
    return mods.filter((mod) => {
      if (category !== 'all' && mod.category !== category) return false;
      if (!query) return true;
      return [mod.title, mod.summary, mod.tags, mod.author_name].join(' ').toLowerCase().includes(query);
    });
  }, [mods, search, category]);

  useEffect(() => {
    if (!filteredMods.length) {
      setSelected(null);
      return;
    }
    const targetSlug = slug || selected?.slug || filteredMods[0]?.slug;
    if (!targetSlug) return;
    let active = true;
    setDetailLoading(true);
    api.getMod(targetSlug)
      .then((data) => {
        if (!active) return;
        setSelected(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load mod');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, filteredMods]);

  const featuredMods = mods.filter((mod) => mod.is_featured).slice(0, 3);

  const openMod = (nextSlug) => {
    navigate(`/mods/${nextSlug}`);
  };

  return (
    <div className="max-w-[95rem] mx-auto px-4 py-8 space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-hull-500/50 bg-hull-800/70 px-4 py-2 text-xs font-display tracking-[0.25em] text-hull-200 uppercase mb-4">
            <Download size={14} className="text-plasma-400" />
            Curated Mod Library
          </div>
          <h1 className="font-display font-bold text-3xl tracking-wider text-hull-50 mb-2">GAME MOD DOWNLOADS</h1>
          <p className="text-hull-200 max-w-3xl">
            Browse curated SWG mods, preview screenshots, check install notes, and download a single zip bundle for each mod.
          </p>
        </div>
      </div>

      {featuredMods.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-4">
          {featuredMods.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => openMod(mod.slug)}
              className="card p-4 text-left hover:border-plasma-400/60 transition-all"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-display text-sm tracking-[0.18em] text-laser-yellow uppercase">Featured</div>
                <div className="badge badge-neutral">{mod.version}</div>
              </div>
              <div className="font-display font-semibold text-hull-50 text-lg">{mod.title}</div>
              <p className="text-sm text-hull-200 mt-2">{mod.summary}</p>
            </button>
          ))}
        </div>
      )}

      <div className="grid xl:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
        <aside className="space-y-4">
          <div className="card p-4 space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-hull-300" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mods..." className="pl-10" />
            </div>
            <div>
              <label className="text-xs text-hull-200 block mb-2">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {availableCategories.map((item) => (
                  <option key={item} value={item}>
                    {item === 'all' ? 'All categories' : item.replace(/-/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card p-4 space-y-2 max-h-[44rem] overflow-auto">
            <div className="flex items-center gap-2 text-sm font-display tracking-[0.16em] uppercase text-plasma-400">
              <Filter size={14} /> Mods ({filteredMods.length})
            </div>
            {loading ? (
              <div className="text-sm text-hull-200 py-8">Loading mods...</div>
            ) : filteredMods.length === 0 ? (
              <div className="text-sm text-hull-300 py-8">No mods match that filter.</div>
            ) : filteredMods.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => openMod(mod.slug)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${selected?.slug === mod.slug ? 'border-plasma-400/60 bg-plasma-500/10 shadow-glow' : 'border-hull-400/40 bg-hull-700/50 hover:border-hull-300/70 hover:bg-hull-700'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-hull-50">{mod.title}</div>
                    <div className="text-xs text-hull-300 mt-1">{mod.category} · {mod.version}</div>
                  </div>
                  {mod.is_featured && <span className="badge badge-admin shrink-0">Featured</span>}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-4 min-w-0">
          {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
          {!selected ? (
            <div className="card p-8 text-hull-200">Select a mod to view details.</div>
          ) : detailLoading ? (
            <div className="card p-8 text-hull-200">Loading mod details...</div>
          ) : (
            <>
              <div className="card p-5 space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h2 className="font-display font-bold text-2xl tracking-wider text-hull-50">{selected.title}</h2>
                      <span className="badge badge-neutral">{selected.version}</span>
                      <span className="badge badge-neutral">{selected.compatibility}</span>
                    </div>
                    <div className="text-sm text-hull-300">By {selected.author_name || 'Unknown author'}</div>
                    <p className="text-hull-200 mt-3 max-w-3xl">{selected.description || selected.summary}</p>
                  </div>
                  <div className="card-strong p-4 min-w-[260px] xl:max-w-[320px] space-y-3">
                    <div className="text-sm text-hull-200">Files included: <span className="text-hull-50 font-medium">{selected.files.length}</span></div>
                    <div className="text-sm text-hull-200">Screenshots: <span className="text-hull-50 font-medium">{selected.screenshots.length}</span></div>
                    <a href={`/api/mods/${selected.slug}/download`} className="btn-primary w-full justify-center">
                      <Download size={16} /> Download ZIP
                    </a>
                  </div>
                </div>

                {selected.tags && (
                  <div className="flex flex-wrap gap-2">
                    {splitModTags(selected.tags).map((tag) => (
                      <span key={tag} className="rounded-full border border-hull-500/50 bg-hull-800/70 px-3 py-1 text-xs font-display tracking-wide text-hull-200 inline-flex items-center gap-1">
                        <Tag size={12} /> {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <div className="space-y-4 min-w-0">
                  <div className="card p-4">
                    <h3 className="font-display text-sm tracking-[0.18em] text-plasma-400 uppercase mb-3">Screenshots</h3>
                    {selected.screenshots.length === 0 ? (
                      <div className="text-sm text-hull-300 py-6">No screenshots uploaded yet.</div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        {selected.screenshots.map((image) => (
                          <a key={image.id} href={image.url} target="_blank" rel="noreferrer" className="rounded-2xl overflow-hidden border border-hull-400/40 bg-hull-800/60 block hover:border-plasma-400/50 transition-colors">
                            <img src={image.url} alt={image.caption || selected.title} className="w-full h-56 object-cover bg-hull-900" />
                            <div className="px-3 py-2 text-sm text-hull-200">{image.caption || 'Preview'}</div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card p-4">
                    <h3 className="font-display text-sm tracking-[0.18em] text-plasma-400 uppercase mb-3">Installation</h3>
                    <div className="whitespace-pre-wrap text-sm text-hull-200 leading-relaxed">{selected.install_instructions || 'No install notes have been added yet.'}</div>
                  </div>
                </div>

                <div className="card p-4 h-fit">
                  <h3 className="font-display text-sm tracking-[0.18em] text-plasma-400 uppercase mb-3">Included Files</h3>
                  <div className="space-y-2">
                    {selected.files.map((file) => (
                      <div key={file.id} className="rounded-xl border border-hull-400/40 bg-hull-800/60 px-3 py-3">
                        <div className="text-sm text-hull-50 font-medium">{file.label || file.original_filename}</div>
                        <div className="text-xs text-hull-300 mt-1">{file.original_filename}</div>
                        <div className="text-xs text-hull-400 mt-1">{formatBytes(file.file_size)}</div>
                      </div>
                    ))}
                    {selected.files.length === 0 && (
                      <div className="text-sm text-hull-300 py-4">No files uploaded yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
