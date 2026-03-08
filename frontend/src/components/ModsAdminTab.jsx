import React, { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Plus, RefreshCcw, Save, Trash2, Upload } from 'lucide-react';

import { api } from '../api';
import { splitModTags, slugifyModTitle } from '../utils/mods';

const EMPTY_FORM = {
  title: '',
  slug: '',
  author_name: '',
  summary: '',
  description: '',
  category: 'general',
  tags: '',
  version: '1.0',
  compatibility: 'SWG Legends',
  install_instructions: '',
  is_published: false,
  is_featured: false,
};

export default function ModsAdminTab() {
  const [mods, setMods] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedSummary = useMemo(() => mods.find((item) => item.id === selectedId) || null, [mods, selectedId]);

  const loadMods = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminMods();
      setMods(data);
      const nextId = selectedId || data[0]?.id || null;
      setSelectedId(nextId);
    } catch (error) {
      setMessage(error.message || 'Failed to load mods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMods();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    api.getAdminMod(selectedId)
      .then((data) => {
        if (!active) return;
        setDetail(data);
        setForm({
          title: data.title || '',
          slug: data.slug || '',
          author_name: data.author_name || '',
          summary: data.summary || '',
          description: data.description || '',
          category: data.category || 'general',
          tags: data.tags || '',
          version: data.version || '1.0',
          compatibility: data.compatibility || 'SWG Legends',
          install_instructions: data.install_instructions || '',
          is_published: !!data.is_published,
          is_featured: !!data.is_featured,
        });
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error.message || 'Failed to load mod');
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const flash = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2500);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const created = await api.createMod({ ...EMPTY_FORM, title: 'New Mod', slug: `new-mod-${Date.now()}` });
      await loadMods();
      setSelectedId(created.id);
      flash('Mod created');
    } catch (error) {
      flash(error.message || 'Failed to create mod');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.updateMod(selectedId, { ...form, slug: form.slug || slugifyModTitle(form.title) });
      await loadMods();
      flash('Mod saved');
    } catch (error) {
      flash(error.message || 'Failed to save mod');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !window.confirm('Delete this mod and all uploaded files?')) return;
    try {
      await api.deleteMod(selectedId);
      setSelectedId(null);
      setDetail(null);
      setForm(EMPTY_FORM);
      await loadMods();
      flash('Mod deleted');
    } catch (error) {
      flash(error.message || 'Failed to delete mod');
    }
  };

  const handleFileUpload = async (event, kind) => {
    const files = event.target.files;
    if (!selectedId || !files?.length) return;
    try {
      const next = kind === 'screens' ? await api.uploadModScreenshots(selectedId, files) : await api.uploadModFiles(selectedId, files);
      setDetail(next);
      flash(kind === 'screens' ? 'Screenshots uploaded' : 'Files uploaded');
      await loadMods();
    } catch (error) {
      flash(error.message || 'Upload failed');
    } finally {
      event.target.value = '';
    }
  };

  const handleDeleteFile = async (id, type) => {
    try {
      if (type === 'file') await api.deleteModFile(id);
      else await api.deleteModScreenshot(id);
      const next = await api.getAdminMod(selectedId);
      setDetail(next);
      await loadMods();
      flash(type === 'file' ? 'File removed' : 'Screenshot removed');
    } catch (error) {
      flash(error.message || 'Delete failed');
    }
  };

  return (
    <div className="grid xl:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
      <aside className="space-y-4">
        <div className="card p-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-sm tracking-[0.18em] text-plasma-400 uppercase">Curated Mods</div>
            <div className="text-sm text-hull-200 mt-1">Admin-managed only.</div>
          </div>
          <button type="button" className="btn-primary text-xs" onClick={handleCreate} disabled={saving}>
            <Plus size={14} /> New Mod
          </button>
        </div>
        <div className="card p-3 space-y-2 max-h-[52rem] overflow-auto">
          {loading ? (
            <div className="text-sm text-hull-200 p-4">Loading mods...</div>
          ) : mods.map((mod) => (
            <button
              type="button"
              key={mod.id}
              onClick={() => setSelectedId(mod.id)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${selectedId === mod.id ? 'border-plasma-400/60 bg-plasma-500/10 shadow-glow' : 'border-hull-400/40 bg-hull-700/50 hover:bg-hull-700'}`}
            >
              <div className="font-medium text-hull-50">{mod.title}</div>
              <div className="text-xs text-hull-300 mt-1">{mod.category} · {mod.version}</div>
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-4 min-w-0">
        {message && <div className="rounded-xl border border-laser-yellow/30 bg-laser-yellow/10 px-4 py-3 text-sm text-laser-yellow">{message}</div>}
        {!selectedId ? (
          <div className="card p-8 text-hull-200">Create or select a mod to begin.</div>
        ) : (
          <>
            <div className="card p-4 space-y-4">
              <div className="grid lg:grid-cols-2 gap-4">
                <label className="space-y-2 text-sm text-hull-200">
                  <span>Title</span>
                  <input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value, slug: current.slug || slugifyModTitle(e.target.value) }))} />
                </label>
                <label className="space-y-2 text-sm text-hull-200">
                  <span>Slug</span>
                  <input value={form.slug} onChange={(e) => setForm((current) => ({ ...current, slug: slugifyModTitle(e.target.value) }))} />
                </label>
                <label className="space-y-2 text-sm text-hull-200">
                  <span>Author</span>
                  <input value={form.author_name} onChange={(e) => setForm((current) => ({ ...current, author_name: e.target.value }))} />
                </label>
                <label className="space-y-2 text-sm text-hull-200">
                  <span>Category</span>
                  <input value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))} />
                </label>
                <label className="space-y-2 text-sm text-hull-200">
                  <span>Version</span>
                  <input value={form.version} onChange={(e) => setForm((current) => ({ ...current, version: e.target.value }))} />
                </label>
                <label className="space-y-2 text-sm text-hull-200">
                  <span>Compatibility</span>
                  <input value={form.compatibility} onChange={(e) => setForm((current) => ({ ...current, compatibility: e.target.value }))} />
                </label>
              </div>

              <label className="space-y-2 text-sm text-hull-200 block">
                <span>Summary</span>
                <input value={form.summary} onChange={(e) => setForm((current) => ({ ...current, summary: e.target.value }))} />
              </label>

              <label className="space-y-2 text-sm text-hull-200 block">
                <span>Tags</span>
                <input value={form.tags} onChange={(e) => setForm((current) => ({ ...current, tags: e.target.value }))} placeholder="ui, icons, quality of life" />
              </label>

              <label className="space-y-2 text-sm text-hull-200 block">
                <span>Description</span>
                <textarea rows={5} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
              </label>

              <label className="space-y-2 text-sm text-hull-200 block">
                <span>Install Instructions</span>
                <textarea rows={5} value={form.install_instructions} onChange={(e) => setForm((current) => ({ ...current, install_instructions: e.target.value }))} />
              </label>

              <div className="flex flex-wrap gap-4 text-sm text-hull-200">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm((current) => ({ ...current, is_published: e.target.checked }))} className="!w-4 !h-4" /> Published</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm((current) => ({ ...current, is_featured: e.target.checked }))} className="!w-4 !h-4" /> Featured</label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}><Save size={16} /> Save Mod</button>
                <button type="button" className="btn-ghost text-laser-red" onClick={handleDelete}><Trash2 size={16} /> Delete</button>
                <button type="button" className="btn-ghost" onClick={() => loadMods()}><RefreshCcw size={16} /> Refresh</button>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-sm tracking-[0.18em] text-plasma-400 uppercase">Mod Files</div>
                    <div className="text-sm text-hull-200 mt-1">These are bundled into the download zip.</div>
                  </div>
                  <label className="btn-secondary cursor-pointer text-xs">
                    <Upload size={14} /> Upload Files
                    <input type="file" multiple className="hidden" onChange={(event) => handleFileUpload(event, 'files')} />
                  </label>
                </div>
                <div className="space-y-2">
                  {detail?.files?.map((file) => (
                    <div key={file.id} className="rounded-xl border border-hull-400/40 bg-hull-800/70 px-3 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-hull-50 font-medium truncate">{file.label || file.original_filename}</div>
                        <div className="text-xs text-hull-300 truncate">{file.original_filename}</div>
                      </div>
                      <button type="button" className="btn-ghost text-laser-red text-xs" onClick={() => handleDeleteFile(file.id, 'file')}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {!detail?.files?.length && <div className="text-sm text-hull-300 py-4">No files uploaded yet.</div>}
                </div>
              </div>

              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-sm tracking-[0.18em] text-plasma-400 uppercase">Screenshots</div>
                    <div className="text-sm text-hull-200 mt-1">Used on the public detail page.</div>
                  </div>
                  <label className="btn-secondary cursor-pointer text-xs">
                    <ImagePlus size={14} /> Upload Shots
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => handleFileUpload(event, 'screens')} />
                  </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {detail?.screenshots?.map((image) => (
                    <div key={image.id} className="rounded-xl overflow-hidden border border-hull-400/40 bg-hull-800/70">
                      <img src={image.url} alt={image.caption || 'Screenshot'} className="w-full h-36 object-cover bg-hull-900" />
                      <div className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="text-xs text-hull-200 truncate">{image.caption || 'Screenshot'}</div>
                        <button type="button" className="btn-ghost text-laser-red text-xs" onClick={() => handleDeleteFile(image.id, 'shot')}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  {!detail?.screenshots?.length && <div className="text-sm text-hull-300 py-4">No screenshots uploaded yet.</div>}
                </div>
              </div>
            </div>

            {selectedSummary && (
              <div className="card p-4 text-sm text-hull-200">
                <div className="font-display text-sm tracking-[0.18em] text-plasma-400 uppercase mb-2">Preview</div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {splitModTags(form.tags).map((tag) => (
                    <span key={tag} className="rounded-full border border-hull-500/50 bg-hull-800/70 px-2.5 py-1 text-[11px] font-display tracking-wide text-hull-200">{tag}</span>
                  ))}
                </div>
                <div>{form.summary || 'Add a short summary for the public list.'}</div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
