import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getPassiveVocabularyEnglishDefinitions,
  getPassiveVocabularyForms,
  getPassiveVocabularyTranscriptions,
  getPassiveVocabularyUkrainianTranslation,
  normalizePassiveVocabularyLibraryAttributes,
  normalizePassiveVocabularyText,
  withPassiveVocabularyEnglishDefinitions,
  withPassiveVocabularyForms,
  withPassiveVocabularyTranscriptions,
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
  englishDefinitions?: string[] | null;
  americanTranscription?: string | null;
  britishTranscription?: string | null;
  transcription?: string | null;
  forms?: string[] | null;
  attributes?: PassiveVocabularyLibraryAttributes | null;
}

async function syncPassiveVocabularyLibraryAliases({
  adminClient,
  libraryItemId,
  itemType,
  oldCanonicalTerm,
  oldNormalizedTerm,
  canonicalTerm,
  canonicalNormalizedTerm,
  explicitForms,
  nowIso,
}: {
  adminClient: AdminClient;
  libraryItemId: string;
  itemType: Database["public"]["Tables"]["passive_vocabulary_library"]["Row"]["item_type"];
  oldCanonicalTerm: string;
  oldNormalizedTerm: string;
  canonicalTerm: string;
  canonicalNormalizedTerm: string;
  explicitForms: string[];
  nowIso: string;
}) {
  await adminClient
    .from("passive_vocabulary_library_forms")
    .delete()
    .eq("library_item_id", libraryItemId)
    .eq("normalized_form", canonicalNormalizedTerm)
    .eq("item_type", itemType)
    .eq("is_canonical", false);

  const { error: canonicalFormUpdateError } = await adminClient
    .from("passive_vocabulary_library_forms")
    .update({
      form_term: canonicalTerm,
      normalized_form: canonicalNormalizedTerm,
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
    .eq("normalized_form", canonicalNormalizedTerm);

  if (canonicalRowsError) {
    throw new Error("Failed to verify the canonical library form");
  }

  if ((canonicalRows ?? []).length === 0) {
    const { error: canonicalFormInsertError } = await adminClient
      .from("passive_vocabulary_library_forms")
      .insert({
        library_item_id: libraryItemId,
        form_term: canonicalTerm,
        normalized_form: canonicalNormalizedTerm,
        item_type: itemType,
        is_canonical: true,
        updated_at: nowIso,
      });

    if (canonicalFormInsertError) {
      throw new Error("Failed to save the canonical library form");
    }
  }

  const desiredAliases = new Map<string, string>();

  if (oldNormalizedTerm !== canonicalNormalizedTerm) {
    desiredAliases.set(oldNormalizedTerm, oldCanonicalTerm);
  }

  for (const explicitForm of explicitForms) {
    const normalizedExplicitForm = normalizePassiveVocabularyText(explicitForm);

    if (
      normalizedExplicitForm &&
      normalizedExplicitForm !== canonicalNormalizedTerm &&
      !desiredAliases.has(normalizedExplicitForm)
    ) {
      desiredAliases.set(normalizedExplicitForm, explicitForm);
    }
  }

  const { data: existingAliasRows, error: existingAliasRowsError } = await adminClient
    .from("passive_vocabulary_library_forms")
    .select("id, normalized_form")
    .eq("library_item_id", libraryItemId)
    .eq("item_type", itemType)
    .eq("is_canonical", false);

  if (existingAliasRowsError) {
    throw new Error("Failed to inspect passive vocabulary library aliases");
  }

  const aliasIdsToDelete = (existingAliasRows ?? [])
    .filter((row) => !desiredAliases.has(row.normalized_form))
    .map((row) => row.id);

  if (aliasIdsToDelete.length > 0) {
    const { error: deleteAliasError } = await adminClient
      .from("passive_vocabulary_library_forms")
      .delete()
      .in("id", aliasIdsToDelete);

    if (deleteAliasError) {
      throw new Error("Failed to remove outdated passive vocabulary aliases");
    }
  }

  for (const [normalizedForm, formTerm] of desiredAliases) {
    const { error: aliasError } = await adminClient
      .from("passive_vocabulary_library_forms")
      .upsert(
        {
          library_item_id: libraryItemId,
          form_term: formTerm,
          normalized_form: normalizedForm,
          item_type: itemType,
          is_canonical: false,
          updated_at: nowIso,
        },
        { onConflict: "normalized_form,item_type" },
      );

    if (aliasError) {
      throw new Error("Failed to save passive vocabulary library alias");
    }
  }
}

export async function updatePassiveVocabularyLibraryItem({
  adminClient,
  libraryItemId,
  updatedBy,
  canonicalTerm: requestedCanonicalTerm,
  cefrLevel,
  partOfSpeech,
  ukrainianTranslation,
  englishDefinitions,
  americanTranscription,
  britishTranscription,
  transcription,
  forms,
  attributes,
}: UpdatePassiveVocabularyLibraryItemInput): Promise<PassiveVocabularyLibraryRow> {
  const { data: existingItem, error: existingItemError } = await adminClient
    .from("passive_vocabulary_library")
    .select(
      "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, approval_status, rejection_reason, enrichment_status, enrichment_error, created_by, reviewed_by, reviewed_at, updated_by, created_at, updated_at",
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
  const nextAttributesWithEnglishDefinitions =
    withPassiveVocabularyEnglishDefinitions(
      nextAttributes,
      englishDefinitions === undefined
        ? getPassiveVocabularyEnglishDefinitions(existingAttributes)
        : englishDefinitions,
    );
  const existingTranscriptions = getPassiveVocabularyTranscriptions(
    existingAttributes,
  );
  const nextAttributesWithTranscription = withPassiveVocabularyTranscriptions(
    nextAttributesWithEnglishDefinitions,
    {
      american:
        americanTranscription === undefined
          ? transcription === undefined
            ? existingTranscriptions.american
            : transcription
          : americanTranscription,
      british:
        britishTranscription === undefined
          ? transcription === undefined
            ? existingTranscriptions.british
            : transcription
          : britishTranscription,
    },
  );
  const explicitForms =
    forms === undefined
      ? getPassiveVocabularyForms(existingAttributes, canonicalTerm)
      : forms;
  const nextAttributesWithForms = withPassiveVocabularyForms(
    nextAttributesWithTranscription,
    explicitForms,
    canonicalTerm,
  );
  const nextCefrLevel =
    existingItem.item_type === "phrase"
      ? null
      : (cefrLevel ?? existingItem.cefr_level);
  const nextPartOfSpeech =
    existingItem.item_type === "phrase"
      ? "phrase"
      : ((partOfSpeech ?? existingItem.part_of_speech) as PassiveVocabularyPartOfSpeech | null);

  const { data: updatedItem, error: updateError } = await adminClient
    .from("passive_vocabulary_library")
    .update({
      canonical_term: canonicalTerm,
      normalized_term: normalizedTerm,
      cefr_level: nextCefrLevel,
      part_of_speech: nextPartOfSpeech,
      attributes: nextAttributesWithForms,
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
      "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, approval_status, rejection_reason, enrichment_status, enrichment_error, created_by, reviewed_by, reviewed_at, updated_by, created_at, updated_at",
    )
    .single();

  if (updateError) {
    if (updateError.code === "23505") {
      throw new Error("Another library item already uses that canonical term");
    }

    throw new Error("Failed to update passive vocabulary library item");
  }

  await syncPassiveVocabularyLibraryAliases({
    adminClient,
    libraryItemId,
    itemType: existingItem.item_type,
    oldCanonicalTerm: existingItem.canonical_term,
    oldNormalizedTerm: existingItem.normalized_term,
    canonicalTerm,
    canonicalNormalizedTerm: normalizedTerm,
    explicitForms: getPassiveVocabularyForms(nextAttributesWithForms, canonicalTerm),
    nowIso,
  });

  return updatedItem;
}