import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_THEME_ID,
  isThemeId,
  THEME_PRESETS,
  THEME_STORAGE_KEY,
  type ThemeId,
  type ThemePreset,
} from './themes';

interface ThemeContextValue {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  presets: ThemePreset[];
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isThemeId(stored)) return stored;
  } catch {
    /* private browsing */
  }
  return DEFAULT_THEME_ID;
}

function applyThemeToDocument(id: ThemeId) {
  document.documentElement.dataset.theme = id;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(readStoredTheme);

  const setTheme = useCallback((id: ThemeId) => {
    applyThemeToDocument(id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      /* private browsing */
    }
    setThemeIdState(id);
  }, []);

  useEffect(() => {
    applyThemeToDocument(themeId);
  }, [themeId]);

  const value = useMemo(
    () => ({ themeId, setTheme, presets: THEME_PRESETS }),
    [themeId, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
