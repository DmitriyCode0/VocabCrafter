import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  getGenAI,
  generateFromGeminiWithUsage,
  generateJsonFromGeminiWithUsage,
  GEMINI_MODEL,
} from "@/lib/gemini/client";
import {
  getQuizPromptWithBlueprints,
  getSystemInstruction,
} from "@/lib/gemini/prompts";
import type { TopicSubRuleSpec } from "@/lib/grammar/sentence-blueprints";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import {
  resolveGrammarTopicLabels,
  resolveGrammarTopicPromptDetails,
} from "@/lib/grammar/prompt-overrides";
import type {
  DiscussionPrompt,
  GenerateQuizRequest,
  QuizTerm,
} from "@/types/quiz";
import {
  buildFallbackQuizTitle,
  extractCustomTopicFromConfig,
  extractGrammarTopicLabelFromConfig,
  normalizeSuggestedQuizTitle,
} from "@/lib/quiz/quiz-title";
import { z } from "zod";
import {
  createTranslationResponseSchema,
  mcqResponseSchema,
  gapFillResponseSchema,
  textTranslationResponseSchema,
  matchingResponseSchema,
  flashcardsResponseSchema,
  discussionResponseSchema,
} from "@/lib/gemini/validation";
import type { QuizType } from "@/types/quiz";

type QuizCacheStatus = "hit" | "miss" | "bypass" | "error" | "fallback";

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
    targetLanguage: z.enum(["english"]).optional(),
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

const QUIZ_CACHE_ENABLED =
  (process.env.GEMINI_QUIZ_CACHE_ENABLED ?? "true").toLowerCase() !== "false";
const QUIZ_CACHE_TTL_SECONDS = Math.max(
  300,
  Number.parseInt(process.env.GEMINI_QUIZ_CACHE_TTL_SECONDS ?? "43200", 10),
);
const QUIZ_CACHE_MIN_SYSTEM_TOKENS = Math.max(
  0,
  Number.parseInt(
    process.env.GEMINI_QUIZ_CACHE_MIN_SYSTEM_TOKENS ?? "4000",
    10,
  ),
);
const quizSystemInstructionCache = new Map<
  string,
  { cachedContent: string; expiresAt: number }
>();

interface GeneratedMCQQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  originalTerm: string;
}

function shuffleArray<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function normalizeChoice(value: string) {
  return value.trim().toLowerCase();
}

function estimateTextTokens(text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 4));
}

function getCacheKeyForSystemInstruction(systemInstruction: string) {
  return createHash("sha256").update(systemInstruction).digest("hex");
}

function getQuizThinkingConfig(type: QuizType) {
  if (type === "mcq" || type === "matching") {
    return {
      thinkingBudget: 0,
    };
  }

  return undefined;
}

async function resolveQuizSystemInstructionCache(
  systemInstruction: string,
): Promise<{ cachedContent?: string; status: QuizCacheStatus }> {
  if (!QUIZ_CACHE_ENABLED) {
    return { status: "bypass" };
  }

  if (estimateTextTokens(systemInstruction) < QUIZ_CACHE_MIN_SYSTEM_TOKENS) {
    return { status: "bypass" };
  }

  const key = getCacheKeyForSystemInstruction(systemInstruction);
  const now = Date.now();
  const existing = quizSystemInstructionCache.get(key);

  if (existing && existing.expiresAt > now) {
    return { cachedContent: existing.cachedContent, status: "hit" };
  }

  try {
    const created = await getGenAI().caches.create({
      model: GEMINI_MODEL,
      config: {
        displayName: `quiz-system-${key.slice(0, 16)}`,
        systemInstruction,
        ttl: `${QUIZ_CACHE_TTL_SECONDS}s`,
      },
    });

    if (!created.name) {
      throw new Error("Gemini cache creation returned no resource name");
    }

    const expiresAt = now + QUIZ_CACHE_TTL_SECONDS * 1000;
    quizSystemInstructionCache.set(key, {
      cachedContent: created.name,
      expiresAt,
    });

    return { cachedContent: created.name, status: "miss" };
  } catch (error) {
    console.warn("Failed to create Gemini context cache for quizzes", error);
    return { status: "error" };
  }
}

function randomizeMCQContent(rawContent: unknown) {
  const parsed = mcqResponseSchema.parse(rawContent);
  const targetIndexes = shuffleArray(
    parsed.questions.map((_, index) => index % 4),
  );

  const randomizedQuestions: GeneratedMCQQuestion[] = parsed.questions.map(
    (question, index) => {
      const exactCorrectIndex = question.options.findIndex(
        (option) => option === question.correctAnswer,
      );
      const normalizedCorrectIndex =
        exactCorrectIndex >= 0
          ? exactCorrectIndex
          : question.options.findIndex(
              (option) =>
                normalizeChoice(option) ===
                normalizeChoice(question.correctAnswer),
            );
      const safeCorrectIndex =
        normalizedCorrectIndex >= 0 ? normalizedCorrectIndex : 0;

      const correctOption = question.options[safeCorrectIndex];
      const distractors = question.options.filter(
        (_, optionIndex) => optionIndex !== safeCorrectIndex,
      );
      const shuffledDistractors = shuffleArray(distractors);
      const nextOptions = [...shuffledDistractors];
      const targetIndex = targetIndexes[index] ?? index % 4;
      nextOptions.splice(targetIndex, 0, correctOption);

      return {
        ...question,
        options: nextOptions,
        correctAnswer: correctOption,
      };
    },
  );

  return {
    questions: shuffleArray(randomizedQuestions).map((question, index) => ({
      ...question,
      id: index + 1,
    })),
  };
}

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

