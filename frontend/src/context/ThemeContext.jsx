import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'swg-tools-theme';

export const THEMES = [
  { key: 'deep-space', label: 'Deep Space' },
  { key: 'hoth-blizzard', label: 'Hoth Blizzard' },
  { key: 'imperial-red', label: 'Imperial Red' },
  { key: 'rebel-gold', label: 'Rebel Gold' },
  { key: 'bounty-hunter', label: 'Bounty Hunter' },
  { key: 'coruscant-purple', label: 'Coruscant Purple' },
];

const DEFAULT_THEME = THEMES[0].key;

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return THEMES.some((item) => item.key === stored) ? stored : DEFAULT_THEME;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({ theme, setTheme, themes: THEMES }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
