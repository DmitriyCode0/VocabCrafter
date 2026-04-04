import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromGeminiWithUsage, GEMINI_MODEL } from "@/lib/gemini/client";
import { getQuizPrompt, getSystemInstruction } from "@/lib/gemini/prompts";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import {
  resolveGrammarTopicLabels,
  resolveGrammarTopicPromptDetails,
} from "@/lib/grammar/prompt-overrides";
import type { GenerateQuizRequest } from "@/types/quiz";
import { z } from "zod";
import {
  mcqResponseSchema,
  gapFillResponseSchema,
  translationResponseSchema,
  textTranslationResponseSchema,
  matchingResponseSchema,
  flashcardsResponseSchema,
  discussionResponseSchema,
} from "@/lib/gemini/validation";
import type { QuizType } from "@/types/quiz";

const requestSchema = z.object({
  type: z.enum([
    "mcq",
    "gap_fill",
    "translation",
    "text_translation",
    "translation_list",
    "matching",
    "flashcards",
    "discussion",
  ]),
  terms: z
    .array(
      z.object({
        term: z.string().min(1),
        definition: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
  config: z.object({
    cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
    targetLanguage: z.enum(["english", "spanish"]).optional(),
    sourceLanguage: z.enum(["english", "ukrainian"]).optional(),
    vocabularyChallenge: z.enum(["Simple", "Standard", "Complex"]),
    grammarChallenge: z.enum(["Simple", "Standard", "Complex"]),
    teacherPersona: z.enum(["learning", "strict", "standard"]),
    timedMode: z.boolean(),
    grammarTopics: z.array(z.string()).optional(),
    customTopic: z.string().optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { type, terms, config } = parsed.data as GenerateQuizRequest;

    // --- Enforce AI quota ---
    const quota = await checkAIQuota(user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `AI call limit reached (${quota.limit}/month). Upgrade your plan for more.`,
          code: "QUOTA_EXCEEDED",
        },
        { status: 429 },
      );
    }

    // Sanitize customTopic to prevent prompt injection
    if (config.customTopic) {
      config.customTopic = config.customTopic
        .replace(/[\r\n]+/g, " ")
        .replace(/[{}\[\]`]/g, "")
        .slice(0, 200);
    }

    config.grammarTopicDetails = await resolveGrammarTopicPromptDetails(
      config.grammarTopics,
    );
    config.grammarTopicLabels = await resolveGrammarTopicLabels(
      config.grammarTopics,
    );

    const prompt = getQuizPrompt(type, terms, config);
    const systemInstruction = getSystemInstruction(config);

    const SCHEMA_MAP: Record<QuizType, z.ZodSchema> = {
      mcq: mcqResponseSchema,
      gap_fill: gapFillResponseSchema,
      translation: translationResponseSchema,
      text_translation: textTranslationResponseSchema,
      translation_list: translationResponseSchema,
      matching: matchingResponseSchema,
      flashcards: flashcardsResponseSchema,
      discussion: discussionResponseSchema,
    };

    const { data: generatedContent, usageSnapshot } =
      await generateFromGeminiWithUsage(
        {
          prompt,
          systemInstruction,
          temperature: 0.7,
        },
        SCHEMA_MAP[type],
      );

    await recordAIUsageEvent({
      userId: user.id,
      feature: "generate_quiz",
      requestType: "text",
      model: GEMINI_MODEL,
      snapshot: usageSnapshot,
    });

    // Increment AI call counter after successful generation
    await incrementAICalls(user.id);

    return NextResponse.json({ content: generatedContent });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "AI response validation failed", details: error.flatten() },
        { status: 502 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 502 },
      );
    }

    console.error("Quiz generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
