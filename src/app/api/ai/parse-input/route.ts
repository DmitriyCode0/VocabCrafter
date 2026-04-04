import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromGeminiWithUsage, GEMINI_MODEL } from "@/lib/gemini/client";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import { z } from "zod";
import {
  getLearningLanguageLabel,
  getSourceLanguageLabel,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
} from "@/lib/languages";

const requestSchema = z.object({
  text: z.string().min(1).max(10000),
  targetLanguage: z.enum(["english", "spanish"]).optional(),
  sourceLanguage: z.enum(["english", "ukrainian"]).optional(),
});

const parsedTermSchema = z.object({
  terms: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    }),
  ),
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

    const targetLanguage = normalizeLearningLanguage(
      parsed.data.targetLanguage,
    );
    const sourceLanguage = normalizeSourceLanguage(parsed.data.sourceLanguage);
    const targetLanguageLabel = getLearningLanguageLabel(targetLanguage);
    const sourceLanguageLabel = getSourceLanguageLabel(sourceLanguage);
    const { text } = parsed.data;

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

    const prompt = `You are a vocabulary extraction assistant. Analyze the following input and extract individual ${targetLanguageLabel} words or short phrases (2-3 words max) that would be useful for a ${targetLanguageLabel} learner.

For each extracted word or phrase, provide its meaning in ${sourceLanguageLabel}.

Input text:
"""
${text}
"""

Rules:
- Extract meaningful vocabulary words (nouns, verbs, adjectives, adverbs, useful phrases)
- Skip common articles (a, an, the), prepositions, and very basic words unless they form part of a phrase
- The input text is primarily written in ${sourceLanguageLabel}. Use it as context to infer useful ${targetLanguageLabel} vocabulary.
- If the input already contains word-definition pairs (e.g., tab-separated or formatted lists), preserve them when possible
- If the input is a raw text or paragraph, extract the most useful vocabulary from it
- Provide accurate ${sourceLanguageLabel} meanings
- Output format must be valid JSON only, no markdown

Respond with JSON in this exact format:
{
  "terms": [
    {
      "term": "${targetLanguageLabel} word or phrase",
      "definition": "${sourceLanguageLabel} meaning"
    }
  ]
}`;

    const { data: result, usageSnapshot } = await generateFromGeminiWithUsage(
      {
        prompt,
        systemInstruction: `You are a professional ${targetLanguageLabel}-${sourceLanguageLabel} vocabulary extraction tool. Always respond with valid JSON only. Do not include any markdown formatting or code blocks.`,
        temperature: 0.3,
      },
      parsedTermSchema,
    );

    await recordAIUsageEvent({
      userId: user.id,
      feature: "parse_input",
      requestType: "text",
      model: GEMINI_MODEL,
      snapshot: usageSnapshot,
    });

    // Increment AI call counter after successful parse
    await incrementAICalls(user.id);

    return NextResponse.json(result);
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

    console.error("Parse input error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
