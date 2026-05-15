import { z } from "zod";
import {
  normalizeEnglishVariantPreference,
  type EnglishVariantPreference,
} from "@/lib/languages";
import type { Json } from "@/types/database";
import type { CEFRLevel } from "@/types/quiz";

export const PASSIVE_VOCABULARY_ITEM_TYPES = ["word", "phrase"] as const;
export const PASSIVE_VOCABULARY_SOURCE_TYPES = [
  "full_text",
  "manual_list",
  "curated_list",
] as const;
export const PASSIVE_VOCABULARY_CEFR_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
] as const satisfies readonly CEFRLevel[];
export const PASSIVE_VOCABULARY_PARTS_OF_SPEECH = [
  "noun",
  "verb",
  "modal verb",
  "auxiliary",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "determiner",
  "interjection",
  "phrase",
  "phrasal verb",
  "idiom",
  "other",
] as const;
export const PASSIVE_VOCABULARY_NOUN_COUNTABILITY = [
  "countable",
  "uncountable",
] as const;

export type PassiveVocabularyItemType =
  (typeof PASSIVE_VOCABULARY_ITEM_TYPES)[number];
export type PassiveVocabularySourceType =
  (typeof PASSIVE_VOCABULARY_SOURCE_TYPES)[number];
export type PassiveVocabularyLibraryCefrLevel =
  (typeof PASSIVE_VOCABULARY_CEFR_LEVELS)[number];
export type PassiveVocabularyPartOfSpeech =
  (typeof PASSIVE_VOCABULARY_PARTS_OF_SPEECH)[number];
export type PassiveVocabularyNounCountability =
  (typeof PASSIVE_VOCABULARY_NOUN_COUNTABILITY)[number];

export interface PassiveVocabularyEditableFormValues {
  plural: string | null;
  pastSimple: string | null;
  pastParticiple: string | null;
  gerund: string | null;
  thirdPersonSingular: string | null;
  comparative: string | null;
  superlative: string | null;
  objectPronoun: string | null;
  possessiveAdjective: string | null;
  possessivePronoun: string | null;
  reflexivePronoun: string | null;
}

export interface PassiveVocabularyTranscriptions {
  american: string | null;
  british: string | null;
}

export interface PassiveVocabularyLibraryAttributes extends Record<
  string,
  Json | undefined
> {
  ukrainianTranslation?: string | null;
  englishDefinition?: string | null;
  englishDefinitions?: string[];
  transcription?: string | null;
  americanTranscription?: string | null;
  britishTranscription?: string | null;
  nounCountability?: PassiveVocabularyNounCountability[];
  forms?: string[];
}

function addPassiveVocabularyNounCountabilityValue(
  values: Set<PassiveVocabularyNounCountability>,
  candidate: unknown,
) {
  const normalizedCandidate = normalizePassiveVocabularyText(
    String(candidate ?? ""),
  );

  if (!normalizedCandidate) {
    return;
  }

  if (
    normalizedCandidate === "both" ||
    normalizedCandidate === "countable and uncountable" ||
    normalizedCandidate === "uncountable and countable" ||
    normalizedCandidate === "countable/uncountable" ||
    normalizedCandidate === "uncountable/countable"
  ) {
    values.add("countable");
    values.add("uncountable");
    return;
  }

  if (
    PASSIVE_VOCABULARY_NOUN_COUNTABILITY.includes(
      normalizedCandidate as PassiveVocabularyNounCountability,
    )
  ) {
    values.add(normalizedCandidate as PassiveVocabularyNounCountability);
  }
}

function normalizePassiveVocabularyNounCountability(
  value: unknown,
  flags?: {
    countable?: unknown;
    uncountable?: unknown;
  },
) {
  const values = new Set<PassiveVocabularyNounCountability>();

  if (Array.isArray(value)) {
    for (const entry of value) {
      addPassiveVocabularyNounCountabilityValue(values, entry);
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record.countable === true) {
      values.add("countable");
    }

    if (record.uncountable === true) {
      values.add("uncountable");
    }

    if (Array.isArray(record.values)) {
      for (const entry of record.values) {
        addPassiveVocabularyNounCountabilityValue(values, entry);
      }
    }
  } else {
    addPassiveVocabularyNounCountabilityValue(values, value);
  }

  if (flags?.countable === true) {
    values.add("countable");
  }

  if (flags?.uncountable === true) {
    values.add("uncountable");
  }

  return PASSIVE_VOCABULARY_NOUN_COUNTABILITY.filter((entry) =>
    values.has(entry),
  );
}

function normalizePassiveVocabularyManagedForms(
  value: unknown,
  canonicalTerm?: string | null,
) {
  const canonicalNormalizedTerm = normalizePassiveVocabularyText(
    canonicalTerm ?? "",
  );

  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const forms = new Map<string, string>();

  for (const form of value) {
    const normalizedFormText = normalizePassiveVocabularyAttributeText(form);
    const normalizedLookupForm = normalizePassiveVocabularyText(
      normalizedFormText ?? "",
    );

    if (
      !normalizedFormText ||
      !normalizedLookupForm ||
      normalizedLookupForm === canonicalNormalizedTerm
    ) {
      continue;
    }

    if (!forms.has(normalizedLookupForm)) {
      forms.set(normalizedLookupForm, normalizedFormText);
    }
  }

  return Array.from(forms.values());
}

