import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateFromGeminiWithUsage,
  generateJsonFromGeminiWithUsage,
  GEMINI_MODEL,
} from "@/lib/gemini/client";
import { getQuizPrompt, getSystemInstruction } from "@/lib/gemini/prompts";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import { normalizeLearningLanguage } from "@/lib/languages";
import {
  resolveGrammarTopicLabels,
  resolveGrammarTopicPromptDetails,
} from "@/lib/grammar/prompt-overrides";
import type {
  DiscussionPrompt,
  GenerateQuizRequest,
  QuizConfig,
  QuizTerm,
} from "@/types/quiz";
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

const discussionPromptKeys = [
  "prompt",
  "question",
  "sentence",
  "statement",
  "text",
  "content",
  "topic",
] as const;

function cleanDiscussionPromptText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractDiscussionPromptText(candidate: unknown): string | null {
  if (typeof candidate === "string") {
    const cleaned = cleanDiscussionPromptText(candidate);
    return cleaned.length > 0 ? cleaned : null;
  }

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  for (const key of discussionPromptKeys) {
    const value = (candidate as Record<string, unknown>)[key];
    if (typeof value === "string") {
      const cleaned = cleanDiscussionPromptText(value);
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  }

  return null;
}

function normalizeDiscussionPromptType(
  rawType: unknown,
  promptText: string,
): DiscussionPrompt["type"] {
  if (typeof rawType === "string") {
    const normalized = rawType.trim().toLowerCase();

    if (
      [
        "agree-disagree",
        "agree/disagree",
        "agree_disagree",
        "agree or disagree",
        "statement",
        "opinion",
      ].includes(normalized)
    ) {
      return "agree-disagree";
    }

    if (
      ["open-ended", "open ended", "open_ended", "open", "question"].includes(
        normalized,
      )
    ) {
      return "open-ended";
    }
  }

  if (/\bagree\b.*\bdisagree\b|\bdo you agree\b/i.test(promptText)) {
    return "agree-disagree";
  }

  return "open-ended";
}

function buildDiscussionUsageInstruction(
  term: string,
  config: QuizConfig,
): string {
  return normalizeLearningLanguage(config.targetLanguage) === "spanish"
    ? `Usa \"${term}\" en tu respuesta.`
    : `Use \"${term}\" in your answer.`;
}

function ensurePromptReferencesTerm(
  promptText: string,
  term: string,
  config: QuizConfig,
) {
  if (promptText.toLowerCase().includes(term.toLowerCase())) {
    return promptText;
  }

  const suffix = buildDiscussionUsageInstruction(term, config);
  const base = /[.!?]$/.test(promptText) ? promptText : `${promptText}.`;
  return `${base} ${suffix}`;
}

function buildFallbackDiscussionPrompt(
  term: QuizTerm,
  index: number,
  config: QuizConfig,
): DiscussionPrompt {
  const promptType: DiscussionPrompt["type"] =
    index % 2 === 0 ? "open-ended" : "agree-disagree";
  const isSpanish =
    normalizeLearningLanguage(config.targetLanguage) === "spanish";

  if (promptType === "agree-disagree") {
    return {
      id: index + 1,
      type: promptType,
      sourceTerm: term.term,
      highlightText: term.term,
      prompt: isSpanish
        ? `Di si estas de acuerdo o no: \"${term.term}\" es importante en la vida diaria. Explica tu opinion.`
        : `Agree or disagree: \"${term.term}\" is important in everyday life. Explain your opinion.`,
    };
  }

  return {
    id: index + 1,
    type: promptType,
    sourceTerm: term.term,
    highlightText: term.term,
    prompt: isSpanish
      ? `Usa \"${term.term}\" en tu respuesta y describe una situacion real relacionada con esta palabra.`
      : `Use \"${term.term}\" in your answer and describe a real situation related to it.`,
  };
}

function normalizeDiscussionContent(
  rawContent: unknown,
  terms: QuizTerm[],
  config: QuizConfig,
) {
  let rawPrompts: unknown[] = [];

  if (Array.isArray(rawContent)) {
    rawPrompts = rawContent;
  } else if (rawContent && typeof rawContent === "object") {
    const record = rawContent as Record<string, unknown>;

    for (const key of ["prompts", "questions", "items", "content"] as const) {
      if (Array.isArray(record[key])) {
        rawPrompts = record[key] as unknown[];
        break;
      }
    }

    if (rawPrompts.length === 0 && extractDiscussionPromptText(rawContent)) {
      rawPrompts = [rawContent];
    }
  }

  const prompts = terms.map((term, index) => {
    const candidate = rawPrompts[index];
    const promptText = extractDiscussionPromptText(candidate);

    if (!promptText) {
      return buildFallbackDiscussionPrompt(term, index, config);
    }

    const rawType =
      candidate && typeof candidate === "object"
        ? (candidate as Record<string, unknown>).type
        : undefined;

    return {
      id: index + 1,
      prompt: ensurePromptReferencesTerm(promptText, term.term, config),
      type: normalizeDiscussionPromptType(rawType, promptText),
      sourceTerm: term.term,
      highlightText: term.term,
    } satisfies DiscussionPrompt;
  });

  return discussionResponseSchema.parse({ prompts });
}

function buildFallbackDiscussionContent(terms: QuizTerm[], config: QuizConfig) {
  return discussionResponseSchema.parse({
    prompts: terms.map((term, index) =>
      buildFallbackDiscussionPrompt(term, index, config),
    ),
  });
}

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

    let generatedContent: unknown;
    let usageSnapshot:
      | Awaited<
          ReturnType<typeof generateJsonFromGeminiWithUsage>
        >["usageSnapshot"]
      | null = null;

    if (type === "discussion") {
      try {
        const result = await generateJsonFromGeminiWithUsage({
          prompt,
          systemInstruction,
          temperature: 0.4,
        });

        generatedContent = normalizeDiscussionContent(
          result.data,
          terms,
          config,
        );
        usageSnapshot = result.usageSnapshot;
      } catch (error) {
        console.warn(
          "Discussion generation fell back to deterministic prompts:",
          error,
        );
        generatedContent = buildFallbackDiscussionContent(terms, config);
      }
    } else {
      const result = await generateFromGeminiWithUsage(
        {
          prompt,
          systemInstruction,
          temperature: 0.7,
        },
        SCHEMA_MAP[type],
      );

      generatedContent = result.data;
      usageSnapshot = result.usageSnapshot;
    }

    if (usageSnapshot) {
      await recordAIUsageEvent({
        userId: user.id,
        feature: "generate_quiz",
        requestType: "text",
        model: GEMINI_MODEL,
        snapshot: usageSnapshot,
      });

      // Increment AI call counter after successful generation
      await incrementAICalls(user.id);
    }

    return NextResponse.json({ content: generatedContent });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Quiz generation validation error:", error.flatten());
      return NextResponse.json(
        { error: "AI response validation failed", details: error.flatten() },
        { status: 502 },
      );
    }
    if (error instanceof SyntaxError) {
      console.error("Quiz generation JSON error:", error);
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
