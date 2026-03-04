import type {
  QuizConfig,
  QuizTerm,
  QuizType,
  CEFRLevel,
  VocabularyChallenge,
  GrammarChallenge,
  TeacherPersona,
} from "@/types/quiz";
import { GRAMMAR_RULES } from "@/lib/grammar/rules";

// ─── Formatting helpers ──────────────────────────────────────────

function formatTerms(terms: QuizTerm[]): string {
  return terms.map((t) => `- ${t.term}: ${t.definition}`).join("\n");
}

/** Shuffle array and take first `n` items */
export function shuffleAndSlice<T>(array: T[], limit: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(array.length, limit));
}

// ─── Topic instruction ───────────────────────────────────────────

function getTopicInstruction(topic?: string): string {
  if (!topic?.trim()) return "";
  return `
CRITICAL CONTEXT INSTRUCTION: The generated content MUST relate to the specific topic: "${topic.trim()}".
While you must use the provided vocabulary list, try to frame the sentences, questions, or scenarios within this topic/context as much as possible.
`;
}

// ─── Difficulty instructions ─────────────────────────────────────

function getDifficultyInstruction(
  vocab: VocabularyChallenge,
  grammar: GrammarChallenge,
  type:
    | "mcq"
    | "gap_fill"
    | "translate_uk_en"
    | "discussion"
    | "text_translation",
): string {
  let vocabInstruction = "";
  switch (vocab) {
    case "Simple":
      vocabInstruction =
        "Use only basic, high-frequency vocabulary in the surrounding text/distractors.";
      break;
    case "Standard":
      vocabInstruction =
        "Use standard, on-level vocabulary appropriate for the Student's Proficiency level.";
      break;
    case "Complex":
      vocabInstruction =
        "Incorporate some more advanced or less common (but still on-level) vocabulary to challenge the user.";
      break;
  }

  let grammarInstruction = "";
  switch (grammar) {
    case "Simple":
      grammarInstruction =
        "Construct sentences using simple grammar (e.g., single clauses, basic tenses).";
      break;
    case "Standard":
      grammarInstruction =
        "Use standard sentence structures with a mix of simple and compound sentences appropriate for the Student's Proficiency level.";
      break;
    case "Complex":
      grammarInstruction =
        "Employ more complex grammatical structures (e.g., multiple clauses, advanced tenses, passive voice) to challenge the user.";
      break;
  }

  switch (type) {
    case "mcq":
      return `
CRITICAL VOCABULARY INSTRUCTION: ${vocabInstruction} This is especially important for the incorrect options (distractors). For a 'Complex' vocabulary challenge, distractors should be very close synonyms. For a 'Simple' challenge, they should be clearly wrong.
CRITICAL GRAMMAR INSTRUCTION: ${grammarInstruction} This applies to the question sentence itself.
`;
    case "gap_fill":
    case "translate_uk_en":
    case "text_translation":
      return `
CRITICAL VOCABULARY INSTRUCTION: ${vocabInstruction}
CRITICAL GRAMMAR INSTRUCTION: ${grammarInstruction} The sentence structure must adhere to this.
`;
    case "discussion":
      if (vocab === "Complex" || grammar === "Complex") {
        return "CRITICAL: The prompts should be more abstract, hypothetical, or philosophical, requiring deeper critical thinking and justification.";
      } else if (vocab === "Simple" || grammar === "Simple") {
        return "CRITICAL: The prompts should be personal and direct, asking for simple opinions or experiences.";
      } else {
        return "CRITICAL: The prompts should ask for opinions on familiar topics, requiring some explanation or justification.";
      }
  }
  return "";
}

// ─── Grammar rules extraction ────────────────────────────────────

