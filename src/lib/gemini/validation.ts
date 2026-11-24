import { z } from "zod";
import {
  selectGapFillCandidate,
  selectTranslationCandidate,
  type TopicSubRuleSpec,
} from "@/lib/grammar/sentence-blueprints";
import type {
  GapFillQuestion,
  QuizType,
  TranslationQuestion,
} from "@/types/quiz";

// MCQ validation
const mcqQuestionSchema = z.object({
  id: z.number(),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.string(),
  originalTerm: z.string(),
});

export const mcqResponseSchema = z.object({
  suggestedTitle: z.string().trim().max(80).optional(),
  questions: z.array(mcqQuestionSchema),
});

// Gap-fill validation (supports multi-candidate randomization + flat backward compatibility)
const flatGapFillQuestionSchema = z.object({
  id: z.number(),
  sentence: z.string(),
  correctAnswer: z.string(),
  hint: z.string(),
  sourceTerm: z.string(),
});

const multiCandidateGapFillQuestionSchema = z.object({
  id: z.number(),
  hint: z.string(),
  sourceTerm: z.string(),
  candidates: z
    .array(
      z.object({
        sentence: z.string(),
        correctAnswer: z.string(),
      }),
    )
    .min(1),
});

const gapFillQuestionSchema = z
  .union([multiCandidateGapFillQuestionSchema, flatGapFillQuestionSchema])
  .transform((item): GapFillQuestion => {
    if ("candidates" in item) {
      const picked = selectGapFillCandidate(item.candidates);
      return {
        id: item.id,
        sentence: picked.sentence,
        correctAnswer: picked.correctAnswer,
        hint: item.hint,
        sourceTerm: item.sourceTerm,
      };
    }

    return item;
  });

export const gapFillResponseSchema = z.object({
  suggestedTitle: z.string().trim().max(80).optional(),
  questions: z.array(gapFillQuestionSchema),
});

// Translation validation (supports multi-candidate randomization + sub-rule filtering)
const flatTranslationQuestionSchema = z.object({
  id: z.number(),
  ukrainianSentence: z.string(),
  englishReference: z.string(),
  sourceTerm: z.string(),
  highlightText: z.string().optional(),
  validatedGrammarTopic: z.string().optional(),
  validatedGrammarTopicLabel: z.string().optional(),
  grammarValidationReason: z.string().optional(),
});

const multiCandidateTranslationQuestionSchema = z.object({
  id: z.number(),
  sourceTerm: z.string(),
  candidates: z
    .array(
      z.object({
        ukrainianSentence: z.string(),
        englishReference: z.string(),
        highlightText: z.string().optional(),
      }),
    )
    .min(1),
});

export function createTranslationResponseSchema(
  subRulesByTerm?: Map<string, TopicSubRuleSpec>,
) {
  const questionSchema = z
    .union([
      multiCandidateTranslationQuestionSchema,
      flatTranslationQuestionSchema,
    ])
    .transform((item): TranslationQuestion => {
      if ("candidates" in item) {
        const subRule = subRulesByTerm?.get(item.sourceTerm.toLowerCase());
        const picked = selectTranslationCandidate(item.candidates, subRule);
        return {
          id: item.id,
          sourceTerm: item.sourceTerm,
          ukrainianSentence: picked.ukrainianSentence,
          englishReference: picked.englishReference,
          highlightText: picked.highlightText,
        };
      }

      return item;
    });

  return z.object({
    suggestedTitle: z.string().trim().max(80).optional(),
    questions: z.array(questionSchema),
  });
}

export const translationResponseSchema = createTranslationResponseSchema();

// Text translation validation
export const textTranslationResponseSchema = z.object({
  suggestedTitle: z.string().trim().max(80).optional(),
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
  sourceTerm: z.string().optional(),
  highlightText: z.string().optional(),
});

export const discussionResponseSchema = z.object({
  suggestedTitle: z.string().trim().max(80).optional(),
  prompts: z.array(discussionPromptSchema),
});

// Evaluation validation
export const evaluationResponseSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
});

// Schema map for quiz types
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