function buildDiscussionUsageInstruction(term: string): string {
  return `Use \"${term}\" in your answer.`;
}

function ensurePromptReferencesTerm(promptText: string, term: string) {
  if (promptText.toLowerCase().includes(term.toLowerCase())) {
    return promptText;
  }

  const suffix = buildDiscussionUsageInstruction(term);
  const base = /[.!?]$/.test(promptText) ? promptText : `${promptText}.`;
  return `${base} ${suffix}`;
}

function buildFallbackDiscussionPrompt(
  term: QuizTerm,
  index: number,
): DiscussionPrompt {
  const promptType: DiscussionPrompt["type"] =
    index % 2 === 0 ? "open-ended" : "agree-disagree";

  if (promptType === "agree-disagree") {
    return {
      id: index + 1,
      type: promptType,
      sourceTerm: term.term,
      highlightText: term.term,
      prompt: `Agree or disagree: \"${term.term}\" is important in everyday life. Explain your opinion.`,
    };
  }

  return {
    id: index + 1,
    type: promptType,
    sourceTerm: term.term,
    highlightText: term.term,
    prompt: `Use \"${term.term}\" in your answer and describe a real situation related to it.`,
  };
}

function normalizeDiscussionContent(rawContent: unknown, terms: QuizTerm[]) {
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
      return buildFallbackDiscussionPrompt(term, index);
    }

    const rawType =
      candidate && typeof candidate === "object"
        ? (candidate as Record<string, unknown>).type
        : undefined;

    return {
      id: index + 1,
      prompt: ensurePromptReferencesTerm(promptText, term.term),
      type: normalizeDiscussionPromptType(rawType, promptText),
      sourceTerm: term.term,
      highlightText: term.term,
    } satisfies DiscussionPrompt;
  });

  const rawSuggestedTitle =
    rawContent &&
    typeof rawContent === "object" &&
    !Array.isArray(rawContent) &&
    typeof (rawContent as Record<string, unknown>).suggestedTitle === "string"
      ? ((rawContent as Record<string, unknown>).suggestedTitle as string).trim()
      : undefined;

  return discussionResponseSchema.parse({
    ...(rawSuggestedTitle ? { suggestedTitle: rawSuggestedTitle } : {}),
    prompts,
  });
}

function buildFallbackDiscussionContent(terms: QuizTerm[]) {
  return discussionResponseSchema.parse({
    prompts: terms.map((term, index) =>
      buildFallbackDiscussionPrompt(term, index),
    ),
  });
}

