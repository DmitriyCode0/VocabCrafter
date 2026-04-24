import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromGeminiWithUsage, GEMINI_MODEL } from "@/lib/gemini/client";
import { getEvaluationPrompt } from "@/lib/gemini/prompts";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import {
  resolveGrammarTopicEvaluationInstructions,
  resolveGrammarTopicLabels,
  resolveGrammarTopicPromptDetails,
} from "@/lib/grammar/prompt-overrides";
import { formatTranslationFeedback } from "@/lib/translation-feedback";
import { z } from "zod";
import type { QuizConfig } from "@/types/quiz";

const requestSchema = z.object({
  userTranslation: z.string().min(1),
  referenceTranslation: z.string().min(1),
  targetTerm: z.string().min(1).optional(),
  validatedGrammarTopic: z.string().min(1).optional(),
  grammarValidationReason: z.string().min(1).optional(),
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  // Full config for rich evaluation — optional for backward compatibility
  config: z
    .object({
      cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
      targetLanguage: z.enum(["english", "spanish"]).optional(),
      sourceLanguage: z.enum(["english", "ukrainian"]).optional(),
      vocabularyChallenge: z.enum(["Simple", "Standard", "Complex"]),
      grammarChallenge: z.enum(["Simple", "Standard", "Complex"]),
      teacherPersona: z.enum(["learning", "strict", "standard"]),
      timedMode: z.boolean(),
      grammarTopics: z.array(z.string()).optional(),
      customTopic: z.string().optional(),
    })
    .optional(),
});

const evaluationMetricSchema = z.object({
  passed: z.boolean(),
  comment: z.preprocess((value) => {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === "string")
        .join(" ");
    }

    return value;
  }, z.string().trim().min(1)),
});

const evaluationResponseSchema = z.object({
  score: z.preprocess((value) => {
    const clampScore = (score: number) => Math.min(100, Math.max(0, score));

    if (typeof value === "number") {
      return clampScore(value);
    }

    if (typeof value === "string") {
      const match = value.match(/-?\d+(?:\.\d+)?/);
      return match ? clampScore(Number(match[0])) : value;
    }

    return value;
  }, z.number().min(0).max(100)),
  metrics: z.object({
    vocabulary: evaluationMetricSchema,
    grammar: evaluationMetricSchema,
    meaning: evaluationMetricSchema,
    mechanics: evaluationMetricSchema,
    naturalness: evaluationMetricSchema,
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("app_language")
      .eq("id", user.id)
      .single();
    const appLanguage = normalizeAppLanguage(profile?.app_language);

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      userTranslation,
      referenceTranslation,
      targetTerm,
      validatedGrammarTopic,
      grammarValidationReason,
      cefrLevel,
      config,
    } = parsed.data;

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

    // Build a full QuizConfig — use provided config or fall back to defaults
    const baseConfig: QuizConfig = config ?? {
      cefrLevel,
      vocabularyChallenge: "Standard",
      grammarChallenge: "Standard",
      teacherPersona: "standard",
      timedMode: false,
    };

    const evalConfig: QuizConfig = validatedGrammarTopic
      ? {
          ...baseConfig,
          grammarTopics: [validatedGrammarTopic],
        }
      : baseConfig;

    evalConfig.grammarTopicDetails = await resolveGrammarTopicPromptDetails(
      evalConfig.grammarTopics,
    );
    evalConfig.grammarTopicLabels = await resolveGrammarTopicLabels(
      evalConfig.grammarTopics,
    );
    evalConfig.grammarTopicEvaluationInstructions =
      await resolveGrammarTopicEvaluationInstructions(evalConfig.grammarTopics);

    const prompt = getEvaluationPrompt(
      userTranslation,
      referenceTranslation,
      targetTerm,
      grammarValidationReason,
      appLanguage,
      evalConfig,
    );

    const { data: result, usageSnapshot } = await generateFromGeminiWithUsage(
      {
        prompt,
        systemInstruction:
          "You are a professional language teacher evaluating student translations. Always respond with valid JSON only. Do not include any markdown formatting or code blocks.",
        temperature: 0.4,
      },
      evaluationResponseSchema,
    );

    await recordAIUsageEvent({
      userId: user.id,
      feature: "evaluate",
      requestType: "text",
      model: GEMINI_MODEL,
      snapshot: usageSnapshot,
    });

    // Increment AI call counter after successful evaluation
    await incrementAICalls(user.id);

    return NextResponse.json({
      score: result.score,
      feedback: formatTranslationFeedback(result.metrics, appLanguage),
    });
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

    console.error("Evaluation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
