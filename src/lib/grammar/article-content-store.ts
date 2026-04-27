import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGrammarLibraryTopicContent } from "@/lib/grammar/library-topic-content";
import type { GrammarLibraryTopicContent } from "@/lib/grammar/library-topic-content";

const grammarLibraryTopicQuizOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const grammarLibraryTopicQuizQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(grammarLibraryTopicQuizOptionSchema).min(2),
  correctOptionId: z.string().min(1),
  explanation: z.string().min(1),
});

const grammarLibraryTopicContentSchema = z.object({
  summary: z.string().min(1),
  formula: z.string().min(1),
  note: z.string().optional(),
  sections: z.array(
    z.object({
      title: z.string().min(1),
      items: z.array(z.string().min(1)).min(1),
    }),
  ),
  examples: z.array(
    z.object({
      sentence: z.string().min(1),
      note: z.string().optional(),
    }),
  ),
  quiz: z
    .object({
      questions: z.array(grammarLibraryTopicQuizQuestionSchema).min(1),
    })
    .optional(),
});

function parseGrammarLibraryTopicContent(
  value: unknown,
): GrammarLibraryTopicContent | null {
  const parsed = grammarLibraryTopicContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export interface GrammarTopicLibraryContentState {
  topicKey: string;
  draftContent: GrammarLibraryTopicContent | null;
  publishedContent: GrammarLibraryTopicContent | null;
  updatedAt: string | null;
  publishedAt: string | null;
}

export async function getGrammarTopicLibraryContentState(topicKey: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("grammar_topic_library_contents")
    .select("topic_key, draft_content, published_content, updated_at, published_at")
    .eq("topic_key", topicKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    topicKey: data.topic_key,
    draftContent: parseGrammarLibraryTopicContent(data.draft_content),
    publishedContent: parseGrammarLibraryTopicContent(data.published_content),
    updatedAt: data.updated_at,
    publishedAt: data.published_at,
  } satisfies GrammarTopicLibraryContentState;
}

export async function getPublishedGrammarTopicContent(topicKey: string) {
  const state = await getGrammarTopicLibraryContentState(topicKey);
  return state?.publishedContent ?? null;
}

export async function getPublishedGrammarTopicContentWithFallback(
  topicKey: string,
) {
  const storedContent = await getPublishedGrammarTopicContent(topicKey);

  if (storedContent) {
    return storedContent;
  }

  return getGrammarLibraryTopicContent(topicKey) ?? null;
}

export { grammarLibraryTopicContentSchema };