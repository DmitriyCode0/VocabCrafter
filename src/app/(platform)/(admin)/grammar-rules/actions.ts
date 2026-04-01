"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  applyGrammarTopicPromptOverride,
  fetchGrammarTopicPromptOverrides,
  getDefaultGrammarTopicPromptConfig,
  getGrammarTopicPromptCatalog,
} from "@/lib/grammar/prompt-overrides";
import { getDefaultGrammarTopicDefinitionMap } from "@/lib/grammar/topics";
import type { LearningLanguage } from "@/lib/languages";

const DEFAULT_TOPIC_MAP = getDefaultGrammarTopicDefinitionMap();
const SELECT_COLUMNS =
  "topic_key, display_name, learning_language, cefr_level, rule_text, guidance_text, evaluation_instructions, is_custom, is_archived, updated_by, created_at, updated_at";

function isMissingGrammarTopicColumnsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42703" ||
    candidate.code === "PGRST204" ||
    candidate.message?.includes("display_name") ||
    candidate.message?.includes("learning_language") ||
    candidate.message?.includes("evaluation_instructions") ||
    false
  );
}

function toGrammarTopicActionError(error: unknown) {
  if (isMissingGrammarTopicColumnsError(error)) {
    return new Error(
      "Database migration 00016 has not been applied yet. Apply the latest Supabase migrations before using topic rename/create/delete or evaluation-instruction editing.",
    );
  }

  return error instanceof Error
    ? error
    : new Error("Grammar topic update failed");
}

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "superadmin") {
    throw new Error("Forbidden");
  }

  return user.id;
}

function normalizeText(value: string) {
  return value.trim();
}

