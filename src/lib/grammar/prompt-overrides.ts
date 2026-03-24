import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildGrammarPromptDetails,
  GRAMMAR_PROMPT_GUIDANCE,
  GRAMMAR_RULES,
} from "@/lib/grammar/rules";
import { getUniqueGrammarTopicCatalog } from "@/lib/grammar/topics";
import type { LearningLanguage } from "@/lib/languages";
import type { Database } from "@/types/database";

type GrammarTopicPromptOverrideRow =
  Database["public"]["Tables"]["grammar_topic_prompt_overrides"]["Row"];

export interface GrammarTopicPromptConfig {
  topicKey: string;
  defaultRule: string;
  defaultGuidance: string;
  effectiveRule: string;
  effectiveGuidance: string;
  effectivePromptDetails: string;
  hasOverride: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

function getOverrideValue(
  overrideValue: string | null | undefined,
  fallbackValue: string,
) {
  return overrideValue === null || overrideValue === undefined
    ? fallbackValue
    : overrideValue;
}

export function getDefaultGrammarTopicPromptConfig(
  topicKey: string,
): GrammarTopicPromptConfig {
  const defaultRule = GRAMMAR_RULES[topicKey] ?? "";
  const defaultGuidance = GRAMMAR_PROMPT_GUIDANCE[topicKey] ?? "";

  return {
    topicKey,
    defaultRule,
    defaultGuidance,
    effectiveRule: defaultRule,
    effectiveGuidance: defaultGuidance,
    effectivePromptDetails: buildGrammarPromptDetails(
      defaultRule,
      defaultGuidance,
    ),
    hasOverride: false,
    updatedAt: null,
    updatedBy: null,
  };
}

export function applyGrammarTopicPromptOverride(
  topicKey: string,
  override?: GrammarTopicPromptOverrideRow | null,
): GrammarTopicPromptConfig {
  const defaults = getDefaultGrammarTopicPromptConfig(topicKey);
  const effectiveRule = getOverrideValue(override?.rule_text, defaults.defaultRule);
  const effectiveGuidance = getOverrideValue(
    override?.guidance_text,
    defaults.defaultGuidance,
  );

  return {
    ...defaults,
    effectiveRule,
    effectiveGuidance,
    effectivePromptDetails: buildGrammarPromptDetails(
      effectiveRule,
      effectiveGuidance,
    ),
    hasOverride: Boolean(override),
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
    .select("topic_key, rule_text, guidance_text, updated_by, created_at, updated_at");

  if (topicKeys && topicKeys.length > 0) {
    query = query.in("topic_key", Array.from(new Set(topicKeys)));
  }

  const { data, error } = await query.order("topic_key", { ascending: true });

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((item) => [item.topic_key, item]));
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

export async function getGrammarTopicPromptCatalog(
  language: LearningLanguage,
): Promise<{ level: string; topics: GrammarTopicPromptConfig[] }[]> {
  const overrideMap = await fetchGrammarTopicPromptOverrides();

  return getUniqueGrammarTopicCatalog(language).map(({ level, topics }) => ({
    level,
    topics: topics.map((topicKey) =>
      applyGrammarTopicPromptOverride(topicKey, overrideMap.get(topicKey)),
    ),
  }));
}