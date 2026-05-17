import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getPassiveVocabularyUkrainianSearchForms,
  normalizePassiveVocabularyText,
  type PassiveVocabularyLibraryAttributes,
} from "@/lib/mastery/passive-vocabulary";

type AdminClient = SupabaseClient<Database>;

export async function syncPassiveVocabularyLibraryUkrainianForms({
  adminClient,
  libraryItemId,
  attributes,
  nowIso,
}: {
  adminClient: AdminClient;
  libraryItemId: string;
  attributes?: PassiveVocabularyLibraryAttributes | null;
  nowIso: string;
}) {
  const desiredForms = getPassiveVocabularyUkrainianSearchForms(attributes);
  const desiredFormsByNormalizedValue = new Map<string, string>();

  for (const form of desiredForms) {
    const normalizedForm = normalizePassiveVocabularyText(form);

    if (!normalizedForm || desiredFormsByNormalizedValue.has(normalizedForm)) {
      continue;
    }

    desiredFormsByNormalizedValue.set(normalizedForm, form);
  }

  const { data: existingRows, error: existingRowsError } = await adminClient
    .from("passive_vocabulary_library_ukrainian_forms")
    .select("id, normalized_form")
    .eq("library_item_id", libraryItemId);

  if (existingRowsError) {
    throw new Error("Failed to inspect passive vocabulary Ukrainian search forms");
  }

  const rowsToDelete = (existingRows ?? [])
    .filter((row) => !desiredFormsByNormalizedValue.has(row.normalized_form))
    .map((row) => row.id);

  if (rowsToDelete.length > 0) {
    const { error: deleteError } = await adminClient
      .from("passive_vocabulary_library_ukrainian_forms")
      .delete()
      .in("id", rowsToDelete);

    if (deleteError) {
      throw new Error("Failed to delete passive vocabulary Ukrainian search forms");
    }
  }

  const rowsToUpsert = Array.from(desiredFormsByNormalizedValue.entries()).map(
    ([normalizedForm, formTerm]) => ({
      library_item_id: libraryItemId,
      form_term: formTerm,
      normalized_form: normalizedForm,
      updated_at: nowIso,
    }),
  );

  if (rowsToUpsert.length === 0) {
    return;
  }

  const { error: upsertError } = await adminClient
    .from("passive_vocabulary_library_ukrainian_forms")
    .upsert(rowsToUpsert, { onConflict: "library_item_id,normalized_form" });

  if (upsertError) {
    throw new Error("Failed to save passive vocabulary Ukrainian search forms");
  }
}