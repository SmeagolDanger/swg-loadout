import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Wrench, Plus, Trash2, Edit3, Save, X } from 'lucide-react';

const COMP_TYPES_LIST = [
  { value: 'reactor', label: 'Reactor', stats: ['Mass', 'Generation'] },
  { value: 'engine', label: 'Engine', stats: ['Drain', 'Mass', 'Pitch', 'Yaw', 'Roll', 'Top Speed'] },
  { value: 'booster', label: 'Booster', stats: ['Drain', 'Mass', 'Energy', 'Recharge Rate', 'Consumption', 'Acceleration', 'Top Speed'] },
  { value: 'shield', label: 'Shield', stats: ['Drain', 'Mass', 'HP', 'Recharge Rate'] },
  { value: 'armor', label: 'Armor', stats: ['HP', 'Mass'] },
  { value: 'capacitor', label: 'Capacitor', stats: ['Drain', 'Mass', 'Cap Energy', 'Cap Recharge'] },
  { value: 'droidinterface', label: 'Droid Interface', stats: ['Drain', 'Mass', 'Cmd Speed'] },
  { value: 'cargohold', label: 'Cargo Hold', stats: ['Mass'] },
  { value: 'weapon', label: 'Weapon', stats: ['Drain', 'Mass', 'Min Damage', 'Max Damage', 'Vs Shields', 'Vs Armor', 'Energy/Shot', 'Refire Rate'] },
  { value: 'ordnancelauncher', label: 'Ordnance Launcher', stats: ['Drain', 'Mass', 'Min Damage', 'Max Damage', 'Vs Shields', 'Vs Armor', 'Ammo', 'PvE Multiplier'] },
  { value: 'countermeasurelauncher', label: 'Countermeasure Launcher', stats: ['Drain', 'Mass', 'Ammo'] },
  { value: 'ordnancepack', label: 'Ordnance Pack', stats: ['Min Damage', 'Max Damage', 'Ammo', 'Type'] },
  { value: 'countermeasurepack', label: 'Countermeasure Pack', stats: ['Ammo'] },
];

export default function ComponentManager() {
  const [components, setComponents] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | component id
  const [form, setForm] = useState({ comp_type: 'reactor', name: '', stats: Array(8).fill(0) });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.getComponents(filterType || undefined)
      .then(setComponents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterType]);

  const currentType = COMP_TYPES_LIST.find(t => t.value === form.comp_type);

  const handleSave = async () => {
    setError('');
    try {
      const data = {
        comp_type: form.comp_type,
        name: form.name,
        stat1: parseFloat(form.stats[0]) || 0,
        stat2: parseFloat(form.stats[1]) || 0,
        stat3: parseFloat(form.stats[2]) || 0,
        stat4: parseFloat(form.stats[3]) || 0,
        stat5: parseFloat(form.stats[4]) || 0,
        stat6: parseFloat(form.stats[5]) || 0,
        stat7: parseFloat(form.stats[6]) || 0,
        stat8: parseFloat(form.stats[7]) || 0,
      };
      if (editing === 'new') {
        await api.createComponent(data);
      } else {
        await api.updateComponent(editing, data);
      }
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this component?')) return;
    try {
      await api.deleteComponent(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (comp) => {
    setForm({
      comp_type: comp.comp_type,
      name: comp.name,
      stats: [comp.stat1, comp.stat2, comp.stat3, comp.stat4, comp.stat5, comp.stat6, comp.stat7, comp.stat8]
    });
    setEditing(comp.id);
  };

  const startNew = () => {
    setForm({ comp_type: filterType || 'reactor', name: '', stats: Array(8).fill(0) });
    setEditing('new');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold tracking-wider text-hull-100 flex items-center gap-2">
          <Wrench size={24} className="text-plasma-400" /> COMPONENT MANAGER
        </h1>
        <button onClick={startNew} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Add Component
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full sm:w-64">
          <option value="">All Types</option>
          {COMP_TYPES_LIST.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-laser-red/10 border border-laser-red/30 rounded-lg px-3 py-2 text-sm text-laser-red mb-4">{error}</div>
      )}

      {/* Edit/Create form */}
      {editing !== null && (
        <div className="card mb-4 animate-slide-up">
          <div className="card-header">
            {editing === 'new' ? 'ADD COMPONENT' : 'EDIT COMPONENT'}
            <button onClick={() => setEditing(null)} className="ml-auto text-hull-400 hover:text-hull-200"><X size={16} /></button>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-display text-hull-200 mb-1">TYPE</label>
                <select value={form.comp_type}
                  onChange={e => setForm({ ...form, comp_type: e.target.value, stats: Array(8).fill(0) })}
                  className="w-full text-sm" disabled={editing !== 'new'}>
                  {COMP_TYPES_LIST.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-display text-hull-200 mb-1">NAME</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {currentType?.stats.map((stat, i) => (
                <div key={i}>
                  <label className="block text-[10px] font-display text-hull-300 mb-0.5">{stat}</label>
                  <input type="number" step="0.1"
                    value={form.stats[i]}
                    onChange={e => {
                      const s = [...form.stats];
                      s[i] = e.target.value;
                      setForm({ ...form, stats: s });
                    }}
                    className="w-full text-sm font-mono" />
                </div>
              )) || null}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} className="btn-primary flex items-center gap-1"><Save size={14} /> Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Component list */}
      {loading ? (
        <div className="text-center py-12 text-hull-200">Loading components...</div>
      ) : components.length === 0 ? (
        <div className="text-center py-12">
          <Wrench size={40} className="text-hull-500 mx-auto mb-3" />
          <p className="text-hull-200">No components yet. Add your first component to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {components.map(comp => {
            const typeInfo = COMP_TYPES_LIST.find(t => t.value === comp.comp_type);
            return (
              <div key={comp.id} className="card px-4 py-3 flex items-center gap-3 hover:border-hull-400/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-hull-100 truncate">{comp.name}</div>
                  <div className="text-xs text-hull-200 font-display tracking-wider">{typeInfo?.label || comp.comp_type}</div>
                </div>
                <div className="hidden sm:flex gap-3 text-xs text-hull-200 font-mono flex-wrap">
                  {typeInfo?.stats.map((stat, i) => {
                    const val = comp[`stat${i + 1}`];
                    return val ? <span key={i}>{stat}: <span className="text-hull-100">{val}</span></span> : null;
                  })}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(comp)} className="p-1.5 rounded hover:bg-hull-600 text-hull-200 hover:text-plasma-400">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(comp.id)} className="p-1.5 rounded hover:bg-hull-600 text-hull-200 hover:text-laser-red">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