async function fetchRecentSentencesToAvoid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  type: QuizType,
  terms: QuizTerm[],
): Promise<string[]> {
  try {
    const termSet = new Set(terms.map((t) => t.term.trim().toLowerCase()));
    const { data: recentQuizzes, error } = await supabase
      .from("quizzes")
      .select("generated_content")
      .eq("creator_id", userId)
      .eq("type", type)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error || !recentQuizzes) {
      return [];
    }

    const collected: string[] = [];
    const seen = new Set<string>();

    const pushIfNew = (candidate: unknown) => {
      if (typeof candidate !== "string") return;
      const trimmed = candidate.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      collected.push(trimmed);
    };

    for (const quiz of recentQuizzes) {
      const content = quiz.generated_content as Record<string, unknown> | null;
      if (!content) continue;

      if (Array.isArray(content.questions)) {
        for (const item of content.questions) {
          if (!item || typeof item !== "object") continue;
          const record = item as Record<string, unknown>;
          const termKey = String(
            record.sourceTerm ?? record.originalTerm ?? "",
          )
            .trim()
            .toLowerCase();
          if (termKey && termSet.size > 0 && !termSet.has(termKey)) continue;

          pushIfNew(record.englishReference);
          pushIfNew(record.ukrainianSentence);
          pushIfNew(record.sentence);
          pushIfNew(record.question);
        }
      }

      if (Array.isArray(content.prompts)) {
        for (const item of content.prompts) {
          if (!item || typeof item !== "object") continue;
          const record = item as Record<string, unknown>;
          const termKey = String(record.sourceTerm ?? "").trim().toLowerCase();
          if (termKey && termSet.size > 0 && !termSet.has(termKey)) continue;
          pushIfNew(record.prompt);
        }
      }

      if (content.content && typeof content.content === "object") {
        const inner = content.content as Record<string, unknown>;
        pushIfNew(inner.originalText);
      }

      if (collected.length >= 15) {
        break;
      }
    }

    return collected.slice(0, 15);
  } catch {
    return [];
  }
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
    config.avoidSentences = await fetchRecentSentencesToAvoid(
      supabase,
      user.id,
      type,
      terms,
    );

    const { prompt, blueprints } = getQuizPromptWithBlueprints(
      type,
      terms,
      config,
    );
    const subRulesByTerm = new Map<string, TopicSubRuleSpec>();
    for (const bp of blueprints) {
      if (bp.subRule) {
        subRulesByTerm.set(bp.term.term.toLowerCase(), bp.subRule);
      }
    }
    const translationSchema = createTranslationResponseSchema(subRulesByTerm);
    const systemInstruction = getSystemInstruction(config);
    const thinkingConfig = getQuizThinkingConfig(type);

    const cacheResolution =
      await resolveQuizSystemInstructionCache(systemInstruction);
    let cacheStatus = cacheResolution.status;

    const SCHEMA_MAP: Record<QuizType, z.ZodSchema> = {
      mcq: mcqResponseSchema,
      gap_fill: gapFillResponseSchema,
      translation: translationSchema,
      text_translation: textTranslationResponseSchema,
      translation_list: translationSchema,
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
    let cachedContentUsed = Boolean(cacheResolution.cachedContent);
    let cachedContentTokenCount = 0;

    const creativeTemperature =
      type === "translation" ||
      type === "translation_list" ||
      type === "gap_fill" ||
      type === "text_translation"
        ? 0.85
        : 0.7;

    const buildGenerateOptions = (temperature: number) => ({
      prompt,
      systemInstruction: cacheResolution.cachedContent
        ? undefined
        : systemInstruction,
      cachedContent: cacheResolution.cachedContent,
      temperature,
      thinkingConfig,
    });

    if (type === "discussion") {
      try {
        let result: Awaited<ReturnType<typeof generateJsonFromGeminiWithUsage>>;

        try {
          result = await generateJsonFromGeminiWithUsage(
            buildGenerateOptions(0.4),
          );
        } catch (error) {
          if (!cacheResolution.cachedContent) {
            throw error;
          }

          cacheStatus = "fallback";
          cachedContentUsed = false;
          console.warn(
            "Quiz discussion generation cache failed; retrying without cache",
            error,
          );

          result = await generateJsonFromGeminiWithUsage({
            prompt,
            systemInstruction,
            temperature: 0.4,
            thinkingConfig,
          });
        }

        generatedContent = normalizeDiscussionContent(
          result.data,
          blueprints.map((bp) => bp.term),
        );
        usageSnapshot = result.usageSnapshot;
        cachedContentTokenCount =
          result.usageMetadata?.cachedContentTokenCount ?? 0;
      } catch (error) {
        console.warn(
          "Discussion generation fell back to deterministic prompts:",
          error,
        );
        generatedContent = buildFallbackDiscussionContent(
          blueprints.map((bp) => bp.term),
        );
      }
    } else {
      let result: Awaited<ReturnType<typeof generateFromGeminiWithUsage>>;

      try {
        result = await generateFromGeminiWithUsage(
          buildGenerateOptions(creativeTemperature),
          SCHEMA_MAP[type],
        );
      } catch (error) {
        if (!cacheResolution.cachedContent) {
          throw error;
        }

        cacheStatus = "fallback";
        cachedContentUsed = false;
        console.warn(
          "Quiz generation cache failed; retrying without cache",
          error,
        );

        result = await generateFromGeminiWithUsage(
          {
            prompt,
            systemInstruction,
            temperature: creativeTemperature,
            thinkingConfig,
          },
          SCHEMA_MAP[type],
        );
      }

      generatedContent =
        type === "mcq" ? randomizeMCQContent(result.data) : result.data;
      usageSnapshot = result.usageSnapshot;
      cachedContentTokenCount =
        result.usageMetadata?.cachedContentTokenCount ?? 0;
    }

    console.info("Quiz generation config", {
      quizType: type,
      thinkingBudget: thinkingConfig?.thinkingBudget ?? null,
      cacheStatus,
      cachedContentUsed,
      cachedContentTokenCount,
    });

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

    const grammarTopicLabel = extractGrammarTopicLabelFromConfig(config);
    const customTopic = extractCustomTopicFromConfig(config);
    const fallbackTitle = buildFallbackQuizTitle({
      terms,
      grammarTopicLabel,
      customTopic,
    });
    const rawSuggestedTitle =
      generatedContent &&
      typeof generatedContent === "object" &&
      "suggestedTitle" in generatedContent &&
      typeof (generatedContent as { suggestedTitle?: unknown }).suggestedTitle ===
        "string"
        ? (generatedContent as { suggestedTitle: string }).suggestedTitle
        : null;
    const suggestedTitle = normalizeSuggestedQuizTitle({
      suggestedTitle: rawSuggestedTitle,
      grammarTopicLabel,
      fallbackTitle,
    });

    return NextResponse.json({ content: generatedContent, suggestedTitle });
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
