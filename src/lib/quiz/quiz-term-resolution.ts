import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeLearningLanguage,
  normalizeSourceLanguage,
  type LearningLanguage,
  type SourceLanguage,
} from "@/lib/languages";
import {
  getPassiveVocabularyCompositeKey,
  getPassiveVocabularyEnglishDefinitions,
  getPassiveVocabularyUkrainianTranslation,
  inferPassiveVocabularyItemType,
  normalizePassiveVocabularyText,
} from "@/lib/mastery/passive-vocabulary";
import {
  lookupPassiveVocabularyLibraryItems,
  resolvePassiveVocabularyLibraryItems,
  type PassiveVocabularyLibraryInput,
  type PassiveVocabularyLibraryResolution,
} from "@/lib/mastery/passive-vocabulary-library";
import type { Database } from "@/types/database";
import type { QuizTerm } from "@/types/quiz";

type AdminClient = SupabaseClient<Database>;

export interface PreparedQuizDictionaryTerm {
  term: string;
  definition: string;
  libraryInput: PassiveVocabularyLibraryInput | null;
}

export interface ResolvedQuizDictionaryTerm extends PreparedQuizDictionaryTerm {
  definitionSource: "dictionary" | "input";
  resolution: PassiveVocabularyLibraryResolution | null;
}

function normalizeQuizTermValue(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getQuizTermLookupKey(input: PassiveVocabularyLibraryInput) {
  return getPassiveVocabularyCompositeKey(input.normalizedTerm, input.itemType);
}

function getPreferredDictionaryDefinition(
  resolution: PassiveVocabularyLibraryResolution,
  sourceLanguage: SourceLanguage,
) {
  if (sourceLanguage === "english") {
    return getPassiveVocabularyEnglishDefinitions(resolution.attributes)[0] ?? null;
  }

  return getPassiveVocabularyUkrainianTranslation(resolution.attributes);
}

export function prepareQuizTermsForDictionary({
  terms,
  sourceLanguage,
}: {
  terms: QuizTerm[];
  sourceLanguage?: SourceLanguage | string | null;
}) {
  const normalizedSourceLanguage = normalizeSourceLanguage(sourceLanguage);

  return terms.map((term): PreparedQuizDictionaryTerm => {
    const normalizedTerm = normalizeQuizTermValue(term.term);
    const normalizedDefinition = normalizeQuizTermValue(term.definition);
    const resolvedNormalizedTerm = normalizePassiveVocabularyText(normalizedTerm);

    if (!normalizedTerm || !resolvedNormalizedTerm) {
      return {
        term: normalizedTerm,
        definition: normalizedDefinition,
        libraryInput: null,
      };
    }

    return {
      term: normalizedTerm,
      definition: normalizedDefinition,
      libraryInput: {
        term: normalizedTerm,
        normalizedTerm: resolvedNormalizedTerm,
        itemType: inferPassiveVocabularyItemType(normalizedTerm),
        englishDefinitions:
          normalizedSourceLanguage === "english" && normalizedDefinition
            ? [normalizedDefinition]
            : undefined,
        ukrainianTranslation:
          normalizedSourceLanguage === "ukrainian" && normalizedDefinition
            ? normalizedDefinition
            : undefined,
      },
    };
  });
}

export async function resolveQuizTermsWithDictionary({
  adminClient,
  actorUserId,
  targetLanguage,
  sourceLanguage,
  terms,
  createMissing = false,
}: {
  adminClient: AdminClient;
  actorUserId: string;
  targetLanguage?: LearningLanguage | string | null;
  sourceLanguage?: SourceLanguage | string | null;
  terms: QuizTerm[];
  createMissing?: boolean;
}) {
  const preparedTerms = prepareQuizTermsForDictionary({
    terms,
    sourceLanguage,
  });
  const normalizedSourceLanguage = normalizeSourceLanguage(sourceLanguage);
  const libraryInputs = preparedTerms.flatMap((term) =>
    term.libraryInput ? [term.libraryInput] : [],
  );
  const resolutionByLookupKey = new Map<
    string,
    PassiveVocabularyLibraryResolution
  >();

  if (libraryInputs.length > 0) {
    if (createMissing) {
      const resolutions = await resolvePassiveVocabularyLibraryItems({
        adminClient,
        actorUserId,
        targetLanguage: normalizeLearningLanguage(targetLanguage),
        items: libraryInputs,
      });

      for (const resolution of resolutions) {
        resolutionByLookupKey.set(
          getPassiveVocabularyCompositeKey(
            resolution.requestedNormalizedTerm,
            resolution.itemType,
          ),
          resolution,
        );
      }
    } else {
      const resolutions = await lookupPassiveVocabularyLibraryItems({
        adminClient,
        items: libraryInputs,
      });

      for (const [lookupKey, resolution] of resolutions.entries()) {
        resolutionByLookupKey.set(lookupKey, resolution);
      }
    }
  }

  return preparedTerms.map((term): ResolvedQuizDictionaryTerm => {
    const resolution = term.libraryInput
      ? resolutionByLookupKey.get(getQuizTermLookupKey(term.libraryInput)) ?? null
      : null;
    const dictionaryDefinition =
      resolution?.approvalStatus === "confirmed"
        ? getPreferredDictionaryDefinition(resolution, normalizedSourceLanguage)
        : null;

    return {
      ...term,
      definition: dictionaryDefinition ?? term.definition,
      definitionSource: dictionaryDefinition ? "dictionary" : "input",
      resolution,
    };
  });
}