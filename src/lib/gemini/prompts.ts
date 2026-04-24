import type {
  QuizConfig,
  QuizTerm,
  QuizType,
  CEFRLevel,
  VocabularyChallenge,
  GrammarChallenge,
  TeacherPersona,
} from "@/types/quiz";
import type { AppLanguage } from "@/lib/i18n/app-language";
import { formatGrammarRulesSection } from "@/lib/grammar/prompt-sections";
import {
  getLearningLanguageLabel,
  getSourceLanguageLabel,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
} from "@/lib/languages";

// ─── Formatting helpers ──────────────────────────────────────────

function getLanguageContext(config: QuizConfig) {
  const targetLanguage = normalizeLearningLanguage(config.targetLanguage);
  const sourceLanguage = normalizeSourceLanguage(config.sourceLanguage);

  return {
    targetLanguage,
    sourceLanguage,
    targetLanguageLabel: getLearningLanguageLabel(targetLanguage),
    sourceLanguageLabel: getSourceLanguageLabel(sourceLanguage),
  };
}

function formatTerms(
  terms: QuizTerm[],
  targetLanguageLabel: string,
  sourceLanguageLabel: string,
): string {
  return terms
    .map(
      (t) =>
        `- ${targetLanguageLabel}: ${t.term}; ${sourceLanguageLabel}: ${t.definition}`,
    )
    .join("\n");
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

function getGrammarRulesSection(
  topics: string[] | undefined,
  difficulty: GrammarChallenge,
  topicDetails?: Record<string, string>,
  topicLabels?: Record<string, string>,
): string {
  return formatGrammarRulesSection(
    topics,
    difficulty,
    topicDetails,
    topicLabels,
  );
}

function getTranslationSentenceFormationRules(config: QuizConfig): string {
  const {
    targetLanguage,
    sourceLanguage,
    targetLanguageLabel,
    sourceLanguageLabel,
  } = getLanguageContext(config);

  const targetInflectionRules =
    targetLanguage === "english"
      ? `TARGET-WORD INFLECTION POLICY:
- The ${targetLanguageLabel} reference sentence may use a natural inflected form of the target word when grammar requires it.
- If the target word is a verb, allowed forms include the base form, to-infinitive, third-person singular (-s/-es), past simple, and past participle.
- Use correct regular or irregular verb forms when needed.
- If the target word is a regular count noun, singular and regular plural (-s/-es) forms are both allowed when natural.
- The "sourceTerm" field MUST still remain the original ${targetLanguageLabel} vocabulary item from the input list exactly as provided.`
      : `TARGET-WORD INFLECTION POLICY:
- The ${targetLanguageLabel} reference sentence may inflect the target word naturally when grammar requires it.
- The "sourceTerm" field MUST still remain the original ${targetLanguageLabel} vocabulary item from the input list exactly as provided.`;

  const sourceSentenceRules =
    sourceLanguage === "ukrainian"
      ? `SOURCE-SENTENCE QUALITY POLICY:
- The ${sourceLanguageLabel} sentence must be grammatically correct and natural, not a literal dictionary-form template.
- Inflect Ukrainian nouns, adjectives, pronouns, numerals, and verbs correctly for case, number, gender, person, tense, and agreement.
- Do NOT leave a Ukrainian word in its dictionary form if the sentence requires another form.
- Prefer natural Ukrainian phrasing and agreement throughout the full sentence.
- Good patterns: "Він не має паперової карти." and "Вони не працюють у великому аеропорту."`
      : `SOURCE-SENTENCE QUALITY POLICY:
- The ${sourceLanguageLabel} sentence must be fully grammatical and natural in the source language.
- Use the correct inflected source-language word form that the sentence requires.`;

  return `${targetInflectionRules}

${sourceSentenceRules}`;
}

// ─── Teacher Persona ─────────────────────────────────────────────

function getTeacherPersonaInstruction(
  persona: TeacherPersona,
  config: QuizConfig,
): string {
  const { targetLanguageLabel, sourceLanguageLabel } =
    getLanguageContext(config);

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
You are an expert ${targetLanguageLabel}-${sourceLanguageLabel} teacher with 20+ years of experience.
**SCORING ALGORITHM (Start at 100%, Max 100%):**
1. **Grammar/Topic Compliance:** Deduct 25% IMMEDIATELY if the requested grammar topic rules are violated, even minor violations.
2. **Mechanics (Capitalization):** Deduct 5% if the sentence start or "I" is not capitalized.
3. **Spelling & Lexis:** Deduct 5% PER spelling error. Extra 5% for each contextually incorrect word.
4. **Bonuses (Cap remains 100%):** You may use correct internal punctuation or strong vocabulary choice to justify fewer deductions, but the final score must NEVER exceed 100.
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
  const { targetLanguageLabel } = getLanguageContext(config);
  const personaLine =
    config.teacherPersona === "learning"
      ? "You are a friendly, encouraging language tutor who gives supportive feedback."
      : config.teacherPersona === "strict"
        ? "You are a strict but fair language examiner who demands precision."
        : "You are a professional language teacher who gives clear, balanced feedback.";

  return `${personaLine}
You generate ${targetLanguageLabel} language learning content for students at CEFR level ${config.cefrLevel}.
Always respond with valid JSON only. Do not include any markdown formatting or code blocks.`;
}

// ─── Per-type prompt constructors ────────────────────────────────

export function getMCQPrompt(terms: QuizTerm[], config: QuizConfig): string {
  const { targetLanguageLabel, sourceLanguageLabel } =
    getLanguageContext(config);
  const difficultyInstruction = getDifficultyInstruction(
    config.vocabularyChallenge,
    config.grammarChallenge,
    "mcq",
  );
  const topicInstruction = getTopicInstruction(config.customTopic);

  return `You are an expert quiz creator specializing in ${targetLanguageLabel} vocabulary for language learners.
Your task is to generate a multiple-choice quiz from a list of ${targetLanguageLabel} words and their ${sourceLanguageLabel} meanings.
The ${sourceLanguageLabel} meaning is provided ONLY to give you context for the intended meaning of the ${targetLanguageLabel} word, especially for words with multiple meanings. The entire quiz (questions, options, and answers) must be in ${targetLanguageLabel.toUpperCase()}.
The difficulty of the vocabulary used in questions and incorrect options should be appropriate for a Student at CEFR ${config.cefrLevel} proficiency.
${difficultyInstruction}
${topicInstruction}

For each word in the provided list, create one question that tests its meaning. The question could be a definition, a synonym, an antonym, or a fill-in-the-blank sentence.
Generate four options for each question: one correct answer and three plausible but incorrect distractors. Crucially, all four options should be of similar length and grammatical structure to prevent the correct answer from being obvious.
Ensure the 'originalTerm' field matches the ${targetLanguageLabel} word from the input list exactly.

Vocabulary terms:
${formatTerms(terms, targetLanguageLabel, sourceLanguageLabel)}

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
  const { targetLanguageLabel, sourceLanguageLabel } =
    getLanguageContext(config);
  const difficultyInstruction = getDifficultyInstruction(
    config.vocabularyChallenge,
    config.grammarChallenge,
    "gap_fill",
  );
  const topicInstruction = getTopicInstruction(config.customTopic);

  return `You are an expert quiz creator specializing in ${targetLanguageLabel} vocabulary for language learners.
Your task is to generate a set of gap-fill (fill-in-the-blank) exercises from a list of ${targetLanguageLabel} words and their ${sourceLanguageLabel} meanings.
The difficulty of the sentence structure and vocabulary should be appropriate for a Student at CEFR ${config.cefrLevel} proficiency.
${difficultyInstruction}
${topicInstruction}

For each word in the provided list, create one ${targetLanguageLabel.toUpperCase()} sentence that uses the word in a natural context. In the sentence, replace the target ${targetLanguageLabel} word with '___' to create a blank.
- The 'correctAnswer' field should be the exact word that fits in the blank. This might be a conjugated form of the original term (e.g., 'goes' instead of 'go').
- The 'sourceTerm' field MUST be the original ${targetLanguageLabel} word from the input list, exactly as provided.
- The 'hint' field must be the original ${sourceLanguageLabel} meaning from the input list.

Vocabulary terms:
${formatTerms(terms, targetLanguageLabel, sourceLanguageLabel)}

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
  const { targetLanguageLabel, sourceLanguageLabel } =
    getLanguageContext(config);
  const difficultyInstruction = getDifficultyInstruction(
    config.vocabularyChallenge,
    config.grammarChallenge,
    "translate_uk_en",
  );
  const topicInstruction = getTopicInstruction(config.customTopic);
  const grammarRules = getGrammarRulesSection(
    config.grammarTopics,
    config.grammarChallenge,
    config.grammarTopicDetails,
    config.grammarTopicLabels,
  );
  const sentenceFormationRules = getTranslationSentenceFormationRules(config);

  const termList = terms
    .map(
      (t) =>
        `  - ${targetLanguageLabel}: "${t.term}" | ${sourceLanguageLabel}: "${t.definition}"`,
    )
    .join("\n");

  return `You are an expert in creating language translation exercises for ${targetLanguageLabel} learners working from ${sourceLanguageLabel}.
Your task is to generate a set of exactly ${terms.length} translation challenges.

═══ MANDATORY RULES (VIOLATION = REJECTED OUTPUT) ═══

RULE 1 — ONE VOCABULARY WORD PER SENTENCE:
Each sentence must use EXACTLY ONE word/phrase from the provided vocabulary list. NEVER combine multiple vocabulary words in a single sentence.

RULE 2 — VOCABULARY MUST BE PRESENT:
The ${sourceLanguageLabel} meaning of the target vocabulary word MUST appear in the source sentence in the grammatically correct surface form that the sentence requires.
- The word may be inflected, but it must remain clearly derived from the provided ${sourceLanguageLabel} meaning.
- Example: if the source-language meaning is "карта", you may use "карти" or "картою" when the sentence requires it, but not a different noun.
- Example: if the source-language meaning is "працювати", you may use "працюють" when the sentence requires that verb form.

RULE 3 — HIGHLIGHT THE TARGET WORD:
Return the exact form of the source-language vocabulary word as it appears in your sentence in the "highlightText" field. This will be bolded in the UI for the student.
Do NOT wrap the word in markdown markers like **bold** or __underline__ inside "ukrainianSentence".

RULE 4 — GRAMMAR TOPIC COMPLIANCE:
The ${targetLanguageLabel.toUpperCase()} translation of each sentence MUST require the grammatical structure(s) listed below. The source sentence should be crafted so that translating it naturally into ${targetLanguageLabel} forces the student to use the target grammar.
Before finalizing any question, reject it if a natural ${targetLanguageLabel} translation could avoid the target grammar topic.
Only keep questions where the reference translation clearly demonstrates the requested grammar.

RULE 5 — CEFR LEVEL COMPLIANCE:
The student is at level **${config.cefrLevel}**. Sentence complexity, vocabulary (outside target words), and length MUST match this level. NEVER exceed it.

RULE 6 — SENSIBLE SENTENCES:
Every sentence must make logical sense in the real world. No absurd, nonsensical, or contradictory statements.

RULE 7 — INFLECTION AND SENTENCE FORMATION:
${sentenceFormationRules}

═══ CONTEXT ═══
${difficultyInstruction}
${grammarRules}
${topicInstruction}

═══ VOCABULARY LIST (one sentence per entry) ═══
${termList}

═══ OUTPUT FORMAT ═══
Respond with JSON in this exact format:
{
  "questions": [
    {
      "id": 1,
      "ukrainianSentence": "${sourceLanguageLabel} sentence containing the target word",
      "englishReference": "Natural ${targetLanguageLabel} translation demonstrating target grammar",
      "sourceTerm": "original ${targetLanguageLabel} word from the list exactly as provided",
      "highlightText": "exact ${sourceLanguageLabel} word form as it appears in ukrainianSentence"
    }
  ]
}`;
}

export function getTextTranslationPrompt(
  terms: QuizTerm[],
  config: QuizConfig,
): string {
  const { targetLanguageLabel, sourceLanguageLabel } =
    getLanguageContext(config);
  const difficultyInstruction = getDifficultyInstruction(
    config.vocabularyChallenge,
    config.grammarChallenge,
    "text_translation",
  );
  const topicInstruction = getTopicInstruction(config.customTopic);
  const grammarRules = getGrammarRulesSection(
    config.grammarTopics,
    config.grammarChallenge,
    config.grammarTopicDetails,
    config.grammarTopicLabels,
  );

  return `You are an expert in creating language translation exercises for ${targetLanguageLabel} learners working from ${sourceLanguageLabel}.
Your task is to generate a short, cohesive text for translation.

CRITICAL LEVEL INSTRUCTION:
1. **Student Proficiency:** The student is at level **${config.cefrLevel}**. The complexity of vocabulary, sentence length, and context must match this level.
2. **Grammar Target:** The sentences MUST specifically test the grammatical structures listed below.

CRITICAL INSTRUCTION:
1. Create a cohesive text in ${sourceLanguageLabel.toUpperCase()} that is approximately 5 sentences long.
2. The text should be on a single, clear topic.
3. Naturally incorporate several words from the provided vocabulary list. You DO NOT need to use all the words; prioritize creating a text that reads naturally.
${difficultyInstruction}
${grammarRules}
${topicInstruction}
4. After creating the ${sourceLanguageLabel} text, provide a correct and natural-sounding ${targetLanguageLabel.toUpperCase()} translation for the entire text.

Vocabulary terms:
${formatTerms(terms, targetLanguageLabel, sourceLanguageLabel)}

Respond with JSON in this exact format:
{
  "content": {
    "originalText": "${sourceLanguageLabel} paragraph here",
    "referenceTranslation": "${targetLanguageLabel} translation here"
  }
}`;
}

export function getMatchingPrompt(
  terms: QuizTerm[],
  config: QuizConfig,
): string {
  const { targetLanguageLabel, sourceLanguageLabel } =
    getLanguageContext(config);
  const topicInstruction = getTopicInstruction(config.customTopic);

  return `Generate a matching exercise using the following vocabulary terms.

CEFR Level: ${config.cefrLevel}
Vocabulary Complexity: ${config.vocabularyChallenge}
${topicInstruction}

Vocabulary terms:
${formatTerms(terms, targetLanguageLabel, sourceLanguageLabel)}

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
  const { targetLanguageLabel, sourceLanguageLabel } =
    getLanguageContext(config);
  const topicInstruction = getTopicInstruction(config.customTopic);

  return `Generate flashcard content using the following vocabulary terms.

CEFR Level: ${config.cefrLevel}
${topicInstruction}

Vocabulary terms:
${formatTerms(terms, targetLanguageLabel, sourceLanguageLabel)}

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
  const { targetLanguageLabel, sourceLanguageLabel } =
    getLanguageContext(config);
  const difficultyInstruction = getDifficultyInstruction(
    config.vocabularyChallenge,
    config.grammarChallenge,
    "discussion",
  );
  const topicInstruction = getTopicInstruction(config.customTopic);

  return `You are an expert in creating live speaking materials for ${targetLanguageLabel} language learners.
Your task is to generate CEFR-level topic sentences for live discussion based on a list of ${targetLanguageLabel} words and their ${sourceLanguageLabel} meanings. The ${sourceLanguageLabel} meaning is for context only. All output must be in ${targetLanguageLabel.toUpperCase()}.
The complexity and subject matter must be appropriate for a Student at CEFR ${config.cefrLevel} proficiency.
${difficultyInstruction}
${topicInstruction}

CRITICAL REQUIREMENTS:
- Generate exactly one discussion sentence per input term.
- Each sentence must naturally include the corresponding target vocabulary item.
- Keep each sentence concise and conversation-ready (one line).
- Mix open-ended prompts and agree/disagree statements.
- Keep topics practical and suitable for live speaking.
- Return exactly ${terms.length} items in the "prompts" array.
- Each item must include a numeric "id" starting at 1 and increasing by 1.
- The "type" field must be exactly either "open-ended" or "agree-disagree".
- Each item must include a "sourceTerm" field equal to the input vocabulary item exactly as written.
- Each item must include a "highlightText" field equal to the exact vocabulary word or phrase as it appears in the prompt.
- Do not add explanations, notes, markdown, or any keys other than "id", "prompt", "type", "sourceTerm", and "highlightText".

Vocabulary terms:
${formatTerms(terms, targetLanguageLabel, sourceLanguageLabel)}

Respond with JSON in this exact format:
{
  "prompts": [
    {
      "id": 1,
      "prompt": "Discussion question or statement here",
      "type": "open-ended",
      "sourceTerm": "target vocabulary item",
      "highlightText": "exact text from the prompt"
    }
  ]
}`;
}

// ─── Evaluation prompt ───────────────────────────────────────────

export function getEvaluationPrompt(
  userTranslation: string,
  referenceTranslation: string,
  targetTerm: string | undefined,
  grammarValidationReason: string | undefined,
  appLanguage: AppLanguage,
  config: QuizConfig,
): string {
  const { targetLanguageLabel, sourceLanguageLabel } =
    getLanguageContext(config);
  const { personality, rubric, specialInstructions } = getEvaluationRubric(
    config.cefrLevel,
  );
  const personaInstruction = getTeacherPersonaInstruction(
    config.teacherPersona,
    config,
  );
  const grammarRules = getGrammarRulesSection(
    config.grammarTopics,
    config.grammarChallenge,
    config.grammarTopicDetails,
    config.grammarTopicLabels,
  );

  const evaluationInstruction =
    config.grammarTopics && config.grammarTopics.length > 0
      ? config.grammarTopics
          .map((topicKey) => {
            const topicLabel =
              config.grammarTopicLabels?.[topicKey] ?? topicKey;
            const instruction =
              config.grammarTopicEvaluationInstructions?.[topicKey]?.trim() ??
              "";

            if (!instruction) {
              return null;
            }

            return `- ${topicLabel}: ${instruction}`;
          })
          .filter((value): value is string => Boolean(value))
          .join("\n")
      : "";

  const grammarCheckInstruction =
    config.grammarTopics && config.grammarTopics.length > 0
      ? `CRITICAL GRAMMAR CHECK: The user MUST demonstrate usage of ${config.grammarTopics.map((topicKey) => `"${config.grammarTopicLabels?.[topicKey] ?? topicKey}"`).join(" AND ")}. Judge grammar compliance by the required structure itself, not by matching the reference translation word-for-word. If they used a different structure (even if grammatically correct in general English), deduct 25 points as per the 'Grammar/Topic Compliance' rule.`
      : "";

  const validatedGrammarInstruction = grammarValidationReason
    ? `This question was validated during quiz generation as genuinely requiring the selected grammar. Validation note: ${grammarValidationReason}`
    : "";
  const feedbackLanguageLabel = appLanguage === "uk" ? "Ukrainian" : "English";

  return `${personality}
${personaInstruction}

**CRITICAL GIBBERISH RULE:**
If the student's answer is random letters (e.g., "asdf", "kjlhg", "123123"), nonsense, or clearly not an attempt at translation, the score MUST be 0. Do not attempt to grade grammar or vocabulary for gibberish.

**Task:** Evaluate the student's translation of a ${sourceLanguageLabel} sentence into ${targetLanguageLabel}.
**Student Proficiency Level:** ${config.cefrLevel}
**Feedback Language:** ${feedbackLanguageLabel}
**Target Grammar:** ${grammarCheckInstruction}
${targetTerm ? `**Target Vocabulary:** ${targetTerm}` : ""}
${validatedGrammarInstruction}
${grammarRules}
${evaluationInstruction ? `**Topic-Specific Evaluation Instructions:**\n${evaluationInstruction}` : ""}

**Input Data:**
- Reference translation (ideal): "${referenceTranslation}"
- **Student's translation:** "${userTranslation}"

${rubric}

${specialInstructions}

═══ EVALUATION CHECKLIST (perform ALL checks in order) ═══
You MUST evaluate the student's translation against these 5 categories. For each category, determine PASS (✓) or FAIL (✗).

1. **Vocabulary Accuracy** — Did the student use the required target vocabulary word/phrase correctly, and is it spelled correctly?
2. **Grammar Compliance** — Did the student use the required grammatical structure(s)? (If no grammar was specified, check general grammar correctness.)
3. **Meaning & Completeness** — Is the full meaning of the original sentence preserved? Nothing added or lost?
4. **Mechanics** — Capitalization, punctuation, spelling — are they all correct?
5. **Naturalness** — Does the sentence sound like natural ${targetLanguageLabel}, not a word-for-word translation?

Score the translation from 0 to 100 based on these checks. The final numeric score must always be an integer between 0 and 100.

═══ FEEDBACK FORMAT ═══
Return EXACTLY five metric objects: vocabulary, grammar, meaning, mechanics, naturalness.
Each metric must include:
- passed: boolean
- comment: a short explanation written in ${feedbackLanguageLabel}

Rules for metric comments:
- Keep each comment concise.
- Do not include category names inside the comment.
- Do not include checkmarks, numbering, or bullets inside the comment.
- Do not include any suggested answer.

Respond with JSON in this exact format:
{
  "score": 85,
  "metrics": {
    "vocabulary": { "passed": true, "comment": "required word is used correctly." },
    "grammar": { "passed": false, "comment": "third-person singular needs 'doesn't' here." },
    "meaning": { "passed": true, "comment": "core meaning is preserved." },
    "mechanics": { "passed": false, "comment": "article before 'map' is missing." },
    "naturalness": { "passed": false, "comment": "the sentence sounds unnatural because of the auxiliary verb." }
  }
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
