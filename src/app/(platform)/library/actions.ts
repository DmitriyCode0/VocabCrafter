"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getPassiveVocabularyUkrainianTranslation,
  normalizePassiveVocabularyLibraryAttributes,
  normalizePassiveVocabularyText,
  withPassiveVocabularyUkrainianTranslation,
  type PassiveVocabularyLibraryAttributes,
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";
import { updatePassiveVocabularyLibraryItem } from "@/lib/mastery/passive-vocabulary-library-updates";
import { isMissingPassiveVocabularyLibrarySuggestionsTableError } from "@/lib/mastery/passive-vocabulary-library-suggestions";
import type { Role } from "@/types/roles";

interface SuggestPassiveVocabularyLibraryChangeInput {
  libraryItemId: string;
  canonicalTerm: string;
  cefrLevel: PassiveVocabularyLibraryCefrLevel | null;
  partOfSpeech: PassiveVocabularyPartOfSpeech | null;
  ukrainianTranslation: string | null;
  attributes: PassiveVocabularyLibraryAttributes;
  suggestionNote: string;
}

async function requireLibraryRole(roles: Role[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !roles.includes(profile.role as Role)) {
    throw new Error("Forbidden");
  }

  return {
    userId: user.id,
    role: profile.role as Role,
    adminClient: createAdminClient(),
  };
}