function getGrammarRulesSection(
  topics: string[] | undefined,
  difficulty: GrammarChallenge,
): string {
  if (!topics || topics.length === 0) return "";

  const rules = topics.map((topicKey) => {
    const rule = GRAMMAR_RULES[topicKey];
    if (!rule) return `- ${topicKey}`;

    let constraint = "";
    switch (difficulty) {
      case "Simple":
        constraint =
          "Use the most basic form of this structure. Keep sentences short.";
        break;
      case "Standard":
        constraint =
          "Use standard forms of this structure as demonstrated in the examples.";
        break;
      case "Complex":
        constraint =
          "Combine this structure with others. Use in complex sentences with multiple clauses.";
        break;
    }

    return `
- TOPIC: ${topicKey}
  * Rule: ${rule.split("\n").slice(0, 2).join(" ")}
  * Constraint: ${constraint}`;
  });

  return `
The content must specifically test the following grammatical structures. Follow the constraints precisely:
${rules.join("\n")}
`;
}

// ─── Teacher Persona ─────────────────────────────────────────────

function getTeacherPersonaInstruction(persona: TeacherPersona): string {
  switch (persona) {
    case "learning":
      return `
**TEACHER PERSONA: The Mentor (Learning Mode)**
OVERRIDE INSTRUCTION: You are a patient guide focused purely on improvement.
1. **Constructive Feedback:** Provide highly detailed, educational explanations for any mistakes.
2. **Encouraging Tone:** Use positive language. Even if the answer is wrong, find something good to say.
3. **No Grading Pressure:** Your feedback should sound like a helpful peer review, not an exam result.
4. **Forgive Mechanics:** Focus on the core meaning and grammar. Ignore minor punctuation slips.
`;
    case "strict":
      return `
**TEACHER PERSONA: The Examiner (Precision-Focused)**
OVERRIDE INSTRUCTION: You are a strict, perfectionist editor. Apply **NATIVE-LEVEL STANDARDS**.
1. **Zero Tolerance:** Deduct points for ANY error in punctuation, capitalization, spelling, or articles.
2. **Style Penalty:** If the grammar is correct but the phrasing is unnatural or "clunky", deduct points.
3. **Accuracy is King:** Communication is not enough. The form must be perfect.
4. **Feedback Tone:** Direct, clinical, and exhaustive. List every single flaw.
`;
    case "standard":
    default:
      return `
**TEACHER PERSONA: The Expert Tutor (20+ years experience)**
You are an expert English-Ukrainian teacher with 20+ years of experience.
**SCORING ALGORITHM (Start at 100%, Max 110%):**
1. **Grammar/Topic Compliance:** Deduct 25% IMMEDIATELY if the requested grammar topic rules are violated, even minor violations.
2. **Mechanics (Capitalization):** Deduct 5% if the sentence start or "I" is not capitalized.
3. **Spelling & Lexis:** Deduct 5% PER spelling error. Extra 5% for each contextually incorrect word.
4. **Bonuses (Max 110%):** +5% for correct internal punctuation. +5% for using valid vocabulary above target CEFR level.
**FEEDBACK FORMAT:**
- Keep explanations short and direct.
- For errors use format: "[Where the mistake is] -> [What should be there]. Correct: [Correct phrase]"
- Always provide the suggested full answer at the end.
`;
  }
}

// ─── Evaluation Rubrics (per CEFR level) ─────────────────────────

