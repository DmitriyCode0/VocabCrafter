import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getPassiveVocabularyFollowedBy,
  getPassiveVocabularyAdjectiveGradability,
  formatPassiveVocabularyCanonicalTerm,
  getPassiveVocabularyCanonicalHeadword,
  getPassiveVocabularyEnglishDefinitions,
  getPassiveVocabularyForms,
  getPassiveVocabularyMetadataValidation,
  getPassiveVocabularyNounCountability,
  getPassiveVocabularyVerbPattern,
  getPassiveVocabularyVerbRegularity,
  getPassiveVocabularyVerbState,
  getPassiveVocabularyVerbTransitivity,
  getPassiveVocabularyTranscriptions,
  getPassiveVocabularyUkrainianTranslation,
  normalizePassiveVocabularyLibraryAttributes,
  normalizePassiveVocabularyText,
  withPassiveVocabularyAdjectiveGradability,
  withPassiveVocabularyEnglishDefinitions,
  withPassiveVocabularyFollowedBy,
  withPassiveVocabularyForms,
  withPassiveVocabularyNounCountability,
  withPassiveVocabularyVerbPattern,
  withPassiveVocabularyTranscriptions,
  withPassiveVocabularyUkrainianSearchForms,
  withPassiveVocabularyUkrainianTranslation,
  withPassiveVocabularyVerbRegularity,
  withPassiveVocabularyVerbState,
  withPassiveVocabularyVerbTransitivity,
  type PassiveVocabularyAdjectiveGradability,
  type PassiveVocabularyFollowedBy,
  type PassiveVocabularyLibraryAttributes,
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyNounCountability,
  type PassiveVocabularyPartOfSpeech,
  type PassiveVocabularyVerbPattern,
  type PassiveVocabularyVerbRegularity,
  type PassiveVocabularyVerbState,
  type PassiveVocabularyVerbTransitivity,
} from "@/lib/mastery/passive-vocabulary";
import { syncPassiveVocabularyLibraryUkrainianForms } from "@/lib/mastery/passive-vocabulary-library-ukrainian-forms";

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
  nounCountability?: PassiveVocabularyNounCountability[] | null;
  adjectiveGradability?: PassiveVocabularyAdjectiveGradability[] | null;
  followedBy?: PassiveVocabularyFollowedBy[] | null;
  verbPattern?: PassiveVocabularyVerbPattern[] | null;
  verbRegularity?: PassiveVocabularyVerbRegularity[] | null;
  verbState?: PassiveVocabularyVerbState[] | null;
  verbTransitivity?: PassiveVocabularyVerbTransitivity[] | null;
  forms?: string[] | null;
  attributes?: PassiveVocabularyLibraryAttributes | null;
}

async function upsertPassiveVocabularyLibraryAliasIfAvailable({
  adminClient,
  libraryItemId,
  formTerm,
  normalizedForm,
  itemType,
  nowIso,
}: {
  adminClient: AdminClient;
  libraryItemId: string;
  formTerm: string;
  normalizedForm: string;
  itemType: Database["public"]["Tables"]["passive_vocabulary_library"]["Row"]["item_type"];
  nowIso: string;
}) {
  const { data: existingFormRow, error: existingFormRowError } =
    await adminClient
      .from("passive_vocabulary_library_forms")
      .select("id, library_item_id")
      .eq("normalized_form", normalizedForm)
      .eq("item_type", itemType)
      .maybeSingle();

  if (existingFormRowError) {
    throw new Error("Failed to inspect passive vocabulary library alias");
  }

  if (existingFormRow && existingFormRow.library_item_id !== libraryItemId) {
    return;
  }

  if (existingFormRow) {
    const { error: updateAliasError } = await adminClient
      .from("passive_vocabulary_library_forms")
      .update({
        form_term: formTerm,
        is_canonical: false,
        updated_at: nowIso,
      })
      .eq("id", existingFormRow.id);

    if (updateAliasError) {
      throw new Error("Failed to save passive vocabulary library alias");
    }

    return;
  }

  const { error: insertAliasError } = await adminClient
    .from("passive_vocabulary_library_forms")
    .insert({
      library_item_id: libraryItemId,
      form_term: formTerm,
      normalized_form: normalizedForm,
      item_type: itemType,
      is_canonical: false,
      updated_at: nowIso,
    });

  if (insertAliasError) {
    throw new Error("Failed to save passive vocabulary library alias");
  }
}

