import type { Database } from "@/types/database";
import {
  normalizePassiveVocabularyLibraryAttributes,
  type PassiveVocabularyLibraryAttributes,
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";

type SuggestionRow =
  Database["public"]["Tables"]["passive_vocabulary_library_suggestions"]["Row"];

export type PassiveVocabularyLibrarySuggestionStatus =
  SuggestionRow["status"];

export interface PassiveVocabularyLibrarySuggestionItem {
  id: string;
  library_item_id: string;
  status: PassiveVocabularyLibrarySuggestionStatus;
  proposed_canonical_term: string;
  proposed_normalized_term: string;
  proposed_cefr_level: PassiveVocabularyLibraryCefrLevel | null;
  proposed_part_of_speech: PassiveVocabularyPartOfSpeech | null;
  proposed_attributes: PassiveVocabularyLibraryAttributes;
  suggestion_note: string | null;
  review_note: string | null;
  created_by: string;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
}

export function mapPassiveVocabularyLibrarySuggestionItem(
  row: SuggestionRow,
): PassiveVocabularyLibrarySuggestionItem {
  return {
    id: row.id,
    library_item_id: row.library_item_id,
    status: row.status,
    proposed_canonical_term: row.proposed_canonical_term,
    proposed_normalized_term: row.proposed_normalized_term,
    proposed_cefr_level:
      (row.proposed_cefr_level as PassiveVocabularyLibraryCefrLevel | null) ??
      null,
    proposed_part_of_speech:
      (row.proposed_part_of_speech as PassiveVocabularyPartOfSpeech | null) ??
      null,
    proposed_attributes: normalizePassiveVocabularyLibraryAttributes(
      row.proposed_attributes,
    ),
    suggestion_note: row.suggestion_note,
    review_note: row.review_note,
    created_by: row.created_by,
    reviewed_by: row.reviewed_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    reviewed_at: row.reviewed_at,
  };
}

export type PassiveVocabularyLibrarySuggestionRow =
  Database["public"]["Tables"]["passive_vocabulary_library_suggestions"]["Row"];

export function isMissingPassiveVocabularyLibrarySuggestionsTableError(
  error: unknown,
) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    candidate.message?.includes("passive_vocabulary_library_suggestions") ||
    false
  );
}