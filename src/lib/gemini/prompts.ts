import type { QuizConfig, QuizTerm, QuizType } from "@/types/quiz";
import { GRAMMAR_RULES } from "@/lib/grammar/rules";

function formatTerms(terms: QuizTerm[]): string {
  return terms.map((t) => `- "${t.term}" = "${t.definition}"`).join("\n");
}

function configContext(config: QuizConfig): string {
  const parts = [
    `CEFR Level: ${config.cefrLevel}`,
    `Vocabulary Complexity: ${config.vocabularyChallenge}`,
    `Grammar Complexity: ${config.grammarChallenge}`,
    `Teacher Persona: ${config.teacherPersona}`,
  ];
  if (config.grammarTopics?.length) {
    const topicDetails = config.grammarTopics
      .map((topic) => {
        const rule = GRAMMAR_RULES[topic];
        return rule ? `- ${topic}:\n${rule}` : `- ${topic}`;
      })
      .join("\n\n");
    parts.push(
      `Grammar Focus (generate sentences using these grammar patterns):\n${topicDetails}`,
    );
  }
  if (config.customTopic) {
    parts.push(`Custom Topic/Context: ${config.customTopic}`);
  }
  return parts.join("\n");
}

const PERSONA_MAP = {
  learning:
    "You are a friendly, encouraging language tutor who gives supportive feedback.",
  strict: "You are a strict but fair language examiner who demands precision.",
  standard:
    "You are a professional language teacher who gives clear, balanced feedback.",
} as const;

export function getSystemInstruction(config: QuizConfig): string {
  return `${PERSONA_MAP[config.teacherPersona]}
You generate English language learning content for students at CEFR level ${config.cefrLevel}.
Always respond with valid JSON only. Do not include any markdown formatting or code blocks.`;
}

export function getMCQPrompt(terms: QuizTerm[], config: QuizConfig): string {
  return `Generate a multiple-choice quiz using the following vocabulary terms.

${configContext(config)}

Vocabulary terms:
${formatTerms(terms)}

Generate exactly ${terms.length} questions. For each term, create a question that tests the student's understanding.
Each question should have exactly 4 options with one correct answer.

Respond with JSON in this exact format:
{
  "questions": [
    {
      "id": 1,
      "question": "What does 'term' mean?",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": "option1",
      "originalTerm": "term"
    }
  ]
}`;
}

export function getGapFillPrompt(
  terms: QuizTerm[],
  config: QuizConfig,
): string {
  return `Generate a gap-fill exercise using the following vocabulary terms.

${configContext(config)}

Vocabulary terms:
${formatTerms(terms)}

Generate exactly ${terms.length} sentences. Each sentence should use one of the vocabulary terms in context, with the term replaced by a blank (___).
Provide a hint for each question.

Respond with JSON in this exact format:
{
  "questions": [
    {
      "id": 1,
      "sentence": "She ___ the book on the table.",
      "correctAnswer": "placed",
      "hint": "To put something in a specific position",
      "sourceTerm": "place"
    }
  ]
}`;
}

export function getTranslationPrompt(
  terms: QuizTerm[],
  config: QuizConfig,
): string {
  return `Generate a translation exercise using the following vocabulary terms.

${configContext(config)}

Vocabulary terms:
${formatTerms(terms)}

Generate exactly ${terms.length} Ukrainian sentences that incorporate the vocabulary terms, along with their English reference translations.
The sentences should be at the appropriate CEFR level.

Respond with JSON in this exact format:
{
  "questions": [
    {
      "id": 1,
      "ukrainianSentence": "Ukrainian sentence here",
      "englishReference": "English translation here",
      "sourceTerm": "vocabulary term used"
    }
  ]
}`;
}

export function getTextTranslationPrompt(
  terms: QuizTerm[],
  config: QuizConfig,
): string {
  return `Generate a text translation exercise using the following vocabulary terms.

${configContext(config)}

Vocabulary terms:
${formatTerms(terms)}

Create a short paragraph (3-5 sentences) in Ukrainian that incorporates as many of the vocabulary terms as possible.
The text should be at the appropriate CEFR level. Provide a reference English translation.

Respond with JSON in this exact format:
{
  "content": {
    "originalText": "Ukrainian paragraph here",
    "referenceTranslation": "English translation here"
  }
}`;
}

export function getMatchingPrompt(
  terms: QuizTerm[],
  config: QuizConfig,
): string {
  return `Generate a matching exercise using the following vocabulary terms.

${configContext(config)}

Vocabulary terms:
${formatTerms(terms)}

Create term-definition pairs for matching. Use the provided terms and their definitions, but rephrase the definitions to test deeper understanding.

Respond with JSON in this exact format:
{
  "pairs": [
    {
      "term": "vocabulary term",
      "definition": "rephrased definition"
    }
  ]
}`;
}

export function getFlashcardsPrompt(
  terms: QuizTerm[],
  config: QuizConfig,
): string {
  return `Generate flashcard content using the following vocabulary terms.

${configContext(config)}

Vocabulary terms:
${formatTerms(terms)}

For each term, provide the definition and an example sentence using the term at the appropriate CEFR level.

Respond with JSON in this exact format:
{
  "cards": [
    {
      "term": "vocabulary term",
      "definition": "clear definition",
      "example": "Example sentence using the term."
    }
  ]
}`;
}

export function getDiscussionPrompt(
  terms: QuizTerm[],
  config: QuizConfig,
): string {
  return `Generate discussion prompts using the following vocabulary terms as thematic inspiration.

${configContext(config)}

Vocabulary terms:
${formatTerms(terms)}

Generate 3-5 discussion prompts that encourage using the vocabulary terms in conversation.
Mix open-ended questions with agree/disagree statements.

Respond with JSON in this exact format:
{
  "prompts": [
    {
      "id": 1,
      "prompt": "Discussion question or statement here",
      "type": "open-ended"
    }
  ]
}`;
}

export function getEvaluationPrompt(
  userTranslation: string,
  referenceTranslation: string,
  config: QuizConfig,
): string {
  return `Evaluate the following English translation attempt.

${configContext(config)}

Reference translation: "${referenceTranslation}"
Student's translation: "${userTranslation}"

Score the translation from 0 to 100 and provide constructive feedback.
Consider: accuracy, grammar, vocabulary usage, and naturalness.

Respond with JSON in this exact format:
{
  "score": 85,
  "feedback": "Detailed feedback here"
}`;
}

const PROMPT_MAP: Record<
  QuizType,
  (terms: QuizTerm[], config: QuizConfig) => string
> = {
  mcq: getMCQPrompt,
  gap_fill: getGapFillPrompt,
  translation: getTranslationPrompt,
  text_translation: getTextTranslationPrompt,
  translation_list: getTranslationPrompt,
  matching: getMatchingPrompt,
  flashcards: getFlashcardsPrompt,
  discussion: getDiscussionPrompt,
};

export function getQuizPrompt(
  type: QuizType,
  terms: QuizTerm[],
  config: QuizConfig,
): string {
  const promptFn = PROMPT_MAP[type];
  return promptFn(terms, config);
}
