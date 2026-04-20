export const APP_LANGUAGES = ["en", "uk"] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export function normalizeAppLanguage(value: unknown): AppLanguage {
  return value === "uk" ? "uk" : "en";
}