import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { CEFRLevel } from "@/types/quiz";
import {
  normalizePassiveVocabularyLibraryAttributes,
  normalizePassiveVocabularyText,
  type PassiveVocabularyLibraryAttributes,
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";
import { resolvePassiveVocabularyLibraryItems } from "@/lib/mastery/passive-vocabulary-library";
import { normalizeLearningLanguage } from "@/lib/languages";

type AdminClient = SupabaseClient<Database>;

export type ActiveVocabularyEvidenceSourceType =
  Database["public"]["Tables"]["active_vocabulary_evidence"]["Row"]["source_type"];

export interface ActiveVocabularyEvidenceRow {
  id: string;
  term: string;
  source_type: ActiveVocabularyEvidenceSourceType;
  source_label: string | null;
  usage_count: number;
  first_used_at: string;
  last_used_at: string;
  library_cefr_level?: PassiveVocabularyLibraryCefrLevel | null;
  library_part_of_speech?: PassiveVocabularyPartOfSpeech | null;
  library_attributes?: PassiveVocabularyLibraryAttributes | null;
}

export interface ActiveVocabularySignalSummary {
  uniqueItems: number;
  totalUsageCount: number;
  cefrCounts: Record<PassiveVocabularyLibraryCefrLevel | "unknown", number>;
}

function createActiveVocabularyCefrCounts() {
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

export function summarizeActiveVocabularyEvidence(
  items: ActiveVocabularyEvidenceRow[],
) {
  const cefrCounts = createActiveVocabularyCefrCounts();

  for (const item of items) {
    const cefrLevel = item.library_cefr_level ?? "unknown";
    cefrCounts[cefrLevel] += 1;
  }

  return {
    uniqueItems: items.length,
    totalUsageCount: items.reduce(
      (sum, item) => sum + Math.max(item.usage_count, 0),
      0,
    ),
    cefrCounts,
  } satisfies ActiveVocabularySignalSummary;
}

export interface UpsertActiveVocabularyEvidenceInput {
  adminClient: AdminClient;
  studentId: string;
  actorUserId: string;
  targetLanguage: string;
  terms: string[];
  sourceType?: ActiveVocabularyEvidenceSourceType;
  sourceLabel?: string | null;
  usedAt?: string;
}

export async function upsertActiveVocabularyEvidence({
  adminClient,
  studentId,
  actorUserId,
  targetLanguage,
  terms,
  sourceType = "lesson_recording",
  sourceLabel = null,
  usedAt,
}: UpsertActiveVocabularyEvidenceInput) {
  const normalizedTermCounts = new Map<string, number>();

  for (const term of terms) {
    const normalizedTerm = normalizePassiveVocabularyText(term);

    if (!normalizedTerm) {
      continue;
    }

    normalizedTermCounts.set(
      normalizedTerm,
      (normalizedTermCounts.get(normalizedTerm) ?? 0) + 1,
    );
  }

  const normalizedUniqueTerms = Array.from(normalizedTermCounts.keys());

  if (normalizedUniqueTerms.length === 0) {
    return {
      importedCount: 0,
      createdCount: 0,
      updatedCount: 0,
    };
  }

  const resolutions = await resolvePassiveVocabularyLibraryItems({
    adminClient,
    actorUserId,
    targetLanguage: normalizeLearningLanguage(targetLanguage),
    items: normalizedUniqueTerms.map((term) => ({
      term,
      normalizedTerm: term,
      itemType: "word" as const,
    })),
  });

  const canonicalUsageCounts = new Map<string, number>();
  const canonicalResolutionsByTerm = new Map<string, (typeof resolutions)[number]>();

  for (const resolution of resolutions) {
    canonicalUsageCounts.set(
      resolution.canonicalNormalizedTerm,
      (canonicalUsageCounts.get(resolution.canonicalNormalizedTerm) ?? 0) +
        (normalizedTermCounts.get(resolution.requestedNormalizedTerm) ?? 0),
    );

    if (!canonicalResolutionsByTerm.has(resolution.canonicalNormalizedTerm)) {
      canonicalResolutionsByTerm.set(
        resolution.canonicalNormalizedTerm,
        resolution,
      );
    }
  }

  const existingRowsResult = await adminClient
    .from("active_vocabulary_evidence")
    .select("id, normalized_term, usage_count, first_used_at, last_used_at")
    .eq("student_id", studentId)
    .in(
      "normalized_term",
      Array.from(canonicalResolutionsByTerm.keys()),
    );

  if (existingRowsResult.error) {
    throw new Error("Failed to inspect active vocabulary evidence");
  }

  const existingRowsByNormalizedTerm = new Map(
    (existingRowsResult.data ?? []).map((row) => [row.normalized_term, row]),
  );

  const nowIso = usedAt ?? new Date().toISOString();
  const rows = Array.from(canonicalResolutionsByTerm.values()).map(
    (resolution) => {
    const existing = existingRowsByNormalizedTerm.get(
      resolution.canonicalNormalizedTerm,
    );
    const usageDelta = canonicalUsageCounts.get(
      resolution.canonicalNormalizedTerm,
    );

    return {
      student_id: studentId,
      library_item_id: resolution.libraryItemId,
      term: resolution.canonicalTerm,
      normalized_term: resolution.canonicalNormalizedTerm,
      source_type: sourceType,
      source_label: sourceLabel,
      usage_count: (existing?.usage_count ?? 0) + Math.max(usageDelta ?? 0, 1),
      first_used_at: existing?.first_used_at ?? nowIso,
      last_used_at: nowIso,
      updated_at: nowIso,
    };
    },
  );

  const upsertResult = await adminClient
    .from("active_vocabulary_evidence")
    .upsert(rows, {
      onConflict: "student_id,normalized_term",
    });

  if (upsertResult.error) {
    throw new Error("Failed to save active vocabulary evidence");
  }

  const createdCount = rows.filter(
    (row) => !existingRowsByNormalizedTerm.has(row.normalized_term),
  ).length;

  return {
    importedCount: rows.length,
    createdCount,
    updatedCount: rows.length - createdCount,
  };
}

export function normalizeActiveVocabularyLibraryAttributes(value: unknown) {
  return normalizePassiveVocabularyLibraryAttributes(value);
}
