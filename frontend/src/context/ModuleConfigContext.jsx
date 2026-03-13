import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';

export const MODULE_GROUPS = [
  {
    label: 'Feature Areas',
    modules: [
      { key: 'tools', label: 'Space Tools' },
      { key: 'buildouts', label: 'Buildout Maps' },
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
      { key: 'nav:/tools/logs', label: 'Log Analyzer' },
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

const ModuleConfigContext = createContext(null);

export function ModuleConfigProvider({ children }) {
  const [enabled, setEnabled] = useState(new Set(ALL_KEYS));
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.getModuleConfig();
      if (Array.isArray(data.enabled)) {
        setEnabled(new Set(data.enabled.filter((k) => ALL_KEYS.has(k))));
      } else {
        setEnabled(new Set(ALL_KEYS));
      }
    } catch {
      setEnabled(new Set(ALL_KEYS));
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const toggle = useCallback(async (key) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      setSaving(true);
      api.updateModuleConfig([...next]).finally(() => setSaving(false));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      isEnabled: (key) => enabled.has(key),
      toggle,
      saving,
      refetch: fetchConfig,
    }),
    [enabled, toggle, saving, fetchConfig],
  );

  return <ModuleConfigContext.Provider value={value}>{children}</ModuleConfigContext.Provider>;
}

export const useModuleConfig = () => useContext(ModuleConfigContext);