function normalizePassiveVocabularyAttributeText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ");
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function normalizePassiveVocabularyLibraryAttributes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} satisfies PassiveVocabularyLibraryAttributes;
  }

  const attributes = {
    ...(value as Record<string, unknown>),
  } as PassiveVocabularyLibraryAttributes;
  const ukrainianTranslation = normalizePassiveVocabularyAttributeText(
    attributes.ukrainianTranslation ?? attributes.ukrainian_translation,
  );
  const englishDefinition = normalizePassiveVocabularyAttributeText(
    attributes.englishDefinition ?? attributes.english_definition,
  );
  const englishDefinitionsRaw =
    attributes.englishDefinitions ?? attributes.english_definitions;
  const englishDefinitions = Array.isArray(englishDefinitionsRaw)
    ? Array.from(
        new Set(
          englishDefinitionsRaw
            .map((definition) =>
              normalizePassiveVocabularyAttributeText(definition),
            )
            .filter((definition): definition is string => Boolean(definition)),
        ),
      ).slice(0, 5)
    : [];
  const transcription = normalizePassiveVocabularyAttributeText(
    attributes.transcription ?? attributes.ipa_transcription,
  );
  const americanTranscription = normalizePassiveVocabularyAttributeText(
    attributes.americanTranscription ??
      attributes.american_transcription ??
      attributes.transcriptionAmerican ??
      attributes.transcription_american,
  );
  const britishTranscription = normalizePassiveVocabularyAttributeText(
    attributes.britishTranscription ??
      attributes.british_transcription ??
      attributes.transcriptionBritish ??
      attributes.transcription_british,
  );
  const nounCountability = normalizePassiveVocabularyNounCountability(
    attributes.nounCountability ??
      attributes.noun_countability ??
      attributes.countability,
    {
      countable: attributes.countable,
      uncountable: attributes.uncountable,
    },
  );
  const forms = normalizePassiveVocabularyManagedForms(
    attributes.forms,
    typeof attributes.canonicalTerm === "string"
      ? attributes.canonicalTerm
      : null,
  );

  delete attributes.ukrainian_translation;
  delete attributes.english_definition;
  delete attributes.english_definitions;
  delete attributes.ipa_transcription;
  delete attributes.americanTranscription;
  delete attributes.american_transcription;
  delete attributes.transcriptionAmerican;
  delete attributes.transcription_american;
  delete attributes.britishTranscription;
  delete attributes.british_transcription;
  delete attributes.transcriptionBritish;
  delete attributes.transcription_british;
  delete attributes.noun_countability;
  delete attributes.countability;
  delete attributes.countable;
  delete attributes.uncountable;

  if (ukrainianTranslation) {
    attributes.ukrainianTranslation = ukrainianTranslation;
  } else {
    delete attributes.ukrainianTranslation;
  }

  if (englishDefinitions.length > 0) {
    attributes.englishDefinitions = englishDefinitions;
    attributes.englishDefinition = englishDefinitions[0] ?? null;
  } else if (englishDefinition) {
    attributes.englishDefinition = englishDefinition;
    delete attributes.englishDefinitions;
  } else {
    delete attributes.englishDefinition;
    delete attributes.englishDefinitions;
  }

  if (americanTranscription) {
    attributes.americanTranscription = americanTranscription;
  } else {
    delete attributes.americanTranscription;
  }

  if (britishTranscription) {
    attributes.britishTranscription = britishTranscription;
  } else {
    delete attributes.britishTranscription;
  }

  if (transcription && !americanTranscription && !britishTranscription) {
    attributes.transcription = transcription;
  } else {
    delete attributes.transcription;
  }

  if (nounCountability.length > 0) {
    attributes.nounCountability = nounCountability;
  } else {
    delete attributes.nounCountability;
  }

  if (forms.length > 0) {
    attributes.forms = forms;
  } else {
    delete attributes.forms;
  }

  return attributes;
}

export function getPassiveVocabularyUkrainianTranslation(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  return (
    normalizePassiveVocabularyLibraryAttributes(attributes)
      .ukrainianTranslation ?? null
  );
}

export function withPassiveVocabularyUkrainianTranslation(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  ukrainianTranslation?: string | null,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedTranslation =
    normalizePassiveVocabularyAttributeText(ukrainianTranslation);

  if (normalizedTranslation) {
    nextAttributes.ukrainianTranslation = normalizedTranslation;
  } else {
    delete nextAttributes.ukrainianTranslation;
  }

  return nextAttributes;
}

export function getPassiveVocabularyEnglishDefinitions(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  const normalizedAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);

  if (
    Array.isArray(normalizedAttributes.englishDefinitions) &&
    normalizedAttributes.englishDefinitions.length > 0
  ) {
    return normalizedAttributes.englishDefinitions;
  }

  if (normalizedAttributes.englishDefinition) {
    return [normalizedAttributes.englishDefinition];
  }

  return [] as string[];
}

