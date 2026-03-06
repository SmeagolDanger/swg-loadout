import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Box, Trash2, Copy, Globe, Lock, Eye, Upload, CheckCircle, AlertTriangle } from 'lucide-react';

export default function LoadoutManager() {
  const [loadouts, setLoadouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.getLoadouts().then(setLoadouts).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this loadout permanently?')) return;
    try {
      await api.deleteLoadout(id);
      setSelected(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDuplicate = async (loadout) => {
    const name = prompt('Name for the duplicate:', `${loadout.name} (Copy)`);
    if (!name) return;
    try {
      await api.duplicateLoadout(loadout.id, name);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleTogglePublic = async (loadout) => {
    try {
      await api.updateLoadout(loadout.id, { ...loadout, is_public: !loadout.is_public });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleImport = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.db')) {
      setImportResult({ error: 'Please select a .db file (savedata.db from the desktop app).' });
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api.importSavedata(file);
      setImportResult(result);
      load();
    } catch (e) {
      setImportResult({ error: e.message });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImport(file);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-hull-100 flex items-center gap-2 mb-6">
        <Box size={24} className="text-plasma-400" /> MY LOADOUTS
      </h1>

      {/* Import from Desktop App */}
      <div className="card mb-6">
        <div className="card-header"><Upload size={16} /> IMPORT FROM DESKTOP APP</div>
        <div className="p-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
              ${dragOver ? 'border-plasma-500 bg-plasma-500/5' : 'border-hull-500/50 hover:border-hull-400'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
            {importing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-plasma-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-hull-200 font-display">Importing...</span>
              </div>
            ) : (
              <>
                <Upload size={24} className="text-hull-400 mx-auto mb-2" />
                <p className="text-hull-200 text-sm font-display">
                  Drop <span className="text-plasma-400 font-mono">savedata.db</span> here or click to browse
                </p>
                <p className="text-hull-200 text-xs mt-1">
                  Found in <span className="font-mono">%APPDATA%\Seraph's Loadout Tool\savedata.db</span>
                </p>
                <p className="text-hull-500 text-xs mt-0.5">
                  Imports all loadouts and components. Duplicates are skipped.
                </p>
              </>
            )}
          </div>

          {/* Import results */}
          {importResult && (
            <div className={`mt-3 rounded-lg p-3 text-sm animate-slide-up ${
              importResult.error
                ? 'bg-laser-red/10 border border-laser-red/30'
                : 'bg-laser-green/10 border border-laser-green/30'
            }`}>
              {importResult.error ? (
                <div className="flex items-start gap-2 text-laser-red">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{importResult.error}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-laser-green font-display font-semibold">
                    <CheckCircle size={16} /> Import Complete
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-hull-200 text-xs">
                    <span>Loadouts imported: <span className="text-hull-100 font-mono">{importResult.loadouts_imported}</span></span>
                    <span>Loadouts skipped: <span className="text-hull-200 font-mono">{importResult.loadouts_skipped}</span></span>
                    <span>Components imported: <span className="text-hull-100 font-mono">{importResult.components_imported}</span></span>
                    <span>Components skipped: <span className="text-hull-200 font-mono">{importResult.components_skipped}</span></span>
                  </div>
                  {importResult.errors?.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-hull-500/30 text-xs text-laser-yellow">
                      {importResult.errors.map((err, i) => <div key={i}>{err}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loadout list */}
      {loading ? (
        <div className="text-center py-12 text-hull-200">Loading loadouts...</div>
      ) : loadouts.length === 0 ? (
        <div className="text-center py-16">
          <Box size={48} className="text-hull-500 mx-auto mb-4" />
          <p className="text-hull-200 text-lg">No loadouts saved yet.</p>
          <p className="text-hull-500 text-sm mt-1">Use the Loadout Builder to create and save your first build, or import from the desktop app above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {loadouts.map(l => (
            <div
              key={l.id}
              className={`card p-4 cursor-pointer transition-all hover:border-plasma-500/40
                ${selected?.id === l.id ? 'border-plasma-500/50 shadow-plasma' : ''}`}
              onClick={() => setSelected(selected?.id === l.id ? null : l)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-display font-bold text-hull-100 text-lg">{l.name}</h3>
                  <p className="text-sm text-plasma-400 font-display">{l.chassis}</p>
                </div>
                <div className="flex items-center gap-1">
                  {l.is_public ? (
                    <span className="text-[10px] bg-laser-green/15 text-laser-green border border-laser-green/30 rounded px-1.5 py-0.5 font-display">
                      <Globe size={10} className="inline mr-0.5" />PUBLIC
                    </span>
                  ) : (
                    <span className="text-[10px] bg-hull-600 text-hull-200 border border-hull-500 rounded px-1.5 py-0.5 font-display">
                      <Lock size={10} className="inline mr-0.5" />PRIVATE
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-hull-200">
                <span>Reactor: <span className="text-hull-100">{l.reactor !== 'None' ? l.reactor : '—'}</span></span>
                <span>Engine: <span className="text-hull-100">{l.engine !== 'None' ? l.engine : '—'}</span></span>
                <span>Shield: <span className="text-hull-100">{l.shield !== 'None' ? l.shield : '—'}</span></span>
                <span>Booster: <span className="text-hull-100">{l.booster !== 'None' ? l.booster : '—'}</span></span>
                <span>Cap: <span className="text-hull-100">{l.capacitor !== 'None' ? l.capacitor : '—'}</span></span>
                <span>Mass: <span className="text-hull-100 font-mono">{l.mass}</span></span>
              </div>

              {selected?.id === l.id && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-hull-500/30 animate-slide-up">
                  <button onClick={(e) => { e.stopPropagation(); handleDuplicate(l); }}
                    className="btn-ghost text-xs flex items-center gap-1"><Copy size={12} /> Duplicate</button>
                  <button onClick={(e) => { e.stopPropagation(); handleTogglePublic(l); }}
                    className="btn-ghost text-xs flex items-center gap-1">
                    {l.is_public ? <><Lock size={12} /> Make Private</> : <><Globe size={12} /> Make Public</>}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }}
                    className="btn-danger text-xs flex items-center gap-1 ml-auto"><Trash2 size={12} /> Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
