import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getPassiveVocabularyCompositeKey,
  inferPassiveVocabularyItemType,
  normalizePassiveVocabularyText,
  type PassiveVocabularyItemType,
} from "@/lib/mastery/passive-vocabulary";

type AdminClient = SupabaseClient<Database>;

export type StudentVocabularyCurrentState =
  Database["public"]["Tables"]["student_vocabulary_items"]["Row"]["current_state"];

type StudentVocabularyStateRow =
  Database["public"]["Tables"]["student_vocabulary_items"]["Row"];

export interface StudentVocabularyStateInput {
  term: string;
  normalizedTerm: string;
  itemType: PassiveVocabularyItemType;
  libraryItemId?: string | null;
}

export interface StudentVocabularyMasteryStateInput {
  term: string;
  masteryLevel: number;
  practicedAt?: string | null;
  createdAt?: string | null;
}

function dedupeStudentVocabularyStateInputs(
  inputs: StudentVocabularyStateInput[],
) {
  const deduped = new Map<string, StudentVocabularyStateInput>();

  for (const input of inputs) {
    const normalizedTerm = normalizePassiveVocabularyText(input.normalizedTerm);
    const normalizedItem = {
      term: input.term.trim().replace(/\s+/g, " "),
      normalizedTerm,
      itemType: input.itemType,
      libraryItemId: input.libraryItemId ?? null,
    } satisfies StudentVocabularyStateInput;

    if (!normalizedItem.term || !normalizedItem.normalizedTerm) {
      continue;
    }

    deduped.set(
      createStudentVocabularyStateKey(
        normalizedItem.normalizedTerm,
        normalizedItem.itemType,
      ),
      normalizedItem,
    );
  }

  return Array.from(deduped.values());
}

async function loadExistingStudentVocabularyStateRows(
  adminClient: AdminClient,
  studentId: string,
  inputs: StudentVocabularyStateInput[],
) {
  const normalizedTerms = Array.from(
    new Set(inputs.map((input) => input.normalizedTerm)),
  );
  const itemTypes = Array.from(new Set(inputs.map((input) => input.itemType)));

  if (normalizedTerms.length === 0 || itemTypes.length === 0) {
    return new Map<string, StudentVocabularyStateRow>();
  }

  const { data, error } = await adminClient
    .from("student_vocabulary_items")
    .select(
      "id, student_id, library_item_id, term, normalized_term, item_type, current_state, has_active_evidence, has_passive_evidence, moved_to_learning_at, learning_archived_at, created_at, updated_at",
    )
    .eq("student_id", studentId)
    .in("normalized_term", normalizedTerms)
    .in("item_type", itemTypes);

  if (error) {
    throw new Error("Failed to inspect student vocabulary state");
  }

  return new Map(
    ((data ?? []) as StudentVocabularyStateRow[]).map((row) => [
      createStudentVocabularyStateKey(row.normalized_term, row.item_type),
      row,
    ]),
  );
}

async function upsertStudentVocabularyStateRows(
  adminClient: AdminClient,
  rows: Database["public"]["Tables"]["student_vocabulary_items"]["Insert"][],
) {
  if (rows.length === 0) {
    return;
  }

  const { error } = await adminClient.from("student_vocabulary_items").upsert(
    rows,
    {
      onConflict: "student_id,normalized_term,item_type",
    },
  );

  if (error) {
    throw new Error("Failed to save student vocabulary state");
  }
}

async function deleteStudentVocabularyStateRows(
  adminClient: AdminClient,
  rowIds: string[],
) {
  if (rowIds.length === 0) {
    return;
  }

  const { error } = await adminClient
    .from("student_vocabulary_items")
    .delete()
    .in("id", rowIds);

  if (error) {
    throw new Error("Failed to delete student vocabulary state");
  }
}

function dedupeStudentVocabularyMasteryStateInputs(
  inputs: StudentVocabularyMasteryStateInput[],
) {
  const deduped = new Map<
    string,
    StudentVocabularyMasteryStateInput & {
      normalizedTerm: string;
      itemType: PassiveVocabularyItemType;
    }
  >();

  for (const input of inputs) {
    const trimmedTerm = input.term.trim().replace(/\s+/g, " ");
    const normalizedTerm = normalizePassiveVocabularyText(trimmedTerm);

    if (!trimmedTerm || !normalizedTerm) {
      continue;
    }

    deduped.set(
      createStudentVocabularyStateKey(
        normalizedTerm,
        inferPassiveVocabularyItemType(trimmedTerm),
      ),
      {
        ...input,
        term: trimmedTerm,
        normalizedTerm,
        itemType: inferPassiveVocabularyItemType(trimmedTerm),
      },
    );
  }

  return Array.from(deduped.values());
}

export function createStudentVocabularyStateKey(
  normalizedTerm: string,
  itemType: PassiveVocabularyItemType,
) {
  return getPassiveVocabularyCompositeKey(normalizedTerm, itemType);
}

