"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type TtsEngine = "browser" | "ai";

interface TtsPreferenceContextValue {
  engine: TtsEngine;
  setEngine: (engine: TtsEngine) => void;
  toggleEngine: () => void;
}

const STORAGE_KEY = "vocab_crafter_tts_engine";
const CHANGE_EVENT = "vocab-crafter-tts-engine-change";
export const DEFAULT_TTS_ENGINE: TtsEngine = "browser";

function getSnapshot(): TtsEngine {
  if (typeof window === "undefined") {
    return DEFAULT_TTS_ENGINE;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "ai" || stored === "browser"
      ? stored
      : DEFAULT_TTS_ENGINE;
  } catch {
    return DEFAULT_TTS_ENGINE;
  }
}

function getServerSnapshot(): TtsEngine {
  return DEFAULT_TTS_ENGINE;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function writeStoredEngine(nextEngine: TtsEngine) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, nextEngine);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage may be blocked
  }
}

const TtsPreferenceContext = createContext<TtsPreferenceContextValue | null>(
  null,
);

export function TtsPreferenceProvider({ children }: { children: ReactNode }) {
  const engine = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setEngine = useCallback((newEngine: TtsEngine) => {
    writeStoredEngine(newEngine);
  }, []);

  const toggleEngine = useCallback(() => {
    const current = getSnapshot();
    writeStoredEngine(current === "ai" ? "browser" : "ai");
  }, []);

  return (
    <TtsPreferenceContext.Provider value={{ engine, setEngine, toggleEngine }}>
      {children}
    </TtsPreferenceContext.Provider>
  );
}

export function useTtsPreference() {
  const context = useContext(TtsPreferenceContext);

  if (!context) {
    return {
      engine: DEFAULT_TTS_ENGINE,
      setEngine: (newEngine: TtsEngine) => writeStoredEngine(newEngine),
      toggleEngine: () => {
        const current = getSnapshot();
        writeStoredEngine(current === "ai" ? "browser" : "ai");
      },
    };
  }

  return context;
}
