import type { CEFRLevel } from "@/types/quiz";

export const TARGET_LANGUAGE_OPTIONS = [
  { value: "english", label: "English" },
  { value: "spanish", label: "Spanish" },
] as const;

export const SOURCE_LANGUAGE_OPTIONS = [
  { value: "english", label: "English" },
  { value: "ukrainian", label: "Ukrainian" },
] as const;

export type LearningLanguage =
  (typeof TARGET_LANGUAGE_OPTIONS)[number]["value"];
export type SourceLanguage = (typeof SOURCE_LANGUAGE_OPTIONS)[number]["value"];

export const ALL_CEFR_LEVELS: CEFRLevel[] = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
];

export function normalizeLearningLanguage(
  value?: string | null,
): LearningLanguage {
  if (value === "spanish" || value === "es") {
    return "spanish";
  }

  return "english";
}

export function normalizeSourceLanguage(value?: string | null): SourceLanguage {
  if (value === "english" || value === "en") {
    return "english";
  }

  return "ukrainian";
}

export function getLearningLanguageLabel(value?: string | null) {
  const normalized = normalizeLearningLanguage(value);
  return (
    TARGET_LANGUAGE_OPTIONS.find((option) => option.value === normalized)
      ?.label ?? "English"
  );
}

export function getSourceLanguageLabel(value?: string | null) {
  const normalized = normalizeSourceLanguage(value);
  return (
    SOURCE_LANGUAGE_OPTIONS.find((option) => option.value === normalized)
      ?.label ?? "Ukrainian"
  );
}

export function getAllowedCefrLevels(language?: string | null): CEFRLevel[] {
  return normalizeLearningLanguage(language) === "spanish"
    ? ["A1"]
    : ALL_CEFR_LEVELS;
}

export function getDefaultCefrLevelForLanguage(
  language?: string | null,
): CEFRLevel {
  return normalizeLearningLanguage(language) === "spanish" ? "A1" : "B1";
}

export function getSpeechLanguageTag(language?: string | null) {
  if (language === "spanish" || language === "es") {
    return "es-ES";
  }

  if (language === "ukrainian" || language === "uk") {
    return "uk-UA";
  }

  return "en-US";
}
