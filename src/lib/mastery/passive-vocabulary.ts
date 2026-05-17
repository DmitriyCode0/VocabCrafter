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
export const PASSIVE_VOCABULARY_VERB_TRANSITIVITY = [
  "transitive",
  "intransitive",
] as const;
export const PASSIVE_VOCABULARY_VERB_FOLLOWED_BY = [
  "on",
  "at",
  "of",
  "for",
  "with",
  "in",
  "to",
  "about",
  "from",
  "by",
] as const;
export const PASSIVE_VOCABULARY_FOLLOWED_BY =
  PASSIVE_VOCABULARY_VERB_FOLLOWED_BY;
export const PASSIVE_VOCABULARY_VERB_REGULARITY = [
  "regular",
  "irregular",
] as const;
export const PASSIVE_VOCABULARY_VERB_STATE = ["state", "dynamic"] as const;
export const PASSIVE_VOCABULARY_VERB_PATTERN = [
  "v-ing",
  "to-v",
  "v",
  "not followed",
] as const;
export const PASSIVE_VOCABULARY_ADJECTIVE_GRADABILITY = [
  "gradable",
  "non-gradable",
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
export type PassiveVocabularyVerbTransitivity =
  (typeof PASSIVE_VOCABULARY_VERB_TRANSITIVITY)[number];
export type PassiveVocabularyVerbFollowedBy =
  (typeof PASSIVE_VOCABULARY_VERB_FOLLOWED_BY)[number];
export type PassiveVocabularyFollowedBy = PassiveVocabularyVerbFollowedBy;
export type PassiveVocabularyVerbRegularity =
  (typeof PASSIVE_VOCABULARY_VERB_REGULARITY)[number];
export type PassiveVocabularyVerbState =
  (typeof PASSIVE_VOCABULARY_VERB_STATE)[number];
export type PassiveVocabularyVerbPattern =
  (typeof PASSIVE_VOCABULARY_VERB_PATTERN)[number];
export type PassiveVocabularyAdjectiveGradability =
  (typeof PASSIVE_VOCABULARY_ADJECTIVE_GRADABILITY)[number];

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
  ukrainianSearchForms?: string[];
  englishDefinition?: string | null;
  englishDefinitions?: string[];
  transcription?: string | null;
  americanTranscription?: string | null;
  britishTranscription?: string | null;
  nounCountability?: PassiveVocabularyNounCountability[];
  verbTransitivity?: PassiveVocabularyVerbTransitivity[];
  followedBy?: PassiveVocabularyVerbFollowedBy[];
  verbRegularity?: PassiveVocabularyVerbRegularity[];
  verbState?: PassiveVocabularyVerbState[];
  verbPattern?: PassiveVocabularyVerbPattern[];
  adjectiveGradability?: PassiveVocabularyAdjectiveGradability[];
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

function addPassiveVocabularyVerbTransitivityValue(
  values: Set<PassiveVocabularyVerbTransitivity>,
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
    normalizedCandidate === "transitive and intransitive" ||
    normalizedCandidate === "intransitive and transitive" ||
    normalizedCandidate === "transative and intransitive" ||
    normalizedCandidate === "intransitive and transative" ||
    normalizedCandidate === "transitive/intransitive" ||
    normalizedCandidate === "intransitive/transitive" ||
    normalizedCandidate === "transative/intransitive" ||
    normalizedCandidate === "intransitive/transative"
  ) {
    values.add("transitive");
    values.add("intransitive");
    return;
  }

  if (normalizedCandidate === "transative") {
    values.add("transitive");
    return;
  }

  if (
    PASSIVE_VOCABULARY_VERB_TRANSITIVITY.includes(
      normalizedCandidate as PassiveVocabularyVerbTransitivity,
    )
  ) {
    values.add(normalizedCandidate as PassiveVocabularyVerbTransitivity);
  }
}

function normalizePassiveVocabularyVerbTransitivity(
  value: unknown,
  flags?: {
    transitive?: unknown;
    transative?: unknown;
    intransitive?: unknown;
  },
) {
  const values = new Set<PassiveVocabularyVerbTransitivity>();

  if (Array.isArray(value)) {
    for (const entry of value) {
      addPassiveVocabularyVerbTransitivityValue(values, entry);
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record.transitive === true || record.transative === true) {
      values.add("transitive");
    }

    if (record.intransitive === true) {
      values.add("intransitive");
    }

    if (Array.isArray(record.values)) {
      for (const entry of record.values) {
        addPassiveVocabularyVerbTransitivityValue(values, entry);
      }
    }
  } else {
    addPassiveVocabularyVerbTransitivityValue(values, value);
  }

  if (flags?.transitive === true || flags?.transative === true) {
    values.add("transitive");
  }

  if (flags?.intransitive === true) {
    values.add("intransitive");
  }

  return PASSIVE_VOCABULARY_VERB_TRANSITIVITY.filter((entry) =>
    values.has(entry),
  );
}

