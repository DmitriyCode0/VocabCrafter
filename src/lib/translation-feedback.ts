import type { AppLanguage } from "@/lib/i18n/app-language";

export const TRANSLATION_FEEDBACK_KEYS = [
  "vocabulary",
  "grammar",
  "meaning",
  "mechanics",
  "naturalness",
] as const;

export type TranslationFeedbackKey =
  (typeof TRANSLATION_FEEDBACK_KEYS)[number];

export interface TranslationFeedbackMetric {
  key: TranslationFeedbackKey;
  passed: boolean;
  comment: string;
}

export type TranslationFeedbackMetricsRecord = Record<
  TranslationFeedbackKey,
  {
    passed: boolean;
    comment: string;
  }
>;

const TRANSLATION_FEEDBACK_LABELS: Record<
  AppLanguage,
  Record<TranslationFeedbackKey, string>
> = {
  en: {
    vocabulary: "Vocabulary",
    grammar: "Grammar",
    meaning: "Meaning",
    mechanics: "Mechanics",
    naturalness: "Naturalness",
  },
  uk: {
    vocabulary: "Словник",
    grammar: "Граматика",
    meaning: "Зміст",
    mechanics: "Механіка",
    naturalness: "Природність",
  },
};

const LEGACY_LABEL_TO_KEY: Record<string, TranslationFeedbackKey> = {
  vocabulary: "vocabulary",
  grammar: "grammar",
  meaning: "meaning",
  "meaning & completeness": "meaning",
  mechanics: "mechanics",
  naturalness: "naturalness",
  словник: "vocabulary",
  граматика: "grammar",
  зміст: "meaning",
  механіка: "mechanics",
  природність: "naturalness",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FEEDBACK_ITEM_PATTERN = new RegExp(
  `([✓✗])\\s*(${Object.keys(LEGACY_LABEL_TO_KEY)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|")})\\s*:`,
  "giu",
);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripSuggestedAnswerSection(feedback: string) {
  return feedback
    .replace(
      /\s*(Suggested(?: answer)?|suggested(?: answer)?|Рекомендована відповідь|Запропонована відповідь)\s*:[\s\S]*$/iu,
      "",
    )
    .trim();
}

function stripLabelPrefix(comment: string, key: TranslationFeedbackKey) {
  const knownLabels = Array.from(
    new Set(
      [
        TRANSLATION_FEEDBACK_LABELS.en[key],
        TRANSLATION_FEEDBACK_LABELS.uk[key],
        key === "meaning" ? "Meaning & Completeness" : null,
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  return comment
    .replace(/^[✓✗]\s*/u, "")
    .replace(
      new RegExp(
        `^(?:${knownLabels
          .sort((left, right) => right.length - left.length)
          .map(escapeRegExp)
          .join("|")})\\s*:\\s*`,
        "iu",
      ),
      "",
    )
    .trim();
}

export function getTranslationFeedbackLabels(appLanguage: AppLanguage) {
  return TRANSLATION_FEEDBACK_LABELS[appLanguage];
}

export function formatTranslationFeedback(
  metrics: TranslationFeedbackMetricsRecord,
  appLanguage: AppLanguage,
) {
  const labels = getTranslationFeedbackLabels(appLanguage);

  return TRANSLATION_FEEDBACK_KEYS.map((key) => {
    const metric = metrics[key];
    const symbol = metric.passed ? "✓" : "✗";

    return `${symbol} ${labels[key]}: ${stripLabelPrefix(metric.comment, key)}`;
  }).join("\n");
}

export function parseTranslationFeedback(
  feedback: string,
): TranslationFeedbackMetric[] {
  const cleanedFeedback = stripSuggestedAnswerSection(feedback);
  const matches = Array.from(cleanedFeedback.matchAll(FEEDBACK_ITEM_PATTERN));

  if (matches.length === 0) {
    return [];
  }

  const metricMap = new Map<TranslationFeedbackKey, TranslationFeedbackMetric>();

  for (const [index, match] of matches.entries()) {
    const symbol = match[1];
    const rawLabel = match[2];
    const startIndex = match.index ?? 0;
    const contentStartIndex = startIndex + match[0].length;
    const contentEndIndex = matches[index + 1]?.index ?? cleanedFeedback.length;
    const key = LEGACY_LABEL_TO_KEY[normalizeWhitespace(rawLabel).toLowerCase()];

    if (!key) {
      continue;
    }

    metricMap.set(key, {
      key,
      passed: symbol === "✓",
      comment: stripLabelPrefix(
        normalizeWhitespace(
          cleanedFeedback.slice(contentStartIndex, contentEndIndex),
        ),
        key,
      ),
    });
  }

  return TRANSLATION_FEEDBACK_KEYS.flatMap((key) => {
    const metric = metricMap.get(key);
    return metric ? [metric] : [];
  });
}