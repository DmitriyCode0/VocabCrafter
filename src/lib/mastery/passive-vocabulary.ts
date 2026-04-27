import { z } from "zod";
import type { Json } from "@/types/database";
import type { CEFRLevel } from "@/types/quiz";

export const PASSIVE_VOCABULARY_ITEM_TYPES = ["word", "phrase"] as const;
export const PASSIVE_VOCABULARY_SOURCE_TYPES = [
  "full_text",
  "manual_list",
  "curated_list",
] as const;
export const PASSIVE_VOCABULARY_CEFR_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
] as const satisfies readonly CEFRLevel[];
export const PASSIVE_VOCABULARY_PARTS_OF_SPEECH = [
  "noun",
  "verb",
  "modal verb",
  "auxiliary",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "determiner",
  "interjection",
  "phrase",
  "other",
] as const;

export type PassiveVocabularyItemType =
  (typeof PASSIVE_VOCABULARY_ITEM_TYPES)[number];
export type PassiveVocabularySourceType =
  (typeof PASSIVE_VOCABULARY_SOURCE_TYPES)[number];
export type PassiveVocabularyLibraryCefrLevel =
  (typeof PASSIVE_VOCABULARY_CEFR_LEVELS)[number];
export type PassiveVocabularyPartOfSpeech =
  (typeof PASSIVE_VOCABULARY_PARTS_OF_SPEECH)[number];
export interface PassiveVocabularyLibraryAttributes extends Record<
  string,
  Json | undefined
> {
  ukrainianTranslation?: string | null;
}

function normalizePassiveVocabularyAttributeText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ");
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function normalizePassiveVocabularyLibraryAttributes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} satisfies PassiveVocabularyLibraryAttributes;
  }

  const attributes = {
    ...(value as Record<string, unknown>),
  } as PassiveVocabularyLibraryAttributes;
  const ukrainianTranslation = normalizePassiveVocabularyAttributeText(
    attributes.ukrainianTranslation ?? attributes.ukrainian_translation,
  );

  delete attributes.ukrainian_translation;

  if (ukrainianTranslation) {
    attributes.ukrainianTranslation = ukrainianTranslation;
  } else {
    delete attributes.ukrainianTranslation;
  }

  return attributes;
}

export function getPassiveVocabularyUkrainianTranslation(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  return (
    normalizePassiveVocabularyLibraryAttributes(attributes)
      .ukrainianTranslation ?? null
  );
}

export function withPassiveVocabularyUkrainianTranslation(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  ukrainianTranslation?: string | null,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedTranslation =
    normalizePassiveVocabularyAttributeText(ukrainianTranslation);

  if (normalizedTranslation) {
    nextAttributes.ukrainianTranslation = normalizedTranslation;
  } else {
    delete nextAttributes.ukrainianTranslation;
  }

  return nextAttributes;
}

export function getPassiveVocabularyCustomAttributes(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  const customAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  delete customAttributes.ukrainianTranslation;

  return customAttributes;
}