function addPassiveVocabularyVerbFollowedByValue(
  values: Set<PassiveVocabularyVerbFollowedBy>,
  candidate: unknown,
) {
  const normalizedCandidate = normalizePassiveVocabularyText(
    String(candidate ?? ""),
  );

  if (!normalizedCandidate) {
    return;
  }

  const tokens = normalizedCandidate
    .split(/\s*(?:,|\/|;| and )\s*/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens.length > 0 ? tokens : [normalizedCandidate]) {
    const normalizedToken = token.replace(/^\.+|\.+$/g, "");

    if (
      PASSIVE_VOCABULARY_VERB_FOLLOWED_BY.includes(
        normalizedToken as PassiveVocabularyVerbFollowedBy,
      )
    ) {
      values.add(normalizedToken as PassiveVocabularyVerbFollowedBy);
    }
  }
}

function normalizePassiveVocabularyVerbFollowedBy(
  value: unknown,
  flags?: Partial<Record<PassiveVocabularyVerbFollowedBy, unknown>>,
) {
  const values = new Set<PassiveVocabularyVerbFollowedBy>();

  if (Array.isArray(value)) {
    for (const entry of value) {
      addPassiveVocabularyVerbFollowedByValue(values, entry);
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const option of PASSIVE_VOCABULARY_VERB_FOLLOWED_BY) {
      if (record[option] === true) {
        values.add(option);
      }
    }

    if (Array.isArray(record.values)) {
      for (const entry of record.values) {
        addPassiveVocabularyVerbFollowedByValue(values, entry);
      }
    }
  } else {
    addPassiveVocabularyVerbFollowedByValue(values, value);
  }

  for (const option of PASSIVE_VOCABULARY_VERB_FOLLOWED_BY) {
    if (flags?.[option] === true) {
      values.add(option);
    }
  }

  return PASSIVE_VOCABULARY_VERB_FOLLOWED_BY.filter((entry) =>
    values.has(entry),
  );
}

function addPassiveVocabularyVerbRegularityValue(
  values: Set<PassiveVocabularyVerbRegularity>,
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
    normalizedCandidate === "regular and irregular" ||
    normalizedCandidate === "irregular and regular" ||
    normalizedCandidate === "regular/irregular" ||
    normalizedCandidate === "irregular/regular"
  ) {
    values.add("regular");
    values.add("irregular");
    return;
  }

  if (
    PASSIVE_VOCABULARY_VERB_REGULARITY.includes(
      normalizedCandidate as PassiveVocabularyVerbRegularity,
    )
  ) {
    values.add(normalizedCandidate as PassiveVocabularyVerbRegularity);
  }
}

function normalizePassiveVocabularyVerbRegularity(
  value: unknown,
  flags?: {
    regular?: unknown;
    irregular?: unknown;
  },
) {
  const values = new Set<PassiveVocabularyVerbRegularity>();

  if (Array.isArray(value)) {
    for (const entry of value) {
      addPassiveVocabularyVerbRegularityValue(values, entry);
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record.regular === true) {
      values.add("regular");
    }

    if (record.irregular === true) {
      values.add("irregular");
    }

    if (Array.isArray(record.values)) {
      for (const entry of record.values) {
        addPassiveVocabularyVerbRegularityValue(values, entry);
      }
    }
  } else {
    addPassiveVocabularyVerbRegularityValue(values, value);
  }

  if (flags?.regular === true) {
    values.add("regular");
  }

  if (flags?.irregular === true) {
    values.add("irregular");
  }

  return PASSIVE_VOCABULARY_VERB_REGULARITY.filter((entry) =>
    values.has(entry),
  );
}

function addPassiveVocabularyVerbStateValue(
  values: Set<PassiveVocabularyVerbState>,
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
    normalizedCandidate === "state and dynamic" ||
    normalizedCandidate === "dynamic and state" ||
    normalizedCandidate === "stative and dynamic" ||
    normalizedCandidate === "dynamic and stative" ||
    normalizedCandidate === "state/dynamic" ||
    normalizedCandidate === "dynamic/state" ||
    normalizedCandidate === "stative/dynamic" ||
    normalizedCandidate === "dynamic/stative"
  ) {
    values.add("state");
    values.add("dynamic");
    return;
  }

  if (normalizedCandidate === "stative") {
    values.add("state");
    return;
  }

  if (
    PASSIVE_VOCABULARY_VERB_STATE.includes(
      normalizedCandidate as PassiveVocabularyVerbState,
    )
  ) {
    values.add(normalizedCandidate as PassiveVocabularyVerbState);
  }
}

