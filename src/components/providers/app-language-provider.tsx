"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages, type AppMessages } from "@/lib/i18n/messages";

interface AppLanguageContextValue {
  appLanguage: AppLanguage;
  messages: AppMessages;
}

const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);

interface AppLanguageProviderProps {
  appLanguage: AppLanguage;
  children: ReactNode;
}

export function AppLanguageProvider({
  appLanguage,
  children,
}: AppLanguageProviderProps) {
  return (
    <AppLanguageContext.Provider
      value={{ appLanguage, messages: getAppMessages(appLanguage) }}
    >
      {children}
    </AppLanguageContext.Provider>
  );
}

export function useAppI18n() {
  const context = useContext(AppLanguageContext);

  if (!context) {
    throw new Error("useAppI18n must be used within AppLanguageProvider");
  }

  return context;
}
