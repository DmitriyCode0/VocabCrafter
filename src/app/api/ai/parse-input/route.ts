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
  text: z.string().max(10000).default(""),
  targetLanguage: z.enum(["english", "spanish"]).optional(),
  sourceLanguage: z.enum(["english", "ukrainian"]).optional(),
  screenshots: z
    .array(
      z.object({
        mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
        data: z.string().min(1),
      }),
    )
    .max(3)
    .default([]),
}).refine(
  (value) => value.text.trim().length > 0 || value.screenshots.length > 0,
  {
    message: "Provide text or at least one screenshot",
    path: ["text"],
  },
);

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
    const { text, screenshots } = parsed.data;

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

    const hasText = text.trim().length > 0;
    const hasScreenshots = screenshots.length > 0;

    const prompt = `You are a vocabulary extraction assistant. Analyze the provided user text and screenshots, then extract ${targetLanguageLabel} vocabulary items.

For each extracted item, provide its meaning in ${sourceLanguageLabel}.

Core behavior:
- When the source contains explicit ${targetLanguageLabel} words or phrases, return those exact visible words or phrases.
- Preserve the original wording and order from the source whenever possible.
- Keep full multi-word expressions exactly as written, even when they are longer than 3 words.
- If a screenshot shows a clean list of ${targetLanguageLabel} items, treat it as the source of truth and transcribe those items faithfully.
- If the source already contains ${targetLanguageLabel}-${sourceLanguageLabel} pairs, preserve those pairings.
- Only infer new vocabulary when the source is raw notes or prose and does not already provide explicit ${targetLanguageLabel} items.

Critical rules:
- Do not replace visible phrases with synonyms, summaries, themes, or related concepts.
- Do not shorten or rewrite phrasal verbs, idioms, or expressions.
- If a screenshot shows "put it off", return "put it off", not "postpone".
- If a screenshot shows "a herculean task", return "a herculean task", not a related concept.
- Ignore unrelated app UI chrome, buttons, icons, and layout labels unless they are clearly part of the learning content.
- Deduplicate exact repeats across text and screenshots while keeping first-seen order.
- Provide accurate ${sourceLanguageLabel} meanings.
- Output valid JSON only, with no markdown.

Respond with JSON in this exact format:
{
  "terms": [
    {
      "term": "${targetLanguageLabel} word or phrase",
      "definition": "${sourceLanguageLabel} meaning"
    }
  ]
}

User input summary:
- Text included: ${hasText ? "yes" : "no"}
- Screenshot count: ${screenshots.length}
- Screenshot-first extraction mode: ${hasScreenshots ? "enabled" : "disabled"}`;

    const contents: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [{ text: prompt }];

    if (hasText) {
      contents.push({
        text: `User text:\n"""\n${text.trim()}\n"""`,
      });
    }

    for (const screenshot of screenshots) {
      contents.push({
        inlineData: {
          mimeType: screenshot.mimeType,
          data: screenshot.data,
        },
      });
    }

    const { data: result, usageSnapshot } = await generateFromGeminiWithUsage(
      {
        prompt,
        contents,
        systemInstruction: `You are a professional ${targetLanguageLabel}-${sourceLanguageLabel} vocabulary extraction tool. Your first priority is faithful extraction of the exact visible ${targetLanguageLabel} words and phrases from the user's text or screenshots. Never substitute related vocabulary when the source already shows the target term. Always respond with valid JSON only and do not include markdown or code blocks.`,
        temperature: 0.1,
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
