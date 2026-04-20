import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import { incrementAICalls } from "@/lib/ai/quota";
import { GEMINI_MODEL, generateFromGeminiWithUsage } from "@/lib/gemini/client";
import {
  getLearningLanguageLabel,
  normalizeLearningLanguage,
  type LearningLanguage,
} from "@/lib/languages";
import type { Database, Json } from "@/types/database";
import {
  PASSIVE_VOCABULARY_CEFR_LEVELS,
  PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
  getPassiveVocabularyCompositeKey,
  getPassiveVocabularyLookupCandidates,
  normalizePassiveVocabularyLibraryAttributes,
  normalizePassiveVocabularyText,
  withPassiveVocabularyUkrainianTranslation,
  type PassiveVocabularyItemType,
  type PassiveVocabularyLibraryAttributes,
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyPartOfSpeech,
} from "./passive-vocabulary";

type AdminClient = SupabaseClient<Database>;
type LibraryRow =
  Database["public"]["Tables"]["passive_vocabulary_library"]["Row"];
type LibraryFormRow =
  Database["public"]["Tables"]["passive_vocabulary_library_forms"]["Row"];

interface PassiveVocabularyLibraryInput {
  term: string;
  normalizedTerm: string;
  itemType: PassiveVocabularyItemType;
}

interface PassiveVocabularyEnrichmentItem {
  requestedTerm: string;
  canonicalTerm: string;
  cefrLevel: PassiveVocabularyLibraryCefrLevel | null;
  partOfSpeech: PassiveVocabularyPartOfSpeech | null;
  ukrainianTranslation: string | null;
  attributes: PassiveVocabularyLibraryAttributes;
}

export interface PassiveVocabularyLibraryAdminItem {
  id: string;
  canonical_term: string;
  normalized_term: string;
  item_type: PassiveVocabularyItemType;
  cefr_level: PassiveVocabularyLibraryCefrLevel | null;
  part_of_speech: PassiveVocabularyPartOfSpeech | null;
  attributes: PassiveVocabularyLibraryAttributes;
  enrichment_status: "pending" | "completed" | "failed";
  enrichment_error: string | null;
  updated_at: string;
}

export interface PassiveVocabularyReEnrichResult {
  item: PassiveVocabularyLibraryAdminItem;
  mergedSourceItemId: string | null;
}

const PASSIVE_VOCABULARY_PART_OF_SPEECH_ALIASES = new Map<
  string,
  PassiveVocabularyPartOfSpeech
>([
  ["article", "determiner"],
  ["definite article", "determiner"],
  ["indefinite article", "determiner"],
  ["modal", "modal verb"],
  ["modal verb", "modal verb"],
  ["modal verbs", "modal verb"],
  ["auxiliary", "auxiliary"],
  ["auxiliary verb", "auxiliary"],
  ["auxiliary verbs", "auxiliary"],
  ["auxillary", "auxiliary"],
  ["auxillary verb", "auxiliary"],
  ["auxillary verbs", "auxiliary"],
  ["helping verb", "auxiliary"],
  ["helping verbs", "auxiliary"],
  ["number", "determiner"],
  ["numeral", "determiner"],
]);

function normalizePassiveVocabularyPartOfSpeech(
  value: unknown,
): PassiveVocabularyPartOfSpeech | null {
  if (value == null) {
    return null;
  }

  const normalizedValue = normalizePassiveVocabularyText(String(value));
  const aliasedValue =
    PASSIVE_VOCABULARY_PART_OF_SPEECH_ALIASES.get(normalizedValue) ??
    normalizedValue;

  return PASSIVE_VOCABULARY_PARTS_OF_SPEECH.includes(
    aliasedValue as PassiveVocabularyPartOfSpeech,
  )
    ? (aliasedValue as PassiveVocabularyPartOfSpeech)
    : null;
}