export function createStudentVocabularyStateKeyFromTerm(term: string) {
  const normalizedTerm = normalizePassiveVocabularyText(term);

  if (!normalizedTerm) {
    return null;
  }

  return createStudentVocabularyStateKey(
    normalizedTerm,
    inferPassiveVocabularyItemType(term),
  );
}

export async function syncStudentVocabularyStateFromPassiveEvidence({
  adminClient,
  studentId,
  items,
}: {
  adminClient: AdminClient;
  studentId: string;
  items: StudentVocabularyStateInput[];
}) {
  const dedupedItems = dedupeStudentVocabularyStateInputs(items);

  if (dedupedItems.length === 0) {
    return;
  }

  const masteryKeySet = await getStudentWordMasteryKeySet({
    adminClient,
    studentId,
  });
  const existingRowsByKey = await loadExistingStudentVocabularyStateRows(
    adminClient,
    studentId,
    dedupedItems,
  );
  const nowIso = new Date().toISOString();

  await upsertStudentVocabularyStateRows(
    adminClient,
    dedupedItems.map((item) => {
      const itemKey = createStudentVocabularyStateKey(
        item.normalizedTerm,
        item.itemType,
      );
      const existing = existingRowsByKey.get(
        itemKey,
      );

      return {
        student_id: studentId,
        library_item_id: item.libraryItemId ?? existing?.library_item_id ?? null,
        term: item.term,
        normalized_term: item.normalizedTerm,
        item_type: item.itemType,
        current_state:
          existing?.current_state === "learning" || masteryKeySet.has(itemKey)
            ? "learning"
            : existing?.current_state === "active_and_passive"
              ? "active_and_passive"
              : "passive_only",
        has_active_evidence: existing?.has_active_evidence ?? false,
        has_passive_evidence: true,
        moved_to_learning_at: existing?.moved_to_learning_at ?? null,
        learning_archived_at: existing?.learning_archived_at ?? null,
        updated_at: nowIso,
      } satisfies Database["public"]["Tables"]["student_vocabulary_items"]["Insert"];
    }),
  );
}

export async function syncStudentVocabularyStateFromActiveEvidence({
  adminClient,
  studentId,
  items,
}: {
  adminClient: AdminClient;
  studentId: string;
  items: StudentVocabularyStateInput[];
}) {
  const dedupedItems = dedupeStudentVocabularyStateInputs(items);

  if (dedupedItems.length === 0) {
    return;
  }

  const masteryKeySet = await getStudentWordMasteryKeySet({
    adminClient,
    studentId,
  });
  const existingRowsByKey = await loadExistingStudentVocabularyStateRows(
    adminClient,
    studentId,
    dedupedItems,
  );
  const nowIso = new Date().toISOString();

  await upsertStudentVocabularyStateRows(
    adminClient,
    dedupedItems.map((item) => {
      const itemKey = createStudentVocabularyStateKey(
        item.normalizedTerm,
        item.itemType,
      );
      const existing = existingRowsByKey.get(
        itemKey,
      );

      return {
        student_id: studentId,
        library_item_id: item.libraryItemId ?? existing?.library_item_id ?? null,
        term: item.term,
        normalized_term: item.normalizedTerm,
        item_type: item.itemType,
        current_state:
          existing?.current_state === "learning" || masteryKeySet.has(itemKey)
            ? "learning"
            : "active_and_passive",
        has_active_evidence: true,
        has_passive_evidence: existing?.has_passive_evidence ?? false,
        moved_to_learning_at: existing?.moved_to_learning_at ?? null,
        learning_archived_at: existing?.learning_archived_at ?? null,
        updated_at: nowIso,
      } satisfies Database["public"]["Tables"]["student_vocabulary_items"]["Insert"];
    }),
  );
}

export async function markStudentVocabularyStateAsLearning({
  adminClient,
  studentId,
  items,
}: {
  adminClient: AdminClient;
  studentId: string;
  items: StudentVocabularyStateInput[];
}) {
  const dedupedItems = dedupeStudentVocabularyStateInputs(items);

  if (dedupedItems.length === 0) {
    return;
  }

  const existingRowsByKey = await loadExistingStudentVocabularyStateRows(
    adminClient,
    studentId,
    dedupedItems,
  );
  const nowIso = new Date().toISOString();

  await upsertStudentVocabularyStateRows(
    adminClient,
    dedupedItems.map((item) => {
      const existing = existingRowsByKey.get(
        createStudentVocabularyStateKey(item.normalizedTerm, item.itemType),
      );

      return {
        student_id: studentId,
        library_item_id: item.libraryItemId ?? existing?.library_item_id ?? null,
        term: item.term,
        normalized_term: item.normalizedTerm,
        item_type: item.itemType,
        current_state: "learning",
        has_active_evidence: existing?.has_active_evidence ?? false,
        has_passive_evidence: existing?.has_passive_evidence ?? false,
        moved_to_learning_at: existing?.moved_to_learning_at ?? nowIso,
        learning_archived_at: null,
        updated_at: nowIso,
      } satisfies Database["public"]["Tables"]["student_vocabulary_items"]["Insert"];
    }),
  );
}

