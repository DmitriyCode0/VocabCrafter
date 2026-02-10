export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type QuizType =
  | "mcq"
  | "gap_fill"
  | "translation"
  | "text_translation"
  | "translation_list"
  | "matching"
  | "flashcards"
  | "discussion";

export type VocabularyChallenge = "Simple" | "Standard" | "Complex";
export type GrammarChallenge = "Simple" | "Standard" | "Complex";
export type TeacherPersona = "learning" | "strict" | "standard";

export interface QuizTerm {
  term: string;
  definition: string;
}

export interface QuizConfig {
  cefrLevel: CEFRLevel;
  vocabularyChallenge: VocabularyChallenge;
  grammarChallenge: GrammarChallenge;
  teacherPersona: TeacherPersona;
  timedMode: boolean;
  grammarTopics?: string[];
  customTopic?: string;
}

// MCQ types
export interface MCQQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  originalTerm: string;
}

export interface MCQAnswer {
  questionId: number;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

// Gap-fill types
export interface GapFillQuestion {
  id: number;
  sentence: string;
  correctAnswer: string;
  hint: string;
  sourceTerm: string;
}

export interface GapFillAnswer {
  questionId: number;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

// Translation types
export interface TranslationQuestion {
  id: number;
  ukrainianSentence: string;
  englishReference: string;
  sourceTerm: string;
}

export interface TranslationAnswer {
  questionId: number;
  userTranslation: string;
  referenceTranslation: string;
  score: number;
  feedback: string;
}

// Text translation types
export interface TextTranslationContent {
  originalText: string;
  referenceTranslation: string;
}

export interface TextTranslationAnswer {
  userTranslation: string;
  score: number;
  feedback: string;
}

// Matching types
export interface MatchingPair {
  term: string;
  definition: string;
}

// Flashcard types
export interface FlashcardItem {
  term: string;
  definition: string;
  example?: string;
}

// Discussion types
export interface DiscussionPrompt {
  id: number;
  prompt: string;
  type: "open-ended" | "agree-disagree";
}

// Feedback
export interface FeedbackItem {
  type: string;
  topic: string;
  message: string;
}

// Quiz generation request
export interface GenerateQuizRequest {
  type: QuizType;
  terms: QuizTerm[];
  config: QuizConfig;
}

// Quiz attempt result
export interface QuizAttemptResult {
  quizId: string;
  answers:
    | MCQAnswer[]
    | GapFillAnswer[]
    | TranslationAnswer[]
    | TextTranslationAnswer;
  score: number;
  maxScore: number;
}
