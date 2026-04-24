import { z } from "zod";
import { generateFromGemini } from "@/lib/gemini/client";
import { getGrammarPromptDetails } from "@/lib/grammar/rules";
import type { QuizConfig, TranslationQuestion } from "@/types/quiz";
import {
  getLearningLanguageLabel,
  getSourceLanguageLabel,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
} from "@/lib/languages";

const translationGrammarValidationSchema = z.object({
  valid: z.boolean(),
  reason: z.string().min(1),
});

async function validateTranslationQuestion(
  question: TranslationQuestion,
  topic: string,
  config: QuizConfig,
): Promise<{ valid: boolean; reason: string }> {
  const topicLabel = config.grammarTopicLabels?.[topic] ?? topic;
  const rule =
    config.grammarTopicDetails?.[topic] ?? getGrammarPromptDetails(topic);
  const targetLanguageLabel = getLearningLanguageLabel(
    normalizeLearningLanguage(config.targetLanguage),
  );
  const sourceLanguageLabel = getSourceLanguageLabel(
    normalizeSourceLanguage(config.sourceLanguage),
  );

  const prompt = `You are validating a ${targetLanguageLabel} learning translation exercise.

Check whether this exercise REALLY forces the target grammar topic.

TARGET GRAMMAR TOPIC: ${topicLabel}
GRAMMAR RULE: ${rule}
CEFR LEVEL: ${config.cefrLevel}

SOURCE SENTENCE (${sourceLanguageLabel}) stored in the compatibility field "ukrainianSentence":
"${question.ukrainianSentence}"

TARGET REFERENCE (${targetLanguageLabel}) stored in the compatibility field "englishReference":
"${question.englishReference}"

Return valid=true ONLY if ALL THREE conditions are true:
1. The ${targetLanguageLabel} reference clearly uses the target grammar topic.
2. A student translating the ${sourceLanguageLabel} sentence naturally would reasonably be expected to use that same grammar.
3. The ${sourceLanguageLabel} sentence is itself grammatical and natural, with correct inflection/agreement for the source language.

Return valid=false if the grammar is optional, if multiple natural ${targetLanguageLabel} renderings would avoid the target grammar, if the reference sentence itself does not clearly demonstrate the topic, or if the ${sourceLanguageLabel} sentence has awkward or incorrect inflection/agreement.

Respond with JSON in this exact format:
{
  "valid": true,
  "reason": "short explanation"
}`;

  return generateFromGemini(
    {
      prompt,
      systemInstruction: `You are an expert ${targetLanguageLabel} grammar validator. Respond with valid JSON only.`,
      temperature: 0.1,
    },
    translationGrammarValidationSchema,
  );
}

export async function validateTranslationQuestions(
  questions: TranslationQuestion[],
  config: QuizConfig,
): Promise<{
  valid: boolean;
  questions: TranslationQuestion[];
  reasons: string[];
}> {
  const topic = config.grammarTopics?.[0];

  if (!topic) {
    return {
      valid: true,
      questions,
      reasons: [],
    };
  }

  const validatedQuestions: TranslationQuestion[] = [];
  const reasons: string[] = [];

  for (const question of questions) {
    const validation = await validateTranslationQuestion(
      question,
      topic,
      config,
    );

    if (!validation.valid) {
      reasons.push(`Question ${question.id}: ${validation.reason}`);
      continue;
    }

    validatedQuestions.push({
      ...question,
      validatedGrammarTopic: topic,
      validatedGrammarTopicLabel: config.grammarTopicLabels?.[topic] ?? topic,
      grammarValidationReason: validation.reason,
    });
  }

  return {
    valid: reasons.length === 0,
    questions: validatedQuestions,
    reasons,
  };
}
