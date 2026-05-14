import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
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

const ACTIVE_TO_PASSIVE_SOURCE_LABEL =
  "Auto-copied from confirmed active vocabulary";

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

export async function syncConfirmedActiveVocabularyToPassiveEvidence({
  adminClient,
  actorUserId,
  libraryItemIds,
  studentId,
}: {
  adminClient: AdminClient;
  actorUserId: string;
  libraryItemIds: string[];
  studentId?: string;
}) {
  const uniqueLibraryItemIds = Array.from(
    new Set(libraryItemIds.filter(Boolean)),
  );

  if (uniqueLibraryItemIds.length === 0) {
    return {
      createdCount: 0,
      updatedCount: 0,
    };
  }

  let activeRowsQuery = adminClient
    .from("active_vocabulary_evidence")
    .select("student_id, library_item_id, term, normalized_term, last_used_at")
    .in("library_item_id", uniqueLibraryItemIds);

  if (studentId) {
    activeRowsQuery = activeRowsQuery.eq("student_id", studentId);
  }

  const { data: activeRows, error: activeRowsError } = await activeRowsQuery;

  if (activeRowsError) {
    throw new Error("Failed to load confirmed active vocabulary evidence");
  }

  if (!activeRows || activeRows.length === 0) {
    return {
      createdCount: 0,
      updatedCount: 0,
    };
  }

  const studentIds = Array.from(new Set(activeRows.map((row) => row.student_id)));
  const normalizedTerms = Array.from(
    new Set(activeRows.map((row) => row.normalized_term)),
  );

  const { data: existingPassiveRows, error: existingPassiveRowsError } =
    await adminClient
      .from("passive_vocabulary_evidence")
      .select(
        "student_id, normalized_term, item_type, source_type, source_label, definition, import_count, last_imported_at, library_item_id",
      )
      .in("student_id", studentIds)
      .eq("item_type", "word")
      .in("normalized_term", normalizedTerms);

  if (existingPassiveRowsError) {
    throw new Error("Failed to inspect passive vocabulary evidence");
  }

  const existingPassiveRowsByKey = new Map(
    (existingPassiveRows ?? []).map((row) => [
      `${row.student_id}:${row.normalized_term}`,
      row,
    ]),
  );

  const nowIso = new Date().toISOString();
  const upsertRows = activeRows.map((row) => {
    const existingRow = existingPassiveRowsByKey.get(
      `${row.student_id}:${row.normalized_term}`,
    );
    const existingTime = existingRow?.last_imported_at
      ? new Date(existingRow.last_imported_at).getTime()
      : 0;
    const activeTime = row.last_used_at
      ? new Date(row.last_used_at).getTime()
      : 0;

    return {
      student_id: row.student_id,
      imported_by: actorUserId,
      term: row.term,
      normalized_term: row.normalized_term,
      definition: existingRow?.definition ?? null,
      item_type: "word" as const,
      source_type: existingRow?.source_type ?? ("curated_list" as const),
      source_label: existingRow?.source_label ?? ACTIVE_TO_PASSIVE_SOURCE_LABEL,
      import_count: existingRow?.import_count ?? 1,
      last_imported_at:
        existingTime >= activeTime
          ? existingRow?.last_imported_at ?? row.last_used_at ?? nowIso
          : row.last_used_at ?? nowIso,
      library_item_id: row.library_item_id,
      updated_at: nowIso,
    };
  });

  const { error: upsertPassiveError } = await adminClient
    .from("passive_vocabulary_evidence")
    .upsert(upsertRows, {
      onConflict: "student_id,normalized_term,item_type",
    });

  if (upsertPassiveError) {
    throw new Error("Failed to sync active vocabulary into passive evidence");
  }

  const createdCount = upsertRows.filter(
    (row) =>
      !existingPassiveRowsByKey.has(`${row.student_id}:${row.normalized_term}`),
  ).length;

  return {
    createdCount,
    updatedCount: upsertRows.length - createdCount,
  };
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
      confirmedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
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

  const acceptedResolutions = resolutions.filter(
    (resolution) => resolution.approvalStatus !== "rejected",
  );
  const rejectedCount = resolutions.length - acceptedResolutions.length;

  if (acceptedResolutions.length === 0) {
    return {
      importedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      confirmedCount: 0,
      pendingCount: 0,
      rejectedCount,
    };
  }

  const canonicalUsageCounts = new Map<string, number>();
  const canonicalResolutionsByTerm = new Map<
    string,
    (typeof acceptedResolutions)[number]
  >();

  for (const resolution of acceptedResolutions) {
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
    .in("normalized_term", Array.from(canonicalResolutionsByTerm.keys()));

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
        usage_count:
          (existing?.usage_count ?? 0) + Math.max(usageDelta ?? 0, 1),
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

  const confirmedLibraryItemIds = Array.from(
    new Set(
      acceptedResolutions.flatMap((resolution) =>
        resolution.approvalStatus === "confirmed" && resolution.libraryItemId
          ? [resolution.libraryItemId]
          : [],
      ),
    ),
  );

  if (confirmedLibraryItemIds.length > 0) {
    await syncConfirmedActiveVocabularyToPassiveEvidence({
      adminClient,
      actorUserId,
      libraryItemIds: confirmedLibraryItemIds,
      studentId,
    });
  }

  const createdCount = rows.filter(
    (row) => !existingRowsByNormalizedTerm.has(row.normalized_term),
  ).length;
  const confirmedCount = Array.from(canonicalResolutionsByTerm.values()).filter(
    (resolution) => resolution.approvalStatus === "confirmed",
  ).length;

  return {
    importedCount: rows.length,
    createdCount,
    updatedCount: rows.length - createdCount,
    confirmedCount,
    pendingCount: rows.length - confirmedCount,
    rejectedCount,
  };
}

export function normalizeActiveVocabularyLibraryAttributes(value: unknown) {
  return normalizePassiveVocabularyLibraryAttributes(value);
}