export function withPassiveVocabularyEnglishDefinitions(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  englishDefinitions: string[] | null | undefined,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedDefinitions = Array.isArray(englishDefinitions)
    ? Array.from(
        new Set(
          englishDefinitions
            .map((definition) =>
              normalizePassiveVocabularyAttributeText(definition),
            )
            .filter((definition): definition is string => Boolean(definition)),
        ),
      ).slice(0, 5)
    : [];

  if (normalizedDefinitions.length > 0) {
    nextAttributes.englishDefinitions = normalizedDefinitions;
    nextAttributes.englishDefinition = normalizedDefinitions[0] ?? null;
  } else {
    delete nextAttributes.englishDefinitions;
    delete nextAttributes.englishDefinition;
  }

  return nextAttributes;
}

export function getPassiveVocabularyTranscription(
  attributes?: PassiveVocabularyLibraryAttributes | null,
  englishVariantPreference?: EnglishVariantPreference | null,
) {
  const transcriptions = getPassiveVocabularyTranscriptions(attributes);

  if (normalizeEnglishVariantPreference(englishVariantPreference) === "british") {
    return transcriptions.british ?? transcriptions.american;
  }

  return transcriptions.american ?? transcriptions.british;
}

export function getPassiveVocabularyTranscriptions(
  attributes?: PassiveVocabularyLibraryAttributes | null,
): PassiveVocabularyTranscriptions {
  const normalizedAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const fallbackTranscription = normalizedAttributes.transcription ?? null;

  return {
    american:
      normalizedAttributes.americanTranscription ?? fallbackTranscription,
    british:
      normalizedAttributes.britishTranscription ?? fallbackTranscription,
  };
}

export function withPassiveVocabularyTranscription(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  transcription?: string | null,
) {
  return withPassiveVocabularyTranscriptions(attributes, {
    american: transcription ?? null,
    british: transcription ?? null,
  });
}

export function withPassiveVocabularyTranscriptions(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  transcriptions?: PassiveVocabularyTranscriptions | null,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedAmericanTranscription = normalizePassiveVocabularyAttributeText(
    transcriptions?.american,
  );
  const normalizedBritishTranscription = normalizePassiveVocabularyAttributeText(
    transcriptions?.british,
  );

  if (normalizedAmericanTranscription) {
    nextAttributes.americanTranscription = normalizedAmericanTranscription;
  } else {
    delete nextAttributes.americanTranscription;
  }

  if (normalizedBritishTranscription) {
    nextAttributes.britishTranscription = normalizedBritishTranscription;
  } else {
    delete nextAttributes.britishTranscription;
  }

  delete nextAttributes.transcription;

  return nextAttributes;
}

export function getPassiveVocabularyNounCountability(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  return normalizePassiveVocabularyNounCountability(
    normalizePassiveVocabularyLibraryAttributes(attributes).nounCountability,
  );
}

export function withPassiveVocabularyNounCountability(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  nounCountability:
    | PassiveVocabularyNounCountability[]
    | null
    | undefined,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedNounCountability = normalizePassiveVocabularyNounCountability(
    nounCountability,
  );

  if (normalizedNounCountability.length > 0) {
    nextAttributes.nounCountability = normalizedNounCountability;
  } else {
    delete nextAttributes.nounCountability;
  }

  return nextAttributes;
}

export function getPassiveVocabularyForms(
  attributes?: PassiveVocabularyLibraryAttributes | null,
  canonicalTerm?: string | null,
) {
  return normalizePassiveVocabularyManagedForms(
    normalizePassiveVocabularyLibraryAttributes(attributes).forms,
    canonicalTerm,
  );
}

export function withPassiveVocabularyForms(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  forms: string[] | null | undefined,
  canonicalTerm?: string | null,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedForms = normalizePassiveVocabularyManagedForms(
    forms,
    canonicalTerm,
  );

  if (normalizedForms.length > 0) {
    nextAttributes.forms = normalizedForms;
  } else {
    delete nextAttributes.forms;
  }

  return nextAttributes;
}

export function getPassiveVocabularyCustomAttributes(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  const customAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  delete customAttributes.ukrainianTranslation;
  delete customAttributes.englishDefinition;
  delete customAttributes.englishDefinitions;
  delete customAttributes.transcription;
  delete customAttributes.americanTranscription;
  delete customAttributes.britishTranscription;
  delete customAttributes.nounCountability;
  delete customAttributes.forms;

  return customAttributes;
}

