import { z } from "zod";

export const PASSIVE_VOCABULARY_ITEM_TYPES = ["word", "phrase"] as const;
export const PASSIVE_VOCABULARY_SOURCE_TYPES = [
  "full_text",
  "manual_list",
  "curated_list",
] as const;

export type PassiveVocabularyItemType =
  (typeof PASSIVE_VOCABULARY_ITEM_TYPES)[number];
export type PassiveVocabularySourceType =
  (typeof PASSIVE_VOCABULARY_SOURCE_TYPES)[number];

export const passiveVocabularyImportItemSchema = z.object({
  term: z.string().trim().min(1).max(200),
  definition: z.string().trim().max(400).optional(),
  itemType: z.enum(PASSIVE_VOCABULARY_ITEM_TYPES).default("word"),
});

export const passiveVocabularyImportSchema = z.object({
  studentId: z.string().uuid().optional(),
  sourceType: z.enum(PASSIVE_VOCABULARY_SOURCE_TYPES).default("full_text"),
  sourceLabel: z.string().trim().max(160).optional(),
  items: z.array(passiveVocabularyImportItemSchema).min(1).max(500),
});

export interface PassiveVocabularyEvidenceRow {
  term: string;
  definition: string | null;
  item_type: PassiveVocabularyItemType;
  source_type: PassiveVocabularySourceType;
  source_label: string | null;
  import_count: number;
  last_imported_at: string;
}

export interface PassiveVocabularySampleItem {
  term: string;
  definition: string | null;
  itemType: PassiveVocabularyItemType;
  sourceType: PassiveVocabularySourceType;
  sourceLabel: string | null;
  importCount: number;
  lastImportedAt: string;
}

export interface PassiveVocabularySignalSummary {
  uniqueItems: number;
  wordCount: number;
  phraseCount: number;
  equivalentWordCount: number;
  sampleItems: PassiveVocabularySampleItem[];
}

export const PASSIVE_EQUIVALENT_WORDS_EXPLANATION =
  "Equivalent words is the single-word total used by progress estimates when passive evidence is added. Because passive imports are now split into individual known words, it will usually match the passive evidence count.";

const PASSIVE_VOCABULARY_WORD_PATTERN =
  /[\p{L}\p{M}]+(?:[\u2019'’-][\p{L}\p{M}]+)*/gu;

export function normalizePassiveVocabularyText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function extractPassiveVocabularyTermsFromText(text: string) {
  const matches = text.match(PASSIVE_VOCABULARY_WORD_PATTERN) ?? [];
  const uniqueTerms = new Map<string, string>();

  for (const match of matches) {
    const normalizedTerm = normalizePassiveVocabularyText(match);

    if (!normalizedTerm) {
      continue;
    }

    if (!uniqueTerms.has(normalizedTerm)) {
      uniqueTerms.set(normalizedTerm, normalizedTerm);
    }
  }

  return Array.from(uniqueTerms.values()).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

export function getPassiveVocabularyCompositeKey(
  normalizedText: string,
  itemType: PassiveVocabularyItemType,
) {
  return `${itemType}:${normalizedText}`;
}

export function getPassiveVocabularyEquivalentWeight(
  itemType: PassiveVocabularyItemType,
) {
  if (itemType === "phrase") {
    return 1;
  }

  return 1;
}

export function summarizePassiveVocabularyEvidence(
  rows: PassiveVocabularyEvidenceRow[],
  sampleLimit = 30,
): PassiveVocabularySignalSummary {
  const wordCount = rows.filter((row) => row.item_type === "word").length;
  const phraseCount = rows.length - wordCount;
  const equivalentWordCount = Math.round(
    rows.reduce(
      (sum, row) => sum + getPassiveVocabularyEquivalentWeight(row.item_type),
      0,
    ),
  );

  return {
    uniqueItems: rows.length,
    wordCount,
    phraseCount,
    equivalentWordCount,
    sampleItems: rows.slice(0, sampleLimit).map((row) => ({
      term: row.term,
      definition: row.definition,
      itemType: row.item_type,
      sourceType: row.source_type,
      sourceLabel: row.source_label,
      importCount: row.import_count,
      lastImportedAt: row.last_imported_at,
    })),
  };
}
