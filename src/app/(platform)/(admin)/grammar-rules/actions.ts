"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAllGrammarTopicKeys } from "@/lib/grammar/topics";
import { applyGrammarTopicPromptOverride } from "@/lib/grammar/prompt-overrides";

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

function assertValidTopic(topicKey: string) {
  if (!getAllGrammarTopicKeys().includes(topicKey)) {
    throw new Error("Invalid grammar topic");
  }
}

export async function saveGrammarTopicPromptOverride(input: {
  topicKey: string;
  ruleText: string;
  guidanceText: string;
}) {
  const userId = await requireSuperadmin();
  assertValidTopic(input.topicKey);

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const defaultConfig = applyGrammarTopicPromptOverride(input.topicKey, null);

  const matchesDefault =
    input.ruleText === defaultConfig.defaultRule &&
    input.guidanceText === defaultConfig.defaultGuidance;

  if (matchesDefault) {
    const { error } = await admin
      .from("grammar_topic_prompt_overrides")
      .delete()
      .eq("topic_key", input.topicKey);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/grammar-rules");
    return applyGrammarTopicPromptOverride(input.topicKey, null);
  }

  const { data, error } = await admin
    .from("grammar_topic_prompt_overrides")
    .upsert(
      {
        topic_key: input.topicKey,
        rule_text: input.ruleText,
        guidance_text: input.guidanceText,
        updated_by: userId,
        updated_at: now,
      },
      { onConflict: "topic_key" },
    )
    .select("topic_key, rule_text, guidance_text, updated_by, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/grammar-rules");
  return applyGrammarTopicPromptOverride(input.topicKey, data);
}

export async function resetGrammarTopicPromptOverride(topicKey: string) {
  await requireSuperadmin();
  assertValidTopic(topicKey);

  const admin = createAdminClient();
  const { error } = await admin
    .from("grammar_topic_prompt_overrides")
    .delete()
    .eq("topic_key", topicKey);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/grammar-rules");
  return applyGrammarTopicPromptOverride(topicKey, null);
}