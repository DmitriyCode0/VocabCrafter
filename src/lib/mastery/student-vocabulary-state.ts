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
export type StudentVocabularyGroupOverride = Exclude<
  StudentVocabularyCurrentState,
  "learning"
>;

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

function normalizeStudentVocabularyGroupOverride(
  value: string | null | undefined,
): StudentVocabularyGroupOverride | null {
  return value === "passive_only" || value === "active_and_passive"
    ? value
    : null;
}

function getStudentVocabularyExplicitState(
  existing?: Pick<
    StudentVocabularyStateRow,
    "group_override" | "custom_definition" | "current_state"
  > | null,
): StudentVocabularyGroupOverride | null {
  const groupOverride = normalizeStudentVocabularyGroupOverride(
    existing?.group_override,
  );

  if (groupOverride) {
    return groupOverride;
  }

  if (existing?.custom_definition?.trim()) {
    return existing.current_state === "active_and_passive"
      ? "active_and_passive"
      : "passive_only";
  }

  return null;
}

export function resolveStudentVocabularyCurrentState({
  existing,
  hasActiveEvidence,
  hasPassiveEvidence,
  isLearning,
}: {
  existing?: Pick<
    StudentVocabularyStateRow,
    "group_override" | "custom_definition" | "current_state"
  > | null;
  hasActiveEvidence: boolean;
  hasPassiveEvidence: boolean;
  isLearning: boolean;
}): StudentVocabularyCurrentState | null {
  if (isLearning) {
    return "learning";
  }

  const explicitState = getStudentVocabularyExplicitState(existing);

  if (explicitState) {
    return explicitState;
  }

  if (hasActiveEvidence) {
    return "active_and_passive";
  }

  if (hasPassiveEvidence) {
    return "passive_only";
  }

  return null;
}

function buildStudentVocabularyStateUpsertRow({
  studentId,
  term,
  normalizedTerm,
  itemType,
  libraryItemId,
  existing,
  currentState,
  hasActiveEvidence,
  hasPassiveEvidence,
  movedToLearningAt,
  learningArchivedAt,
  nowIso,
}: {
  studentId: string;
  term: string;
  normalizedTerm: string;
  itemType: PassiveVocabularyItemType;
  libraryItemId?: string | null;
  existing?: StudentVocabularyStateRow;
  currentState: StudentVocabularyCurrentState;
  hasActiveEvidence: boolean;
  hasPassiveEvidence: boolean;
  movedToLearningAt: string | null;
  learningArchivedAt: string | null;
  nowIso: string;
}) {
  return {
    student_id: studentId,
    library_item_id: libraryItemId ?? existing?.library_item_id ?? null,
    term,
    normalized_term: normalizedTerm,
    item_type: itemType,
    current_state: currentState,
    group_override: normalizeStudentVocabularyGroupOverride(
      existing?.group_override,
    ),
    custom_definition: existing?.custom_definition ?? null,
    has_active_evidence: hasActiveEvidence,
    has_passive_evidence: hasPassiveEvidence,
    moved_to_learning_at: movedToLearningAt,
    learning_archived_at: learningArchivedAt,
    updated_at: nowIso,
  } satisfies Database["public"]["Tables"]["student_vocabulary_items"]["Insert"];
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
      "id, student_id, library_item_id, term, normalized_term, item_type, current_state, group_override, custom_definition, has_active_evidence, has_passive_evidence, moved_to_learning_at, learning_archived_at, created_at, updated_at",
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

async function loadStudentVocabularyStateRowById(
  adminClient: AdminClient,
  rowId: string,
) {
  const { data, error } = await adminClient
    .from("student_vocabulary_items")
    .select(
      "id, student_id, library_item_id, term, normalized_term, item_type, current_state, group_override, custom_definition, has_active_evidence, has_passive_evidence, moved_to_learning_at, learning_archived_at, created_at, updated_at",
    )
    .eq("id", rowId)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load student vocabulary state row");
  }

  return (data as StudentVocabularyStateRow | null) ?? null;
}

async function loadStudentWordMasteryRowIdsForVocabularyItem({
  adminClient,
  studentId,
  normalizedTerm,
  itemType,
}: {
  adminClient: AdminClient;
  studentId: string;
  normalizedTerm: string;
  itemType: PassiveVocabularyItemType;
}) {
  const { data, error } = await adminClient
    .from("word_mastery")
    .select("id, term")
    .eq("student_id", studentId);

  if (error) {
    throw new Error("Failed to inspect student word mastery state");
  }

  const targetKey = createStudentVocabularyStateKey(normalizedTerm, itemType);

  return (data ?? [])
    .filter((row) => createStudentVocabularyStateKeyFromTerm(row.term) === targetKey)
    .map((row) => row.id);
}