function normalizePassiveVocabularyVerbState(
  value: unknown,
  flags?: {
    state?: unknown;
    stative?: unknown;
    dynamic?: unknown;
  },
) {
  const values = new Set<PassiveVocabularyVerbState>();

  if (Array.isArray(value)) {
    for (const entry of value) {
      addPassiveVocabularyVerbStateValue(values, entry);
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record.state === true || record.stative === true) {
      values.add("state");
    }

    if (record.dynamic === true) {
      values.add("dynamic");
    }

    if (Array.isArray(record.values)) {
      for (const entry of record.values) {
        addPassiveVocabularyVerbStateValue(values, entry);
      }
    }
  } else {
    addPassiveVocabularyVerbStateValue(values, value);
  }

  if (flags?.state === true || flags?.stative === true) {
    values.add("state");
  }

  if (flags?.dynamic === true) {
    values.add("dynamic");
  }

  return PASSIVE_VOCABULARY_VERB_STATE.filter((entry) => values.has(entry));
}

function addPassiveVocabularyVerbPatternValue(
  values: Set<PassiveVocabularyVerbPattern>,
  candidate: unknown,
) {
  const normalizedCandidate = normalizePassiveVocabularyText(
    String(candidate ?? ""),
  );

  if (!normalizedCandidate) {
    return;
  }

  const normalizedValues = new Set<PassiveVocabularyVerbPattern>();

  if (normalizedCandidate === "both") {
    normalizedValues.add("v-ing");
    normalizedValues.add("to-v");
  } else {
    for (const token of normalizedCandidate.split(/\s*(?:\/|,| and )\s*/)) {
      if (!token) {
        continue;
      }

      if (
        token === "v ing" ||
        token === "verb ing" ||
        token === "-ing" ||
        token === "ing" ||
        token === "gerund"
      ) {
        normalizedValues.add("v-ing");
        continue;
      }

      if (
        token === "to v" ||
        token === "to+v" ||
        token === "to verb" ||
        token === "to infinitive" ||
        token === "to-infinitive" ||
        token === "infinitive" ||
        token === "to + infinitive"
      ) {
        normalizedValues.add("to-v");
        continue;
      }

      if (
        token === "v" ||
        token === "bare infinitive" ||
        token === "bare-infinitive" ||
        token === "bare verb" ||
        token === "base verb" ||
        token === "base form" ||
        token === "infinitive without to"
      ) {
        normalizedValues.add("v");
        continue;
      }

      if (
        token === "not followed" ||
        token === "not followed by verb" ||
        token === "not followed by a verb" ||
        token === "not followed by another verb" ||
        token === "no following verb" ||
        token === "no verb complement" ||
        token === "none"
      ) {
        normalizedValues.add("not followed");
        continue;
      }

      if (
        PASSIVE_VOCABULARY_VERB_PATTERN.includes(
          token as PassiveVocabularyVerbPattern,
        )
      ) {
        normalizedValues.add(token as PassiveVocabularyVerbPattern);
      }
    }
  }

  for (const normalizedValue of normalizedValues) {
    values.add(normalizedValue);
  }
}

function normalizePassiveVocabularyVerbPattern(
  value: unknown,
  flags?: {
    gerund?: unknown;
    ing?: unknown;
    vIng?: unknown;
    toV?: unknown;
    infinitive?: unknown;
    toInfinitive?: unknown;
    v?: unknown;
    bareInfinitive?: unknown;
    notFollowed?: unknown;
    not_followed?: unknown;
  },
) {
  const values = new Set<PassiveVocabularyVerbPattern>();

  if (Array.isArray(value)) {
    for (const entry of value) {
      addPassiveVocabularyVerbPatternValue(values, entry);
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record.gerund === true || record.ing === true || record.vIng === true) {
      values.add("v-ing");
    }

    if (
      record.toV === true ||
      record.infinitive === true ||
      record.toInfinitive === true
    ) {
      values.add("to-v");
    }

    if (record.v === true || record.bareInfinitive === true) {
      values.add("v");
    }

    if (record.notFollowed === true || record.not_followed === true) {
      values.add("not followed");
    }

    if (Array.isArray(record.values)) {
      for (const entry of record.values) {
        addPassiveVocabularyVerbPatternValue(values, entry);
      }
    }
  } else {
    addPassiveVocabularyVerbPatternValue(values, value);
  }

  if (flags?.gerund === true || flags?.ing === true || flags?.vIng === true) {
    values.add("v-ing");
  }

  if (
    flags?.toV === true ||
    flags?.infinitive === true ||
    flags?.toInfinitive === true
  ) {
    values.add("to-v");
  }

  if (flags?.v === true || flags?.bareInfinitive === true) {
    values.add("v");
  }

  if (flags?.notFollowed === true || flags?.not_followed === true) {
    values.add("not followed");
  }

  return PASSIVE_VOCABULARY_VERB_PATTERN.filter((entry) => values.has(entry));
}