function normalizeOptionalText(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function slugifyTopicName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function assertUniqueDisplayName(
  topicKey: string | null,
  learningLanguage: LearningLanguage,
  displayName: string,
) {
  const catalog = await getGrammarTopicPromptCatalog(learningLanguage);
  const duplicate = catalog
    .flatMap(({ topics }) => topics)
    .find(
      (topic) =>
        topic.topicKey !== topicKey &&
        topic.displayName.toLowerCase() === displayName.toLowerCase(),
    );

  if (duplicate) {
    throw new Error("A topic with this name already exists in this language");
  }
}

async function getTopicConfig(topicKey: string) {
  const overrideMap = await fetchGrammarTopicPromptOverrides([topicKey]);
  const override = overrideMap.get(topicKey);

  if (!override && !DEFAULT_TOPIC_MAP.has(topicKey)) {
    throw new Error("Invalid grammar topic");
  }

  return applyGrammarTopicPromptOverride(topicKey, override);
}

async function generateCustomTopicKey(
  learningLanguage: LearningLanguage,
  displayName: string,
) {
  const baseSlug = slugifyTopicName(displayName) || "grammar-topic";
  const admin = createAdminClient();

  for (let index = 0; index < 100; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const topicKey = `custom-${learningLanguage}-${baseSlug}${suffix}`;
    const { data } = await admin
      .from("grammar_topic_prompt_overrides")
      .select("topic_key")
      .eq("topic_key", topicKey)
      .maybeSingle();

    if (!data && !DEFAULT_TOPIC_MAP.has(topicKey)) {
      return topicKey;
    }
  }

  throw new Error("Could not generate a unique topic key");
}

function revalidateGrammarPages() {
  revalidatePath("/grammar-rules");
  revalidatePath("/quizzes/new");
}

export async function createGrammarTopic(input: {
  displayName: string;
  learningLanguage: LearningLanguage;
  level: string;
  ruleText: string;
  guidanceText: string;
  evaluationInstructions: string;
}) {
  const userId = await requireSuperadmin();
  const displayName = normalizeText(input.displayName);
  const ruleText = normalizeText(input.ruleText);

  if (!displayName) {
    throw new Error("Topic name is required");
  }

  if (!ruleText) {
    throw new Error("Rule text is required for custom topics");
  }

  await assertUniqueDisplayName(null, input.learningLanguage, displayName);

  const topicKey = await generateCustomTopicKey(
    input.learningLanguage,
    displayName,
  );
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("grammar_topic_prompt_overrides")
    .insert({
      topic_key: topicKey,
      display_name: displayName,
      learning_language: input.learningLanguage,
      cefr_level: input.level,
      rule_text: ruleText,
      guidance_text: normalizeOptionalText(input.guidanceText),
      evaluation_instructions: normalizeOptionalText(
        input.evaluationInstructions,
      ),
      is_custom: true,
      is_archived: false,
      updated_by: userId,
      updated_at: now,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    throw toGrammarTopicActionError(error);
  }

  revalidateGrammarPages();
  return applyGrammarTopicPromptOverride(topicKey, data);
}

export async function saveGrammarTopicPromptOverride(input: {
  topicKey: string;
  displayName: string;
  learningLanguage: LearningLanguage;
  level: string;
  ruleText: string;
  guidanceText: string;
  evaluationInstructions: string;
}) {
  const userId = await requireSuperadmin();
  const currentTopic = await getTopicConfig(input.topicKey);
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const displayName = normalizeText(input.displayName);
  const ruleText = normalizeText(input.ruleText);

  if (!displayName) {
    throw new Error("Topic name is required");
  }

  if (!ruleText) {
    throw new Error("Rule text is required");
  }

  await assertUniqueDisplayName(
    input.topicKey,
    input.learningLanguage,
    displayName,
  );

  if (currentTopic.isCustom) {
    const { data, error } = await admin
      .from("grammar_topic_prompt_overrides")
      .update({
        display_name: displayName,
        learning_language: input.learningLanguage,
        cefr_level: input.level,
        rule_text: ruleText,
        guidance_text: normalizeOptionalText(input.guidanceText),
        evaluation_instructions: normalizeOptionalText(
          input.evaluationInstructions,
        ),
        is_archived: false,
        updated_by: userId,
        updated_at: now,
      })
      .eq("topic_key", input.topicKey)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      throw toGrammarTopicActionError(error);
    }

    revalidateGrammarPages();
    return applyGrammarTopicPromptOverride(input.topicKey, data);
  }

  const defaults = getDefaultGrammarTopicPromptConfig(input.topicKey);
  const matchesDefault =
    displayName === defaults.displayName &&
    input.learningLanguage === defaults.learningLanguage &&
    input.level === defaults.level &&
    ruleText === defaults.defaultRule &&
    normalizeText(input.guidanceText) === defaults.defaultGuidance &&
    normalizeText(input.evaluationInstructions) ===
      defaults.defaultEvaluationInstructions;

  if (matchesDefault) {
    const { error } = await admin
      .from("grammar_topic_prompt_overrides")
      .delete()
      .eq("topic_key", input.topicKey);

    if (error) {
      throw toGrammarTopicActionError(error);
    }

    revalidateGrammarPages();
    return applyGrammarTopicPromptOverride(input.topicKey, null);
  }

  const { data, error } = await admin
    .from("grammar_topic_prompt_overrides")
    .upsert(
      {
        topic_key: input.topicKey,
        display_name: displayName === defaults.displayName ? null : displayName,
        learning_language:
          input.learningLanguage === defaults.learningLanguage
            ? null
            : input.learningLanguage,
        cefr_level: input.level === defaults.level ? null : input.level,
        rule_text: ruleText === defaults.defaultRule ? null : ruleText,
        guidance_text:
          normalizeText(input.guidanceText) === defaults.defaultGuidance
            ? null
            : normalizeOptionalText(input.guidanceText),
        evaluation_instructions:
          normalizeText(input.evaluationInstructions) ===
          defaults.defaultEvaluationInstructions
            ? null
            : normalizeOptionalText(input.evaluationInstructions),
        is_custom: false,
        is_archived: false,
        updated_by: userId,
        updated_at: now,
      },
      { onConflict: "topic_key" },
    )
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    throw toGrammarTopicActionError(error);
  }

  revalidateGrammarPages();
  return applyGrammarTopicPromptOverride(input.topicKey, data);
}

export async function resetGrammarTopicPromptOverride(topicKey: string) {
  await requireSuperadmin();

  const topic = await getTopicConfig(topicKey);
  if (topic.isCustom) {
    throw new Error("Custom topics do not have defaults to reset");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("grammar_topic_prompt_overrides")
    .delete()
    .eq("topic_key", topicKey);

  if (error) {
    throw toGrammarTopicActionError(error);
  }

  revalidateGrammarPages();
  return applyGrammarTopicPromptOverride(topicKey, null);
}

export async function deleteGrammarTopic(topicKey: string) {
  const userId = await requireSuperadmin();
  const topic = await getTopicConfig(topicKey);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (topic.isCustom) {
    const { error } = await admin
      .from("grammar_topic_prompt_overrides")
      .delete()
      .eq("topic_key", topicKey);

    if (error) {
      throw toGrammarTopicActionError(error);
    }

    revalidateGrammarPages();
    return;
  }

  const { error } = await admin.from("grammar_topic_prompt_overrides").upsert(
    {
      topic_key: topicKey,
      is_custom: false,
      is_archived: true,
      updated_by: userId,
      updated_at: now,
    },
    { onConflict: "topic_key" },
  );

  if (error) {
    throw toGrammarTopicActionError(error);
  }

  revalidateGrammarPages();
}
