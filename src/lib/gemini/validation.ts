import { z } from "zod";

// MCQ validation
const mcqQuestionSchema = z.object({
  id: z.number(),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.string(),
  originalTerm: z.string(),
});

export const mcqResponseSchema = z.object({
  questions: z.array(mcqQuestionSchema),
});

// Gap-fill validation
const gapFillQuestionSchema = z.object({
  id: z.number(),
  sentence: z.string(),
  correctAnswer: z.string(),
  hint: z.string(),
  sourceTerm: z.string(),
});

export const gapFillResponseSchema = z.object({
  questions: z.array(gapFillQuestionSchema),
});

// Translation validation
const translationQuestionSchema = z.object({
  id: z.number(),
  ukrainianSentence: z.string(),
  englishReference: z.string(),
  sourceTerm: z.string(),
});

export const translationResponseSchema = z.object({
  questions: z.array(translationQuestionSchema),
});

// Text translation validation
export const textTranslationResponseSchema = z.object({
  content: z.object({
    originalText: z.string(),
    referenceTranslation: z.string(),
  }),
});

// Matching validation
const matchingPairSchema = z.object({
  term: z.string(),
  definition: z.string(),
});

export const matchingResponseSchema = z.object({
  pairs: z.array(matchingPairSchema),
});

// Flashcards validation
const flashcardSchema = z.object({
  term: z.string(),
  definition: z.string(),
  example: z.string().optional(),
});

export const flashcardsResponseSchema = z.object({
  cards: z.array(flashcardSchema),
});

// Discussion validation
const discussionPromptSchema = z.object({
  id: z.number(),
  prompt: z.string(),
  type: z.enum(["open-ended", "agree-disagree"]),
});

export const discussionResponseSchema = z.object({
  prompts: z.array(discussionPromptSchema),
});

// Evaluation validation
export const evaluationResponseSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
});

// Schema map for quiz types
import type { QuizType } from "@/types/quiz";

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

export function parseQuizResponse(type: QuizType, raw: string): unknown {
  // Strip markdown code blocks if present
  const cleaned = raw
    .replace(/```(?:json)?\s*\n?/g, "")
    .replace(/\n?```\s*$/g, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  const schema = SCHEMA_MAP[type];
  return schema.parse(parsed);
}