export async function syncStudentVocabularyStateFromWordMastery({
  adminClient,
  studentId,
  items,
}: {
  adminClient: AdminClient;
  studentId: string;
  items: StudentVocabularyMasteryStateInput[];
}) {
  const dedupedItems = dedupeStudentVocabularyMasteryStateInputs(items);

  if (dedupedItems.length === 0) {
    return;
  }

  const existingRowsByKey = await loadExistingStudentVocabularyStateRows(
    adminClient,
    studentId,
    dedupedItems,
  );
  const nowIso = new Date().toISOString();

  await upsertStudentVocabularyStateRows(
    adminClient,
    dedupedItems.map((item) => {
      const existing = existingRowsByKey.get(
        createStudentVocabularyStateKey(item.normalizedTerm, item.itemType),
      );
      const effectiveTimestamp = item.practicedAt ?? item.createdAt ?? nowIso;

      return {
        student_id: studentId,
        library_item_id: existing?.library_item_id ?? null,
        term: item.term,
        normalized_term: item.normalizedTerm,
        item_type: item.itemType,
        current_state: "learning",
        has_active_evidence: existing?.has_active_evidence ?? false,
        has_passive_evidence: existing?.has_passive_evidence ?? false,
        moved_to_learning_at: existing?.moved_to_learning_at ?? effectiveTimestamp,
        learning_archived_at:
          item.masteryLevel >= 5 ? effectiveTimestamp : null,
        updated_at: nowIso,
      } satisfies Database["public"]["Tables"]["student_vocabulary_items"]["Insert"];
    }),
  );
}

export async function restoreStudentVocabularyStateAfterLearningRemoval({
  adminClient,
  studentId,
  terms,
}: {
  adminClient: AdminClient;
  studentId: string;
  terms: string[];
}) {
  const dedupedItems = dedupeStudentVocabularyMasteryStateInputs(
    terms.map((term) => ({
      term,
      masteryLevel: 0,
    })),
  );

  if (dedupedItems.length === 0) {
    return;
  }

  const existingRowsByKey = await loadExistingStudentVocabularyStateRows(
    adminClient,
    studentId,
    dedupedItems,
  );
  const nowIso = new Date().toISOString();
  const rowsToUpsert: Database["public"]["Tables"]["student_vocabulary_items"]["Insert"][] = [];
  const rowIdsToDelete: string[] = [];

  for (const item of dedupedItems) {
    const existing = existingRowsByKey.get(
      createStudentVocabularyStateKey(item.normalizedTerm, item.itemType),
    );

    if (!existing) {
      continue;
    }

    if (existing.has_active_evidence) {
      rowsToUpsert.push({
        student_id: studentId,
        library_item_id: existing.library_item_id,
        term: existing.term,
        normalized_term: existing.normalized_term,
        item_type: existing.item_type,
        current_state: "active_and_passive",
        has_active_evidence: true,
        has_passive_evidence: existing.has_passive_evidence,
        moved_to_learning_at: existing.moved_to_learning_at,
        learning_archived_at: null,
        updated_at: nowIso,
      });
      continue;
    }

    if (existing.has_passive_evidence) {
      rowsToUpsert.push({
        student_id: studentId,
        library_item_id: existing.library_item_id,
        term: existing.term,
        normalized_term: existing.normalized_term,
        item_type: existing.item_type,
        current_state: "passive_only",
        has_active_evidence: false,
        has_passive_evidence: true,
        moved_to_learning_at: existing.moved_to_learning_at,
        learning_archived_at: null,
        updated_at: nowIso,
      });
      continue;
    }

    rowIdsToDelete.push(existing.id);
  }

  await upsertStudentVocabularyStateRows(adminClient, rowsToUpsert);
  await deleteStudentVocabularyStateRows(adminClient, rowIdsToDelete);
}

export async function getStudentWordMasteryKeySet({
  adminClient,
  studentId,
}: {
  adminClient: AdminClient;
  studentId: string;
}) {
  const { data, error } = await adminClient
    .from("word_mastery")
    .select("term")
    .eq("student_id", studentId);

  if (error) {
    throw new Error("Failed to load student word mastery state");
  }

  const keySet = new Set<string>();

  for (const row of data ?? []) {
    const key = createStudentVocabularyStateKeyFromTerm(row.term);

    if (key) {
      keySet.add(key);
    }
  }

  return keySet;
}

export async function getStudentLearningVocabularyKeySet({
  adminClient,
  studentId,
}: {
  adminClient: AdminClient;
  studentId: string;
}) {
  const { data, error } = await adminClient
    .from("student_vocabulary_items")
    .select("normalized_term, item_type")
    .eq("student_id", studentId)
    .eq("current_state", "learning");

  if (error) {
    throw new Error("Failed to load student learning vocabulary state");
  }

  return new Set(
    (data ?? []).map((row) =>
      createStudentVocabularyStateKey(row.normalized_term, row.item_type),
    ),
  );
}