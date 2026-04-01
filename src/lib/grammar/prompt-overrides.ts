import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildGrammarPromptDetails,
  GRAMMAR_PROMPT_GUIDANCE,
  GRAMMAR_RULES,
} from "@/lib/grammar/rules";
import {
  getDefaultGrammarTopicDefinitionMap,
  getDefaultGrammarTopicDefinitions,
  LEVEL_ORDER,
} from "@/lib/grammar/topics";
import type { LearningLanguage } from "@/lib/languages";
import type { Database } from "@/types/database";

type GrammarTopicPromptOverrideRow =
  Database["public"]["Tables"]["grammar_topic_prompt_overrides"]["Row"];

const EXTENDED_SELECT_COLUMNS =
  "topic_key, display_name, learning_language, cefr_level, rule_text, guidance_text, evaluation_instructions, is_custom, is_archived, updated_by, created_at, updated_at";
const LEGACY_SELECT_COLUMNS =
  "topic_key, rule_text, guidance_text, updated_by, created_at, updated_at";

export interface GrammarTopicPromptConfig {
  topicKey: string;
  displayName: string;
  learningLanguage: LearningLanguage;
  level: string;
  defaultRule: string;
  defaultGuidance: string;
  defaultEvaluationInstructions: string;
  effectiveRule: string;
  effectiveGuidance: string;
  effectiveEvaluationInstructions: string;
  effectivePromptDetails: string;
  hasOverride: boolean;
  isCustom: boolean;
  isArchived: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

const DEFAULT_TOPIC_MAP = getDefaultGrammarTopicDefinitionMap();

function isMissingGrammarTopicColumnsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42703" ||
    candidate.code === "PGRST204" ||
    candidate.message?.includes(
      "grammar_topic_prompt_overrides.display_name",
    ) ||
    candidate.message?.includes("display_name") ||
    false
  );
}