async function deleteStudentWordMasteryRowsForVocabularyItem({
  adminClient,
  studentId,
  normalizedTerm,
  itemType,
}: {
  adminClient: AdminClient;
  studentId: string;
  normalizedTerm: string;
  itemType: PassiveVocabularyItemType;
}) {
  const rowIds = await loadStudentWordMasteryRowIdsForVocabularyItem({
    adminClient,
    studentId,
    normalizedTerm,
    itemType,
  });

  if (rowIds.length === 0) {
    return;
  }

  const { error } = await adminClient
    .from("word_mastery")
    .delete()
    .in("id", rowIds);

  if (error) {
    throw new Error("Failed to delete student word mastery rows");
  }
}

function normalizeStudentCustomDefinition(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? "";
  return normalizedValue.length > 0 ? normalizedValue : null;
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
    dedupedItems.flatMap((item) => {
      const itemKey = createStudentVocabularyStateKey(
        item.normalizedTerm,
        item.itemType,
      );
      const existing = existingRowsByKey.get(
        itemKey,
      );
      const hasActiveEvidence = existing?.has_active_evidence ?? false;
      const hasPassiveEvidence = true;
      const currentState = resolveStudentVocabularyCurrentState({
        existing,
        hasActiveEvidence,
        hasPassiveEvidence,
        isLearning:
          existing?.current_state === "learning" || masteryKeySet.has(itemKey),
      });

      if (!currentState) {
        return [];
      }

      return [
        buildStudentVocabularyStateUpsertRow({
          studentId,
          term: item.term,
          normalizedTerm: item.normalizedTerm,
          itemType: item.itemType,
          libraryItemId: item.libraryItemId,
          existing,
          currentState,
          hasActiveEvidence,
          hasPassiveEvidence,
          movedToLearningAt: existing?.moved_to_learning_at ?? null,
          learningArchivedAt: existing?.learning_archived_at ?? null,
          nowIso,
        }),
      ];
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
    dedupedItems.flatMap((item) => {
      const itemKey = createStudentVocabularyStateKey(
        item.normalizedTerm,
        item.itemType,
      );
      const existing = existingRowsByKey.get(
        itemKey,
      );
      const hasActiveEvidence = true;
      const hasPassiveEvidence = existing?.has_passive_evidence ?? false;
      const currentState = resolveStudentVocabularyCurrentState({
        existing,
        hasActiveEvidence,
        hasPassiveEvidence,
        isLearning:
          existing?.current_state === "learning" || masteryKeySet.has(itemKey),
      });

      if (!currentState) {
        return [];
      }

      return [
        buildStudentVocabularyStateUpsertRow({
          studentId,
          term: item.term,
          normalizedTerm: item.normalizedTerm,
          itemType: item.itemType,
          libraryItemId: item.libraryItemId,
          existing,
          currentState,
          hasActiveEvidence,
          hasPassiveEvidence,
          movedToLearningAt: existing?.moved_to_learning_at ?? null,
          learningArchivedAt: existing?.learning_archived_at ?? null,
          nowIso,
        }),
      ];
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

      return buildStudentVocabularyStateUpsertRow({
        studentId,
        term: item.term,
        normalizedTerm: item.normalizedTerm,
        itemType: item.itemType,
        libraryItemId: item.libraryItemId,
        existing,
        currentState: "learning",
        hasActiveEvidence: existing?.has_active_evidence ?? false,
        hasPassiveEvidence: existing?.has_passive_evidence ?? false,
        movedToLearningAt: existing?.moved_to_learning_at ?? nowIso,
        learningArchivedAt: null,
        nowIso,
      });
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

      return buildStudentVocabularyStateUpsertRow({
        studentId,
        term: item.term,
        normalizedTerm: item.normalizedTerm,
        itemType: item.itemType,
        existing,
        currentState: "learning",
        hasActiveEvidence: existing?.has_active_evidence ?? false,
        hasPassiveEvidence: existing?.has_passive_evidence ?? false,
        movedToLearningAt:
          existing?.moved_to_learning_at ?? effectiveTimestamp,
        learningArchivedAt:
          item.masteryLevel >= 5 ? effectiveTimestamp : null,
        nowIso,
      });
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

    const currentState = resolveStudentVocabularyCurrentState({
      existing,
      hasActiveEvidence: existing.has_active_evidence,
      hasPassiveEvidence: existing.has_passive_evidence,
      isLearning: false,
    });

    if (currentState) {
      rowsToUpsert.push({
        ...buildStudentVocabularyStateUpsertRow({
          studentId,
          term: existing.term,
          normalizedTerm: existing.normalized_term,
          itemType: existing.item_type,
          libraryItemId: existing.library_item_id,
          existing,
          currentState,
          hasActiveEvidence: existing.has_active_evidence,
          hasPassiveEvidence: existing.has_passive_evidence,
          movedToLearningAt: existing.moved_to_learning_at,
          learningArchivedAt: null,
          nowIso,
        }),
      });
      continue;
    }

    rowIdsToDelete.push(existing.id);
  }

  await upsertStudentVocabularyStateRows(adminClient, rowsToUpsert);
  await deleteStudentVocabularyStateRows(adminClient, rowIdsToDelete);
}

export async function updateStudentVocabularyItem({
  adminClient,
  rowId,
  group,
  customDefinition,
}: {
  adminClient: AdminClient;
  rowId: string;
  group?: StudentVocabularyCurrentState;
  customDefinition?: string | null;
}) {
  const existing = await loadStudentVocabularyStateRowById(adminClient, rowId);

  if (!existing) {
    throw new Error("Student vocabulary item not found");
  }

  const nextCustomDefinition =
    customDefinition === undefined
      ? existing.custom_definition
      : normalizeStudentCustomDefinition(customDefinition);
  const nowIso = new Date().toISOString();

  if (group === "learning") {
    const { error: updateError } = await adminClient
      .from("student_vocabulary_items")
      .update({
        custom_definition: nextCustomDefinition,
        updated_at: nowIso,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error("Failed to update student vocabulary item");
    }

    await markStudentVocabularyStateAsLearning({
      adminClient,
      studentId: existing.student_id,
      items: [
        {
          term: existing.term,
          normalizedTerm: existing.normalized_term,
          itemType: existing.item_type,
          libraryItemId: existing.library_item_id,
        },
      ],
    });

    return loadStudentVocabularyStateRowById(adminClient, existing.id);
  }

  if (group === "passive_only" || group === "active_and_passive") {
    await deleteStudentWordMasteryRowsForVocabularyItem({
      adminClient,
      studentId: existing.student_id,
      normalizedTerm: existing.normalized_term,
      itemType: existing.item_type,
    });
  }

  const nextGroupOverride =
    group === undefined
      ? normalizeStudentVocabularyGroupOverride(existing.group_override)
      : normalizeStudentVocabularyGroupOverride(group);
  const nextCurrentState = resolveStudentVocabularyCurrentState({
    existing: {
      ...existing,
      group_override: nextGroupOverride,
      custom_definition: nextCustomDefinition,
    },
    hasActiveEvidence: existing.has_active_evidence,
    hasPassiveEvidence: existing.has_passive_evidence,
    isLearning: group === undefined && existing.current_state === "learning",
  });

  if (!nextCurrentState) {
    await deleteStudentVocabularyStateRows(adminClient, [existing.id]);
    return null;
  }

  const { error: updateError } = await adminClient
    .from("student_vocabulary_items")
    .update({
      current_state: nextCurrentState,
      group_override: nextGroupOverride,
      custom_definition: nextCustomDefinition,
      learning_archived_at: nextCurrentState === "learning"
        ? existing.learning_archived_at
        : null,
      updated_at: nowIso,
    })
    .eq("id", existing.id);

  if (updateError) {
    throw new Error("Failed to update student vocabulary item");
  }

  return loadStudentVocabularyStateRowById(adminClient, existing.id);
}

export async function deleteStudentVocabularyItem({
  adminClient,
  rowId,
}: {
  adminClient: AdminClient;
  rowId: string;
}) {
  const existing = await loadStudentVocabularyStateRowById(adminClient, rowId);

  if (!existing) {
    throw new Error("Student vocabulary item not found");
  }

  await deleteStudentWordMasteryRowsForVocabularyItem({
    adminClient,
    studentId: existing.student_id,
    normalizedTerm: existing.normalized_term,
    itemType: existing.item_type,
  });

  const { error: passiveEvidenceDeleteError } = await adminClient
    .from("passive_vocabulary_evidence")
    .delete()
    .eq("student_id", existing.student_id)
    .eq("normalized_term", existing.normalized_term)
    .eq("item_type", existing.item_type);

  if (passiveEvidenceDeleteError) {
    throw new Error("Failed to delete passive vocabulary evidence");
  }

  if (existing.item_type === "word") {
    const { error: activeEvidenceDeleteError } = await adminClient
      .from("active_vocabulary_evidence")
      .delete()
      .eq("student_id", existing.student_id)
      .eq("normalized_term", existing.normalized_term);

    if (activeEvidenceDeleteError) {
      throw new Error("Failed to delete active vocabulary evidence");
    }
  }

  await deleteStudentVocabularyStateRows(adminClient, [existing.id]);
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