function getEvaluationRubric(level: CEFRLevel): {
  personality: string;
  rubric: string;
  specialInstructions: string;
} {
  const base = `**CRITICAL SCORING RULE:** The provided model answer is just one correct example. If the student's translation is grammatically correct and accurately conveys the same meaning, it MUST receive a high score, even if it uses different words or sentence structures. Do not penalize valid alternative phrasings.`;

  switch (level) {
    case "A1":
      return {
        personality: `You are a highly supportive and forgiving English coach for absolute beginners. Your philosophy is: "If the message is conveyed, it is a success."`,
        rubric: `
- **Communicative Success (80 pts):** Did the student convey the main idea?
- **Grammar (10 pts):** No major blocking errors.
- **Vocabulary (10 pts):** Target word used correctly.`,
        specialInstructions: `${base}
**CRITICAL A1 RULES:**
1. **Focus on Keywords:** If the key nouns and verbs are translated correctly, the score should be high.
2. **Grammar Exception:** If the student was specifically asked to practice a grammar topic and fails to use it, the score CANNOT exceed 50%.`,
      };
    case "A2":
      return {
        personality: `You are a precise English teacher for elementary learners. You value communication, but you are STRICT about basic grammar rules (Present vs Past, S-V-O order).`,
        rubric: `
- **Grammar & Syntax (50 pts):** Grammar is correct for A2 level.
- **Communicative Success (40 pts):** Meaning is perfectly clear.
- **Vocabulary (10 pts):** Correct target vocabulary or synonym.`,
        specialInstructions: `${base}
**CRITICAL A2 RULES:**
1. **Grammar Priority:** Deduct points for basic grammar errors (e.g., "He go").
2. **Grammar Focus Enforcement:** If a specific grammar topic was requested and missed, cap score at 50%.`,
      };
    case "B1":
      return {
        personality: `You are a helpful English tutor for intermediate learners. You expect standard grammar to be correct.`,
        rubric: `
- **Meaning & Accuracy (50 pts):** Meaning is fully conveyed.
- **Grammar & Syntax (40 pts):** Good control of B1 grammar.
- **Vocabulary (10 pts):** Correct word or valid synonym.`,
        specialInstructions: `${base}
**CRITICAL B1 RULES:**
1. **Grammar Focus Enforcement:** If specific grammar topics were requested, the student MUST use them.
2. **Structure:** Basic compound sentences should be correct.`,
      };
    case "B2":
      return {
        personality: `You are a demanding English coach. At B2, you expect fluency and accuracy. Basic errors are no longer tolerated.`,
        rubric: `
- **Grammar & Accuracy (50 pts):** Complex structures are used correctly.
- **Vocabulary & Style (30 pts):** Natural collocation and phrasing.
- **Meaning (20 pts):** Precise translation of nuance.`,
        specialInstructions: `${base}
**CRITICAL B2 RULES:**
1. **Strict Grammar Focus:** Usage of requested grammar topics is MANDATORY.
2. **No Basic Errors:** Penalize strictly for A1/A2 errors.`,
      };
    case "C1":
    case "C2":
      return {
        personality: `You are a professor of English Linguistics. You accept nothing less than native-like precision, nuance, and style.`,
        rubric: `
- **Stylistic Precision (40 pts):** Idiomatic and natural flow.
- **Grammar Accuracy (40 pts):** Flawless structure.
- **Vocabulary Sophistication (20 pts):** Precise word choice.`,
        specialInstructions: `${base}
**CRITICAL C1/C2 RULES:**
1. **Style & Nuance:** Deduct points for "clunky" or "textbook" phrasing. It must sound natural.
2. **Grammar Perfection:** Zero tolerance for grammar errors.`,
      };
    default:
      return {
        personality: `You are a helpful English tutor.`,
        rubric: `Standard scoring.`,
        specialInstructions: base,
      };
  }
}

// ─── System instruction ──────────────────────────────────────────

export function getSystemInstruction(config: QuizConfig): string {
  const personaLine =
    config.teacherPersona === "learning"
      ? "You are a friendly, encouraging language tutor who gives supportive feedback."
      : config.teacherPersona === "strict"
        ? "You are a strict but fair language examiner who demands precision."
        : "You are a professional language teacher who gives clear, balanced feedback.";

  return `${personaLine}
You generate English language learning content for students at CEFR level ${config.cefrLevel}.
Always respond with valid JSON only. Do not include any markdown formatting or code blocks.`;
}

// ─── Per-type prompt constructors ────────────────────────────────