function normalizeLegacyOverrideRow(
  row: Pick<
    GrammarTopicPromptOverrideRow,
    | "topic_key"
    | "rule_text"
    | "guidance_text"
    | "updated_by"
    | "created_at"
    | "updated_at"
  >,
): GrammarTopicPromptOverrideRow {
  return {
    topic_key: row.topic_key,
    display_name: null,
    learning_language: null,
    cefr_level: null,
    rule_text: row.rule_text,
    guidance_text: row.guidance_text,
    evaluation_instructions: null,
    is_custom: false,
    is_archived: false,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getOverrideValue(
  overrideValue: string | null | undefined,
  fallbackValue: string,
) {
  return overrideValue === null || overrideValue === undefined
    ? fallbackValue
    : overrideValue;
}

function normalizeLearningLanguageValue(
  value: string | null | undefined,
  fallbackValue: LearningLanguage,
): LearningLanguage {
  return value === "spanish" ? "spanish" : fallbackValue;
}

function hasBuiltInOverride(
  override: GrammarTopicPromptOverrideRow | null | undefined,
) {
  if (!override || override.is_custom) {
    return false;
  }

  return Boolean(
    override.display_name !== null ||
    override.learning_language !== null ||
    override.cefr_level !== null ||
    override.rule_text !== null ||
    override.guidance_text !== null ||
    override.evaluation_instructions !== null ||
    override.is_archived,
  );
}

export function getDefaultGrammarTopicPromptConfig(
  topicKey: string,
): GrammarTopicPromptConfig {
  const metadata = DEFAULT_TOPIC_MAP.get(topicKey);
  const defaultRule = GRAMMAR_RULES[topicKey] ?? "";
  const defaultGuidance = GRAMMAR_PROMPT_GUIDANCE[topicKey] ?? "";

  return {
    topicKey,
    displayName: metadata?.displayName ?? topicKey,
    learningLanguage: metadata?.learningLanguage ?? "english",
    level: metadata?.level ?? "A1",
    defaultRule,
    defaultGuidance,
    defaultEvaluationInstructions: "",
    effectiveRule: defaultRule,
    effectiveGuidance: defaultGuidance,
    effectiveEvaluationInstructions: "",
    effectivePromptDetails: buildGrammarPromptDetails(
      defaultRule,
      defaultGuidance,
    ),
    hasOverride: false,
    isCustom: false,
    isArchived: false,
    updatedAt: null,
    updatedBy: null,
  };
}

export function applyGrammarTopicPromptOverride(
  topicKey: string,
  override?: GrammarTopicPromptOverrideRow | null,
): GrammarTopicPromptConfig {
  const defaults = getDefaultGrammarTopicPromptConfig(topicKey);
  const isCustom = Boolean(override?.is_custom);
  const defaultRule = isCustom ? "" : defaults.defaultRule;
  const defaultGuidance = isCustom ? "" : defaults.defaultGuidance;
  const defaultEvaluationInstructions = isCustom
    ? ""
    : defaults.defaultEvaluationInstructions;
  const effectiveRule = getOverrideValue(override?.rule_text, defaultRule);
  const effectiveGuidance = getOverrideValue(
    override?.guidance_text,
    defaultGuidance,
  );
  const effectiveEvaluationInstructions = getOverrideValue(
    override?.evaluation_instructions,
    defaultEvaluationInstructions,
  );

  return {
    topicKey,
    displayName: getOverrideValue(
      override?.display_name,
      isCustom ? topicKey : defaults.displayName,
    ),
    learningLanguage: normalizeLearningLanguageValue(
      override?.learning_language,
      defaults.learningLanguage,
    ),
    level: getOverrideValue(override?.cefr_level, defaults.level),
    defaultRule,
    defaultGuidance,
    defaultEvaluationInstructions,
    effectiveRule,
    effectiveGuidance,
    effectiveEvaluationInstructions,
    effectivePromptDetails: buildGrammarPromptDetails(
      effectiveRule,
      effectiveGuidance,
    ),
    hasOverride: hasBuiltInOverride(override),
    isCustom,
    isArchived: override?.is_archived ?? false,
    updatedAt: override?.updated_at ?? null,
    updatedBy: override?.updated_by ?? null,
  };
}

export async function fetchGrammarTopicPromptOverrides(
  topicKeys?: string[],
): Promise<Map<string, GrammarTopicPromptOverrideRow>> {
  const admin = createAdminClient();
  let query = admin
    .from("grammar_topic_prompt_overrides")
    .select(EXTENDED_SELECT_COLUMNS);

  if (topicKeys && topicKeys.length > 0) {
    query = query.in("topic_key", Array.from(new Set(topicKeys)));
  }

  const { data, error } = await query.order("topic_key", { ascending: true });

  if (!error) {
    return new Map((data ?? []).map((item) => [item.topic_key, item]));
  }

  if (!isMissingGrammarTopicColumnsError(error)) {
    throw error;
  }

  let legacyQuery = admin
    .from("grammar_topic_prompt_overrides")
    .select(LEGACY_SELECT_COLUMNS);

  if (topicKeys && topicKeys.length > 0) {
    legacyQuery = legacyQuery.in("topic_key", Array.from(new Set(topicKeys)));
  }

  const { data: legacyData, error: legacyError } = await legacyQuery.order(
    "topic_key",
    { ascending: true },
  );

  if (legacyError) {
    throw legacyError;
  }

  return new Map(
    (legacyData ?? []).map((item) => {
      const normalizedItem = normalizeLegacyOverrideRow(item);
      return [normalizedItem.topic_key, normalizedItem];
    }),
  );
}

export async function resolveGrammarTopicPromptDetails(
  topicKeys?: string[],
): Promise<Record<string, string>> {
  if (!topicKeys || topicKeys.length === 0) {
    return {};
  }

  const overrideMap = await fetchGrammarTopicPromptOverrides(topicKeys);

  return Object.fromEntries(
    Array.from(new Set(topicKeys)).map((topicKey) => {
      const config = applyGrammarTopicPromptOverride(
        topicKey,
        overrideMap.get(topicKey),
      );
      return [topicKey, config.effectivePromptDetails];
    }),
  );
}

export async function resolveGrammarTopicEvaluationInstructions(
  topicKeys?: string[],
): Promise<Record<string, string>> {
  if (!topicKeys || topicKeys.length === 0) {
    return {};
  }

  const overrideMap = await fetchGrammarTopicPromptOverrides(topicKeys);

  return Object.fromEntries(
    Array.from(new Set(topicKeys)).map((topicKey) => {
      const config = applyGrammarTopicPromptOverride(
        topicKey,
        overrideMap.get(topicKey),
      );
      return [topicKey, config.effectiveEvaluationInstructions];
    }),
  );
}

export async function resolveGrammarTopicLabels(
  topicKeys?: string[],
): Promise<Record<string, string>> {
  if (!topicKeys || topicKeys.length === 0) {
    return {};
  }

  const overrideMap = await fetchGrammarTopicPromptOverrides(topicKeys);

  return Object.fromEntries(
    Array.from(new Set(topicKeys)).map((topicKey) => {
      const config = applyGrammarTopicPromptOverride(
        topicKey,
        overrideMap.get(topicKey),
      );
      return [topicKey, config.displayName];
    }),
  );
}

export async function getGrammarTopicPromptCatalog(
  language: LearningLanguage,
): Promise<{ level: string; topics: GrammarTopicPromptConfig[] }[]> {
  const overrideMap = await fetchGrammarTopicPromptOverrides();
  const grouped = new Map<string, GrammarTopicPromptConfig[]>();

  for (const definition of getDefaultGrammarTopicDefinitions(language)) {
    const config = applyGrammarTopicPromptOverride(
      definition.topicKey,
      overrideMap.get(definition.topicKey),
    );

    if (config.isArchived) {
      continue;
    }

    const topics = grouped.get(config.level) ?? [];
    topics.push(config);
    grouped.set(config.level, topics);
  }

  const customTopics = Array.from(overrideMap.values())
    .filter((row) => row.is_custom && !row.is_archived)
    .map((row) => applyGrammarTopicPromptOverride(row.topic_key, row))
    .filter((topic) => topic.learningLanguage === language)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  for (const topic of customTopics) {
    const topics = grouped.get(topic.level) ?? [];
    topics.push(topic);
    grouped.set(topic.level, topics);
  }

  const orderedLevels = [
    ...LEVEL_ORDER,
    ...Array.from(grouped.keys()).filter(
      (level) => !LEVEL_ORDER.includes(level),
    ),
  ];

  return orderedLevels
    .map((level) => ({ level, topics: grouped.get(level) ?? [] }))
    .filter(({ topics }) => topics.length > 0);
}
