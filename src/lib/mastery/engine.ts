import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────

export interface WordResult {
  term: string;
  definition: string;
  correct: boolean;
  practiceType: "gap_fill" | "translation" | "flashcards";
}

function normalizeForWordMatch(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}'\s-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildWordVariants(term: string): Set<string> {
  const variants = new Set([term]);

  if (term.endsWith("y") && term.length > 1) {
    variants.add(`${term.slice(0, -1)}ies`);
    variants.add(`${term.slice(0, -1)}ied`);
  }

  if (term.endsWith("e")) {
    variants.add(`${term}d`);
    variants.add(`${term.slice(0, -1)}ing`);
  } else {
    variants.add(`${term}ed`);
    variants.add(`${term}ing`);
  }

  variants.add(`${term}s`);
  variants.add(`${term}es`);

  return variants;
}

export function hasCorrectTargetWord(
  userTranslation: string | undefined,
  sourceTerm: string | undefined,
): boolean {
  if (!userTranslation || !sourceTerm) return false;

  const answerTokens = normalizeForWordMatch(userTranslation);
  if (answerTokens.length === 0) return false;

  const sourceTokens = normalizeForWordMatch(sourceTerm);
  if (sourceTokens.length === 0) return false;

  const trimmedTokens =
    sourceTokens.length > 1 &&
    ["to", "a", "an", "the"].includes(sourceTokens[0])
      ? sourceTokens.slice(1)
      : sourceTokens;

  if (trimmedTokens.length === 0) return false;

  if (trimmedTokens.length === 1) {
    const variants = buildWordVariants(trimmedTokens[0]);
    return answerTokens.some((token) => variants.has(token));
  }

  const answerPhrase = answerTokens.join(" ");
  const exactPhrase = trimmedTokens.join(" ");

  return answerPhrase.includes(exactPhrase);
}

interface MasteryRow {
  mastery_level: number;
  correct_count: number;
  incorrect_count: number;
  translation_correct_count: number;
  streak: number;
}

export function getNextReviewDateForLevel(
  level: number,
  now: Date = new Date(),
): string {
  const normalizedLevel = Math.max(0, Math.min(5, level));
  const intervalDays =
    normalizedLevel >= 1 ? Math.pow(2, normalizedLevel - 1) : 1;

  return new Date(
    now.getTime() + intervalDays * 24 * 60 * 60 * 1000,
  ).toISOString();
}

// ── Extract per-word results from quiz answers ─────────────

/**
 * Extracts per-word correct/incorrect results from quiz attempt answers.
 * Maps answers back to vocabulary terms using sourceTerm / card index.
 */
export function extractWordResults(
  quizType: string,
  answers: Record<string, unknown>,
  vocabularyTerms: { term: string; definition: string }[],
  generatedContent: Record<string, unknown>,
): WordResult[] {
  // Live discussion is conversational practice only and should not affect
  // per-word mastery metrics.
  if (quizType === "discussion") {
    return [];
  }

  const termMap = new Map(
    vocabularyTerms.map((t) => [t.term.toLowerCase(), t.definition]),
  );

  if (quizType === "gap_fill") {
    return extractGapFillResults(answers, generatedContent, termMap);
  }

  if (quizType === "translation") {
    return extractTranslationResults(answers, generatedContent, termMap);
  }

  if (quizType === "flashcards") {
    return extractFlashcardResults(answers, vocabularyTerms);
  }

  return [];
}