async function syncPassiveVocabularyLibraryAliases({
  adminClient,
  libraryItemId,
  itemType,
  partOfSpeech,
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
  partOfSpeech: PassiveVocabularyPartOfSpeech | null;
  oldCanonicalTerm: string;
  oldNormalizedTerm: string;
  canonicalTerm: string;
  canonicalNormalizedTerm: string;
  explicitForms: string[];
  nowIso: string;
}) {
  const canonicalHeadwordNormalized = normalizePassiveVocabularyText(
    getPassiveVocabularyCanonicalHeadword(canonicalTerm, partOfSpeech),
  );

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

  if (
    oldNormalizedTerm !== canonicalNormalizedTerm &&
    oldNormalizedTerm !== canonicalHeadwordNormalized
  ) {
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

  const { data: existingAliasRows, error: existingAliasRowsError } =
    await adminClient
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
    await upsertPassiveVocabularyLibraryAliasIfAvailable({
      adminClient,
      libraryItemId,
      formTerm,
      normalizedForm,
      itemType,
      nowIso,
    });
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
  nounCountability,
  adjectiveGradability,
  followedBy,
  verbPattern,
  verbRegularity,
  verbState,
  verbTransitivity,
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

  const existingPartOfSpeech =
    (existingItem.part_of_speech as PassiveVocabularyPartOfSpeech | null) ??
    null;
  const canonicalHeadword = getPassiveVocabularyCanonicalHeadword(
    requestedCanonicalTerm,
    partOfSpeech ?? existingPartOfSpeech,
  );

  if (!canonicalHeadword) {
    throw new Error("Canonical term is required");
  }

  const nowIso = new Date().toISOString();
  const existingAttributes = normalizePassiveVocabularyLibraryAttributes(
    existingItem.attributes,
  );
  const normalizedInputAttributes =
    attributes === undefined || attributes === null
      ? null
      : normalizePassiveVocabularyLibraryAttributes(attributes);
  const nextUkrainianTranslation =
    ukrainianTranslation === undefined
      ? getPassiveVocabularyUkrainianTranslation(existingAttributes)
      : ukrainianTranslation;
  const translationChanged =
    nextUkrainianTranslation !==
    getPassiveVocabularyUkrainianTranslation(existingAttributes);
  const nextAttributeSeed = {
    ...(normalizedInputAttributes ?? existingAttributes),
  };

  if (translationChanged && !normalizedInputAttributes?.ukrainianSearchForms) {
    delete nextAttributeSeed.ukrainianSearchForms;
  }

  const nextAttributes = withPassiveVocabularyUkrainianTranslation(
    nextAttributeSeed,
    nextUkrainianTranslation,
  );
  const nextAttributesWithUkrainianSearchForms =
    normalizedInputAttributes?.ukrainianSearchForms
      ? withPassiveVocabularyUkrainianSearchForms(
          nextAttributes,
          normalizedInputAttributes.ukrainianSearchForms,
          nextUkrainianTranslation,
        )
      : nextAttributes;
  const nextAttributesWithEnglishDefinitions =
    withPassiveVocabularyEnglishDefinitions(
      nextAttributesWithUkrainianSearchForms,
      englishDefinitions === undefined
        ? getPassiveVocabularyEnglishDefinitions(existingAttributes)
        : englishDefinitions,
    );
  const existingTranscriptions =
    getPassiveVocabularyTranscriptions(existingAttributes);
  const nextCefrLevel =
    existingItem.item_type === "phrase"
      ? null
      : ((cefrLevel ??
          existingItem.cefr_level) as PassiveVocabularyLibraryCefrLevel | null);
  const nextPartOfSpeech =
    existingItem.item_type === "phrase"
      ? "phrase"
      : ((partOfSpeech ??
          existingItem.part_of_speech) as PassiveVocabularyPartOfSpeech | null);
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
  const nextAttributesWithNounCountability =
    withPassiveVocabularyNounCountability(
      nextAttributesWithTranscription,
      nextPartOfSpeech === "noun"
        ? nounCountability === undefined
          ? getPassiveVocabularyNounCountability(existingAttributes)
          : nounCountability
        : [],
    );
  const nextAttributesWithAdjectiveGradability =
    withPassiveVocabularyAdjectiveGradability(
      nextAttributesWithNounCountability,
      nextPartOfSpeech === "adjective"
        ? adjectiveGradability === undefined
          ? getPassiveVocabularyAdjectiveGradability(existingAttributes)
          : adjectiveGradability
        : [],
    );
  const nextAttributesWithVerbTransitivity = withPassiveVocabularyVerbTransitivity(
    nextAttributesWithAdjectiveGradability,
    nextPartOfSpeech === "verb"
      ? verbTransitivity === undefined
        ? getPassiveVocabularyVerbTransitivity(existingAttributes)
        : verbTransitivity
      : [],
  );
  const nextAttributesWithFollowedBy = withPassiveVocabularyFollowedBy(
    nextAttributesWithVerbTransitivity,
    nextPartOfSpeech === "verb" || nextPartOfSpeech === "adjective"
      ? followedBy === undefined
        ? getPassiveVocabularyFollowedBy(existingAttributes)
        : followedBy
      : [],
  );
  const nextAttributesWithVerbRegularity = withPassiveVocabularyVerbRegularity(
    nextAttributesWithFollowedBy,
    nextPartOfSpeech === "verb"
      ? verbRegularity === undefined
        ? getPassiveVocabularyVerbRegularity(existingAttributes)
        : verbRegularity
      : [],
  );
  const nextAttributesWithVerbState = withPassiveVocabularyVerbState(
    nextAttributesWithVerbRegularity,
    nextPartOfSpeech === "verb"
      ? verbState === undefined
        ? getPassiveVocabularyVerbState(existingAttributes)
        : verbState
      : [],
  );
  const nextAttributesWithVerbPattern = withPassiveVocabularyVerbPattern(
    nextAttributesWithVerbState,
    nextPartOfSpeech === "verb"
      ? verbPattern === undefined
        ? getPassiveVocabularyVerbPattern(existingAttributes)
        : verbPattern
      : [],
  );
  const canonicalTerm = formatPassiveVocabularyCanonicalTerm(
    canonicalHeadword,
    nextPartOfSpeech,
    getPassiveVocabularyNounCountability(nextAttributesWithNounCountability),
  );
  const normalizedTerm = normalizePassiveVocabularyText(canonicalTerm);
  const explicitForms =
    forms === undefined
      ? getPassiveVocabularyForms(existingAttributes, canonicalHeadword)
      : forms;
  const nextAttributesWithForms = withPassiveVocabularyForms(
    nextAttributesWithVerbPattern,
    explicitForms,
    canonicalHeadword,
  );
  const metadataValidation = getPassiveVocabularyMetadataValidation(
    existingItem.item_type,
    nextCefrLevel,
    nextPartOfSpeech,
    nextAttributesWithForms,
  );

  const { data: updatedItem, error: updateError } = await adminClient
    .from("passive_vocabulary_library")
    .update({
      canonical_term: canonicalTerm,
      normalized_term: normalizedTerm,
      cefr_level: nextCefrLevel,
      part_of_speech: nextPartOfSpeech,
      attributes: nextAttributesWithForms,
      enrichment_status: metadataValidation.status,
      enrichment_error: metadataValidation.error,
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
    partOfSpeech: nextPartOfSpeech,
    oldCanonicalTerm: existingItem.canonical_term,
    oldNormalizedTerm: existingItem.normalized_term,
    canonicalTerm,
    canonicalNormalizedTerm: normalizedTerm,
    explicitForms: getPassiveVocabularyForms(
      nextAttributesWithForms,
      canonicalHeadword,
    ),
    nowIso,
  });

  await syncPassiveVocabularyLibraryUkrainianForms({
    adminClient,
    libraryItemId,
    attributes: nextAttributesWithForms,
    nowIso,
  });

  return updatedItem;
}
