import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import ThrottleProfile from './ThrottleProfile';
import {
  Crosshair, Zap, Shield, Gauge, Layers, Box, Save, FolderOpen,
  ChevronDown, Info, Cpu, Rocket, Target, Package
} from 'lucide-react';

const COMP_TYPES = [
  { key: 'reactor', label: 'Reactor', icon: Zap, stats: ['Mass', 'Generation'] },
  { key: 'engine', label: 'Engine', icon: Gauge, stats: ['Drain', 'Mass', 'Pitch', 'Yaw', 'Roll', 'Top Speed'] },
  { key: 'booster', label: 'Booster', icon: Rocket, stats: ['Drain', 'Mass', 'Energy', 'Recharge', 'Consumption', 'Acceleration', 'Top Speed'] },
  { key: 'shield', label: 'Shield', icon: Shield, stats: ['Drain', 'Mass', 'HP', 'Recharge'] },
  { key: 'front_armor', label: 'Front Armor', type: 'armor', icon: Layers, stats: ['HP', 'Mass'] },
  { key: 'rear_armor', label: 'Rear Armor', type: 'armor', icon: Layers, stats: ['HP', 'Mass'] },
  { key: 'capacitor', label: 'Capacitor', icon: Cpu, stats: ['Drain', 'Mass', 'Energy', 'Recharge'] },
  { key: 'droid_interface', label: 'Droid Interface', type: 'droidinterface', icon: Box, stats: ['Drain', 'Mass', 'Cmd Speed'] },
  { key: 'cargo_hold', label: 'Cargo Hold', type: 'cargohold', icon: Package, stats: ['Mass'] },
];

const WEAPON_STATS = ['Drain', 'Mass', 'Min Dmg', 'Max Dmg', 'Vs Shields', 'Vs Armor', 'Energy/Shot', 'Refire'];
const ORD_STATS = ['Drain', 'Mass', 'Min Dmg', 'Max Dmg', 'Vs Shields', 'Vs Armor', 'Ammo', 'PvE Mult'];
const CM_STATS = ['Drain', 'Mass', 'Ammo'];

