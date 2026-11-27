import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { normalizePassiveVocabularyText } from "@/lib/mastery/passive-vocabulary";

type AdminClient = SupabaseClient<Database>;

export interface ReferenceDictionarySense {
  pos?: string;
  translations: string[];
  examples?: string[];
}

export interface ReferenceDictionaryEntry {
  id: string;
  languagePair: string;
  headword: string;
  normalizedHeadword: string;
  itemType: "word" | "phrase";
  partOfSpeech: string | null;
  ipaUs: string | null;
  ipaUk: string | null;
  shortUkTranslation: string | null;
  senses: ReferenceDictionarySense[];
  sourceDict: string;
}

function normalizeSenses(raw: unknown): ReferenceDictionarySense[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === "object"),
    )
    .map((entry) => ({
      pos: typeof entry.pos === "string" ? entry.pos : undefined,
      translations: Array.isArray(entry.translations)
        ? entry.translations.filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0,
          )
        : [],
      examples: Array.isArray(entry.examples)
        ? entry.examples.filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0,
          )
        : undefined,
    }));
}

/**
 * Layer 1 reference dictionary lookup. Fails soft if the table has not been seeded yet.
 */
export async function lookupReferenceDictionaryEntries(
  adminClient: AdminClient,
  terms: string[],
  languagePair = "en-uk",
): Promise<Map<string, ReferenceDictionaryEntry>> {
  const normalizedTerms = Array.from(
    new Set(
      terms
        .map((term) => normalizePassiveVocabularyText(term))
        .filter((term) => term.length > 0),
    ),
  );

  const resultMap = new Map<string, ReferenceDictionaryEntry>();

  if (normalizedTerms.length === 0) {
    return resultMap;
  }

  const chunkSize = 200;

  for (let offset = 0; offset < normalizedTerms.length; offset += chunkSize) {
    const chunk = normalizedTerms.slice(offset, offset + chunkSize);
    const { data, error } = await adminClient
      .from("reference_dictionary_entries")
      .select(
        "id, language_pair, headword, normalized_headword, item_type, part_of_speech, ipa_us, ipa_uk, short_uk_translation, senses, source_dict",
      )
      .eq("language_pair", languagePair)
      .in("normalized_headword", chunk);

    if (error) {
      // Fail soft when table is unavailable or unseeded so vocabulary pipelines keep running.
      console.warn("Reference dictionary lookup skipped:", error.message);
      return resultMap;
    }

    for (const row of data ?? []) {
      const existing = resultMap.get(row.normalized_headword);
      // Prefer explicit `word` entry if both exist, otherwise store first match.
      if (existing && existing.itemType === "word") {
        continue;
      }

      resultMap.set(row.normalized_headword, {
        id: row.id,
        languagePair: row.language_pair,
        headword: row.headword,
        normalizedHeadword: row.normalized_headword,
        itemType: row.item_type,
        partOfSpeech: row.part_of_speech,
        ipaUs: row.ipa_us,
        ipaUk: row.ipa_uk,
        shortUkTranslation: row.short_uk_translation,
        senses: normalizeSenses(row.senses),
        sourceDict: row.source_dict,
      });
    }
  }

  return resultMap;
}
