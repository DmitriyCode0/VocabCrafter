import type { QuizTerm } from "@/types/quiz";

const GENERIC_DATE_TITLE_PATTERNS = [
  /^quiz\s*[-–—·:]\s*\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/i,
  /^вікторина\s*[-–—·:]\s*\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/i,
  /^quiz\s*[-–—·:]\s*[a-z]{3,9}\s+\d{1,2},?\s+\d{4}$/i,
];

export function isGenericDateQuizTitle(title?: string | null): boolean {
  if (!title) return true;
  const trimmed = title.trim();
  if (!trimmed) return true;
  return GENERIC_DATE_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function extractTermLabels(vocabularyTerms: unknown): string[] {
  if (!Array.isArray(vocabularyTerms)) return [];

  return vocabularyTerms
    .map((item) => {
      if (item && typeof item === "object" && "term" in item) {
        const raw = (item as { term?: unknown }).term;
        return typeof raw === "string" ? raw.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

export function extractGrammarTopicLabelFromConfig(
  config: unknown,
): string | null {
  if (!config || typeof config !== "object") return null;

  const cfg = config as {
    grammarTopics?: unknown;
    grammarTopicLabels?: Record<string, unknown>;
  };

  if (!Array.isArray(cfg.grammarTopics) || cfg.grammarTopics.length === 0) {
    return null;
  }

  const firstKey = cfg.grammarTopics[0];
  if (typeof firstKey !== "string" || !firstKey.trim()) {
    return null;
  }

  const mappedLabel = cfg.grammarTopicLabels?.[firstKey];
  if (typeof mappedLabel === "string" && mappedLabel.trim()) {
    return mappedLabel.trim();
  }

  return firstKey.trim();
}

export function extractCustomTopicFromConfig(config: unknown): string | null {
  if (!config || typeof config !== "object") return null;
  const raw = (config as { customTopic?: unknown }).customTopic;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function buildFallbackQuizTitle({
  terms,
  grammarTopicLabel,
  customTopic,
}: {
  terms: QuizTerm[] | string[];
  grammarTopicLabel?: string | null;
  customTopic?: string | null;
}): string {
  const labels = terms
    .map((item) => (typeof item === "string" ? item.trim() : item.term.trim()))
    .filter(Boolean);

  const wordsPreview =
    labels.length === 0
      ? ""
      : labels.length <= 2
        ? labels.join(", ")
        : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;

  const prefix = customTopic?.trim() || grammarTopicLabel?.trim() || "";

  if (prefix && wordsPreview) {
    return `${prefix} · ${wordsPreview}`;
  }

  if (prefix) {
    return prefix;
  }

  return wordsPreview || "Vocabulary Practice";
}

export function normalizeSuggestedQuizTitle({
  suggestedTitle,
  grammarTopicLabel,
  fallbackTitle,
}: {
  suggestedTitle?: string | null;
  grammarTopicLabel?: string | null;
  fallbackTitle: string;
}): string {
  const cleaned = suggestedTitle
    ?.replace(/[\r\n]+/g, " ")
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
    .trim();

  if (!cleaned || isGenericDateQuizTitle(cleaned)) {
    return fallbackTitle;
  }

  const topic = grammarTopicLabel?.trim();
  if (topic && !cleaned.toLowerCase().includes(topic.toLowerCase())) {
    const combined = `${topic} · ${cleaned}`;
    return combined.length <= 72 ? combined : cleaned;
  }

  return cleaned.slice(0, 72);
}

export function resolveQuizDisplayTitle({
  title,
  vocabularyTerms,
  config,
}: {
  title?: string | null;
  vocabularyTerms?: unknown;
  config?: unknown;
}): string {
  const trimmed = title?.trim() ?? "";

  if (trimmed && !isGenericDateQuizTitle(trimmed)) {
    return trimmed;
  }

  const terms = extractTermLabels(vocabularyTerms);
  const grammarTopicLabel = extractGrammarTopicLabelFromConfig(config);
  const customTopic = extractCustomTopicFromConfig(config);

  if (terms.length === 0 && !grammarTopicLabel && !customTopic) {
    return trimmed || "Vocabulary Practice";
  }

  return buildFallbackQuizTitle({
    terms,
    grammarTopicLabel,
    customTopic,
  });
}
