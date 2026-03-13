import React, { createContext, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'swg-module-config';

export const MODULE_GROUPS = [
  {
    label: 'Feature Areas',
    modules: [
      { key: 'tools', label: 'Space Tools' },
     // { key: 'buildouts', label: 'Buildout Maps' },
      { key: 'gcw', label: 'GCW Calculator' },
      { key: 'ent', label: 'Ent Buffs' },
      { key: 'mods', label: 'Game Mods' },
      { key: 'collections', label: 'Collections' },
    ],
  },
  {
    label: 'Space Tools',
    modules: [
      { key: 'nav:/tools', label: 'Builder' },
      { key: 'nav:/tools/loadouts', label: 'Loadouts' },
      { key: 'nav:/tools/components', label: 'Components' },
      { key: 'nav:/tools/re', label: 'RE Calc' },
      { key: 'nav:/tools/fc', label: 'FC Calc' },
      { key: 'nav:/tools/loot', label: 'Loot Lookup' },
     // { key: 'nav:/tools/logs', label: 'Log Analyzer' },
      { key: 'nav:/tools/starters', label: 'Starter Builds' },
      { key: 'nav:/tools/community', label: 'Community' },
    ],
  },
  {
    label: 'Collections',
    modules: [
      { key: 'nav:/collections', label: 'Tracker' },
      { key: 'nav:/collections/characters', label: 'Characters' },
      { key: 'nav:/collections/leaderboard', label: 'Leaderboard' },
    ],
  },
];

const ALL_KEYS = new Set(MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.key)));

function loadEnabled() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!Array.isArray(stored)) return ALL_KEYS;
    return new Set(stored.filter((k) => ALL_KEYS.has(k)));
  } catch {
    return new Set(ALL_KEYS);
  }
}

const ModuleConfigContext = createContext(null);

export function ModuleConfigProvider({ children }) {
  const [enabled, setEnabled] = useState(() => loadEnabled());

  function toggle(key) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function reset() {
    setEnabled(new Set(ALL_KEYS));
    window.localStorage.removeItem(STORAGE_KEY);
  }

  const value = useMemo(
    () => ({
      isEnabled: (key) => enabled.has(key),
      toggle,
      reset,
    }),
    [enabled],
  );

  return <ModuleConfigContext.Provider value={value}>{children}</ModuleConfigContext.Provider>;
}

export const useModuleConfig = () => useContext(ModuleConfigContext);