function extractGapFillResults(
  answers: Record<string, unknown>,
  generatedContent: Record<string, unknown>,
  termMap: Map<string, string>,
): WordResult[] {
  const results = (answers.results ?? []) as {
    questionId?: number;
    isCorrect?: boolean;
    correctAnswer?: string;
  }[];

  // Get source terms from generated questions
  const questions = (generatedContent.questions ?? []) as {
    id: number;
    sourceTerm?: string;
    correctAnswer?: string;
  }[];

  const questionTermMap = new Map<number, string>();
  for (const q of questions) {
    if (q.sourceTerm) {
      questionTermMap.set(q.id, q.sourceTerm.toLowerCase());
    } else if (q.correctAnswer) {
      questionTermMap.set(q.id, q.correctAnswer.toLowerCase());
    }
  }

  return results
    .map((r) => {
      const term =
        questionTermMap.get(r.questionId ?? -1) ??
        r.correctAnswer?.toLowerCase();
      if (!term) return null;
      return {
        term,
        definition: termMap.get(term) ?? "",
        correct: r.isCorrect === true,
        practiceType: "gap_fill",
      };
    })
    .filter((r): r is WordResult => r !== null);
}

function extractTranslationResults(
  answers: Record<string, unknown>,
  generatedContent: Record<string, unknown>,
  termMap: Map<string, string>,
): WordResult[] {
  const results = (answers.results ?? []) as {
    questionId?: number;
    score?: number;
    userTranslation?: string;
  }[];

  const questions = (generatedContent.questions ?? []) as {
    id: number;
    sourceTerm?: string;
  }[];

  const questionTermMap = new Map<number, string>();
  for (const q of questions) {
    if (q.sourceTerm) {
      questionTermMap.set(q.id, q.sourceTerm.toLowerCase());
    }
  }

  return results
    .map((r) => {
      const term = questionTermMap.get(r.questionId ?? -1);
      if (!term) return null;
      return {
        term,
        definition: termMap.get(term) ?? "",
        correct: hasCorrectTargetWord(r.userTranslation, term),
        practiceType: "translation",
      };
    })
    .filter((r): r is WordResult => r !== null);
}

function extractFlashcardResults(
  answers: Record<string, unknown>,
  vocabularyTerms: { term: string; definition: string }[],
): WordResult[] {
  // New format: { type: "flashcards", results: [{ term, known }] }
  const results = answers.results as
    | { term?: string; known?: boolean }[]
    | undefined;

  if (Array.isArray(results)) {
    return results
      .map((r) => {
        if (!r.term) return null;
        const termLower = r.term.toLowerCase();
        const vocabEntry = vocabularyTerms.find(
          (t) => t.term.toLowerCase() === termLower,
        );
        return {
          term: termLower,
          definition: vocabEntry?.definition ?? "",
          correct: r.known === true,
          practiceType: "flashcards",
        };
      })
      .filter((r): r is WordResult => r !== null);
  }

  // Legacy format: { type: "flashcards", known: N, total: M } — no per-word data
  return [];
}

// ── Mastery level computation ──────────────────────────────

/**
 * Computes the new mastery level after a single practice event.
 * Uses spaced-repetition: level 0-5, streak tracking, next_review scheduling.
 *
 * Level transitions:
 *  0→1: word encountered
 *  1→2: first correct answer
 *  2→3: 2+ correct, streak ≥ 2
 *  3→4: 4+ correct, streak ≥ 3
 *  4→5: 6+ correct, streak ≥ 4, and at least 2 correct sentence-translation spellings
 *
 * Wrong answer: level drops by 1 (min 0), streak resets to 0
 * Review interval: 1 day × 2^(level-1) (level 1 = 1d, level 5 = 16d)
 */