function addPassiveVocabularyAdjectiveGradabilityValue(
  values: Set<PassiveVocabularyAdjectiveGradability>,
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
    normalizedCandidate === "gradable and non-gradable" ||
    normalizedCandidate === "non-gradable and gradable" ||
    normalizedCandidate === "gradable and non gradable" ||
    normalizedCandidate === "non gradable and gradable" ||
    normalizedCandidate === "gradable/non-gradable" ||
    normalizedCandidate === "non-gradable/gradable" ||
    normalizedCandidate === "gradable/non gradable" ||
    normalizedCandidate === "non gradable/gradable"
  ) {
    values.add("gradable");
    values.add("non-gradable");
    return;
  }

  if (
    normalizedCandidate === "non gradable" ||
    normalizedCandidate === "nongradable" ||
    normalizedCandidate === "non_gradable"
  ) {
    values.add("non-gradable");
    return;
  }

  if (
    PASSIVE_VOCABULARY_ADJECTIVE_GRADABILITY.includes(
      normalizedCandidate as PassiveVocabularyAdjectiveGradability,
    )
  ) {
    values.add(normalizedCandidate as PassiveVocabularyAdjectiveGradability);
  }
}

function normalizePassiveVocabularyAdjectiveGradability(
  value: unknown,
  flags?: {
    gradable?: unknown;
    nonGradable?: unknown;
    non_gradable?: unknown;
    nongradable?: unknown;
  },
) {
  const values = new Set<PassiveVocabularyAdjectiveGradability>();

  if (Array.isArray(value)) {
    for (const entry of value) {
      addPassiveVocabularyAdjectiveGradabilityValue(values, entry);
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record.gradable === true) {
      values.add("gradable");
    }

    if (
      record.nonGradable === true ||
      record.non_gradable === true ||
      record.nongradable === true
    ) {
      values.add("non-gradable");
    }

    if (Array.isArray(record.values)) {
      for (const entry of record.values) {
        addPassiveVocabularyAdjectiveGradabilityValue(values, entry);
      }
    }
  } else {
    addPassiveVocabularyAdjectiveGradabilityValue(values, value);
  }

  if (flags?.gradable === true) {
    values.add("gradable");
  }

  if (
    flags?.nonGradable === true ||
    flags?.non_gradable === true ||
    flags?.nongradable === true
  ) {
    values.add("non-gradable");
  }

  return PASSIVE_VOCABULARY_ADJECTIVE_GRADABILITY.filter((entry) =>
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

function normalizePassiveVocabularyUkrainianSearchForms(
  value: unknown,
  ukrainianTranslation?: string | null,
) {
  const forms = new Map<string, string>();

  const addCandidate = (candidate: unknown) => {
    const normalizedCandidate =
      normalizePassiveVocabularyAttributeText(candidate);

    if (!normalizedCandidate) {
      return;
    }

    for (const segment of normalizedCandidate.split(/[\n,;/]+/)) {
      const normalizedSegment =
        normalizePassiveVocabularyAttributeText(segment);
      const normalizedLookupSegment = normalizePassiveVocabularyText(
        normalizedSegment ?? "",
      );

      if (
        !normalizedSegment ||
        !normalizedLookupSegment ||
        forms.has(normalizedLookupSegment)
      ) {
        continue;
      }

      forms.set(normalizedLookupSegment, normalizedSegment);
    }
  };

  addCandidate(ukrainianTranslation);

  if (Array.isArray(value)) {
    for (const form of value) {
      addCandidate(form);
    }
  }

  return Array.from(forms.values()).slice(0, 24);
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
  const ukrainianSearchForms = normalizePassiveVocabularyUkrainianSearchForms(
    attributes.ukrainianSearchForms ?? attributes.ukrainian_search_forms,
    ukrainianTranslation,
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
  const verbTransitivity = normalizePassiveVocabularyVerbTransitivity(
    attributes.verbTransitivity ??
      attributes.verb_transitivity ??
      attributes.transitivity,
    {
      transitive: attributes.transitive,
      transative: attributes.transative,
      intransitive: attributes.intransitive,
    },
  );
  const verbFollowedBy = normalizePassiveVocabularyVerbFollowedBy(
    attributes.followedBy ??
      attributes.followed_by ??
      attributes.verbFollowedBy ??
      attributes.verb_followed_by ??
      attributes.dependentPrepositions ??
      attributes.dependent_prepositions,
    {
      on: attributes.on,
      at: attributes.at,
      of: attributes.of,
      for: attributes.for,
      with: attributes.with,
      in: attributes.in,
      to: attributes.to,
      about: attributes.about,
      from: attributes.from,
      by: attributes.by,
    },
  );
  const verbRegularity = normalizePassiveVocabularyVerbRegularity(
    attributes.verbRegularity ??
      attributes.verb_regularity ??
      attributes.regularity ??
      attributes.verbType ??
      attributes.verb_type,
    {
      regular: attributes.regular,
      irregular: attributes.irregular,
    },
  );
  const verbState = normalizePassiveVocabularyVerbState(
    attributes.verbState ??
      attributes.verb_state ??
      attributes.verbStates ??
      attributes.verb_states ??
      attributes.verbDynamicity ??
      attributes.verb_dynamicity ??
      attributes.dynamicity ??
      attributes.stativeDynamicity ??
      attributes.stative_dynamicity,
    {
      state: attributes.state,
      stative: attributes.stative,
      dynamic: attributes.dynamic,
    },
  );
  const verbPattern = normalizePassiveVocabularyVerbPattern(
    attributes.verbPattern ??
      attributes.verb_pattern ??
      attributes.verbPatterns ??
      attributes.verb_patterns ??
      attributes.verbComplementPattern ??
      attributes.verb_complement_pattern,
    {
      gerund: attributes.gerund,
      ing: attributes.ing,
      vIng: attributes.vIng,
      toV: attributes.toV,
      infinitive: attributes.infinitive,
      toInfinitive: attributes.toInfinitive,
      v: attributes.v,
      bareInfinitive: attributes.bareInfinitive,
      notFollowed: attributes.notFollowed,
      not_followed: attributes.not_followed,
    },
  );
  const adjectiveGradability = normalizePassiveVocabularyAdjectiveGradability(
    attributes.adjectiveGradability ??
      attributes.adjective_gradability ??
      attributes.gradability,
    {
      gradable: attributes.gradable,
      nonGradable: attributes.nonGradable,
      non_gradable: attributes.non_gradable,
      nongradable: attributes.nongradable,
    },
  );
  const forms = normalizePassiveVocabularyManagedForms(
    attributes.forms,
    typeof attributes.canonicalTerm === "string"
      ? attributes.canonicalTerm
      : null,
  );

  delete attributes.ukrainian_translation;
  delete attributes.ukrainian_search_forms;
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
  delete attributes.verb_transitivity;
  delete attributes.transitivity;
  delete attributes.transitive;
  delete attributes.transative;
  delete attributes.intransitive;
  delete attributes.followed_by;
  delete attributes.verbFollowedBy;
  delete attributes.verb_followed_by;
  delete attributes.dependentPrepositions;
  delete attributes.dependent_prepositions;
  delete attributes.verb_regularity;
  delete attributes.regularity;
  delete attributes.verbType;
  delete attributes.verb_type;
  delete attributes.regular;
  delete attributes.irregular;
  delete attributes.verb_state;
  delete attributes.verbStates;
  delete attributes.verb_states;
  delete attributes.verbDynamicity;
  delete attributes.verb_dynamicity;
  delete attributes.dynamicity;
  delete attributes.stativeDynamicity;
  delete attributes.stative_dynamicity;
  delete attributes.state;
  delete attributes.stative;
  delete attributes.dynamic;
  delete attributes.verb_pattern;
  delete attributes.verbPatterns;
  delete attributes.verb_patterns;
  delete attributes.verbComplementPattern;
  delete attributes.verb_complement_pattern;
  delete attributes.gerund;
  delete attributes.ing;
  delete attributes.vIng;
  delete attributes.toV;
  delete attributes.infinitive;
  delete attributes.toInfinitive;
  delete attributes.v;
  delete attributes.bareInfinitive;
  delete attributes.notFollowed;
  delete attributes.not_followed;
  delete attributes.adjective_gradability;
  delete attributes.gradability;
  delete attributes.gradable;
  delete attributes.nonGradable;
  delete attributes.non_gradable;
  delete attributes.nongradable;
  for (const preposition of PASSIVE_VOCABULARY_VERB_FOLLOWED_BY) {
    delete attributes[preposition];
  }

  if (ukrainianTranslation) {
    attributes.ukrainianTranslation = ukrainianTranslation;
  } else {
    delete attributes.ukrainianTranslation;
  }

  if (ukrainianSearchForms.length > 0) {
    attributes.ukrainianSearchForms = ukrainianSearchForms;
  } else {
    delete attributes.ukrainianSearchForms;
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

  if (verbTransitivity.length > 0) {
    attributes.verbTransitivity = verbTransitivity;
  } else {
    delete attributes.verbTransitivity;
  }

  if (verbFollowedBy.length > 0) {
    attributes.followedBy = verbFollowedBy;
  } else {
    delete attributes.followedBy;
  }

  if (verbRegularity.length > 0) {
    attributes.verbRegularity = verbRegularity;
  } else {
    delete attributes.verbRegularity;
  }

  if (verbState.length > 0) {
    attributes.verbState = verbState;
  } else {
    delete attributes.verbState;
  }

  if (verbPattern.length > 0) {
    attributes.verbPattern = verbPattern;
  } else {
    delete attributes.verbPattern;
  }

  if (adjectiveGradability.length > 0) {
    attributes.adjectiveGradability = adjectiveGradability;
  } else {
    delete attributes.adjectiveGradability;
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

  const normalizedSearchForms = normalizePassiveVocabularyUkrainianSearchForms(
    nextAttributes.ukrainianSearchForms,
    normalizedTranslation,
  );

  if (normalizedSearchForms.length > 0) {
    nextAttributes.ukrainianSearchForms = normalizedSearchForms;
  } else {
    delete nextAttributes.ukrainianSearchForms;
  }

  return nextAttributes;
}

export function getPassiveVocabularyUkrainianSearchForms(
  attributes?: PassiveVocabularyLibraryAttributes | null,
  ukrainianTranslation?: string | null,
) {
  const normalizedAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);

  return normalizePassiveVocabularyUkrainianSearchForms(
    normalizedAttributes.ukrainianSearchForms,
    ukrainianTranslation ?? normalizedAttributes.ukrainianTranslation ?? null,
  );
}

export function withPassiveVocabularyUkrainianSearchForms(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  ukrainianSearchForms: string[] | null | undefined,
  ukrainianTranslation?: string | null,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedSearchForms = normalizePassiveVocabularyUkrainianSearchForms(
    ukrainianSearchForms,
    ukrainianTranslation ?? nextAttributes.ukrainianTranslation ?? null,
  );

  if (normalizedSearchForms.length > 0) {
    nextAttributes.ukrainianSearchForms = normalizedSearchForms;
  } else {
    delete nextAttributes.ukrainianSearchForms;
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

  if (
    normalizeEnglishVariantPreference(englishVariantPreference) === "british"
  ) {
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
    british: normalizedAttributes.britishTranscription ?? fallbackTranscription,
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
  const normalizedAmericanTranscription =
    normalizePassiveVocabularyAttributeText(transcriptions?.american);
  const normalizedBritishTranscription =
    normalizePassiveVocabularyAttributeText(transcriptions?.british);

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
  nounCountability: PassiveVocabularyNounCountability[] | null | undefined,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedNounCountability =
    normalizePassiveVocabularyNounCountability(nounCountability);

  if (normalizedNounCountability.length > 0) {
    nextAttributes.nounCountability = normalizedNounCountability;
  } else {
    delete nextAttributes.nounCountability;
  }

  return nextAttributes;
}

export function getPassiveVocabularyVerbTransitivity(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  return normalizePassiveVocabularyVerbTransitivity(
    normalizePassiveVocabularyLibraryAttributes(attributes).verbTransitivity,
  );
}

export function withPassiveVocabularyVerbTransitivity(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  verbTransitivity: PassiveVocabularyVerbTransitivity[] | null | undefined,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedVerbTransitivity =
    normalizePassiveVocabularyVerbTransitivity(verbTransitivity);

  if (normalizedVerbTransitivity.length > 0) {
    nextAttributes.verbTransitivity = normalizedVerbTransitivity;
  } else {
    delete nextAttributes.verbTransitivity;
  }

  return nextAttributes;
}

export function getPassiveVocabularyVerbFollowedBy(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  return normalizePassiveVocabularyVerbFollowedBy(
    normalizePassiveVocabularyLibraryAttributes(attributes).followedBy,
  );
}

export function getPassiveVocabularyFollowedBy(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  return getPassiveVocabularyVerbFollowedBy(attributes);
}

export function withPassiveVocabularyVerbFollowedBy(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  verbFollowedBy: PassiveVocabularyVerbFollowedBy[] | null | undefined,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedVerbFollowedBy =
    normalizePassiveVocabularyVerbFollowedBy(verbFollowedBy);

  if (normalizedVerbFollowedBy.length > 0) {
    nextAttributes.followedBy = normalizedVerbFollowedBy;
  } else {
    delete nextAttributes.followedBy;
  }

  return nextAttributes;
}

export function withPassiveVocabularyFollowedBy(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  followedBy: PassiveVocabularyFollowedBy[] | null | undefined,
) {
  return withPassiveVocabularyVerbFollowedBy(attributes, followedBy);
}

export function getPassiveVocabularyVerbRegularity(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  return normalizePassiveVocabularyVerbRegularity(
    normalizePassiveVocabularyLibraryAttributes(attributes).verbRegularity,
  );
}

export function withPassiveVocabularyVerbRegularity(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  verbRegularity: PassiveVocabularyVerbRegularity[] | null | undefined,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedVerbRegularity =
    normalizePassiveVocabularyVerbRegularity(verbRegularity);

  if (normalizedVerbRegularity.length > 0) {
    nextAttributes.verbRegularity = normalizedVerbRegularity;
  } else {
    delete nextAttributes.verbRegularity;
  }

  return nextAttributes;
}

export function getPassiveVocabularyVerbState(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  return normalizePassiveVocabularyVerbState(
    normalizePassiveVocabularyLibraryAttributes(attributes).verbState,
  );
}

export function withPassiveVocabularyVerbState(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  verbState: PassiveVocabularyVerbState[] | null | undefined,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedVerbState = normalizePassiveVocabularyVerbState(verbState);

  if (normalizedVerbState.length > 0) {
    nextAttributes.verbState = normalizedVerbState;
  } else {
    delete nextAttributes.verbState;
  }

  return nextAttributes;
}

export function getPassiveVocabularyVerbPattern(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  return normalizePassiveVocabularyVerbPattern(
    normalizePassiveVocabularyLibraryAttributes(attributes).verbPattern,
  );
}

export function withPassiveVocabularyVerbPattern(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  verbPattern: PassiveVocabularyVerbPattern[] | null | undefined,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedVerbPattern =
    normalizePassiveVocabularyVerbPattern(verbPattern);

  if (normalizedVerbPattern.length > 0) {
    nextAttributes.verbPattern = normalizedVerbPattern;
  } else {
    delete nextAttributes.verbPattern;
  }

  return nextAttributes;
}

export function getPassiveVocabularyAdjectiveGradability(
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  return normalizePassiveVocabularyAdjectiveGradability(
    normalizePassiveVocabularyLibraryAttributes(attributes)
      .adjectiveGradability,
  );
}

export function withPassiveVocabularyAdjectiveGradability(
  attributes: PassiveVocabularyLibraryAttributes | null | undefined,
  adjectiveGradability:
    | PassiveVocabularyAdjectiveGradability[]
    | null
    | undefined,
) {
  const nextAttributes =
    normalizePassiveVocabularyLibraryAttributes(attributes);
  const normalizedAdjectiveGradability =
    normalizePassiveVocabularyAdjectiveGradability(adjectiveGradability);

  if (normalizedAdjectiveGradability.length > 0) {
    nextAttributes.adjectiveGradability = normalizedAdjectiveGradability;
  } else {
    delete nextAttributes.adjectiveGradability;
  }

  return nextAttributes;
}

function formatPassiveVocabularyMetadataRequirementList(
  requirements: string[],
) {
  if (requirements.length === 0) {
    return "metadata";
  }

  if (requirements.length === 1) {
    return requirements[0] ?? "metadata";
  }

  if (requirements.length === 2) {
    return `${requirements[0]} and ${requirements[1]}`;
  }

  return `${requirements.slice(0, -1).join(", ")}, and ${requirements.at(-1)}`;
}

export function getPassiveVocabularyMetadataValidation(
  itemType: PassiveVocabularyItemType,
  cefrLevel?: PassiveVocabularyLibraryCefrLevel | null,
  partOfSpeech?: PassiveVocabularyPartOfSpeech | null,
  attributes?: PassiveVocabularyLibraryAttributes | null,
) {
  if (itemType === "phrase") {
    return {
      status: "completed" as const,
      error: null,
    };
  }

  const missingRequirements: string[] = [];

  if (!cefrLevel) {
    missingRequirements.push("a CEFR level");
  }

  if (!partOfSpeech) {
    missingRequirements.push("part of speech");
  }

  if (
    partOfSpeech === "verb" &&
    getPassiveVocabularyVerbState(attributes).length === 0
  ) {
    missingRequirements.push(
      'verb state classification ("state", "dynamic", or both)',
    );
  }

  if (missingRequirements.length === 0) {
    return {
      status: "completed" as const,
      error: null,
    };
  }

  return {
    status: "failed" as const,
    error: `Metadata still needs ${formatPassiveVocabularyMetadataRequirementList(missingRequirements)}.`,
  };
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
  delete customAttributes.ukrainianSearchForms;
  delete customAttributes.englishDefinition;
  delete customAttributes.englishDefinitions;
  delete customAttributes.transcription;
  delete customAttributes.americanTranscription;
  delete customAttributes.britishTranscription;
  delete customAttributes.nounCountability;
  delete customAttributes.verbTransitivity;
  delete customAttributes.followedBy;
  delete customAttributes.verbRegularity;
  delete customAttributes.verbState;
  delete customAttributes.verbPattern;
  delete customAttributes.adjectiveGradability;
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
  return value.length <= 5 || endsWithConsonantY(value) || value.endsWith("e");
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
  verbRegularity?: PassiveVocabularyVerbRegularity[] | null,
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
    const suggestedPronounForms = SUBJECT_PRONOUN_FORM_MAP.get(
      normalizedText,
    ) ?? {
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
    const suggestedAdjectiveForms = IRREGULAR_ADJECTIVE_FORM_MAP.get(
      normalizedText,
    ) ?? {
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

  const normalizedVerbRegularity =
    normalizePassiveVocabularyVerbRegularity(verbRegularity);
  const shouldForceRegularForms =
    normalizedVerbRegularity.includes("regular") &&
    !normalizedVerbRegularity.includes("irregular");
  const irregularVariants = shouldForceRegularForms
    ? []
    : (IRREGULAR_PASSIVE_VOCABULARY_FORM_MAP.get(normalizedText) ?? []);
  const regularThirdPersonSingular =
    buildRegularThirdPersonSingularForm(normalizedText);
  const regularPast = buildRegularPastForms(normalizedText)[0] ?? null;
  const regularGerund = buildRegularIngForms(normalizedText)[0] ?? null;
  const suggestedThirdPersonSingular =
    irregularVariants.find(
      (form) =>
        normalizePassiveVocabularyText(form) === regularThirdPersonSingular,
    ) ?? regularThirdPersonSingular;
  const suggestedGerund =
    irregularVariants.find((form) =>
      /ing$/.test(normalizePassiveVocabularyText(form)),
    ) ?? regularGerund;
  const remainingIrregularForms = irregularVariants.filter((form) => {
    const normalizedForm = normalizePassiveVocabularyText(form);
    return (
      normalizedForm !==
        normalizePassiveVocabularyText(suggestedThirdPersonSingular) &&
      normalizedForm !== normalizePassiveVocabularyText(suggestedGerund ?? "")
    );
  });
  const suggestedPastSimple = remainingIrregularForms[0] ?? regularPast;
  const suggestedPastParticiple =
    remainingIrregularForms[1] ??
    (remainingIrregularForms.length === 1
      ? remainingIrregularForms[0]
      : regularPast);

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
  verbRegularity?: PassiveVocabularyVerbRegularity[] | null,
) {
  return getPassiveVocabularyUniqueForms(
    getPassiveVocabularyEditableFormValues(
      value,
      partOfSpeech,
      explicitForms,
      verbRegularity,
    ),
    value,
  );
}

export function getPassiveVocabularyGeneratedForms(
  value: string,
  partOfSpeech?: PassiveVocabularyPartOfSpeech | null,
  verbRegularity?: PassiveVocabularyVerbRegularity[] | null,
) {
  return getPassiveVocabularyEditableForms(
    value,
    partOfSpeech,
    undefined,
    verbRegularity,
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
  return value
    .normalize("NFC")
    .replace(/[’ʼ`]/g, "'")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
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
    (normalizedLookupValue.startsWith("a ") ||
      normalizedLookupValue.startsWith("an "))
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
