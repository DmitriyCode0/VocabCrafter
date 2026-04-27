import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getPassiveVocabularyUkrainianTranslation,
  normalizePassiveVocabularyLibraryAttributes,
  normalizePassiveVocabularyText,
  withPassiveVocabularyUkrainianTranslation,
  type PassiveVocabularyLibraryAttributes,
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";

type AdminClient = SupabaseClient<Database>;
type PassiveVocabularyLibraryRow =
  Database["public"]["Tables"]["passive_vocabulary_library"]["Row"];

interface UpdatePassiveVocabularyLibraryItemInput {
  adminClient: AdminClient;
  libraryItemId: string;
  updatedBy: string;
  canonicalTerm: string;
  cefrLevel?: PassiveVocabularyLibraryCefrLevel | null;
  partOfSpeech?: PassiveVocabularyPartOfSpeech | null;
  ukrainianTranslation?: string | null;
  attributes?: PassiveVocabularyLibraryAttributes | null;
}

export async function updatePassiveVocabularyLibraryItem({
  adminClient,
  libraryItemId,
  updatedBy,
  canonicalTerm: requestedCanonicalTerm,
  cefrLevel,
  partOfSpeech,
  ukrainianTranslation,
  attributes,
}: UpdatePassiveVocabularyLibraryItemInput): Promise<PassiveVocabularyLibraryRow> {
  const { data: existingItem, error: existingItemError } = await adminClient
    .from("passive_vocabulary_library")
    .select(
      "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes",
    )
    .eq("id", libraryItemId)
    .maybeSingle();

  if (existingItemError) {
    throw new Error("Failed to load passive vocabulary library item");
  }

  if (!existingItem) {
    throw new Error("Passive vocabulary library item not found");
  }

  const canonicalTerm = requestedCanonicalTerm.trim().replace(/\s+/g, " ");

  if (!canonicalTerm) {
    throw new Error("Canonical term is required");
  }

  const normalizedTerm = normalizePassiveVocabularyText(canonicalTerm);

  if (!normalizedTerm) {
    throw new Error("Canonical term is required");
  }

  const nowIso = new Date().toISOString();
  const existingAttributes = normalizePassiveVocabularyLibraryAttributes(
    existingItem.attributes,
  );
  const nextAttributes = withPassiveVocabularyUkrainianTranslation(
    attributes === undefined || attributes === null
      ? existingAttributes
      : normalizePassiveVocabularyLibraryAttributes(attributes),
    ukrainianTranslation === undefined
      ? getPassiveVocabularyUkrainianTranslation(existingAttributes)
      : ukrainianTranslation,
  );
  const nextCefrLevel =
    existingItem.item_type === "phrase"
      ? null
      : (cefrLevel ?? existingItem.cefr_level);
  const nextPartOfSpeech =
    existingItem.item_type === "phrase"
      ? "phrase"
      : (partOfSpeech ?? existingItem.part_of_speech);

  const { data: updatedItem, error: updateError } = await adminClient
    .from("passive_vocabulary_library")
    .update({
      canonical_term: canonicalTerm,
      normalized_term: normalizedTerm,
      cefr_level: nextCefrLevel,
      part_of_speech: nextPartOfSpeech,
      attributes: nextAttributes,
      enrichment_status:
        existingItem.item_type === "phrase" ||
        (nextCefrLevel && nextPartOfSpeech)
          ? "completed"
          : "failed",
      enrichment_error:
        existingItem.item_type === "phrase" ||
        (nextCefrLevel && nextPartOfSpeech)
          ? null
          : "Metadata still needs a CEFR level and part of speech.",
      updated_by: updatedBy,
      updated_at: nowIso,
    })
    .eq("id", libraryItemId)
    .select(
      "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, enrichment_status, enrichment_error, created_by, updated_by, created_at, updated_at",
    )
    .single();

  if (updateError) {
    if (updateError.code === "23505") {
      throw new Error("Another library item already uses that canonical term");
    }

    throw new Error("Failed to update passive vocabulary library item");
  }

  if (existingItem.normalized_term !== normalizedTerm) {
    const { error: aliasError } = await adminClient
      .from("passive_vocabulary_library_forms")
      .insert({
        library_item_id: libraryItemId,
        form_term: existingItem.canonical_term,
        normalized_form: existingItem.normalized_term,
        item_type: existingItem.item_type,
        is_canonical: false,
        updated_at: nowIso,
      });

    if (aliasError && aliasError.code !== "23505") {
      throw new Error("Failed to preserve the previous canonical form alias");
    }
  }

  await adminClient
    .from("passive_vocabulary_library_forms")
    .delete()
    .eq("library_item_id", libraryItemId)
    .eq("normalized_form", normalizedTerm)
    .eq("item_type", existingItem.item_type)
    .eq("is_canonical", false);

  const { error: canonicalFormUpdateError } = await adminClient
    .from("passive_vocabulary_library_forms")
    .update({
      form_term: canonicalTerm,
      normalized_form: normalizedTerm,
      updated_at: nowIso,
    })
    .eq("library_item_id", libraryItemId)
    .eq("is_canonical", true);

  if (canonicalFormUpdateError) {
    throw new Error("Failed to update the canonical library form");
  }

  const { data: canonicalRows, error: canonicalRowsError } = await adminClient
    .from("passive_vocabulary_library_forms")
    .select("id")
    .eq("library_item_id", libraryItemId)
    .eq("is_canonical", true)
    .eq("normalized_form", normalizedTerm);

  if (canonicalRowsError) {
    throw new Error("Failed to verify the canonical library form");
  }

  if ((canonicalRows ?? []).length === 0) {
    const { error: canonicalFormInsertError } = await adminClient
      .from("passive_vocabulary_library_forms")
      .insert({
        library_item_id: libraryItemId,
        form_term: canonicalTerm,
        normalized_form: normalizedTerm,
        item_type: existingItem.item_type,
        is_canonical: true,
        updated_at: nowIso,
      });

    if (canonicalFormInsertError) {
      throw new Error("Failed to save the canonical library form");
    }
  }

  return updatedItem;
}