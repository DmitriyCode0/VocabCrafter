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
  confidence: z.coerce.number().int().min(1).max(5).default(4),
  items: z.array(passiveVocabularyImportItemSchema).min(1).max(500),
});

export interface PassiveVocabularyEvidenceRow {
  term: string;
  definition: string | null;
  item_type: PassiveVocabularyItemType;
  source_type: PassiveVocabularySourceType;
  source_label: string | null;
  confidence: number;
  import_count: number;
  last_imported_at: string;
}

export interface PassiveVocabularySampleItem {
  term: string;
  definition: string | null;
  itemType: PassiveVocabularyItemType;
  sourceType: PassiveVocabularySourceType;
  sourceLabel: string | null;
  confidence: number;
  importCount: number;
  lastImportedAt: string;
}

export interface PassiveVocabularySignalSummary {
  uniqueItems: number;
  wordCount: number;
  phraseCount: number;
  equivalentWordCount: number;
  avgConfidence: number;
  sampleItems: PassiveVocabularySampleItem[];
}

export function normalizePassiveVocabularyText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getPassiveVocabularyCompositeKey(
  normalizedText: string,
  itemType: PassiveVocabularyItemType,
) {
  return `${itemType}:${normalizedText}`;
}

export function getPassiveVocabularyEquivalentWeight(
  itemType: PassiveVocabularyItemType,
  confidence: number,
) {
  const normalizedConfidence = Math.max(1, Math.min(5, confidence));
  const confidenceFactor = 0.6 + (normalizedConfidence - 1) * 0.1;

  if (itemType === "phrase") {
    return 0.45 * confidenceFactor;
  }

  return 1 * confidenceFactor;
}

export function summarizePassiveVocabularyEvidence(
  rows: PassiveVocabularyEvidenceRow[],
  sampleLimit = 30,
): PassiveVocabularySignalSummary {
  const wordCount = rows.filter((row) => row.item_type === "word").length;
  const phraseCount = rows.length - wordCount;
  const avgConfidence =
    rows.length > 0
      ? Number(
          (
            rows.reduce((sum, row) => sum + (row.confidence ?? 0), 0) /
            rows.length
          ).toFixed(1),
        )
      : 0;
  const equivalentWordCount = Math.round(
    rows.reduce(
      (sum, row) =>
        sum +
        getPassiveVocabularyEquivalentWeight(row.item_type, row.confidence),
      0,
    ),
  );

  return {
    uniqueItems: rows.length,
    wordCount,
    phraseCount,
    equivalentWordCount,
    avgConfidence,
    sampleItems: rows.slice(0, sampleLimit).map((row) => ({
      term: row.term,
      definition: row.definition,
      itemType: row.item_type,
      sourceType: row.source_type,
      sourceLabel: row.source_label,
      confidence: row.confidence,
      importCount: row.import_count,
      lastImportedAt: row.last_imported_at,
    })),
  };
}
