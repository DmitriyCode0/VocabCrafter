import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGenAI, GEMINI_MODEL } from "@/lib/gemini/client";
import { z } from "zod";

const requestSchema = z.object({
  userTranslation: z.string().min(1),
  referenceTranslation: z.string().min(1),
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
});

const evaluationResponseSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
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

    const { userTranslation, referenceTranslation, cefrLevel } = parsed.data;

    const prompt = `Evaluate the following English translation attempt.

CEFR Level: ${cefrLevel}

Reference translation: "${referenceTranslation}"
Student's translation: "${userTranslation}"

Score the translation from 0 to 100 and provide constructive feedback.
Consider: accuracy, grammar, vocabulary usage, and naturalness.
Be encouraging but honest about mistakes.

Respond with JSON in this exact format:
{
  "score": 85,
  "feedback": "Detailed feedback here"
}`;

    const response = await getGenAI().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          "You are a professional English language teacher evaluating student translations. Always respond with valid JSON only. Do not include any markdown formatting or code blocks.",
        temperature: 0.4,
      },
    });

    const responseText = response.text;

    if (!responseText) {
      return NextResponse.json(
        { error: "AI returned empty response" },
        { status: 502 },
      );
    }

    const cleaned = responseText
      .replace(/```(?:json)?\s*\n?/g, "")
      .replace(/\n?```\s*$/g, "")
      .trim();

    const result = evaluationResponseSchema.parse(JSON.parse(cleaned));

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

    console.error("Evaluation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