export function computeNewMastery(
  current: MasteryRow | null,
  result: Pick<WordResult, "correct" | "practiceType">,
): {
  mastery_level: number;
  correct_count: number;
  incorrect_count: number;
  translation_correct_count: number;
  streak: number;
  next_review: string;
} {
  const now = new Date();
  const prev = current ?? {
    mastery_level: 0,
    correct_count: 0,
    incorrect_count: 0,
    translation_correct_count: 0,
    streak: 0,
  };

  let newLevel = prev.mastery_level;
  let newStreak = prev.streak;
  let newCorrect = prev.correct_count;
  let newIncorrect = prev.incorrect_count;
  let newTranslationCorrect = prev.translation_correct_count;

  if (result.correct) {
    newCorrect++;
    newStreak++;

    if (result.practiceType === "translation") {
      newTranslationCorrect++;
    }

    // Ensure level is at least 1 (word encountered)
    if (newLevel === 0) newLevel = 1;

    // Check promotion thresholds
    if (newLevel === 1 && newCorrect >= 1) {
      newLevel = 2;
    } else if (newLevel === 2 && newCorrect >= 2 && newStreak >= 2) {
      newLevel = 3;
    } else if (newLevel === 3 && newCorrect >= 4 && newStreak >= 3) {
      newLevel = 4;
    } else if (newLevel === 4 && newCorrect >= 6 && newStreak >= 4) {
      newLevel = 5;
    }

    if (newLevel >= 5 && newTranslationCorrect < 2) {
      newLevel = 4;
    }
  } else {
    newIncorrect++;
    newStreak = 0;
    // Drop one level (min 1 if already seen, min 0 if new)
    if (newLevel > 0) {
      newLevel = Math.max(1, newLevel - 1);
    }
  }

  return {
    mastery_level: newLevel,
    correct_count: newCorrect,
    incorrect_count: newIncorrect,
    translation_correct_count: newTranslationCorrect,
    streak: newStreak,
    next_review: getNextReviewDateForLevel(newLevel, now),
  };
}

// ── Bulk upsert into word_mastery table ────────────────────

/**
 * Updates word_mastery rows for a student after a quiz attempt.
 * Fetches existing rows, computes new levels, upserts.
 */
export async function upsertWordMastery(
  supabaseAdmin: SupabaseClient,
  studentId: string,
  wordResults: WordResult[],
): Promise<void> {
  if (wordResults.length === 0) return;

  // Deduplicate: if a term appears multiple times in one quiz, aggregate
  const termResults = new Map<
    string,
    {
      definition: string;
      correctCount: number;
      totalCount: number;
      practiceType: WordResult["practiceType"];
    }
  >();
  for (const wr of wordResults) {
    const existing = termResults.get(wr.term) ?? {
      definition: wr.definition,
      correctCount: 0,
      totalCount: 0,
      practiceType: wr.practiceType,
    };
    existing.totalCount++;
    if (wr.correct) existing.correctCount++;
    existing.definition = wr.definition || existing.definition;
    existing.practiceType = wr.practiceType;
    termResults.set(wr.term, existing);
  }

  const terms = Array.from(termResults.keys());

  // Fetch existing mastery rows
  const { data: existingRows } = await supabaseAdmin
    .from("word_mastery")
    .select(
      "term, mastery_level, correct_count, incorrect_count, translation_correct_count, streak",
    )
    .eq("student_id", studentId)
    .in("term", terms);

  const existingMap = new Map(
    (existingRows ?? []).map((r) => [
      r.term,
      {
        mastery_level: r.mastery_level,
        correct_count: r.correct_count,
        incorrect_count: r.incorrect_count,
        translation_correct_count: r.translation_correct_count,
        streak: r.streak,
      },
    ]),
  );

  const now = new Date().toISOString();
  const upsertRows = [];

  for (const [term, result] of termResults) {
    const current = existingMap.get(term) ?? null;
    // For words tested multiple times in one quiz, apply sequentially
    let state = current;
    const correct = result.correctCount > result.totalCount / 2; // majority wins
    const newMastery = computeNewMastery(state, {
      correct,
      practiceType: result.practiceType,
    });

    upsertRows.push({
      student_id: studentId,
      term,
      definition: result.definition,
      mastery_level: newMastery.mastery_level,
      correct_count: newMastery.correct_count,
      incorrect_count: newMastery.incorrect_count,
      translation_correct_count: newMastery.translation_correct_count,
      streak: newMastery.streak,
      last_practiced: now,
      next_review: newMastery.next_review,
    });
  }

  // Upsert in batch
  const { error } = await supabaseAdmin
    .from("word_mastery")
    .upsert(upsertRows, {
      onConflict: "student_id,term",
    });

  if (error) {
    console.error("Failed to upsert word mastery:", error);
  }
}