const passiveVocabularyEnrichmentItemSchema = z.object({
  requestedTerm: z.string().trim().min(1).max(200),
  canonicalTerm: z.string().trim().min(1).max(200),
  cefrLevel: z.enum(PASSIVE_VOCABULARY_CEFR_LEVELS).nullable(),
  partOfSpeech: z.preprocess(
    normalizePassiveVocabularyPartOfSpeech,
    z.enum(PASSIVE_VOCABULARY_PARTS_OF_SPEECH).nullable(),
  ),
  ukrainianTranslation: z.string().trim().min(1).max(200).nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export interface PassiveVocabularyLibraryResolution {
  requestedTerm: string;
  requestedNormalizedTerm: string;
  itemType: PassiveVocabularyItemType;
  libraryItemId: string | null;
  canonicalTerm: string;
  canonicalNormalizedTerm: string;
  cefrLevel: PassiveVocabularyLibraryCefrLevel | null;
  partOfSpeech: PassiveVocabularyPartOfSpeech | null;
  attributes: PassiveVocabularyLibraryAttributes;
}

const passiveVocabularyEnrichmentResponseSchema = z.union([
  z.array(passiveVocabularyEnrichmentItemSchema),
  z.object({ items: z.array(passiveVocabularyEnrichmentItemSchema) }),
]);
const PASSIVE_VOCABULARY_ENRICHMENT_BATCH_SIZE = 40;

function normalizePassiveVocabularyEnrichmentResponse(
  response: z.infer<typeof passiveVocabularyEnrichmentResponseSchema>,
) {
  return Array.isArray(response) ? response : response.items;
}

function chunkPassiveVocabularyInputs<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function asAttributes(value: Json): PassiveVocabularyLibraryAttributes {
  return normalizePassiveVocabularyLibraryAttributes(value);
}

function buildLibraryResolution(
  input: PassiveVocabularyLibraryInput,
  libraryRow: LibraryRow,
): PassiveVocabularyLibraryResolution {
  return {
    requestedTerm: input.term,
    requestedNormalizedTerm: input.normalizedTerm,
    itemType: input.itemType,
    libraryItemId: libraryRow.id,
    canonicalTerm: libraryRow.canonical_term,
    canonicalNormalizedTerm: libraryRow.normalized_term,
    cefrLevel:
      (libraryRow.cefr_level as PassiveVocabularyLibraryCefrLevel | null) ??
      null,
    partOfSpeech:
      (libraryRow.part_of_speech as PassiveVocabularyPartOfSpeech | null) ??
      null,
    attributes: asAttributes(libraryRow.attributes),
  };
}

function getLookupKey(
  normalizedText: string,
  itemType: PassiveVocabularyItemType,
) {
  return getPassiveVocabularyCompositeKey(normalizedText, itemType);
}

function getFallbackCanonicalTerm(input: PassiveVocabularyLibraryInput) {
  const candidates = getPassiveVocabularyLookupCandidates(
    input.term,
    input.itemType,
  );
  const canonicalNormalizedTerm = candidates.at(-1) ?? input.normalizedTerm;

  return {
    canonicalTerm: canonicalNormalizedTerm,
    canonicalNormalizedTerm,
  };
}

function toAdminItem(row: LibraryRow): PassiveVocabularyLibraryAdminItem {
  return {
    id: row.id,
    canonical_term: row.canonical_term,
    normalized_term: row.normalized_term,
    item_type: row.item_type as PassiveVocabularyItemType,
    cefr_level:
      (row.cefr_level as PassiveVocabularyLibraryCefrLevel | null) ?? null,
    part_of_speech:
      (row.part_of_speech as PassiveVocabularyPartOfSpeech | null) ?? null,
    attributes: asAttributes(row.attributes),
    enrichment_status: row.enrichment_status as
      | "pending"
      | "completed"
      | "failed",
    enrichment_error: row.enrichment_error ?? null,
    updated_at: row.updated_at,
  };
}

async function upsertPassiveVocabularyLibraryAlias({
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
  itemType: PassiveVocabularyItemType;
  nowIso: string;
}) {
  const { error } = await adminClient
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

  if (error) {
    throw new Error("Failed to save passive vocabulary library alias");
  }
}

async function syncPassiveVocabularyLibraryForms({
  adminClient,
  libraryItemId,
  itemType,
  oldCanonicalTerm,
  oldNormalizedTerm,
  canonicalTerm,
  canonicalNormalizedTerm,
  nowIso,
}: {
  adminClient: AdminClient;
  libraryItemId: string;
  itemType: PassiveVocabularyItemType;
  oldCanonicalTerm: string;
  oldNormalizedTerm: string;
  canonicalTerm: string;
  canonicalNormalizedTerm: string;
  nowIso: string;
}) {
  const { error: resetError } = await adminClient
    .from("passive_vocabulary_library_forms")
    .update({ is_canonical: false, updated_at: nowIso })
    .eq("library_item_id", libraryItemId);

  if (resetError) {
    throw new Error("Failed to reset passive vocabulary library forms");
  }

  if (oldNormalizedTerm !== canonicalNormalizedTerm) {
    await upsertPassiveVocabularyLibraryAlias({
      adminClient,
      libraryItemId,
      formTerm: oldCanonicalTerm,
      normalizedForm: oldNormalizedTerm,
      itemType,
      nowIso,
    });
  }

  const { error: canonicalError } = await adminClient
    .from("passive_vocabulary_library_forms")
    .upsert(
      {
        library_item_id: libraryItemId,
        form_term: canonicalTerm,
        normalized_form: canonicalNormalizedTerm,
        item_type: itemType,
        is_canonical: true,
        updated_at: nowIso,
      },
      { onConflict: "normalized_form,item_type" },
    );

  if (canonicalError) {
    throw new Error("Failed to save passive vocabulary canonical form");
  }

  await adminClient
    .from("passive_vocabulary_library_forms")
    .delete()
    .eq("library_item_id", libraryItemId)
    .eq("normalized_form", canonicalNormalizedTerm)
    .eq("item_type", itemType)
    .eq("is_canonical", false);
}

async function canonicalizePassiveVocabularyEvidenceRows({
  adminClient,
  libraryItemIds,
  targetLibraryItemId,
  itemType,
  canonicalTerm,
  canonicalNormalizedTerm,
  nowIso,
}: {
  adminClient: AdminClient;
  libraryItemIds: string[];
  targetLibraryItemId: string;
  itemType: PassiveVocabularyItemType;
  canonicalTerm: string;
  canonicalNormalizedTerm: string;
  nowIso: string;
}) {
  const { data: evidenceRows, error: evidenceError } = await adminClient
    .from("passive_vocabulary_evidence")
    .select(
      "id, student_id, definition, source_label, import_count, last_imported_at",
    )
    .in("library_item_id", libraryItemIds)
    .eq("item_type", itemType);

  if (evidenceError) {
    throw new Error("Failed to load passive vocabulary evidence rows");
  }

  for (const row of evidenceRows ?? []) {
    const { data: duplicateRow, error: duplicateError } = await adminClient
      .from("passive_vocabulary_evidence")
      .select("id, definition, source_label, import_count, last_imported_at")
      .eq("student_id", row.student_id)
      .eq("item_type", itemType)
      .eq("normalized_term", canonicalNormalizedTerm)
      .neq("id", row.id)
      .maybeSingle();

    if (duplicateError) {
      throw new Error("Failed to inspect passive vocabulary duplicates");
    }

    if (duplicateRow) {
      const duplicateTime = duplicateRow.last_imported_at
        ? new Date(duplicateRow.last_imported_at).getTime()
        : 0;
      const sourceTime = row.last_imported_at
        ? new Date(row.last_imported_at).getTime()
        : 0;

      const { error: mergeError } = await adminClient
        .from("passive_vocabulary_evidence")
        .update({
          library_item_id: targetLibraryItemId,
          term: canonicalTerm,
          normalized_term: canonicalNormalizedTerm,
          definition: duplicateRow.definition ?? row.definition ?? null,
          source_label: duplicateRow.source_label ?? row.source_label ?? null,
          import_count:
            (duplicateRow.import_count ?? 0) + (row.import_count ?? 0),
          last_imported_at:
            duplicateTime >= sourceTime
              ? duplicateRow.last_imported_at
              : row.last_imported_at,
          updated_at: nowIso,
        })
        .eq("id", duplicateRow.id);

      if (mergeError) {
        throw new Error("Failed to merge passive vocabulary evidence rows");
      }

      const { error: deleteError } = await adminClient
        .from("passive_vocabulary_evidence")
        .delete()
        .eq("id", row.id);

      if (deleteError) {
        throw new Error(
          "Failed to delete merged passive vocabulary evidence row",
        );
      }

      continue;
    }

    const { error: updateError } = await adminClient
      .from("passive_vocabulary_evidence")
      .update({
        library_item_id: targetLibraryItemId,
        term: canonicalTerm,
        normalized_term: canonicalNormalizedTerm,
        updated_at: nowIso,
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error("Failed to canonicalize passive vocabulary evidence row");
    }
  }
}

async function updatePassiveVocabularyLibraryItem({
  adminClient,
  libraryItemId,
  actorUserId,
  canonicalTerm,
  canonicalNormalizedTerm,
  itemType,
  cefrLevel,
  partOfSpeech,
  attributes,
  enrichmentStatus,
  enrichmentError,
  nowIso,
}: {
  adminClient: AdminClient;
  libraryItemId: string;
  actorUserId: string;
  canonicalTerm: string;
  canonicalNormalizedTerm: string;
  itemType: PassiveVocabularyItemType;
  cefrLevel: PassiveVocabularyLibraryCefrLevel | null;
  partOfSpeech: PassiveVocabularyPartOfSpeech | null;
  attributes: PassiveVocabularyLibraryAttributes;
  enrichmentStatus: "pending" | "completed" | "failed";
  enrichmentError: string | null;
  nowIso: string;
}) {
  const { data, error } = await adminClient
    .from("passive_vocabulary_library")
    .update({
      canonical_term: canonicalTerm,
      normalized_term: canonicalNormalizedTerm,
      cefr_level: itemType === "phrase" ? null : cefrLevel,
      part_of_speech: itemType === "phrase" ? "phrase" : partOfSpeech,
      attributes,
      enrichment_status: enrichmentStatus,
      enrichment_error: enrichmentError,
      updated_by: actorUserId,
      updated_at: nowIso,
    })
    .eq("id", libraryItemId)
    .select(
      "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, enrichment_status, enrichment_error, created_by, updated_by, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error("Failed to update passive vocabulary library item");
  }

  return data as LibraryRow;
}

async function findExistingPassiveVocabularyLibraryMatches(
  adminClient: AdminClient,
  inputs: PassiveVocabularyLibraryInput[],
) {
  const candidateMap = new Map<string, string[]>();
  const allCandidates = new Set<string>();

  for (const input of inputs) {
    const key = getLookupKey(input.normalizedTerm, input.itemType);
    const candidates = getPassiveVocabularyLookupCandidates(
      input.term,
      input.itemType,
    );
    candidateMap.set(key, candidates);

    for (const candidate of candidates) {
      allCandidates.add(candidate);
    }
  }

  if (allCandidates.size === 0) {
    return new Map<string, PassiveVocabularyLibraryResolution>();
  }

  const { data: formRows, error: formError } = await adminClient
    .from("passive_vocabulary_library_forms")
    .select(
      "id, library_item_id, form_term, normalized_form, item_type, is_canonical, created_at, updated_at",
    )
    .in("normalized_form", Array.from(allCandidates));

  if (formError) {
    throw new Error("Failed to inspect passive vocabulary library forms");
  }

  const libraryIds = Array.from(
    new Set((formRows ?? []).map((row) => row.library_item_id)),
  );

  const { data: libraryRows, error: libraryError } = libraryIds.length
    ? await adminClient
        .from("passive_vocabulary_library")
        .select(
          "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, enrichment_status, enrichment_error, created_by, updated_by, created_at, updated_at",
        )
        .in("id", libraryIds)
    : { data: [] as LibraryRow[], error: null };

  if (libraryError) {
    throw new Error("Failed to inspect passive vocabulary library");
  }

  const libraryRowById = new Map(
    (libraryRows ?? []).map((row) => [row.id, row]),
  );
  const formLibraryIdByLookupKey = new Map<string, string>();

  for (const row of (formRows ?? []) as LibraryFormRow[]) {
    formLibraryIdByLookupKey.set(
      getLookupKey(row.normalized_form, row.item_type),
      row.library_item_id,
    );
  }

  const matches = new Map<string, PassiveVocabularyLibraryResolution>();

  for (const input of inputs) {
    const inputKey = getLookupKey(input.normalizedTerm, input.itemType);
    const candidates = candidateMap.get(inputKey) ?? [];

    for (const candidate of candidates) {
      const libraryItemId = formLibraryIdByLookupKey.get(
        getLookupKey(candidate, input.itemType),
      );
      const libraryRow = libraryItemId
        ? libraryRowById.get(libraryItemId)
        : undefined;

      if (!libraryRow) {
        continue;
      }

      matches.set(inputKey, buildLibraryResolution(input, libraryRow));
      break;
    }
  }

  return matches;
}

async function enrichPassiveVocabularyWords(
  inputs: PassiveVocabularyLibraryInput[],
  targetLanguage: LearningLanguage,
  actorUserId: string,
  adminClient: AdminClient,
) {
  if (inputs.length === 0) {
    return new Map<string, PassiveVocabularyEnrichmentItem>();
  }

  const targetLanguageLabel = getLearningLanguageLabel(targetLanguage);
  const enrichmentMap = new Map<string, PassiveVocabularyEnrichmentItem>();

  for (const batch of chunkPassiveVocabularyInputs(
    inputs,
    PASSIVE_VOCABULARY_ENRICHMENT_BATCH_SIZE,
  )) {
    const prompt = [
      `Target language: ${targetLanguageLabel}`,
      "For each requested single word, return:",
      "- requestedTerm exactly as provided",
      "- canonicalTerm as the base lemma form in the same language",
      "- cefrLevel as the estimated standalone word difficulty for learners",
      "- partOfSpeech using one of: noun, verb, modal verb, auxiliary, adjective, adverb, pronoun, preposition, conjunction, determiner, interjection, other",
      "- ukrainianTranslation as a concise natural Ukrainian dictionary equivalent",
      "Use modal verb for can, could, may, might, must, shall, should, will, and would.",
      "Use auxiliary when the entry is best labeled as a helping verb rather than a main verb.",
      "Merge regular noun plurals and regular third-person singular verb forms into the same canonical lemma when appropriate.",
      "Examples: tables -> table, works -> work, studies -> study.",
      "Never translate the word. Never return multiple words as the canonical form for a single-word input.",
      "If the word is already canonical, keep it unchanged.",
      'Respond with JSON in this exact shape: { "items": [ { "requestedTerm": "...", "canonicalTerm": "...", "cefrLevel": "A1", "partOfSpeech": "noun", "ukrainianTranslation": "...", "attributes": {} } ] }.',
      "Requested terms:",
      ...batch.map((input) => `- ${input.term}`),
    ].join("\n");

    try {
      const { data, usageSnapshot } = await generateFromGeminiWithUsage(
        {
          prompt,
          systemInstruction:
            "You are building an internal vocabulary library for a language-learning app. Return only valid JSON and keep the requestedTerm field exactly as supplied.",
          temperature: 0.1,
        },
        passiveVocabularyEnrichmentResponseSchema,
      );
      const normalizedItems =
        normalizePassiveVocabularyEnrichmentResponse(data);

      await recordAIUsageEvent({
        userId: actorUserId,
        feature: "passive_vocabulary_enrichment",
        requestType: "text",
        model: GEMINI_MODEL,
        snapshot: usageSnapshot,
        adminClient,
      });
      await incrementAICalls(actorUserId);

      for (const item of normalizedItems) {
        enrichmentMap.set(normalizePassiveVocabularyText(item.requestedTerm), {
          requestedTerm: item.requestedTerm,
          canonicalTerm: item.canonicalTerm,
          cefrLevel: item.cefrLevel,
          partOfSpeech: item.partOfSpeech,
          ukrainianTranslation: item.ukrainianTranslation ?? null,
          attributes: withPassiveVocabularyUkrainianTranslation(
            normalizePassiveVocabularyLibraryAttributes(item.attributes),
            item.ukrainianTranslation ?? null,
          ),
        });
      }
    } catch (error) {
      console.error("Passive vocabulary enrichment error:", error);
    }
  }

  return enrichmentMap;
}

async function createPassiveVocabularyLibraryEntries(
  adminClient: AdminClient,
  inputs: PassiveVocabularyLibraryInput[],
  targetLanguage: LearningLanguage,
  actorUserId: string,
) {
  const wordInputs = inputs.filter((input) => input.itemType === "word");
  const phraseInputs = inputs.filter((input) => input.itemType === "phrase");
  const enrichmentByRequestedTerm = await enrichPassiveVocabularyWords(
    wordInputs,
    targetLanguage,
    actorUserId,
    adminClient,
  );
  const libraryGroups = new Map<
    string,
    {
      canonicalTerm: string;
      canonicalNormalizedTerm: string;
      itemType: PassiveVocabularyItemType;
      cefrLevel: PassiveVocabularyLibraryCefrLevel | null;
      partOfSpeech: PassiveVocabularyPartOfSpeech | null;
      attributes: PassiveVocabularyLibraryAttributes;
      enrichmentStatus: "pending" | "completed" | "failed";
      enrichmentError: string | null;
      inputItems: PassiveVocabularyLibraryInput[];
      candidateForms: Map<string, string>;
    }
  >();

  for (const input of [...wordInputs, ...phraseInputs]) {
    const enrichment = enrichmentByRequestedTerm.get(input.normalizedTerm);
    const fallback = getFallbackCanonicalTerm(input);
    const isPhrase = input.itemType === "phrase";
    const canonicalTerm =
      normalizePassiveVocabularyText(enrichment?.canonicalTerm ?? "") ||
      fallback.canonicalNormalizedTerm;
    const canonicalNormalizedTerm =
      normalizePassiveVocabularyText(canonicalTerm);
    const groupKey = getLookupKey(canonicalNormalizedTerm, input.itemType);
    const existingGroup = libraryGroups.get(groupKey);
    const candidateForms = new Map<string, string>(
      existingGroup?.candidateForms ?? [],
    );

    for (const candidate of getPassiveVocabularyLookupCandidates(
      input.term,
      input.itemType,
    )) {
      candidateForms.set(
        candidate,
        candidate === input.normalizedTerm ? input.term : candidate,
      );
    }

    candidateForms.set(canonicalNormalizedTerm, canonicalTerm);

    libraryGroups.set(groupKey, {
      canonicalTerm,
      canonicalNormalizedTerm,
      itemType: input.itemType,
      cefrLevel: isPhrase ? null : (enrichment?.cefrLevel ?? null),
      partOfSpeech: isPhrase ? "phrase" : (enrichment?.partOfSpeech ?? null),
      attributes: isPhrase ? {} : (enrichment?.attributes ?? {}),
      enrichmentStatus: isPhrase
        ? "completed"
        : enrichment?.cefrLevel && enrichment.partOfSpeech
          ? "completed"
          : "failed",
      enrichmentError: isPhrase
        ? null
        : enrichment?.cefrLevel && enrichment.partOfSpeech
          ? null
          : "Gemini enrichment unavailable or incomplete for this word.",
      inputItems: [...(existingGroup?.inputItems ?? []), input],
      candidateForms,
    });
  }

  const nowIso = new Date().toISOString();
  const { error: upsertLibraryError } = await adminClient
    .from("passive_vocabulary_library")
    .upsert(
      Array.from(libraryGroups.values()).map((group) => ({
        canonical_term: group.canonicalTerm,
        normalized_term: group.canonicalNormalizedTerm,
        item_type: group.itemType,
        cefr_level: group.cefrLevel,
        part_of_speech: group.partOfSpeech,
        attributes: group.attributes,
        enrichment_status: group.enrichmentStatus,
        enrichment_error: group.enrichmentError,
        created_by: actorUserId,
        updated_by: actorUserId,
        updated_at: nowIso,
      })),
      { onConflict: "normalized_term,item_type" },
    );

  if (upsertLibraryError) {
    throw new Error("Failed to save passive vocabulary library entries");
  }

  const { data: libraryRows, error: libraryRowsError } = await adminClient
    .from("passive_vocabulary_library")
    .select(
      "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, enrichment_status, enrichment_error, created_by, updated_by, created_at, updated_at",
    )
    .in(
      "normalized_term",
      Array.from(libraryGroups.values()).map(
        (group) => group.canonicalNormalizedTerm,
      ),
    );

  if (libraryRowsError) {
    throw new Error("Failed to load passive vocabulary library entries");
  }

  const libraryIdByGroupKey = new Map(
    (libraryRows ?? []).map((row) => [
      getLookupKey(row.normalized_term, row.item_type),
      row.id,
    ]),
  );

  const formRows = Array.from(libraryGroups.values()).flatMap((group) => {
    const libraryItemId = libraryIdByGroupKey.get(
      getLookupKey(group.canonicalNormalizedTerm, group.itemType),
    );

    if (!libraryItemId) {
      return [];
    }

    return Array.from(group.candidateForms.entries()).map(
      ([normalizedForm, formTerm]) => ({
        library_item_id: libraryItemId,
        form_term: formTerm,
        normalized_form: normalizedForm,
        item_type: group.itemType,
        is_canonical: normalizedForm === group.canonicalNormalizedTerm,
        updated_at: nowIso,
      }),
    );
  });

  if (formRows.length > 0) {
    const { error: upsertFormsError } = await adminClient
      .from("passive_vocabulary_library_forms")
      .upsert(formRows, { onConflict: "normalized_form,item_type" });

    if (upsertFormsError) {
      throw new Error("Failed to save passive vocabulary library forms");
    }
  }
}

export async function resolvePassiveVocabularyLibraryItems({
  items,
  targetLanguage,
  actorUserId,
  adminClient,
}: {
  items: PassiveVocabularyLibraryInput[];
  targetLanguage: LearningLanguage | string;
  actorUserId: string;
  adminClient: AdminClient;
}) {
  const result = await importPassiveVocabularyLibraryItems({
    items,
    targetLanguage,
    actorUserId,
    adminClient,
  });

  return result.items;
}

export async function importPassiveVocabularyLibraryItems({
  items,
  targetLanguage,
  actorUserId,
  adminClient,
}: {
  items: PassiveVocabularyLibraryInput[];
  targetLanguage: LearningLanguage | string;
  actorUserId: string;
  adminClient: AdminClient;
}) {
  const normalizedTargetLanguage = normalizeLearningLanguage(targetLanguage);
  const existingMatches = await findExistingPassiveVocabularyLibraryMatches(
    adminClient,
    items,
  );
  const existingLibraryItemIds = new Set(
    Array.from(existingMatches.values()).flatMap((match) =>
      match.libraryItemId ? [match.libraryItemId] : [],
    ),
  );
  const unresolvedItems = items.filter(
    (item) =>
      !existingMatches.has(getLookupKey(item.normalizedTerm, item.itemType)),
  );

  if (unresolvedItems.length > 0) {
    await createPassiveVocabularyLibraryEntries(
      adminClient,
      unresolvedItems,
      normalizedTargetLanguage,
      actorUserId,
    );
  }

  const finalMatches = await findExistingPassiveVocabularyLibraryMatches(
    adminClient,
    items,
  );

  const resolvedItems = items.map((item) => {
    const match = finalMatches.get(
      getLookupKey(item.normalizedTerm, item.itemType),
    );
    if (match) {
      return match;
    }

    const fallback = getFallbackCanonicalTerm(item);
    return {
      requestedTerm: item.term,
      requestedNormalizedTerm: item.normalizedTerm,
      itemType: item.itemType,
      libraryItemId: null,
      canonicalTerm: fallback.canonicalTerm,
      canonicalNormalizedTerm: fallback.canonicalNormalizedTerm,
      cefrLevel: null,
      partOfSpeech: item.itemType === "phrase" ? "phrase" : null,
      attributes: {},
    } satisfies PassiveVocabularyLibraryResolution;
  });
  const finalLibraryItemIds = new Set(
    resolvedItems.flatMap((item) =>
      item.libraryItemId ? [item.libraryItemId] : [],
    ),
  );
  const createdCount = Array.from(finalLibraryItemIds).filter(
    (libraryItemId) => !existingLibraryItemIds.has(libraryItemId),
  ).length;

  return {
    items: resolvedItems,
    importedCount: finalLibraryItemIds.size,
    createdCount,
    existingCount: finalLibraryItemIds.size - createdCount,
  };
}

export async function reEnrichPassiveVocabularyLibraryItem({
  libraryItemId,
  targetLanguage,
  actorUserId,
  adminClient,
}: {
  libraryItemId: string;
  targetLanguage: LearningLanguage | string;
  actorUserId: string;
  adminClient: AdminClient;
}): Promise<PassiveVocabularyReEnrichResult> {
  const { data: existingItem, error: existingItemError } = await adminClient
    .from("passive_vocabulary_library")
    .select(
      "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, enrichment_status, enrichment_error, created_by, updated_by, created_at, updated_at",
    )
    .eq("id", libraryItemId)
    .maybeSingle();

  if (existingItemError) {
    throw new Error("Failed to load passive vocabulary library item");
  }

  if (!existingItem) {
    throw new Error("Passive vocabulary library item not found");
  }

  const nowIso = new Date().toISOString();

  if (existingItem.item_type === "phrase") {
    const updatedPhraseItem = await updatePassiveVocabularyLibraryItem({
      adminClient,
      libraryItemId,
      actorUserId,
      canonicalTerm: existingItem.canonical_term,
      canonicalNormalizedTerm: existingItem.normalized_term,
      itemType: "phrase",
      cefrLevel: null,
      partOfSpeech: "phrase",
      attributes: asAttributes(existingItem.attributes),
      enrichmentStatus: "completed",
      enrichmentError: null,
      nowIso,
    });

    return {
      item: toAdminItem(updatedPhraseItem),
      mergedSourceItemId: null,
    };
  }

  const normalizedTargetLanguage = normalizeLearningLanguage(targetLanguage);
  const input: PassiveVocabularyLibraryInput = {
    term: existingItem.canonical_term,
    normalizedTerm: existingItem.normalized_term,
    itemType: "word",
  };
  const enrichmentByRequestedTerm = await enrichPassiveVocabularyWords(
    [input],
    normalizedTargetLanguage,
    actorUserId,
    adminClient,
  );
  const enrichment = enrichmentByRequestedTerm.get(
    existingItem.normalized_term,
  );

  if (!enrichment?.cefrLevel || !enrichment.partOfSpeech) {
    if (!existingItem.cefr_level || !existingItem.part_of_speech) {
      await updatePassiveVocabularyLibraryItem({
        adminClient,
        libraryItemId,
        actorUserId,
        canonicalTerm: existingItem.canonical_term,
        canonicalNormalizedTerm: existingItem.normalized_term,
        itemType: "word",
        cefrLevel:
          (existingItem.cefr_level as PassiveVocabularyLibraryCefrLevel | null) ??
          null,
        partOfSpeech:
          (existingItem.part_of_speech as PassiveVocabularyPartOfSpeech | null) ??
          null,
        attributes: asAttributes(existingItem.attributes),
        enrichmentStatus: "failed",
        enrichmentError:
          "Gemini enrichment unavailable or incomplete for this word.",
        nowIso,
      });
    }

    throw new Error(
      "Gemini enrichment unavailable or incomplete for this word.",
    );
  }

  const canonicalTerm =
    normalizePassiveVocabularyText(enrichment.canonicalTerm) ||
    existingItem.normalized_term;
  const canonicalNormalizedTerm = normalizePassiveVocabularyText(canonicalTerm);
  const { data: existingCanonicalRow, error: existingCanonicalRowError } =
    await adminClient
      .from("passive_vocabulary_library")
      .select(
        "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, enrichment_status, enrichment_error, created_by, updated_by, created_at, updated_at",
      )
      .eq("normalized_term", canonicalNormalizedTerm)
      .eq("item_type", existingItem.item_type)
      .neq("id", existingItem.id)
      .maybeSingle();

  if (existingCanonicalRowError) {
    throw new Error(
      "Failed to inspect canonical passive vocabulary library item",
    );
  }

  if (existingCanonicalRow) {
    const mergedItem = await updatePassiveVocabularyLibraryItem({
      adminClient,
      libraryItemId: existingCanonicalRow.id,
      actorUserId,
      canonicalTerm,
      canonicalNormalizedTerm,
      itemType: "word",
      cefrLevel: enrichment.cefrLevel,
      partOfSpeech: enrichment.partOfSpeech,
      attributes: enrichment.attributes ?? {},
      enrichmentStatus: "completed",
      enrichmentError: null,
      nowIso,
    });

    await syncPassiveVocabularyLibraryForms({
      adminClient,
      libraryItemId: existingCanonicalRow.id,
      itemType: "word",
      oldCanonicalTerm: existingCanonicalRow.canonical_term,
      oldNormalizedTerm: existingCanonicalRow.normalized_term,
      canonicalTerm,
      canonicalNormalizedTerm,
      nowIso,
    });

    if (existingItem.normalized_term !== canonicalNormalizedTerm) {
      await upsertPassiveVocabularyLibraryAlias({
        adminClient,
        libraryItemId: existingCanonicalRow.id,
        formTerm: existingItem.canonical_term,
        normalizedForm: existingItem.normalized_term,
        itemType: "word",
        nowIso,
      });
    }

    await canonicalizePassiveVocabularyEvidenceRows({
      adminClient,
      libraryItemIds: [existingItem.id, existingCanonicalRow.id],
      targetLibraryItemId: existingCanonicalRow.id,
      itemType: "word",
      canonicalTerm,
      canonicalNormalizedTerm,
      nowIso,
    });

    const { error: deleteSourceError } = await adminClient
      .from("passive_vocabulary_library")
      .delete()
      .eq("id", existingItem.id);

    if (deleteSourceError) {
      throw new Error("Failed to merge passive vocabulary library items");
    }

    return {
      item: toAdminItem(mergedItem),
      mergedSourceItemId: existingItem.id,
    };
  }

  const updatedItem = await updatePassiveVocabularyLibraryItem({
    adminClient,
    libraryItemId: existingItem.id,
    actorUserId,
    canonicalTerm,
    canonicalNormalizedTerm,
    itemType: "word",
    cefrLevel: enrichment.cefrLevel,
    partOfSpeech: enrichment.partOfSpeech,
    attributes: enrichment.attributes ?? {},
    enrichmentStatus: "completed",
    enrichmentError: null,
    nowIso,
  });

  await syncPassiveVocabularyLibraryForms({
    adminClient,
    libraryItemId: existingItem.id,
    itemType: "word",
    oldCanonicalTerm: existingItem.canonical_term,
    oldNormalizedTerm: existingItem.normalized_term,
    canonicalTerm,
    canonicalNormalizedTerm,
    nowIso,
  });

  if (existingItem.normalized_term !== canonicalNormalizedTerm) {
    await canonicalizePassiveVocabularyEvidenceRows({
      adminClient,
      libraryItemIds: [existingItem.id],
      targetLibraryItemId: existingItem.id,
      itemType: "word",
      canonicalTerm,
      canonicalNormalizedTerm,
      nowIso,
    });
  }

  return {
    item: toAdminItem(updatedItem),
    mergedSourceItemId: null,
  };
}