export function formatPassiveVocabularyPartOfSpeech(value?: string | null) {
  if (!value) {
    return "—";
  }

  return value
    .split(" ")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function inferPassiveVocabularyItemType(
  value: string,
): PassiveVocabularyItemType {
  return normalizePassiveVocabularyText(value).includes(" ")
    ? "phrase"
    : "word";
}

export const passiveVocabularyImportItemSchema = z.object({
  term: z.string().trim().min(1).max(200),
  definition: z.string().trim().max(400).optional(),
  itemType: z.enum(PASSIVE_VOCABULARY_ITEM_TYPES).default("word"),
});

export const passiveVocabularyImportSchema = z.object({
  studentId: z.string().uuid().optional(),
  sourceType: z.enum(PASSIVE_VOCABULARY_SOURCE_TYPES).default("full_text"),
  sourceLabel: z.string().trim().max(160).optional(),
  items: z.array(passiveVocabularyImportItemSchema).min(1).max(500),
});

export const passiveVocabularyLibraryImportSchema = z.object({
  targetLanguage: z.enum(["english", "spanish"]),
  sourceLabel: z.string().trim().max(160).optional(),
  items: z.array(passiveVocabularyImportItemSchema).min(1).max(500),
});

export interface PassiveVocabularyEvidenceRow {
  term: string;
  definition: string | null;
  item_type: PassiveVocabularyItemType;
  source_type: PassiveVocabularySourceType;
  source_label: string | null;
  import_count: number;
  last_imported_at: string;
  library_cefr_level?: PassiveVocabularyLibraryCefrLevel | null;
  library_part_of_speech?: PassiveVocabularyPartOfSpeech | null;
  library_attributes?: PassiveVocabularyLibraryAttributes | null;
}

export interface PassiveVocabularySampleItem {
  term: string;
  definition: string | null;
  itemType: PassiveVocabularyItemType;
  sourceType: PassiveVocabularySourceType;
  sourceLabel: string | null;
  importCount: number;
  lastImportedAt: string;
  libraryCefrLevel: PassiveVocabularyLibraryCefrLevel | null;
  partOfSpeech: PassiveVocabularyPartOfSpeech | null;
  recognitionWeight: number;
}

export interface PassiveVocabularySignalSummary {
  uniqueItems: number;
  wordCount: number;
  phraseCount: number;
  equivalentWordCount: number;
  rawEquivalentWordCount: number;
  cefrCounts: Record<PassiveVocabularyLibraryCefrLevel | "unknown", number>;
  sampleItems: PassiveVocabularySampleItem[];
}

export const PASSIVE_EQUIVALENT_WORDS_EXPLANATION =
  "Equivalent words is the recognition-weighted single-word total used by passive-vocabulary estimates. Words at or below the student's current level count fully. Higher-level words count partially until the learner's overall profile catches up.";

const PASSIVE_VOCABULARY_WORD_PATTERN =
  /[\p{L}\p{M}]+(?:[\u2019'’-][\p{L}\p{M}]+)*/gu;
const PASSIVE_VOCABULARY_CEFR_ORDER = new Map<
  PassiveVocabularyLibraryCefrLevel,
  number
>(PASSIVE_VOCABULARY_CEFR_LEVELS.map((level, index) => [level, index]));

function addPassiveVocabularyCandidate(
  candidates: string[],
  candidate: string | null,
) {
  if (!candidate) {
    return;
  }

  const normalizedCandidate = normalizePassiveVocabularyText(candidate);
  if (!normalizedCandidate || candidates.includes(normalizedCandidate)) {
    return;
  }

  candidates.push(normalizedCandidate);
}

const IRREGULAR_PASSIVE_VOCABULARY_FORM_MAP = new Map<string, string[]>([
  ["be", ["am", "is", "are", "was", "were", "been", "being"]],
  ["buy", ["bought", "buying"]],
  ["child", ["children"]],
  ["come", ["comes", "came", "coming"]],
  ["do", ["does", "did", "done", "doing"]],
  ["eat", ["eats", "ate", "eaten", "eating"]],
  ["foot", ["feet"]],
  ["get", ["gets", "got", "gotten", "getting"]],
  ["go", ["goes", "went", "gone", "going"]],
  ["goose", ["geese"]],
  ["have", ["has", "had", "having"]],
  ["knife", ["knives"]],
  ["leaf", ["leaves"]],
  ["life", ["lives"]],
  ["make", ["makes", "made", "making"]],
  ["man", ["men"]],
  ["mouse", ["mice"]],
  ["person", ["people"]],
  ["run", ["runs", "ran", "running"]],
  ["say", ["says", "said", "saying"]],
  ["see", ["sees", "saw", "seen", "seeing"]],
  ["take", ["takes", "took", "taken", "taking"]],
  ["teach", ["teaches", "taught", "teaching"]],
  ["teeth", ["tooth"]],
  ["tooth", ["teeth"]],
  ["wife", ["wives"]],
  ["woman", ["women"]],
  ["write", ["writes", "wrote", "written", "writing"]],
]);

const SUBJECT_PRONOUN_FORM_MAP = new Map<
  string,
  {
    objectPronoun: string | null;
    possessiveAdjective: string | null;
    possessivePronoun: string | null;
    reflexivePronoun: string | null;
  }
>([
  [
    "i",
    {
      objectPronoun: "me",
      possessiveAdjective: "my",
      possessivePronoun: "mine",
      reflexivePronoun: "myself",
    },
  ],
  [
    "you",
    {
      objectPronoun: "you",
      possessiveAdjective: "your",
      possessivePronoun: "yours",
      reflexivePronoun: "yourself",
    },
  ],
  [
    "he",
    {
      objectPronoun: "him",
      possessiveAdjective: "his",
      possessivePronoun: "his",
      reflexivePronoun: "himself",
    },
  ],
  [
    "she",
    {
      objectPronoun: "her",
      possessiveAdjective: "her",
      possessivePronoun: "hers",
      reflexivePronoun: "herself",
    },
  ],
  [
    "it",
    {
      objectPronoun: "it",
      possessiveAdjective: "its",
      possessivePronoun: "its",
      reflexivePronoun: "itself",
    },
  ],
  [
    "we",
    {
      objectPronoun: "us",
      possessiveAdjective: "our",
      possessivePronoun: "ours",
      reflexivePronoun: "ourselves",
    },
  ],
  [
    "they",
    {
      objectPronoun: "them",
      possessiveAdjective: "their",
      possessivePronoun: "theirs",
      reflexivePronoun: "themselves",
    },
  ],
]);

const IRREGULAR_ADJECTIVE_FORM_MAP = new Map<
  string,
  {
    comparative: string | null;
    superlative: string | null;
  }
>([
  [
    "bad",
    {
      comparative: "worse",
      superlative: "worst",
    },
  ],
  [
    "far",
    {
      comparative: "farther",
      superlative: "farthest",
    },
  ],
  [
    "good",
    {
      comparative: "better",
      superlative: "best",
    },
  ],
]);

const PASSIVE_VOCABULARY_EDITABLE_FORM_ORDER = [
  "plural",
  "pastSimple",
  "pastParticiple",
  "gerund",
  "thirdPersonSingular",
  "comparative",
  "superlative",
  "objectPronoun",
  "possessiveAdjective",
  "possessivePronoun",
  "reflexivePronoun",
] as const satisfies readonly (keyof PassiveVocabularyEditableFormValues)[];

function endsWithConsonantY(value: string) {
  return /[^aeiou]y$/.test(value);
}

function buildRegularPluralForm(value: string) {
  if (endsWithConsonantY(value)) {
    return `${value.slice(0, -1)}ies`;
  }

  if (/(s|x|z|ch|sh|o)$/.test(value)) {
    return `${value}es`;
  }

  return `${value}s`;
}

function buildRegularThirdPersonSingularForm(value: string) {
  return buildRegularPluralForm(value);
}

function buildRegularPastForms(value: string) {
  const forms: string[] = [];

  if (endsWithConsonantY(value)) {
    addPassiveVocabularyCandidate(forms, `${value.slice(0, -1)}ied`);
    return forms;
  }

  if (value.endsWith("e")) {
    addPassiveVocabularyCandidate(forms, `${value}d`);
    return forms;
  }

  addPassiveVocabularyCandidate(forms, `${value}ed`);
  return forms;
}

function buildRegularIngForms(value: string) {
  const forms: string[] = [];

  if (value.endsWith("ie")) {
    addPassiveVocabularyCandidate(forms, `${value.slice(0, -2)}ying`);
    return forms;
  }

  if (value.endsWith("e") && !value.endsWith("ee")) {
    addPassiveVocabularyCandidate(forms, `${value.slice(0, -1)}ing`);
    return forms;
  }

  addPassiveVocabularyCandidate(forms, `${value}ing`);
  return forms;
}

function hasShortAdjectiveConsonantVowelConsonantEnding(value: string) {
  return /[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvz]$/.test(value);
}

function canAutoGenerateRegularAdjectiveForms(value: string) {
  return (
    value.length <= 5 ||
    endsWithConsonantY(value) ||
    value.endsWith("e")
  );
}

function buildRegularAdjectiveComparativeForm(value: string) {
  if (!canAutoGenerateRegularAdjectiveForms(value)) {
    return null;
  }

  if (endsWithConsonantY(value)) {
    return `${value.slice(0, -1)}ier`;
  }

  if (value.endsWith("e")) {
    return `${value}r`;
  }

  if (hasShortAdjectiveConsonantVowelConsonantEnding(value)) {
    const finalCharacter = value.slice(-1);
    return `${value}${finalCharacter}er`;
  }

  return `${value}er`;
}

function buildRegularAdjectiveSuperlativeForm(value: string) {
  if (!canAutoGenerateRegularAdjectiveForms(value)) {
    return null;
  }

  if (endsWithConsonantY(value)) {
    return `${value.slice(0, -1)}iest`;
  }

  if (value.endsWith("e")) {
    return `${value}st`;
  }

  if (hasShortAdjectiveConsonantVowelConsonantEnding(value)) {
    const finalCharacter = value.slice(-1);
    return `${value}${finalCharacter}est`;
  }

  return `${value}est`;
}

function createEmptyPassiveVocabularyEditableFormValues(): PassiveVocabularyEditableFormValues {
  return {
    plural: null,
    pastSimple: null,
    pastParticiple: null,
    gerund: null,
    thirdPersonSingular: null,
    comparative: null,
    superlative: null,
    objectPronoun: null,
    possessiveAdjective: null,
    possessivePronoun: null,
    reflexivePronoun: null,
  };
}

function getPassiveVocabularyUniqueForms(
  values: PassiveVocabularyEditableFormValues,
  canonicalTerm?: string | null,
) {
  const normalizedCanonicalTerm = normalizePassiveVocabularyText(
    canonicalTerm ?? "",
  );
  const forms: string[] = [];

  for (const key of PASSIVE_VOCABULARY_EDITABLE_FORM_ORDER) {
    const value = values[key];
    const normalizedValue = normalizePassiveVocabularyText(value ?? "");

    if (
      !value ||
      !normalizedValue ||
      normalizedValue === normalizedCanonicalTerm ||
      forms.some(
        (existingValue) =>
          normalizePassiveVocabularyText(existingValue) === normalizedValue,
      )
    ) {
      continue;
    }

    forms.push(value);
  }

  return forms;
}

export function getPassiveVocabularyEditableFormValues(
  value: string,
  partOfSpeech?: PassiveVocabularyPartOfSpeech | null,
  explicitForms?: string[] | null,
): PassiveVocabularyEditableFormValues {
  const headword = getPassiveVocabularyCanonicalHeadword(value, partOfSpeech);
  const normalizedText = normalizePassiveVocabularyText(headword);
  const normalizedExplicitForms = normalizePassiveVocabularyManagedForms(
    explicitForms,
    headword,
  );
  const emptyValues = createEmptyPassiveVocabularyEditableFormValues();

  if (!normalizedText || normalizedText.includes(" ")) {
    return emptyValues;
  }

  if (partOfSpeech === "noun") {
    const irregularVariants =
      IRREGULAR_PASSIVE_VOCABULARY_FORM_MAP.get(normalizedText) ?? [];
    const suggestedPlural =
      irregularVariants[0] ?? buildRegularPluralForm(normalizedText);
    const explicitPlural = normalizedExplicitForms.find(
      (form) =>
        normalizePassiveVocabularyText(form) ===
        normalizePassiveVocabularyText(suggestedPlural),
    );

    return {
      ...emptyValues,
      plural: explicitPlural ?? normalizedExplicitForms[0] ?? suggestedPlural,
    };
  }

  if (partOfSpeech === "pronoun") {
    const suggestedPronounForms = SUBJECT_PRONOUN_FORM_MAP.get(normalizedText) ?? {
      objectPronoun: null,
      possessiveAdjective: null,
      possessivePronoun: null,
      reflexivePronoun: null,
    };
    const remainingExplicitForms = [...normalizedExplicitForms];
    const takeExplicitForm = (preferredValue: string | null) => {
      if (preferredValue) {
        const preferredIndex = remainingExplicitForms.findIndex(
          (form) =>
            normalizePassiveVocabularyText(form) ===
            normalizePassiveVocabularyText(preferredValue),
        );

        if (preferredIndex >= 0) {
          return remainingExplicitForms.splice(preferredIndex, 1)[0] ?? null;
        }
      }

      return remainingExplicitForms.shift() ?? null;
    };

    return {
      ...emptyValues,
      objectPronoun:
        takeExplicitForm(suggestedPronounForms.objectPronoun) ??
        suggestedPronounForms.objectPronoun,
      possessiveAdjective:
        takeExplicitForm(suggestedPronounForms.possessiveAdjective) ??
        suggestedPronounForms.possessiveAdjective,
      possessivePronoun:
        takeExplicitForm(suggestedPronounForms.possessivePronoun) ??
        suggestedPronounForms.possessivePronoun,
      reflexivePronoun:
        takeExplicitForm(suggestedPronounForms.reflexivePronoun) ??
        suggestedPronounForms.reflexivePronoun,
    };
  }

  if (partOfSpeech === "adjective") {
    const suggestedAdjectiveForms =
      IRREGULAR_ADJECTIVE_FORM_MAP.get(normalizedText) ?? {
        comparative: buildRegularAdjectiveComparativeForm(normalizedText),
        superlative: buildRegularAdjectiveSuperlativeForm(normalizedText),
      };
    const remainingExplicitForms = [...normalizedExplicitForms];
    const takeExplicitForm = (preferredValue: string | null) => {
      if (preferredValue) {
        const preferredIndex = remainingExplicitForms.findIndex(
          (form) =>
            normalizePassiveVocabularyText(form) ===
            normalizePassiveVocabularyText(preferredValue),
        );

        if (preferredIndex >= 0) {
          return remainingExplicitForms.splice(preferredIndex, 1)[0] ?? null;
        }
      }

      return remainingExplicitForms.shift() ?? null;
    };

    return {
      ...emptyValues,
      comparative:
        takeExplicitForm(suggestedAdjectiveForms.comparative) ??
        suggestedAdjectiveForms.comparative,
      superlative:
        takeExplicitForm(suggestedAdjectiveForms.superlative) ??
        suggestedAdjectiveForms.superlative,
    };
  }

  if (partOfSpeech !== "verb") {
    return emptyValues;
  }

  const irregularVariants =
    IRREGULAR_PASSIVE_VOCABULARY_FORM_MAP.get(normalizedText) ?? [];
  const regularThirdPersonSingular =
    buildRegularThirdPersonSingularForm(normalizedText);
  const regularPast = buildRegularPastForms(normalizedText)[0] ?? null;
  const regularGerund = buildRegularIngForms(normalizedText)[0] ?? null;
  const suggestedThirdPersonSingular =
    irregularVariants.find(
      (form) => normalizePassiveVocabularyText(form) === regularThirdPersonSingular,
    ) ?? regularThirdPersonSingular;
  const suggestedGerund =
    irregularVariants.find((form) => /ing$/.test(normalizePassiveVocabularyText(form))) ??
    regularGerund;
  const remainingIrregularForms = irregularVariants.filter((form) => {
    const normalizedForm = normalizePassiveVocabularyText(form);
    return (
      normalizedForm !== normalizePassiveVocabularyText(suggestedThirdPersonSingular) &&
      normalizedForm !== normalizePassiveVocabularyText(suggestedGerund ?? "")
    );
  });
  const suggestedPastSimple = remainingIrregularForms[0] ?? regularPast;
  const suggestedPastParticiple =
    remainingIrregularForms[1] ??
    (remainingIrregularForms.length === 1 ? remainingIrregularForms[0] : regularPast);

  const remainingExplicitForms = [...normalizedExplicitForms];
  const takeExplicitForm = (
    preferredValue: string | null,
    predicate?: (form: string) => boolean,
  ) => {
    if (preferredValue) {
      const preferredIndex = remainingExplicitForms.findIndex(
        (form) =>
          normalizePassiveVocabularyText(form) ===
          normalizePassiveVocabularyText(preferredValue),
      );

      if (preferredIndex >= 0) {
        return remainingExplicitForms.splice(preferredIndex, 1)[0] ?? null;
      }
    }

    if (predicate) {
      const matchedIndex = remainingExplicitForms.findIndex(predicate);

      if (matchedIndex >= 0) {
        return remainingExplicitForms.splice(matchedIndex, 1)[0] ?? null;
      }
    }

    return null;
  };

  const thirdPersonSingular =
    takeExplicitForm(suggestedThirdPersonSingular, (form) => {
      const normalizedForm = normalizePassiveVocabularyText(form);
      return normalizedForm === regularThirdPersonSingular;
    }) ?? suggestedThirdPersonSingular;
  const gerund =
    takeExplicitForm(suggestedGerund, (form) =>
      /ing$/.test(normalizePassiveVocabularyText(form)),
    ) ?? suggestedGerund;
  const pastSimple =
    takeExplicitForm(suggestedPastSimple) ??
    remainingExplicitForms.shift() ??
    suggestedPastSimple;
  const pastParticiple =
    takeExplicitForm(suggestedPastParticiple) ??
    remainingExplicitForms.shift() ??
    (pastSimple &&
    suggestedPastSimple &&
    suggestedPastParticiple &&
    normalizePassiveVocabularyText(suggestedPastSimple) ===
      normalizePassiveVocabularyText(suggestedPastParticiple)
      ? pastSimple
      : suggestedPastParticiple);

  return {
    ...emptyValues,
    pastSimple,
    pastParticiple,
    gerund,
    thirdPersonSingular,
  };
}

export function getPassiveVocabularyEditableForms(
  value: string,
  partOfSpeech?: PassiveVocabularyPartOfSpeech | null,
  explicitForms?: string[] | null,
) {
  return getPassiveVocabularyUniqueForms(
    getPassiveVocabularyEditableFormValues(value, partOfSpeech, explicitForms),
    value,
  );
}

export function getPassiveVocabularyGeneratedForms(
  value: string,
  partOfSpeech?: PassiveVocabularyPartOfSpeech | null,
) {
  return getPassiveVocabularyEditableForms(
    value,
    partOfSpeech,
  );
}

function createPassiveVocabularyCefrCounts() {
  return {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
    C2: 0,
    unknown: 0,
  } satisfies Record<PassiveVocabularyLibraryCefrLevel | "unknown", number>;
}

function roundRecognitionWeight(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizePassiveVocabularyText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getPassiveVocabularyIndefiniteArticle(value: string) {
  return /^[aeiou]/i.test(value.trim()) ? "an" : "a";
}

export function getPassiveVocabularyCanonicalHeadword(
  value: string,
  partOfSpeech?: PassiveVocabularyPartOfSpeech | null,
) {
  const normalizedValue = value.trim().replace(/\s+/g, " ");
  const normalizedLookupValue = normalizePassiveVocabularyText(normalizedValue);

  if (!normalizedLookupValue) {
    return "";
  }

  if (partOfSpeech === "verb" && normalizedLookupValue.startsWith("to ")) {
    return normalizedValue.slice(3).trim();
  }

  if (
    partOfSpeech === "noun" &&
    (normalizedLookupValue.startsWith("a ") || normalizedLookupValue.startsWith("an "))
  ) {
    return normalizedLookupValue.startsWith("an ")
      ? normalizedValue.slice(3).trim()
      : normalizedValue.slice(2).trim();
  }

  return normalizedValue;
}

export function formatPassiveVocabularyCanonicalTerm(
  value: string,
  partOfSpeech?: PassiveVocabularyPartOfSpeech | null,
  nounCountability?: PassiveVocabularyNounCountability[] | null,
) {
  const headword = getPassiveVocabularyCanonicalHeadword(value, partOfSpeech);

  if (!headword) {
    return "";
  }

  if (partOfSpeech === "verb") {
    return `to ${headword}`;
  }

  if (partOfSpeech === "noun" && nounCountability?.includes("countable")) {
    return `${getPassiveVocabularyIndefiniteArticle(headword)} ${headword}`;
  }

  return headword;
}

export function getPassiveVocabularyLookupCandidates(
  value: string,
  itemType: PassiveVocabularyItemType,
  partOfSpeech?: PassiveVocabularyPartOfSpeech | null,
) {
  const headword = getPassiveVocabularyCanonicalHeadword(value, partOfSpeech);
  const normalizedHeadword = normalizePassiveVocabularyText(headword);

  if (!normalizedHeadword) {
    return [];
  }

  const candidates: string[] = [];
  const addCandidate = (candidate: string) => {
    const normalizedCandidate = normalizePassiveVocabularyText(candidate);

    if (!normalizedCandidate || candidates.includes(normalizedCandidate)) {
      return;
    }

    candidates.push(normalizedCandidate);
  };

  if (itemType === "word") {
    if (partOfSpeech === "verb") {
      addCandidate(formatPassiveVocabularyCanonicalTerm(headword, "verb"));
    }

    if (partOfSpeech === "noun") {
      addCandidate(`a ${headword}`);
      addCandidate(`an ${headword}`);
    }
  }

  addCandidate(headword);

  return itemType === "word" && !normalizedHeadword.includes(" ")
    ? candidates
    : candidates;
}

export function extractPassiveVocabularyTermsFromText(text: string) {
  const uniqueTerms = new Map<string, string>();

  for (const normalizedTerm of extractPassiveVocabularyTermOccurrencesFromText(
    text,
  )) {
    if (!uniqueTerms.has(normalizedTerm)) {
      uniqueTerms.set(normalizedTerm, normalizedTerm);
    }
  }

  return Array.from(uniqueTerms.values()).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

export function extractPassiveVocabularyTermOccurrencesFromText(text: string) {
  const matches = text.match(PASSIVE_VOCABULARY_WORD_PATTERN) ?? [];
  const occurrences: string[] = [];

  for (const match of matches) {
    const normalizedTerm = normalizePassiveVocabularyText(match);

    if (!normalizedTerm) {
      continue;
    }

    occurrences.push(normalizedTerm);
  }

  return occurrences;
}

export function getPassiveVocabularyCompositeKey(
  normalizedText: string,
  itemType: PassiveVocabularyItemType,
) {
  return `${itemType}:${normalizedText}`;
}

export function getPassiveVocabularyEquivalentWeight(
  itemType: PassiveVocabularyItemType,
  options?: {
    libraryCefrLevel?: PassiveVocabularyLibraryCefrLevel | null;
    studentCefrLevel?: CEFRLevel | null;
  },
) {
  if (itemType === "phrase") {
    return 1;
  }

  const studentLevel = options?.studentCefrLevel;
  const libraryLevel = options?.libraryCefrLevel;

  if (!studentLevel || !libraryLevel) {
    return 1;
  }

  const studentIndex = PASSIVE_VOCABULARY_CEFR_ORDER.get(studentLevel);
  const libraryIndex = PASSIVE_VOCABULARY_CEFR_ORDER.get(libraryLevel);

  if (studentIndex == null || libraryIndex == null) {
    return 1;
  }

  const levelDistance = libraryIndex - studentIndex;

  if (levelDistance <= 0) {
    return 1;
  }

  if (levelDistance === 1) {
    return 0.75;
  }

  if (levelDistance === 2) {
    return 0.45;
  }

  return 0.2;
}

export function summarizePassiveVocabularyEvidence(
  rows: PassiveVocabularyEvidenceRow[],
  studentCefrLevel?: CEFRLevel | null,
  sampleLimit = 30,
): PassiveVocabularySignalSummary {
  const wordCount = rows.filter((row) => row.item_type === "word").length;
  const phraseCount = rows.length - wordCount;
  const rawEquivalentWordCount = Math.round(
    rows.reduce(
      (sum, row) =>
        sum +
        getPassiveVocabularyEquivalentWeight(row.item_type, {
          studentCefrLevel: null,
        }),
      0,
    ),
  );
  const cefrCounts = createPassiveVocabularyCefrCounts();
  const equivalentWordCount = Math.round(
    rows.reduce((sum, row) => {
      const libraryLevel = row.library_cefr_level ?? null;
      const recognitionWeight = getPassiveVocabularyEquivalentWeight(
        row.item_type,
        {
          libraryCefrLevel: libraryLevel,
          studentCefrLevel,
        },
      );

      if (libraryLevel) {
        cefrCounts[libraryLevel] += 1;
      } else {
        cefrCounts.unknown += 1;
      }

      return sum + recognitionWeight;
    }, 0),
  );

  return {
    uniqueItems: rows.length,
    wordCount,
    phraseCount,
    equivalentWordCount,
    rawEquivalentWordCount,
    cefrCounts,
    sampleItems: rows.slice(0, sampleLimit).map((row) => ({
      term: row.term,
      definition: row.definition,
      itemType: row.item_type,
      sourceType: row.source_type,
      sourceLabel: row.source_label,
      importCount: row.import_count,
      lastImportedAt: row.last_imported_at,
      libraryCefrLevel: row.library_cefr_level ?? null,
      partOfSpeech: row.library_part_of_speech ?? null,
      recognitionWeight: roundRecognitionWeight(
        getPassiveVocabularyEquivalentWeight(row.item_type, {
          libraryCefrLevel: row.library_cefr_level ?? null,
          studentCefrLevel,
        }),
      ),
    })),
  };
}