function revalidateLibraryPaths() {
  revalidatePath("/library");
  revalidatePath("/library/dictionary");
  revalidatePath("/passive-vocabulary");
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toSuggestionActionError(error: unknown) {
  if (isMissingPassiveVocabularyLibrarySuggestionsTableError(error)) {
    return new Error(
      "The passive vocabulary suggestions table is not available yet. Apply the latest Supabase migrations before using tutor dictionary suggestions.",
    );
  }

  return error instanceof Error
    ? error
    : new Error("Library suggestion action failed");
}

export async function createPassiveVocabularyLibrarySuggestion(
  input: SuggestPassiveVocabularyLibraryChangeInput,
) {
  const { userId, adminClient } = await requireLibraryRole(["tutor"]);
  const { data: existingItem, error: existingItemError } = await adminClient
    .from("passive_vocabulary_library")
    .select(
      "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes",
    )
    .eq("id", input.libraryItemId)
    .maybeSingle();

  if (existingItemError) {
    throw new Error("Failed to load passive vocabulary library item");
  }

  if (!existingItem) {
    throw new Error("Passive vocabulary library item not found");
  }

  const canonicalTerm = input.canonicalTerm.trim().replace(/\s+/g, " ");

  if (!canonicalTerm) {
    throw new Error("Canonical term is required");
  }

  const normalizedTerm = normalizePassiveVocabularyText(canonicalTerm);

  if (!normalizedTerm) {
    throw new Error("Canonical term is required");
  }

  const currentAttributes = normalizePassiveVocabularyLibraryAttributes(
    existingItem.attributes,
  );
  const proposedAttributes = withPassiveVocabularyUkrainianTranslation(
    normalizePassiveVocabularyLibraryAttributes(input.attributes),
    input.ukrainianTranslation,
  );
  const proposedCefrLevel =
    existingItem.item_type === "phrase"
      ? null
      : (input.cefrLevel ?? existingItem.cefr_level);
  const proposedPartOfSpeech =
    existingItem.item_type === "phrase"
      ? "phrase"
      : (input.partOfSpeech ?? existingItem.part_of_speech);
  const suggestionNote = normalizeOptionalText(input.suggestionNote);

  const hasChanges =
    existingItem.canonical_term !== canonicalTerm ||
    existingItem.cefr_level !== proposedCefrLevel ||
    existingItem.part_of_speech !== proposedPartOfSpeech ||
    JSON.stringify(currentAttributes) !== JSON.stringify(proposedAttributes) ||
    Boolean(suggestionNote);

  if (!hasChanges) {
    throw new Error("Change at least one field before submitting a suggestion");
  }

  const nowIso = new Date().toISOString();

  try {
    const { data: pendingSuggestion, error: pendingSuggestionError } =
      await adminClient
        .from("passive_vocabulary_library_suggestions")
        .select("id")
        .eq("library_item_id", input.libraryItemId)
        .eq("created_by", userId)
        .eq("status", "pending")
        .maybeSingle();

    if (pendingSuggestionError) {
      throw pendingSuggestionError;
    }

    if (pendingSuggestion) {
      const { error: updateError } = await adminClient
        .from("passive_vocabulary_library_suggestions")
        .update({
          proposed_canonical_term: canonicalTerm,
          proposed_normalized_term: normalizedTerm,
          proposed_cefr_level: proposedCefrLevel,
          proposed_part_of_speech: proposedPartOfSpeech,
          proposed_attributes: proposedAttributes,
          suggestion_note: suggestionNote,
          updated_at: nowIso,
        })
        .eq("id", pendingSuggestion.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      const { error: insertError } = await adminClient
        .from("passive_vocabulary_library_suggestions")
        .insert({
          library_item_id: input.libraryItemId,
          proposed_canonical_term: canonicalTerm,
          proposed_normalized_term: normalizedTerm,
          proposed_cefr_level: proposedCefrLevel,
          proposed_part_of_speech: proposedPartOfSpeech,
          proposed_attributes: proposedAttributes,
          suggestion_note: suggestionNote,
          created_by: userId,
          updated_at: nowIso,
        });

      if (insertError) {
        throw insertError;
      }
    }
  } catch (error) {
    throw toSuggestionActionError(error);
  }

  revalidateLibraryPaths();
}

export async function approvePassiveVocabularyLibrarySuggestion(
  suggestionId: string,
) {
  const { userId, adminClient } = await requireLibraryRole(["superadmin"]);

  try {
    const { data: suggestion, error: suggestionError } = await adminClient
      .from("passive_vocabulary_library_suggestions")
      .select(
        "id, library_item_id, proposed_canonical_term, proposed_cefr_level, proposed_part_of_speech, proposed_attributes, status",
      )
      .eq("id", suggestionId)
      .maybeSingle();

    if (suggestionError) {
      throw suggestionError;
    }

    if (!suggestion || suggestion.status !== "pending") {
      throw new Error("Pending suggestion not found");
    }

    const proposedAttributes = normalizePassiveVocabularyLibraryAttributes(
      suggestion.proposed_attributes,
    );

    await updatePassiveVocabularyLibraryItem({
      adminClient,
      libraryItemId: suggestion.library_item_id,
      updatedBy: userId,
      canonicalTerm: suggestion.proposed_canonical_term,
      cefrLevel: suggestion.proposed_cefr_level as
        | PassiveVocabularyLibraryCefrLevel
        | null,
      partOfSpeech: suggestion.proposed_part_of_speech as
        | PassiveVocabularyPartOfSpeech
        | null,
      ukrainianTranslation: getPassiveVocabularyUkrainianTranslation(
        proposedAttributes,
      ),
      attributes: proposedAttributes,
    });

    const { error: reviewError } = await adminClient
      .from("passive_vocabulary_library_suggestions")
      .update({
        status: "approved",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", suggestionId);

    if (reviewError) {
      throw reviewError;
    }
  } catch (error) {
    throw toSuggestionActionError(error);
  }

  revalidateLibraryPaths();
}

export async function rejectPassiveVocabularyLibrarySuggestion(
  suggestionId: string,
) {
  const { userId, adminClient } = await requireLibraryRole(["superadmin"]);

  try {
    const { error } = await adminClient
      .from("passive_vocabulary_library_suggestions")
      .update({
        status: "rejected",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", suggestionId)
      .eq("status", "pending");

    if (error) {
      throw error;
    }
  } catch (error) {
    throw toSuggestionActionError(error);
  }

  revalidateLibraryPaths();
}