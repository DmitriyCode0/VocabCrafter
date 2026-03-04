import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";

export const GEMINI_MODEL = "gemini-2.0-flash";

let _genai: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!_genai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable");
    }
    _genai = new GoogleGenAI({ apiKey });
  }
  return _genai;
}

// ─── Retry wrapper with exponential backoff ──────────────────────

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Don't retry on validation errors (Zod) or client-level issues
      if (error instanceof SyntaxError) throw error;
      if (attempt < retries - 1) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ─── Generic Gemini wrapper ──────────────────────────────────────

interface GenerateOptions {
  prompt: string;
  systemInstruction: string;
  temperature?: number;
}

/**
 * Call Gemini with retry logic, parse the JSON response, and validate
 * against the provided Zod schema. Strips markdown code fences if present.
 */
export async function generateFromGemini<T>(
  options: GenerateOptions,
  schema: z.ZodSchema<T>,
): Promise<T> {
  return withRetry(async () => {
    const response = await getGenAI().models.generateContent({
      model: GEMINI_MODEL,
      contents: options.prompt,
      config: {
        systemInstruction: options.systemInstruction,
        temperature: options.temperature ?? 0.7,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("AI returned empty response");
    }

    // Strip markdown code fences just in case
    const cleaned = text
      .replace(/```(?:json)?\s*\n?/g, "")
      .replace(/\n?```\s*$/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    return schema.parse(parsed);
  });
}
