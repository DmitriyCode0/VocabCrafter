"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ColorThemeId =
  | "forest"
  | "slate-emerald"
  | "midnight-indigo"
  | "warm-terracotta"
  | "deep-ocean";

export interface ColorThemeOption {
  id: ColorThemeId;
  surfaceHex: string;
  accentHex: string;
}

export const COLOR_THEME_STORAGE_KEY = "vocab-crafter:color-theme";
export const DEFAULT_COLOR_THEME: ColorThemeId = "forest";

export const COLOR_THEMES: ColorThemeOption[] = [
  { id: "forest", surfaceHex: "#203024", accentHex: "#4CAF50" },
  { id: "slate-emerald", surfaceHex: "#151921", accentHex: "#22C55E" },
  { id: "midnight-indigo", surfaceHex: "#111420", accentHex: "#6366F1" },
  { id: "warm-terracotta", surfaceHex: "#1D1B19", accentHex: "#E07A5F" },
  { id: "deep-ocean", surfaceHex: "#101820", accentHex: "#14B8A6" },
];

const VALID_THEME_IDS = new Set<string>(COLOR_THEMES.map((item) => item.id));

export function isValidColorThemeId(value: string | null): value is ColorThemeId {
  return Boolean(value && VALID_THEME_IDS.has(value));
}

function applyColorThemeToDocument(themeId: ColorThemeId) {
  if (typeof document === "undefined") {
    return;
  }

  if (themeId === "forest") {
    delete document.documentElement.dataset.colorTheme;
    return;
  }

  document.documentElement.dataset.colorTheme = themeId;
}

interface ColorThemeContextValue {
  colorTheme: ColorThemeId;
  setColorTheme: (themeId: ColorThemeId) => void;
}

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null);

export function ColorThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorThemeId>(() => {
    if (typeof window !== "undefined") {
      try {
        const fromDataset = document.documentElement.dataset.colorTheme ?? null;
        if (isValidColorThemeId(fromDataset)) {
          return fromDataset;
        }
        const stored = window.localStorage.getItem(COLOR_THEME_STORAGE_KEY);
        if (isValidColorThemeId(stored)) {
          return stored;
        }
      } catch {
        // Ignore storage access errors
      }
    }
    return DEFAULT_COLOR_THEME;
  });

  useEffect(() => {
    applyColorThemeToDocument(colorTheme);
  }, [colorTheme]);

  const setColorTheme = useCallback((themeId: ColorThemeId) => {
    setColorThemeState(themeId);
    applyColorThemeToDocument(themeId);

    try {
      window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, themeId);
    } catch {
      // Ignore storage failures
    }
  }, []);

  const value = useMemo(
    () => ({
      colorTheme,
      setColorTheme,
    }),
    [colorTheme, setColorTheme],
  );

  return (
    <ColorThemeContext.Provider value={value}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext);
  if (!context) {
    throw new Error("useColorTheme must be used within ColorThemeProvider");
  }
  return context;
}