export function getMCQPrompt(terms: QuizTerm[], config: QuizConfig): string {
  const difficultyInstruction = getDifficultyInstruction(
    config.vocabularyChallenge,
    config.grammarChallenge,
    "mcq",
  );
  const topicInstruction = getTopicInstruction(config.customTopic);

  return `You are an expert quiz creator specializing in English vocabulary for language learners.
Your task is to generate a multiple-choice quiz from a list of English words and their Ukrainian translations.
The Ukrainian translation is provided ONLY to give you context for the intended meaning of the English word, especially for words with multiple meanings. The entire quiz (questions, options, and answers) must be in ENGLISH.
The difficulty of the vocabulary used in questions and incorrect options should be appropriate for a Student at CEFR ${config.cefrLevel} proficiency.
${difficultyInstruction}
${topicInstruction}

For each word in the provided list, create one question that tests its meaning. The question could be a definition, a synonym, an antonym, or a fill-in-the-blank sentence.
Generate four options for each question: one correct answer and three plausible but incorrect distractors. Crucially, all four options should be of similar length and grammatical structure to prevent the correct answer from being obvious.
Ensure the 'originalTerm' field matches the English word from the input list exactly.

Vocabulary terms:
${formatTerms(terms)}

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
  const difficultyInstruction = getDifficultyInstruction(
    config.vocabularyChallenge,
    config.grammarChallenge,
    "gap_fill",
  );
  const topicInstruction = getTopicInstruction(config.customTopic);

  return `You are an expert quiz creator specializing in English vocabulary for language learners.
Your task is to generate a set of gap-fill (fill-in-the-blank) exercises from a list of English words and their Ukrainian translations.
The difficulty of the sentence structure and vocabulary should be appropriate for a Student at CEFR ${config.cefrLevel} proficiency.
${difficultyInstruction}
${topicInstruction}

For each word in the provided list, create one ENGLISH sentence that uses the word in a natural context. In the sentence, replace the target English word with '___' to create a blank.
- The 'correctAnswer' field should be the exact word that fits in the blank. This might be a conjugated form of the original term (e.g., 'goes' instead of 'go').
- The 'sourceTerm' field MUST be the original English word from the input list, exactly as provided.
- The 'hint' field must be the original Ukrainian translation from the input list.

Vocabulary terms:
${formatTerms(terms)}

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
  const difficultyInstruction = getDifficultyInstruction(
    config.vocabularyChallenge,
    config.grammarChallenge,
    "translate_uk_en",
  );
  const topicInstruction = getTopicInstruction(config.customTopic);
  const grammarRules = getGrammarRulesSection(
    config.grammarTopics,
    config.grammarChallenge,
  );

  return `You are an expert in creating language translation exercises for English learners whose native language is Ukrainian.
Your task is to generate a set of exactly ${terms.length} translation challenges.

CRITICAL LEVEL INSTRUCTION:
1. **Student Proficiency:** The student is at level **${config.cefrLevel}**. The complexity of vocabulary (outside the target words), sentence length, and context must match this level.
2. **Grammar Target:** The sentences MUST specifically test the grammatical structures listed below.
   *Example:* If a B2 student is practicing an A2 topic (e.g., First Conditional), create a sophisticated B2-level sentence that happens to use the First Conditional structure.

${difficultyInstruction}
${grammarRules}
${topicInstruction}

For each word, create one complete UKRAINIAN sentence that uses the Ukrainian translation in a natural context and implicitly requires the specified grammar for its English translation.
Then, provide a correct and natural-sounding ENGLISH translation. This English translation must demonstrate the target grammar.
Ensure the 'sourceTerm' field matches the English word from the input list exactly.

Vocabulary terms:
${formatTerms(terms)}

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
  const difficultyInstruction = getDifficultyInstruction(
    config.vocabularyChallenge,
    config.grammarChallenge,
    "text_translation",
  );
  const topicInstruction = getTopicInstruction(config.customTopic);
  const grammarRules = getGrammarRulesSection(
    config.grammarTopics,
    config.grammarChallenge,
  );

  return `You are an expert in creating language translation exercises for English learners whose native language is Ukrainian.
Your task is to generate a short, cohesive text for translation.

CRITICAL LEVEL INSTRUCTION:
1. **Student Proficiency:** The student is at level **${config.cefrLevel}**. The complexity of vocabulary, sentence length, and context must match this level.
2. **Grammar Target:** The sentences MUST specifically test the grammatical structures listed below.

CRITICAL INSTRUCTION:
1. Create a cohesive text in UKRAINIAN that is approximately 5 sentences long.
2. The text should be on a single, clear topic.
3. Naturally incorporate several words from the provided vocabulary list. You DO NOT need to use all the words; prioritize creating a text that reads naturally.
${difficultyInstruction}
${grammarRules}
${topicInstruction}
4. After creating the Ukrainian text, provide a correct and natural-sounding ENGLISH translation for the entire text.

Vocabulary terms:
${formatTerms(terms)}

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
  const topicInstruction = getTopicInstruction(config.customTopic);

  return `Generate a matching exercise using the following vocabulary terms.

CEFR Level: ${config.cefrLevel}
Vocabulary Complexity: ${config.vocabularyChallenge}
${topicInstruction}

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
  const topicInstruction = getTopicInstruction(config.customTopic);

  return `Generate flashcard content using the following vocabulary terms.

CEFR Level: ${config.cefrLevel}
${topicInstruction}

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
  const difficultyInstruction = getDifficultyInstruction(
    config.vocabularyChallenge,
    config.grammarChallenge,
    "discussion",
  );
  const topicInstruction = getTopicInstruction(config.customTopic);

  return `You are an expert in creating engaging educational materials for English language learners.
Your task is to generate a list of prompts based on a list of English words and their Ukrainian translations. The Ukrainian translation is for context only. All output must be in ENGLISH.
The complexity and subject matter of the prompts should be appropriate for a Student at CEFR ${config.cefrLevel} proficiency.
${difficultyInstruction}
${topicInstruction}

Based on the list of words provided, generate thought-provoking prompts. Mix open-ended discussion questions with agree/disagree statements.

Vocabulary terms:
${formatTerms(terms)}

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

// ─── Evaluation prompt ───────────────────────────────────────────

export function getEvaluationPrompt(
  userTranslation: string,
  referenceTranslation: string,
  config: QuizConfig,
): string {
  const { personality, rubric, specialInstructions } = getEvaluationRubric(
    config.cefrLevel,
  );
  const personaInstruction = getTeacherPersonaInstruction(
    config.teacherPersona,
  );
  const grammarRules = getGrammarRulesSection(
    config.grammarTopics,
    config.grammarChallenge,
  );

  const grammarCheckInstruction =
    config.grammarTopics && config.grammarTopics.length > 0
      ? `CRITICAL GRAMMAR CHECK: The user MUST demonstrate usage of ${config.grammarTopics.map((t) => `"${t}"`).join(" AND ")}. If they used a different structure (even if grammatically correct in general English), deduct 25 points as per the 'Grammar/Topic Compliance' rule.`
      : "";

  return `${personality}
${personaInstruction}

**CRITICAL GIBBERISH RULE:**
If the student's answer is random letters (e.g., "asdf", "kjlhg", "123123"), nonsense, or clearly not an attempt at translation, the score MUST be 0. Do not attempt to grade grammar or vocabulary for gibberish.

**Task:** Evaluate the student's translation of a Ukrainian sentence into English.
**Student Proficiency Level:** ${config.cefrLevel}
**Target Grammar:** ${grammarCheckInstruction}
${grammarRules}

**Input Data:**
- Reference translation (ideal): "${referenceTranslation}"
- **Student's translation:** "${userTranslation}"

${rubric}

${specialInstructions}

Score the translation from 0 to 100 and provide constructive feedback.
Consider: accuracy, grammar, vocabulary usage, and naturalness.

Respond with JSON in this exact format:
{
  "score": 85,
  "feedback": "Detailed feedback here"
}`;
}

// ─── Prompt dispatcher ───────────────────────────────────────────

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

/** Per-type term limits — no point sending 50 terms for a 5-question translation quiz */
export const TERM_LIMITS: Record<QuizType, number> = {
  mcq: 20,
  gap_fill: 20,
  translation: 5,
  text_translation: 15,
  translation_list: 15,
  matching: 20,
  flashcards: 50,
  discussion: 10,
};

export function getQuizPrompt(
  type: QuizType,
  terms: QuizTerm[],
  config: QuizConfig,
): string {
  const promptFn = PROMPT_MAP[type];
  const limit = TERM_LIMITS[type];
  const selectedTerms =
    terms.length > limit ? shuffleAndSlice(terms, limit) : terms;
  return promptFn(selectedTerms, config);
}