/** Power status indicator dot */
function PowerDot({ status }) {
  if (!status || status === 'none') return null;
  const colors = {
    powered: 'bg-green-500',
    partial: 'bg-yellow-400',
    unpowered: 'bg-red-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || ''} mr-1.5`} />;
}

function StatBlock({ label, value, warn, powerStatus }) {
  return (
    <div className="stat-row">
      <span className="stat-label flex items-center">
        {powerStatus && <PowerDot status={powerStatus} />}
        {label}
      </span>
      <span className={warn ? 'stat-value-bad' : 'stat-value'}>{value || '—'}</span>
    </div>
  );
}

export default function LoadoutBuilder() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [chassisList, setChassisList] = useState([]);
  const [selectedChassis, setSelectedChassis] = useState('');
  const [chassisData, setChassisData] = useState(null);
  const [components, setComponents] = useState({});
  const [userComps, setUserComps] = useState([]);
  const [overloads, setOverloads] = useState({ ro: 'None', eo: 'None', co: 'None', wo: 'None' });
  const [shieldAdjust, setShieldAdjust] = useState('None');
  const [shieldAdjustOptions, setShieldAdjustOptions] = useState([]);
  const [calcResults, setCalcResults] = useState(null);
  const [loadoutName, setLoadoutName] = useState('');
  const [chassisMass, setChassisMass] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loadoutId, setLoadoutId] = useState(null);        // Track loaded loadout for Save vs Save As
  const [loadingLoadout, setLoadingLoadout] = useState(false);

  // Load initial data
  useEffect(() => {
    api.getChassisList().then(setChassisList).catch(console.error);
    api.getShieldAdjustOptions().then(setShieldAdjustOptions).catch(console.error);
    if (user) {
      api.getComponents().then(setUserComps).catch(console.error);
    }
  }, [user]);

  // Load a saved loadout by ID — matches component names from the loadout
  // against the user's component library to restore full stat arrays.
  const loadSavedLoadout = useCallback(async (id, comps) => {
    setLoadingLoadout(true);
    try {
      const loadout = await api.getLoadout(id);
      const userComponents = comps || userComps;

      // Helper: find a component by name and type in the user's library
      const findComp = (name, typeKey) => {
        if (!name || name === 'None') return { name: 'None', stats: [] };
        const type = typeKey.replace('_', '');
        const match = userComponents.find(c => {
          const ct = c.comp_type.toLowerCase().replace('_', '');
          return c.name === name && (ct === type || ct === typeKey.replace('_', ''));
        });
        if (match) {
          return {
            name: match.name,
            stats: [match.stat1, match.stat2, match.stat3, match.stat4, match.stat5, match.stat6, match.stat7, match.stat8],
          };
        }
        // Component not in library — show name but no stats (user may need to re-add it)
        return { name, stats: [], _missing: true };
      };

      // Helper: find a slot component (weapon/ord/cm) by name
      const findSlotComp = (name) => {
        if (!name || name === 'None') return { name: 'None', stats: [], comp_type: '' };
        const match = userComponents.find(c => c.name === name);
        if (match) {
          const ct = match.comp_type.toLowerCase();
          return {
            name: match.name,
            stats: [match.stat1, match.stat2, match.stat3, match.stat4, match.stat5, match.stat6, match.stat7, match.stat8],
            comp_type: ct.includes('weapon') ? 'weapon' : ct.includes('ordnance') ? 'ordnance' : 'countermeasure',
          };
        }
        return { name, stats: [], comp_type: 'weapon', _missing: true };
      };

      // Set chassis first (triggers chassisData load via useEffect)
      setSelectedChassis(loadout.chassis);

      // Set loadout metadata
      setLoadoutName(loadout.name);
      setLoadoutId(loadout.id);
      if (loadout.mass) setChassisMass(loadout.mass);

      // Set overloads
      setOverloads({
        ro: loadout.ro_level || 'None',
        eo: loadout.eo_level || 'None',
        co: loadout.co_level || 'None',
        wo: loadout.wo_level || 'None',
      });
      setShieldAdjust(loadout.shield_adjust || 'None');

      // Build component map from saved names
      const newComponents = {};
      for (const ct of COMP_TYPES) {
        const savedName = loadout[ct.key];
        if (savedName && savedName !== 'None') {
          newComponents[ct.key] = findComp(savedName, ct.type || ct.key);
        }
      }
      // Weapon slots
      for (let i = 1; i <= 8; i++) {
        const savedName = loadout[`slot${i}`];
        if (savedName && savedName !== 'None') {
          newComponents[`slot${i}`] = findSlotComp(savedName);
        }
      }

      setComponents(newComponents);
    } catch (err) {
      console.error('Failed to load loadout:', err);
      setSaveMsg('Failed to load loadout');
      setTimeout(() => setSaveMsg(''), 3000);
    } finally {
      setLoadingLoadout(false);
    }
  }, [userComps]);

  // Load from URL param ?loadout=ID when ready
  useEffect(() => {
    const loadoutParam = searchParams.get('loadout');
    if (!loadoutParam) return;
    const id = parseInt(loadoutParam, 10);
    if (isNaN(id)) return;

    // For logged-in users, wait for component library to load so we can match stats.
    // For anonymous users (viewing public loadouts), load immediately with names only.
    if (user && userComps.length === 0) return;  // Still loading user comps, wait

    loadSavedLoadout(id, userComps);
    setSearchParams({}, { replace: true });
  }, [searchParams, user, userComps, loadSavedLoadout, setSearchParams]);

  // Load chassis data when selection changes
  useEffect(() => {
    if (selectedChassis) {
      api.getChassis(selectedChassis).then(data => {
        setChassisData(data);
        setChassisMass(data.mass);
      }).catch(console.error);
    } else {
      setChassisData(null);
      setChassisMass(0);
    }
  }, [selectedChassis]);

  // Recalculate when inputs change
  const recalculate = useCallback(() => {
    if (!selectedChassis) { setCalcResults(null); return; }

    // Build component data for backend
    const compData = { chassis_mass: chassisMass };
    for (const ct of COMP_TYPES) {
      const comp = components[ct.key];
      if (comp && comp.name !== 'None') {
        const mapped = {};
        ct.stats.forEach((s, i) => {
          const key = s.toLowerCase().replace(/ /g, '_').replace('/', '_');
          mapped[key] = comp.stats?.[i] || 0;
        });
        mapped.mass = comp.stats?.[ct.stats.indexOf('Mass')] || comp.stats?.[1] || 0;
        if (ct.key === 'reactor') mapped.generation = comp.stats?.[1] || 0;
        if (ct.key === 'engine') { mapped.drain = comp.stats?.[0] || 0; mapped.top_speed = comp.stats?.[5] || 0; }
        if (ct.key === 'booster') {
          mapped.drain = comp.stats?.[0] || 0; mapped.energy = comp.stats?.[2] || 0;
          mapped.recharge_rate = comp.stats?.[3] || 0; mapped.consumption = comp.stats?.[4] || 0;
          mapped.acceleration = comp.stats?.[5] || 0; mapped.top_speed = comp.stats?.[6] || 0;
        }
        if (ct.key === 'shield') { mapped.drain = comp.stats?.[0] || 0; mapped.hp = comp.stats?.[2] || 0; }
        if (ct.key === 'capacitor') {
          mapped.drain = comp.stats?.[0] || 0; mapped.energy = comp.stats?.[2] || 0;
          mapped.recharge = comp.stats?.[3] || 0;
        }
        if (ct.key === 'droid_interface') mapped.drain = comp.stats?.[0] || 0;
        compData[ct.key] = mapped;
      }
    }

    // FIX: Add weapon slots with FULL stats for weapon damage calculations
    // Previously only sent drain and mass; now sends all stats needed for
    // damage, EPS, refire, vs_shields, vs_armor calculations
    for (let i = 1; i <= 8; i++) {
      const slot = components[`slot${i}`];
      if (slot && slot.name !== 'None') {
        const compType = slot.comp_type || 'weapon';
        const slotData = {
          comp_type: compType,
          drain: slot.stats?.[0] || 0,
          mass: slot.stats?.[1] || 0,
        };

        if (compType === 'weapon') {
          slotData.min_damage = slot.stats?.[2] || 0;
          slotData.max_damage = slot.stats?.[3] || 0;
          slotData.vs_shields = slot.stats?.[4] || 0;
          slotData.vs_armor = slot.stats?.[5] || 0;
          slotData.energy_per_shot = slot.stats?.[6] || 0;
          slotData.refire_rate = slot.stats?.[7] || 0;
        } else if (compType === 'ordnance') {
          slotData.min_damage = slot.stats?.[2] || 0;
          slotData.max_damage = slot.stats?.[3] || 0;
          slotData.vs_shields = slot.stats?.[4] || 0;
          slotData.vs_armor = slot.stats?.[5] || 0;
        }

        compData[`slot${i}`] = slotData;
      }
    }

    api.calculate({
      chassis_name: selectedChassis,
      components: compData,
      ro_level: overloads.ro,
      eo_level: overloads.eo,
      co_level: overloads.co,
      wo_level: overloads.wo,
      shield_adjust: shieldAdjust,
    }).then(setCalcResults).catch(console.error);
  }, [selectedChassis, components, overloads, shieldAdjust, chassisMass]);

  useEffect(() => { recalculate(); }, [recalculate]);

  // Get component list for a given type
  const getCompOptions = (compType) => {
    const type = compType.type || compType.key;
    return [{ name: 'None', stats: [] }, ...userComps.filter(c => {
      const ct = c.comp_type.toLowerCase();
      const target = type.toLowerCase().replace('_', '');
      return ct === target || ct === compType.key.replace('_', '');
    }).map(c => ({
      name: c.name,
      stats: [c.stat1, c.stat2, c.stat3, c.stat4, c.stat5, c.stat6, c.stat7, c.stat8]
    }))];
  };

  const getSlotOptions = (slotIndex) => {
    if (!chassisData) return [];
    const header = chassisData.slots[slotIndex] || '';
    const types = [];
    if (header.includes('Weapon')) types.push('weapon');
    if (header.includes('Ordnance')) types.push('ordnancelauncher');
    if (header.includes('CM') || header.includes('Countermeasure')) types.push('countermeasurelauncher');

    return [{ name: 'None', stats: [], comp_type: '' }, ...userComps.filter(c =>
      types.includes(c.comp_type.toLowerCase())
    ).map(c => ({
      name: c.name,
      stats: [c.stat1, c.stat2, c.stat3, c.stat4, c.stat5, c.stat6, c.stat7, c.stat8],
      comp_type: c.comp_type.toLowerCase().includes('weapon') ? 'weapon' :
        c.comp_type.toLowerCase().includes('ordnance') ? 'ordnance' : 'countermeasure'
    }))];
  };

  const selectComp = (key, comp) => {
    setComponents(prev => ({ ...prev, [key]: comp }));
  };

  // Clear loaded-loadout tracking when user changes chassis manually
  const handleChassisChange = (newChassis) => {
    setSelectedChassis(newChassis);
    setComponents({});
    if (!loadingLoadout) {
      setLoadoutId(null);
      setLoadoutName('');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!loadoutName.trim() || !selectedChassis) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const data = {
        name: loadoutName, chassis: selectedChassis, mass: chassisMass,
        reactor: components.reactor?.name || 'None',
        engine: components.engine?.name || 'None',
        booster: components.booster?.name || 'None',
        shield: components.shield?.name || 'None',
        front_armor: components.front_armor?.name || 'None',
        rear_armor: components.rear_armor?.name || 'None',
        capacitor: components.capacitor?.name || 'None',
        cargo_hold: components.cargo_hold?.name || 'None',
        droid_interface: components.droid_interface?.name || 'None',
        slot1: components.slot1?.name || 'None', slot2: components.slot2?.name || 'None',
        slot3: components.slot3?.name || 'None', slot4: components.slot4?.name || 'None',
        slot5: components.slot5?.name || 'None', slot6: components.slot6?.name || 'None',
        slot7: components.slot7?.name || 'None', slot8: components.slot8?.name || 'None',
        pack1: 'None', pack2: 'None', pack3: 'None', pack4: 'None',
        pack5: 'None', pack6: 'None', pack7: 'None', pack8: 'None',
        ro_level: overloads.ro, eo_level: overloads.eo,
        co_level: overloads.co, wo_level: overloads.wo,
        shield_adjust: shieldAdjust,
      };

      if (loadoutId) {
        // Update existing loadout
        await api.updateLoadout(loadoutId, data);
        setSaveMsg('Loadout updated!');
      } else {
        // Create new loadout
        const result = await api.createLoadout(data);
        setLoadoutId(result.id);
        setSaveMsg('Loadout saved!');
      }
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAs = async () => {
    const newName = prompt('Save as new loadout name:', loadoutName ? `${loadoutName} (Copy)` : '');
    if (!newName || !newName.trim()) return;
    const prevId = loadoutId;
    const prevName = loadoutName;
    setLoadoutId(null);
    setLoadoutName(newName.trim());
    // Wait for state to settle then trigger save
    setSaving(true);
    setSaveMsg('');
    try {
      const data = {
        name: newName.trim(), chassis: selectedChassis, mass: chassisMass,
        reactor: components.reactor?.name || 'None',
        engine: components.engine?.name || 'None',
        booster: components.booster?.name || 'None',
        shield: components.shield?.name || 'None',
        front_armor: components.front_armor?.name || 'None',
        rear_armor: components.rear_armor?.name || 'None',
        capacitor: components.capacitor?.name || 'None',
        cargo_hold: components.cargo_hold?.name || 'None',
        droid_interface: components.droid_interface?.name || 'None',
        slot1: components.slot1?.name || 'None', slot2: components.slot2?.name || 'None',
        slot3: components.slot3?.name || 'None', slot4: components.slot4?.name || 'None',
        slot5: components.slot5?.name || 'None', slot6: components.slot6?.name || 'None',
        slot7: components.slot7?.name || 'None', slot8: components.slot8?.name || 'None',
        pack1: 'None', pack2: 'None', pack3: 'None', pack4: 'None',
        pack5: 'None', pack6: 'None', pack7: 'None', pack8: 'None',
        ro_level: overloads.ro, eo_level: overloads.eo,
        co_level: overloads.co, wo_level: overloads.wo,
        shield_adjust: shieldAdjust,
      };
      const result = await api.createLoadout(data);
      setLoadoutId(result.id);
      setSaveMsg('Saved as new loadout!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      // Revert on failure
      setLoadoutId(prevId);
      setLoadoutName(prevName);
      setSaveMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNewLoadout = () => {
    setLoadoutId(null);
    setLoadoutName('');
    setSelectedChassis('');
    setComponents({});
    setOverloads({ ro: 'None', eo: 'None', co: 'None', wo: 'None' });
    setShieldAdjust('None');
    setCalcResults(null);
    setChassisMass(0);
    setChassisData(null);
  };

  // Helper to look up power status for a component key
  const getPowerStatus = (key) => {
    if (!calcResults?.drain?.component_power) return null;
    const entry = calcResults.drain.component_power.find(p => p.key === key);
    return entry?.status || null;
  };

  const mass = calcResults?.mass;
  const drain = calcResults?.drain;
  const prop = calcResults?.propulsion;
  const weaponStats = calcResults?.weapon_stats;
  const capCombat = calcResults?.cap_combat;

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <select
            value={selectedChassis}
            onChange={e => handleChassisChange(e.target.value)}
            className="w-full text-lg font-display"
          >
            <option value="">Select Chassis...</option>
            {chassisList.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        {user && (
          <div className="flex gap-2 items-center flex-wrap">
            <input
              value={loadoutName}
              onChange={e => setLoadoutName(e.target.value)}
              placeholder="Loadout name..."
              className="w-48 text-sm"
            />
            <button onClick={handleSave} disabled={saving || !loadoutName || !selectedChassis}
              className="btn-primary flex items-center gap-1.5 whitespace-nowrap">
              <Save size={14} /> {loadoutId ? 'Save' : 'Save New'}
            </button>
            {loadoutId && (
              <button onClick={handleSaveAs} disabled={saving || !selectedChassis}
                className="btn-ghost flex items-center gap-1.5 whitespace-nowrap text-xs">
                <Save size={12} /> Save As
              </button>
            )}
            {(loadoutId || selectedChassis) && (
              <button onClick={handleNewLoadout}
                className="btn-ghost flex items-center gap-1.5 whitespace-nowrap text-xs">
                <FolderOpen size={12} /> New
              </button>
            )}
            {saveMsg && <span className={`text-xs ${saveMsg.includes('!') ? 'text-laser-green' : 'text-laser-red'}`}>{saveMsg}</span>}
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {loadingLoadout && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-plasma-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-hull-200 font-display text-sm tracking-wider">LOADING LOADOUT...</p>
        </div>
      )}

      {!selectedChassis && !loadingLoadout ? (
        <div className="text-center py-20">
          <Crosshair size={48} className="text-hull-400 mx-auto mb-4" />
          <h2 className="font-display text-xl text-hull-200 tracking-wider">SELECT A CHASSIS TO BEGIN</h2>
          <p className="text-hull-200 text-sm mt-2">Choose your ship frame from the dropdown above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left column: Core components */}
          <div className="lg:col-span-4 space-y-3">
            {/* Mass and Drain summary */}
            <div className="card">
              <div className="card-header"><Layers size={16} /> SHIP STATUS</div>
              <div className="p-3 space-y-1">
                <div className="stat-row">
                  <span className="stat-label">Chassis Mass</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={chassisMass}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        setChassisMass(isNaN(v) ? 0 : v);
                      }}
                      className="w-24 text-right text-sm font-mono py-0.5 px-1.5 !bg-hull-800 !border-hull-500"
                    />
                    {chassisData && chassisMass !== chassisData.mass && (
                      <button
                        onClick={() => setChassisMass(chassisData.mass)}
                        className="text-[10px] text-hull-400 hover:text-plasma-400 transition-colors"
                        title={`Reset to max: ${chassisData.mass.toLocaleString()}`}
                      >↺</button>
                    )}
                  </div>
                </div>
                {chassisData && (
                  <div className="stat-row">
                    <span className="stat-label text-hull-400 text-xs">Max (Capped)</span>
                    <span className="stat-value text-hull-400 text-xs">{chassisData.mass.toLocaleString()}</span>
                  </div>
                )}
                {mass && (
                  <>
                    <StatBlock label="Total Mass" value={`${mass.total_mass} / ${mass.chassis_mass} (${mass.percent}%)`} warn={mass.over_limit} />
                    <StatBlock label="Mass Remaining" value={mass.remaining} warn={mass.over_limit} />
                  </>
                )}
                {drain && (
                  <>
                    <div className="section-divider" />
                    <StatBlock label="Total Drain" value={drain.total_drain} warn={drain.over_limit} />
                    <StatBlock label="Reactor Gen" value={drain.overloaded_gen} />
                    <StatBlock label="Utilization" value={`${drain.utilization}%`} warn={drain.over_limit} />
                    <StatBlock label="Min Gen Required" value={drain.min_gen_required} />
                  </>
                )}
              </div>
            </div>

            {/* Core components with power status indicators */}
            {COMP_TYPES.map(ct => (
              <CompSelector
                key={ct.key}
                compType={ct}
                options={getCompOptions(ct)}
                selected={components[ct.key]}
                onSelect={comp => selectComp(ct.key, comp)}
                powerStatus={getPowerStatus(ct.key)}
              />
            ))}
          </div>

          {/* Middle column: Weapon slots + overloads */}
          <div className="lg:col-span-4 space-y-3">
            {/* Overloads */}
            <div className="card">
              <div className="card-header"><Zap size={16} /> OVERLOADS</div>
              <div className="p-3 grid grid-cols-2 gap-3">
                {[
                  { key: 'ro', label: 'Reactor OL' },
                  { key: 'eo', label: 'Engine OL' },
                  { key: 'co', label: 'Cap Overcharge' },
                  { key: 'wo', label: 'Weapon OL' },
                ].map(ol => (
                  <div key={ol.key}>
                    <label className="block text-xs font-display text-hull-200 mb-1">{ol.label}</label>
                    <select
                      value={overloads[ol.key]}
                      onChange={e => setOverloads(prev => ({ ...prev, [ol.key]: e.target.value }))}
                      className="w-full text-sm"
                    >
                      <option value="None">None</option>
                      {[1, 2, 3, 4].map(i => <option key={i} value={i}>Level {i}</option>)}
                    </select>
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-display text-hull-200 mb-1">Shield Adjust</label>
                  <select
                    value={shieldAdjust}
                    onChange={e => setShieldAdjust(e.target.value)}
                    className="w-full text-sm"
                  >
                    {shieldAdjustOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {calcResults?.overloads && (
                  <div className="col-span-2 text-xs text-hull-200 space-y-0.5 mt-1">
                    {Object.entries(calcResults.overloads.ro_desc || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span>RO {k}:</span><span className="text-plasma-400 font-mono">{v}</span></div>
                    ))}
                    {Object.entries(calcResults.overloads.eo_desc || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span>EO {k}:</span><span className="text-plasma-400 font-mono">{v}</span></div>
                    ))}
                    {Object.entries(calcResults.overloads.co_desc || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span>CO {k}:</span><span className="text-plasma-400 font-mono">{v}</span></div>
                    ))}
                    {Object.entries(calcResults.overloads.wo_desc || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span>WO {k}:</span><span className="text-plasma-400 font-mono">{v}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Weapon Slots */}
            <div className="card">
              <div className="card-header"><Target size={16} /> WEAPON SLOTS</div>
              <div className="p-3 space-y-2">
                {chassisData?.slots.map((header, i) => {
                  if (!header) return null;
                  const options = getSlotOptions(i);
                  const slotPower = getPowerStatus(`slot${i + 1}`);
                  return (
                    <div key={i}>
                      <label className="block text-xs font-display text-hull-200 mb-1 flex items-center">
                        {slotPower && <PowerDot status={slotPower} />}
                        {header}
                      </label>
                      <select
                        value={components[`slot${i + 1}`]?.name || 'None'}
                        onChange={e => {
                          const comp = options.find(o => o.name === e.target.value) || { name: 'None', stats: [] };
                          selectComp(`slot${i + 1}`, comp);
                        }}
                        className="w-full text-sm"
                      >
                        {options.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
                      </select>
                      {components[`slot${i + 1}`] && components[`slot${i + 1}`].name !== 'None' && (
                        <div className="mt-1 pl-2 border-l-2 border-hull-500/30 text-xs text-hull-200">
                          {(components[`slot${i + 1}`].comp_type === 'weapon' ? WEAPON_STATS :
                            components[`slot${i + 1}`].comp_type === 'ordnance' ? ORD_STATS : CM_STATS
                          ).map((s, j) => {
                            const val = components[`slot${i + 1}`].stats?.[j];
                            return val ? <span key={j} className="mr-3">{s}: <span className="text-hull-100 font-mono">{val}</span></span> : null;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column: Calculations + Throttle Profile */}
          <div className="lg:col-span-4 space-y-3">
            {/* Propulsion */}
            {prop && (
              <div className="card">
                <div className="card-header"><Gauge size={16} /> PROPULSION</div>
                <div className="p-3 space-y-1">
                  <StatBlock label="Speed Mod"
                    value={prop.speed_mod_foils ? `${prop.speed_mod} (${prop.speed_mod_foils})` : prop.speed_mod} />
                  <StatBlock label="Accel / Decel" value={`${prop.accel} / ${prop.decel}`} />
                  <StatBlock label="Pitch / Yaw / Roll" value={`${prop.pitch} / ${prop.yaw} / ${prop.roll}`} />
                  <StatBlock label="Slide Mod" value={prop.slide} />
                  <div className="section-divider" />
                  <StatBlock label="Top Speed"
                    value={prop.top_speed != null ? (prop.top_speed_foils ? `${prop.top_speed} (${prop.top_speed_foils})` : prop.top_speed) : '—'} />
                  <StatBlock label="Boosted Speed"
                    value={prop.boosted_top_speed != null ? (prop.boosted_top_speed_foils ? `${prop.boosted_top_speed} (${prop.boosted_top_speed_foils})` : prop.boosted_top_speed) : '—'} />
                  <StatBlock label="Boost Distance"
                    value={prop.boost_distance != null ? (prop.boost_distance_foils ? `${prop.boost_distance}m (${prop.boost_distance_foils}m)` : `${prop.boost_distance}m`) : '—'} />
                  <StatBlock label="Booster Uptime"
                    value={prop.booster_uptime != null ? `${prop.booster_uptime}%` : '—'} />
                </div>
              </div>
            )}

            {/* FIX: Weapon Damage section (was completely missing) */}
            {weaponStats && weaponStats.weapon_damages?.length > 0 && (
              <div className="card">
                <div className="card-header"><Crosshair size={16} /> WEAPON DAMAGE</div>
                <div className="p-3 space-y-1">
                  <div className="flex justify-between text-xs font-display text-hull-300 mb-1">
                    <span className="w-1/2">Slot</span>
                    <span className="w-1/4 text-right">PvE</span>
                    <span className="w-1/4 text-right">PvP</span>
                  </div>
                  {weaponStats.weapon_damages.map((wd, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="w-1/2 text-hull-200 truncate">{wd.slot}:</span>
                      <span className="w-1/4 text-right font-mono text-hull-100">{wd.pve}</span>
                      <span className="w-1/4 text-right font-mono text-hull-100">{wd.pvp}</span>
                    </div>
                  ))}
                  <div className="section-divider" />
                  <div className="flex justify-between text-xs font-display">
                    <span className="w-1/2 text-hull-200">Pilot Gun Total:</span>
                    <span className="w-1/4 text-right font-mono text-plasma-400">{weaponStats.pilot_total_pve}</span>
                    <span className="w-1/4 text-right font-mono text-plasma-400">{weaponStats.pilot_total_pvp}</span>
                  </div>
                </div>
              </div>
            )}

            {/* FIX: Cap Combat section (was completely missing) */}
            {capCombat && capCombat.overloaded_ce && (
              <div className="card">
                <div className="card-header"><Cpu size={16} /> CAP COMBAT</div>
                <div className="p-3 space-y-1">
                  <StatBlock label={capCombat.overloaded_ce !== calcResults?.drain?.overloaded_gen ? "Overloaded CE" : "Cap Energy"} value={capCombat.overloaded_ce} />
                  <StatBlock label={capCombat.overloaded_rr !== calcResults?.drain?.overloaded_gen ? "Overloaded RR" : "Cap Recharge"} value={capCombat.overloaded_rr} />
                  <div className="section-divider" />
                  <StatBlock label="Full Cap Damage" value={capCombat.full_cap_damage} />
                  <StatBlock label="Fire Time" value={capCombat.fire_time} />
                  <StatBlock label="Cap Recharge Time" value={capCombat.cap_recharge_time} />
                  <StatBlock label="Firing Ratio" value={capCombat.firing_ratio || '—'} />
                </div>
              </div>
            )}

            {/* Shield Info */}
            {calcResults?.shield && components.shield?.name !== 'None' && components.shield && (
              <div className="card">
                <div className="card-header"><Shield size={16} /> SHIELD</div>
                <div className="p-3 space-y-1">
                  <StatBlock label="Shield HP" value={components.shield?.stats?.[2]} />
                  <StatBlock label="Recharge Rate" value={components.shield?.stats?.[3]} />
                  {calcResults.shield.front_hp && (
                    <>
                      <div className="section-divider" />
                      <StatBlock label="Front HP (Adjusted)" value={calcResults.shield.front_hp} />
                      <StatBlock label="Back HP (Adjusted)" value={calcResults.shield.back_hp} />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Throttle Profile */}
            {chassisData && (
              <ThrottleProfile profile={calcResults?.throttle_profile || chassisData.throttle_profile} chassis={chassisData} />
            )}
          </div>
        </div>
      )}

      {/* Sign in prompt */}
      {!user && selectedChassis && (
        <div className="mt-6 card p-4 text-center">
          <p className="text-hull-200 text-sm">
            <a href="/auth" className="text-plasma-400 hover:underline">Sign in</a> to save loadouts, manage components, and share builds with the community.
          </p>
        </div>
      )}
    </div>
  );
}

function CompSelector({ compType, options, selected, onSelect, powerStatus }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = compType.icon;

  return (
    <div className="card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full card-header cursor-pointer hover:bg-hull-600/50 transition-colors"
      >
        {powerStatus && <PowerDot status={powerStatus} />}
        <Icon size={16} />
        <span className="flex-1 text-left">{compType.label.toUpperCase()}</span>
        <span className="text-xs text-hull-200 font-mono normal-case tracking-normal">
          {selected?.name && selected.name !== 'None' ? selected.name : '—'}
        </span>
        <ChevronDown size={14} className={`text-hull-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="p-3 animate-slide-up">
          <select
            value={selected?.name || 'None'}
            onChange={e => {
              const comp = options.find(o => o.name === e.target.value) || { name: 'None', stats: [] };
              onSelect(comp);
            }}
            className="w-full text-sm mb-2"
          >
            {options.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
          </select>

          {selected && selected.name !== 'None' && (
            <div className="space-y-0.5">
              {compType.stats.map((stat, i) => (
                <StatBlock key={stat} label={stat} value={selected.stats?.[i] || 0} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
