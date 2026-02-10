import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGenAI, GEMINI_MODEL } from "@/lib/gemini/client";
import { getQuizPrompt, getSystemInstruction } from "@/lib/gemini/prompts";
import { parseQuizResponse } from "@/lib/gemini/validation";
import type { GenerateQuizRequest } from "@/types/quiz";
import { z } from "zod";

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

    const prompt = getQuizPrompt(type, terms, config);
    const systemInstruction = getSystemInstruction(config);

    const response = await getGenAI().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const text = response.text;

    if (!text) {
      return NextResponse.json(
        { error: "AI returned empty response" },
        { status: 502 },
      );
    }

    const generatedContent = parseQuizResponse(type, text);

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
