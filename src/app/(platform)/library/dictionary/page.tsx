import { redirect } from "next/navigation";
import { LibraryPageHeader } from "@/components/library/library-page-header";
import {
  LibraryDictionaryBrowser,
  type LibraryDictionaryPendingSuggestion,
  type LibraryDictionarySuggestionReviewItem,
} from "@/components/library/library-dictionary-browser";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizePassiveVocabularyLibraryAttributes,
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";
import { isMissingPassiveVocabularyLibrarySuggestionsTableError } from "@/lib/mastery/passive-vocabulary-library-suggestions";
import { createClient } from "@/lib/supabase/server";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import { canUserEditDictionary } from "@/lib/dictionary/dictionary-permissions";

export const dynamic = "force-dynamic";

const LIBRARY_PAGE_SIZE = 20;

interface DictionarySuggestionRow {
  id: string;
  library_item_id: string;
  proposed_canonical_term: string;
  proposed_cefr_level: PassiveVocabularyLibraryCefrLevel | null;
  proposed_part_of_speech: PassiveVocabularyPartOfSpeech | null;
  proposed_attributes: unknown;
  suggestion_note: string | null;
  created_at: string;
  created_by: string;
}

export default async function LibraryDictionaryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, app_language")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "tutor" && profile?.role !== "superadmin") {
    redirect("/dashboard");
  }

  const role = profile.role;
  const messages = getAppMessages(normalizeAppLanguage(profile.app_language));
  const supabaseAdmin = createAdminClient();
  const [libraryCountResult, libraryRowsResult, canDirectlyAdd] = await Promise.all([
    supabaseAdmin
      .from("passive_vocabulary_library")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("passive_vocabulary_library")
      .select(
        "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, enrichment_status, enrichment_error, updated_at",
      )
      .order("updated_at", { ascending: false })
      .range(0, LIBRARY_PAGE_SIZE - 1),
    canUserEditDictionary(user.id, role),
  ]);

  if (libraryRowsResult.error) {
    throw new Error("Failed to load shared dictionary items");
  }

  let pendingSuggestions: LibraryDictionarySuggestionReviewItem[] = [];
  let myPendingSuggestions: LibraryDictionaryPendingSuggestion[] = [];

  const suggestionRowsResult = await supabaseAdmin
    .from("passive_vocabulary_library_suggestions")
    .select(
      "id, library_item_id, proposed_canonical_term, proposed_cefr_level, proposed_part_of_speech, proposed_attributes, suggestion_note, created_at, created_by",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (suggestionRowsResult.error) {
    if (!isMissingPassiveVocabularyLibrarySuggestionsTableError(suggestionRowsResult.error)) {
      throw new Error("Failed to load passive dictionary suggestions");
    }
  } else {
    const suggestionRows = (suggestionRowsResult.data ?? []) as DictionarySuggestionRow[];

    if (role === "superadmin" && suggestionRows.length > 0) {
      const libraryItemIds = Array.from(
        new Set(suggestionRows.map((suggestion) => suggestion.library_item_id)),
      );
      const submitterIds = Array.from(
        new Set(suggestionRows.map((suggestion) => suggestion.created_by)),
      );
      const [relatedLibraryItemsResult, submitterProfilesResult] = await Promise.all([
        supabaseAdmin
          .from("passive_vocabulary_library")
          .select(
            "id, canonical_term, item_type, cefr_level, part_of_speech, attributes",
          )
          .in("id", libraryItemIds),
        supabaseAdmin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", submitterIds),
      ]);

      if (relatedLibraryItemsResult.error || submitterProfilesResult.error) {
        throw new Error("Failed to load passive dictionary review details");
      }

      const libraryItemById = new Map(
        (relatedLibraryItemsResult.data ?? []).map((item) => [item.id, item]),
      );
      const submitterById = new Map(
        (submitterProfilesResult.data ?? []).map((submitter) => [
          submitter.id,
          submitter,
        ]),
      );

      pendingSuggestions = suggestionRows.flatMap((suggestion) => {
        const currentItem = libraryItemById.get(suggestion.library_item_id);

        if (!currentItem) {
          return [];
        }

        const submitter = submitterById.get(suggestion.created_by);

        return [
          {
            id: suggestion.id,
            library_item_id: suggestion.library_item_id,
            proposed_canonical_term: suggestion.proposed_canonical_term,
            proposed_cefr_level: suggestion.proposed_cefr_level,
            proposed_part_of_speech: suggestion.proposed_part_of_speech,
            proposed_attributes: normalizePassiveVocabularyLibraryAttributes(
              suggestion.proposed_attributes,
            ),
            suggestion_note: suggestion.suggestion_note,
            created_at: suggestion.created_at,
            submitter_name:
              submitter?.full_name ?? submitter?.email ?? "Tutor suggestion",
            submitter_email: submitter?.email ?? null,
            current_term: currentItem.canonical_term,
            current_item_type: currentItem.item_type,
            current_cefr_level:
              currentItem.cefr_level as PassiveVocabularyLibraryCefrLevel | null,
            current_part_of_speech:
              currentItem.part_of_speech as PassiveVocabularyPartOfSpeech | null,
            current_attributes: normalizePassiveVocabularyLibraryAttributes(
              currentItem.attributes,
            ),
          },
        ];
      });
    }

    if (role === "tutor") {
      myPendingSuggestions = suggestionRows
        .filter((suggestion) => suggestion.created_by === user.id)
        .map((suggestion) => ({
          id: suggestion.id,
          library_item_id: suggestion.library_item_id,
          proposed_canonical_term: suggestion.proposed_canonical_term,
          proposed_cefr_level: suggestion.proposed_cefr_level,
          proposed_part_of_speech: suggestion.proposed_part_of_speech,
          proposed_attributes: normalizePassiveVocabularyLibraryAttributes(
            suggestion.proposed_attributes,
          ),
          suggestion_note: suggestion.suggestion_note,
          created_at: suggestion.created_at,
        }));
    }
  }

  return (
    <div className="space-y-6">
      <LibraryPageHeader
        currentSection="dictionary"
        title={messages.library.title}
        description={messages.library.dictionaryDescription}
      />

      <LibraryDictionaryBrowser
        role={role}
        initialItems={(libraryRowsResult.data ?? []).map((item) => ({
          id: item.id,
          canonical_term: item.canonical_term,
          normalized_term: item.normalized_term,
          item_type: item.item_type,
          cefr_level: item.cefr_level as
            | "A1"
            | "A2"
            | "B1"
            | "B2"
            | "C1"
            | "C2"
            | null,
          part_of_speech:
            item.part_of_speech as PassiveVocabularyPartOfSpeech | null,
          attributes: normalizePassiveVocabularyLibraryAttributes(item.attributes),
          enrichment_status: item.enrichment_status,
          enrichment_error: item.enrichment_error,
          updated_at: item.updated_at,
        }))}
        initialHasMore={(libraryCountResult.count ?? 0) > LIBRARY_PAGE_SIZE}
        totalItems={libraryCountResult.count ?? 0}
        canDirectlyAdd={canDirectlyAdd}
        pendingSuggestions={pendingSuggestions}
        myPendingSuggestions={myPendingSuggestions}
      />
    </div>
  );
}