export function formatPassiveVocabularyPartOfSpeech(value?: string | null) {
  if (!value) {
    return "—";
  }

  return value
    .split(" ")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function inferPassiveVocabularyItemType(
  value: string,
): PassiveVocabularyItemType {
  return normalizePassiveVocabularyText(value).includes(" ")
    ? "phrase"
    : "word";
}

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

export const passiveVocabularyLibraryImportSchema = z.object({
  targetLanguage: z.enum(["english", "spanish"]),
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
  library_cefr_level?: PassiveVocabularyLibraryCefrLevel | null;
  library_part_of_speech?: PassiveVocabularyPartOfSpeech | null;
  library_attributes?: PassiveVocabularyLibraryAttributes | null;
}

export interface PassiveVocabularySampleItem {
  term: string;
  definition: string | null;
  itemType: PassiveVocabularyItemType;
  sourceType: PassiveVocabularySourceType;
  sourceLabel: string | null;
  importCount: number;
  lastImportedAt: string;
  libraryCefrLevel: PassiveVocabularyLibraryCefrLevel | null;
  partOfSpeech: PassiveVocabularyPartOfSpeech | null;
  recognitionWeight: number;
}

export interface PassiveVocabularySignalSummary {
  uniqueItems: number;
  wordCount: number;
  phraseCount: number;
  equivalentWordCount: number;
  rawEquivalentWordCount: number;
  cefrCounts: Record<PassiveVocabularyLibraryCefrLevel | "unknown", number>;
  sampleItems: PassiveVocabularySampleItem[];
}

export const PASSIVE_EQUIVALENT_WORDS_EXPLANATION =
  "Equivalent words is the recognition-weighted single-word total used by passive-vocabulary estimates. Words at or below the student's current level count fully. Higher-level words count partially until the learner's overall profile catches up.";

const PASSIVE_VOCABULARY_WORD_PATTERN =
  /[\p{L}\p{M}]+(?:[\u2019'’-][\p{L}\p{M}]+)*/gu;
const PASSIVE_VOCABULARY_CEFR_ORDER = new Map<
  PassiveVocabularyLibraryCefrLevel,
  number
>(PASSIVE_VOCABULARY_CEFR_LEVELS.map((level, index) => [level, index]));

function addPassiveVocabularyCandidate(
  candidates: string[],
  candidate: string | null,
) {
  if (!candidate) {
    return;
  }

  const normalizedCandidate = normalizePassiveVocabularyText(candidate);
  if (!normalizedCandidate || candidates.includes(normalizedCandidate)) {
    return;
  }

  candidates.push(normalizedCandidate);
}

function appendRegularWordVariantCandidates(
  normalizedText: string,
  candidates: string[],
) {
  if (normalizedText.length <= 3) {
    return;
  }

  if (normalizedText.endsWith("ies") && normalizedText.length > 4) {
    addPassiveVocabularyCandidate(
      candidates,
      `${normalizedText.slice(0, -3)}y`,
    );
  }

  if (/(ches|shes|sses|xes|zes|oes)$/.test(normalizedText)) {
    addPassiveVocabularyCandidate(candidates, normalizedText.slice(0, -2));
  }

  if (normalizedText === "has") {
    addPassiveVocabularyCandidate(candidates, "have");
    return;
  }

  if (
    normalizedText.endsWith("s") &&
    !normalizedText.endsWith("ss") &&
    !normalizedText.endsWith("us") &&
    !normalizedText.endsWith("is")
  ) {
    addPassiveVocabularyCandidate(candidates, normalizedText.slice(0, -1));
  }
}

function createPassiveVocabularyCefrCounts() {
  return {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
    C2: 0,
    unknown: 0,
  } satisfies Record<PassiveVocabularyLibraryCefrLevel | "unknown", number>;
}

function roundRecognitionWeight(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizePassiveVocabularyText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getPassiveVocabularyLookupCandidates(
  value: string,
  itemType: PassiveVocabularyItemType,
) {
  const normalizedText = normalizePassiveVocabularyText(value);
  if (!normalizedText) {
    return [];
  }

  const candidates = [normalizedText];

  if (itemType === "word" && !normalizedText.includes(" ")) {
    appendRegularWordVariantCandidates(normalizedText, candidates);
  }

  return candidates;
}

export function extractPassiveVocabularyTermsFromText(text: string) {
  const uniqueTerms = new Map<string, string>();

  for (const normalizedTerm of extractPassiveVocabularyTermOccurrencesFromText(
    text,
  )) {
    if (!uniqueTerms.has(normalizedTerm)) {
      uniqueTerms.set(normalizedTerm, normalizedTerm);
    }
  }

  return Array.from(uniqueTerms.values()).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

export function extractPassiveVocabularyTermOccurrencesFromText(text: string) {
  const matches = text.match(PASSIVE_VOCABULARY_WORD_PATTERN) ?? [];
  const occurrences: string[] = [];

  for (const match of matches) {
    const normalizedTerm = normalizePassiveVocabularyText(match);

    if (!normalizedTerm) {
      continue;
    }

    occurrences.push(normalizedTerm);
  }

  return occurrences;
}

export function getPassiveVocabularyCompositeKey(
  normalizedText: string,
  itemType: PassiveVocabularyItemType,
) {
  return `${itemType}:${normalizedText}`;
}

export function getPassiveVocabularyEquivalentWeight(
  itemType: PassiveVocabularyItemType,
  options?: {
    libraryCefrLevel?: PassiveVocabularyLibraryCefrLevel | null;
    studentCefrLevel?: CEFRLevel | null;
  },
) {
  if (itemType === "phrase") {
    return 1;
  }

  const studentLevel = options?.studentCefrLevel;
  const libraryLevel = options?.libraryCefrLevel;

  if (!studentLevel || !libraryLevel) {
    return 1;
  }

  const studentIndex = PASSIVE_VOCABULARY_CEFR_ORDER.get(studentLevel);
  const libraryIndex = PASSIVE_VOCABULARY_CEFR_ORDER.get(libraryLevel);

  if (studentIndex == null || libraryIndex == null) {
    return 1;
  }

  const levelDistance = libraryIndex - studentIndex;

  if (levelDistance <= 0) {
    return 1;
  }

  if (levelDistance === 1) {
    return 0.75;
  }

  if (levelDistance === 2) {
    return 0.45;
  }

  return 0.2;
}

export function summarizePassiveVocabularyEvidence(
  rows: PassiveVocabularyEvidenceRow[],
  studentCefrLevel?: CEFRLevel | null,
  sampleLimit = 30,
): PassiveVocabularySignalSummary {
  const wordCount = rows.filter((row) => row.item_type === "word").length;
  const phraseCount = rows.length - wordCount;
  const rawEquivalentWordCount = Math.round(
    rows.reduce(
      (sum, row) =>
        sum +
        getPassiveVocabularyEquivalentWeight(row.item_type, {
          studentCefrLevel: null,
        }),
      0,
    ),
  );
  const cefrCounts = createPassiveVocabularyCefrCounts();
  const equivalentWordCount = Math.round(
    rows.reduce((sum, row) => {
      const libraryLevel = row.library_cefr_level ?? null;
      const recognitionWeight = getPassiveVocabularyEquivalentWeight(
        row.item_type,
        {
          libraryCefrLevel: libraryLevel,
          studentCefrLevel,
        },
      );

      if (libraryLevel) {
        cefrCounts[libraryLevel] += 1;
      } else {
        cefrCounts.unknown += 1;
      }

      return sum + recognitionWeight;
    }, 0),
  );

  return {
    uniqueItems: rows.length,
    wordCount,
    phraseCount,
    equivalentWordCount,
    rawEquivalentWordCount,
    cefrCounts,
    sampleItems: rows.slice(0, sampleLimit).map((row) => ({
      term: row.term,
      definition: row.definition,
      itemType: row.item_type,
      sourceType: row.source_type,
      sourceLabel: row.source_label,
      importCount: row.import_count,
      lastImportedAt: row.last_imported_at,
      libraryCefrLevel: row.library_cefr_level ?? null,
      partOfSpeech: row.library_part_of_speech ?? null,
      recognitionWeight: roundRecognitionWeight(
        getPassiveVocabularyEquivalentWeight(row.item_type, {
          libraryCefrLevel: row.library_cefr_level ?? null,
          studentCefrLevel,
        }),
      ),
    })),
  };
}
