import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromGemini } from "@/lib/gemini/client";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { z } from "zod";

const requestSchema = z.object({
  text: z.string().min(1).max(10000),
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

    const prompt = `You are a vocabulary extraction assistant. Analyze the following text and extract individual English words or short phrases (2-3 words max) that would be useful vocabulary for an English language learner.

For each extracted word/phrase, provide its Ukrainian translation.

Input text:
"""
${text}
"""

Rules:
- Extract meaningful vocabulary words (nouns, verbs, adjectives, adverbs, useful phrases)
- Skip common articles (a, an, the), prepositions, and very basic words unless they form part of a phrase
- If the input already contains word-definition pairs (e.g., tab-separated or formatted lists), preserve them
- If the input is a raw text or paragraph, extract the most useful vocabulary from it
- Provide accurate Ukrainian translations
- Output format must be valid JSON only, no markdown

Respond with JSON in this exact format:
{
  "terms": [
    {
      "term": "English word or phrase",
      "definition": "Ukrainian translation"
    }
  ]
}`;

    const result = await generateFromGemini(
      {
        prompt,
        systemInstruction:
          "You are a professional English-Ukrainian vocabulary extraction tool. Always respond with valid JSON only. Do not include any markdown formatting or code blocks.",
        temperature: 0.3,
      },
      parsedTermSchema,
    );

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
