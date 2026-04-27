"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canUserEditGrammarArticles } from "@/lib/grammar/article-permissions";
import { grammarLibraryTopicContentSchema } from "@/lib/grammar/article-content-store";
import { buildGrammarTopicArticleHref } from "@/lib/grammar/library-topic-routes";
import type { LearningLanguage } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/roles";

interface GrammarTopicArticleMutationInput {
  topicKey: string;
  learningLanguage: LearningLanguage;
  level: string;
  contentText: string;
}

function parseGrammarTopicArticleContent(contentText: string) {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(contentText);
  } catch {
    throw new Error("Article content must be valid JSON");
  }

  const parsedContent = grammarLibraryTopicContentSchema.safeParse(parsedValue);

  if (!parsedContent.success) {
    const firstIssue = parsedContent.error.issues[0];
    const issuePath = firstIssue?.path.join(".") || "content";
    const issueMessage = firstIssue?.message || "Invalid article content";

    throw new Error(`${issuePath}: ${issueMessage}`);
  }

  return parsedContent.data;
}

async function getAuthorizedGrammarArticleEditor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "User profile not found");
  }

  const canEdit = await canUserEditGrammarArticles(
    user.id,
    profile.role as Role,
  );

  if (!canEdit) {
    throw new Error("Forbidden");
  }

  return { supabase, user };
}

async function saveGrammarTopicArticleContent(
  input: GrammarTopicArticleMutationInput,
  mode: "draft" | "publish",
) {
  const { supabase, user } = await getAuthorizedGrammarArticleEditor();
  const content = parseGrammarTopicArticleContent(input.contentText);
  const articleHref = buildGrammarTopicArticleHref(
    input.learningLanguage,
    input.level,
    input.topicKey,
  );
  const { data: existingRecord, error: existingRecordError } = await supabase
    .from("grammar_topic_library_contents")
    .select("topic_key")
    .eq("topic_key", input.topicKey)
    .maybeSingle();

  if (existingRecordError) {
    throw new Error(existingRecordError.message);
  }

  const publishedAt = mode === "publish" ? new Date().toISOString() : null;

  if (existingRecord) {
    const { error } = await supabase
      .from("grammar_topic_library_contents")
      .update(
        mode === "publish"
          ? {
              draft_content: content,
              published_content: content,
              last_draft_saved_by: user.id,
              last_published_by: user.id,
              published_at: publishedAt,
            }
          : {
              draft_content: content,
              last_draft_saved_by: user.id,
            },
      )
      .eq("topic_key", input.topicKey);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from("grammar_topic_library_contents").insert(
      mode === "publish"
        ? {
            topic_key: input.topicKey,
            draft_content: content,
            published_content: content,
            created_by: user.id,
            last_draft_saved_by: user.id,
            last_published_by: user.id,
            published_at: publishedAt,
          }
        : {
            topic_key: input.topicKey,
            draft_content: content,
            created_by: user.id,
            last_draft_saved_by: user.id,
          },
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath(articleHref);
  revalidatePath("/library");
}

export async function saveGrammarTopicArticleDraft(
  input: GrammarTopicArticleMutationInput,
) {
  await saveGrammarTopicArticleContent(input, "draft");
}

export async function publishGrammarTopicArticle(
  input: GrammarTopicArticleMutationInput,
) {
  await saveGrammarTopicArticleContent(input, "publish");
}