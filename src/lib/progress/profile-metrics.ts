import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVITY_LABELS } from "@/lib/constants";
import {
  getLearningLanguageLabel,
  getSourceLanguageLabel,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
  type LearningLanguage,
  type SourceLanguage,
} from "@/lib/languages";
import { getTopicsForLevel } from "@/lib/grammar/topics";
import {
  getGrammarTopicDisplayName,
  getPrimaryGrammarTopic,
} from "@/lib/utils";
import {
  normalizePassiveVocabularyLibraryAttributes,
  summarizePassiveVocabularyEvidence,
  type PassiveVocabularyEvidenceRow,
} from "@/lib/mastery/passive-vocabulary";
import type { CEFRLevel } from "@/types/quiz";

const CEFR_LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const CEFR_GUIDED_HOURS: Record<
  CEFRLevel,
  {
    minHours: number;
    maxHours: number;
    averageHours: number;
  }
> = {
  A1: { minHours: 90, maxHours: 100, averageHours: 95 },
  A2: { minHours: 180, maxHours: 200, averageHours: 190 },
  B1: { minHours: 350, maxHours: 400, averageHours: 375 },
  B2: { minHours: 500, maxHours: 600, averageHours: 550 },
  C1: { minHours: 700, maxHours: 800, averageHours: 750 },
  C2: { minHours: 1000, maxHours: 1200, averageHours: 1100 },
};

/**
 * CEFR-based vocabulary targets.
 *
 * Active vocabulary = words actively used in production (tracked via word_mastery).
 * Based on Cambridge English Vocabulary Profile and CEFR descriptors.
 * A1: basic survival vocabulary, A2: routine matters, B1: familiar topics,
 * B2: abstract topics, C1: flexible effective use, C2: near-native range.
 */
export const ACTIVE_VOCAB_TARGETS: Record<CEFRLevel, number> = {
  A1: 300,
  A2: 800,
  B1: 2000,
  B2: 4000,
  C1: 8000,
  C2: 15000,
};

/**
 * Passive vocabulary = words recognized but not necessarily produced
 * (tracked via passive_vocabulary_evidence). Typically ~2x active vocabulary.
 * A1: understand basic phrases, A2: simple texts, B1: standard text,
 * B2: contemporary articles, C1: demanding texts, C2: near-native comprehension.
 */
export const PASSIVE_VOCAB_TARGETS: Record<CEFRLevel, number> = {
  A1: 600,
  A2: 1500,
  B1: 4000,
  B2: 8000,
  C1: 15000,
  C2: 25000,
};

/** Target number of quiz attempts per CEFR level for the engagement metric. */
const ENGAGEMENT_QUIZ_TARGETS: Record<CEFRLevel, number> = {
  A1: 30,
  A2: 50,
  B1: 80,
  B2: 120,
  C1: 180,
  C2: 250,
};

/**
 * Grammar variety mastery threshold.
 * A topic is considered mastered when the student has completed at least this
 * many sentence-translation quizzes for that topic with a score >= 90%.
 */
export const GRAMMAR_MASTERY_MIN_ATTEMPTS = 5;
export const GRAMMAR_MASTERY_MIN_SCORE = 90;

type ProgressAxisKey =
  | "active_vocab"
  | "grammar_variety"
  | "engagement"
  | "accuracy"
  | "passive_vocab";

interface AttemptQuizRow {
  title: string;
  type: string;
  cefr_level: string;
  vocabulary_terms: Array<Record<string, unknown>> | null;
  config: unknown;
}

interface AttemptRow {
  score: number | null;
  max_score: number | null;
  time_spent_seconds: number | null;
  completed_at: string;
  quizzes: AttemptQuizRow | null;
}

interface WordMasteryRow {
  term: string;
  definition: string;
  mastery_level: number;
  correct_count: number;
  incorrect_count: number;
  translation_correct_count: number;
  streak: number;
  last_practiced: string;
  next_review: string;
}

interface PassiveEvidenceWithLibraryRow {
  term: string;
  definition: string | null;
  item_type: "word" | "phrase";
  source_type: "full_text" | "manual_list" | "curated_list";
  source_label: string | null;
  import_count: number;
  last_imported_at: string;
  passive_vocabulary_library: {
    cefr_level: string | null;
    part_of_speech: string | null;
    attributes: Record<string, unknown> | null;
  } | null;
}

export interface StudentProgressAxis {
  key: ProgressAxisKey;
  label: string;
  shortLabel: string;
  score: number;
  value: string;
  helper: string;
  beta?: boolean;
}

export interface StudentProgressActivityStat {
  type: string;
  label: string;
  count: number;
  averageScore: number;
}

export interface StudentProgressRecentAttempt {
  title: string;
  type: string;
  completedAt: string;
  scorePercent: number | null;
}

export interface StudentProgressTopicStat {
  topicKey: string;
  label: string;
  level: string;
  attempts: number;
  averageScore: number | null;
}

export interface GrammarTopicMasteryItem {
  topicKey: string;
  label: string;
  level: string;
  mastered: boolean;
  source: "system" | "tutor" | null;
  attempts: number;
  highScoreAttempts: number;
  averageScore: number | null;
}

export interface StudentProgressWord {
  term: string;
  definition: string;
  masteryLevel: number;
  correctCount: number;
  incorrectCount: number;
  translationCorrectCount: number;
  streak: number;
  lastPracticed: string;
}

export interface StudentProgressSnapshot {
  profile: {
    fullName: string | null;
    cefrLevel: CEFRLevel;
    targetLanguage: LearningLanguage;
    sourceLanguage: SourceLanguage;
    targetLanguageLabel: string;
    sourceLanguageLabel: string;
  };
  axes: StudentProgressAxis[];
  chartData: Array<{
    axis: string;
    score: number;
    fullMark: number;
  }>;
  overview: {
    totalAttempts: number;
    avgScore: number;
    bestScore: number;
    streakDays: number;
    activeDays30: number;
    totalWords: number;
    masteredWords: number;
    avgMasteryLevel: number;
    grammarMasteredCount: number;
    grammarAvailableCount: number;
    createdQuizCount: number;
  };
  timeMetrics: {
    appLearningSeconds: number;
    appLearningHours: number;
    lessonHours: number;
    totalLearningHours: number;
    completedLessons: number;
  };
  cefrGuidedHours: {
    source: string;
    levels: Array<{
      level: CEFRLevel;
      minHours: number;
      maxHours: number;
      averageHours: number;
    }>;
    currentLevel: {
      level: CEFRLevel;
      minHours: number;
      maxHours: number;
      averageHours: number;
      progressPercent: number;
      remainingHours: number;
    };
    nextLevel:
      | {
          level: CEFRLevel;
          minHours: number;
          maxHours: number;
          averageHours: number;
          progressPercent: number;
          remainingHours: number;
        }
      | null;
  };
  overallPerformance: {
    score: number;
    band: "needs_focus" | "building" | "on_track" | "strong";
    components: {
      time: number;
      grammar: number;
      knownWords: number;
      addedWords: number;
    };
  };
  activityStats: StudentProgressActivityStat[];
  recentAttempts: StudentProgressRecentAttempt[];
  grammar: {
    betaNotice: string;
    coveredTopics: StudentProgressTopicStat[];
    remainingTopics: Array<{ topicKey: string; label: string; level: string }>;
  };
  grammarTopicMastery: GrammarTopicMasteryItem[];
  passiveSignals: {
    uniqueItems: number;
    wordCount: number;
    phraseCount: number;
    equivalentWordCount: number;
    rawEquivalentWordCount: number;
    cefrCounts: {
      A1: number;
      A2: number;
      B1: number;
      B2: number;
      C1: number;
      C2: number;
      unknown: number;
    };
    sampleItems: Array<{
      term: string;
      definition: string | null;
      itemType: "word" | "phrase";
      sourceType: "full_text" | "manual_list" | "curated_list";
      sourceLabel: string | null;
      importCount: number;
      lastImportedAt: string;
      libraryCefrLevel: string | null;
      partOfSpeech: string | null;
      recognitionWeight: number;
    }>;
  };
  words: StudentProgressWord[];
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeCefrLevel(value?: string | null): CEFRLevel {
  return CEFR_LEVELS.includes(value as CEFRLevel) ? (value as CEFRLevel) : "A1";
}

function getNextCefrLevel(level: CEFRLevel) {
  const levelIndex = CEFR_LEVELS.indexOf(level);

  if (levelIndex < 0 || levelIndex === CEFR_LEVELS.length - 1) {
    return null;
  }

  return CEFR_LEVELS[levelIndex + 1] ?? null;
}

function getScorePercent(attempt: AttemptRow) {
  if (
    attempt.score == null ||
    attempt.max_score == null ||
    attempt.max_score <= 0
  ) {
    return null;
  }

  return Math.round((attempt.score / attempt.max_score) * 100);
}

export async function getStudentProgressSnapshot(
  userId: string,
): Promise<StudentProgressSnapshot> {
  const supabaseAdmin = createAdminClient();

  const [
    profileResult,
    attemptsResult,
    masteryResult,
    quizCountResult,
    passiveEvidenceResult,
    grammarMasteryResult,
    completedLessonsCountResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, cefr_level, preferred_language, source_language")
      .eq("id", userId)
      .single(),
    supabaseAdmin
      .from("quiz_attempts")
      .select(
        "score, max_score, time_spent_seconds, completed_at, quizzes(title, type, cefr_level, vocabulary_terms, config)",
      )
      .eq("student_id", userId)
      .order("completed_at", { ascending: false }),
    supabaseAdmin
      .from("word_mastery")
      .select(
        "term, definition, mastery_level, correct_count, incorrect_count, translation_correct_count, streak, last_practiced, next_review",
      )
      .eq("student_id", userId),
    supabaseAdmin
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", userId),
    supabaseAdmin
      .from("passive_vocabulary_evidence")
      .select(
        "term, definition, item_type, source_type, source_label, import_count, last_imported_at, passive_vocabulary_library(cefr_level, part_of_speech, attributes)",
      )
      .eq("student_id", userId)
      .order("last_imported_at", { ascending: false }),
    supabaseAdmin
      .from("student_grammar_topic_mastery")
      .select("topic_key, source")
      .eq("student_id", userId),
    supabaseAdmin
      .from("tutor_student_lessons")
      .select("id", { count: "exact", head: true })
      .eq("student_id", userId)
      .eq("status", "completed"),
  ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error("Failed to load student progress profile");
  }

  const profile = profileResult.data;
  const targetLanguage = normalizeLearningLanguage(profile.preferred_language);
  const sourceLanguage = normalizeSourceLanguage(profile.source_language);
  const cefrLevel = normalizeCefrLevel(profile.cefr_level);
  const attempts = (attemptsResult.data ?? []) as AttemptRow[];
  const words = ((masteryResult.data ?? []) as WordMasteryRow[])
    .map((word) => ({
      term: word.term,
      definition: word.definition,
      masteryLevel: word.mastery_level ?? 0,
      correctCount: word.correct_count ?? 0,
      incorrectCount: word.incorrect_count ?? 0,
      translationCorrectCount: word.translation_correct_count ?? 0,
      streak: word.streak ?? 0,
      lastPracticed: word.last_practiced,
    }))
    .sort(
      (left, right) =>
        right.masteryLevel - left.masteryLevel ||
        right.correctCount - left.correctCount ||
        left.term.localeCompare(right.term),
    );
  const passiveEvidenceRows = (
    (passiveEvidenceResult.data ?? []) as PassiveEvidenceWithLibraryRow[]
  ).map(
    (row): PassiveVocabularyEvidenceRow => ({
      term: row.term,
      definition: row.definition,
      item_type: row.item_type,
      source_type: row.source_type,
      source_label: row.source_label,
      import_count: row.import_count,
      last_imported_at: row.last_imported_at,
      library_cefr_level:
        (row.passive_vocabulary_library?.cefr_level as
          | PassiveVocabularyEvidenceRow["library_cefr_level"]
          | null) ?? null,
      library_part_of_speech:
        (row.passive_vocabulary_library?.part_of_speech as
          | PassiveVocabularyEvidenceRow["library_part_of_speech"]
          | null) ?? null,
      library_attributes: normalizePassiveVocabularyLibraryAttributes(
        row.passive_vocabulary_library?.attributes,
      ),
    }),
  );
  const passiveSignals = summarizePassiveVocabularyEvidence(
    passiveEvidenceRows,
    cefrLevel,
  );
  const completedLessons = completedLessonsCountResult.count ?? 0;
  const appLearningSeconds = attempts.reduce(
    (total, attempt) => total + (attempt.time_spent_seconds ?? 0),
    0,
  );
  const appLearningHoursRaw = appLearningSeconds / 3600;
  const lessonHours = completedLessons;
  const totalLearningHoursRaw = appLearningHoursRaw + lessonHours;
  const currentGuidedHours = CEFR_GUIDED_HOURS[cefrLevel];
  const nextLevel = getNextCefrLevel(cefrLevel);
  const nextGuidedHours = nextLevel ? CEFR_GUIDED_HOURS[nextLevel] : null;

  const tutorMarkedTopics = new Map(
    (
      (grammarMasteryResult.data ?? []) as Array<{
        topic_key: string;
        source: string;
      }>
    ).map((row) => [row.topic_key, row.source as "system" | "tutor"]),
  );

  // --- Scored attempts (all types) ---
  const scoredAttempts = attempts.filter(
    (attempt) => getScorePercent(attempt) !== null,
  );
  const allAvgScore =
    scoredAttempts.length > 0
      ? clampScore(
          scoredAttempts.reduce(
            (sum, attempt) => sum + (getScorePercent(attempt) ?? 0),
            0,
          ) / scoredAttempts.length,
        )
      : 0;
  const bestScore =
    scoredAttempts.length > 0
      ? clampScore(
          Math.max(
            ...scoredAttempts.map((attempt) => getScorePercent(attempt) ?? 0),
          ),
        )
      : 0;

  // --- Accuracy: gap_fill + translation only ---
  const accuracyAttempts = scoredAttempts.filter((attempt) => {
    const type = attempt.quizzes?.type;
    return type === "gap_fill" || type === "translation";
  });
  const accuracyScore =
    accuracyAttempts.length > 0
      ? clampScore(
          accuracyAttempts.reduce(
            (sum, attempt) => sum + (getScorePercent(attempt) ?? 0),
            0,
          ) / accuracyAttempts.length,
        )
      : 0;

  // --- Engagement: 40% active days, 30% quizzes, 30% words ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
  const activeDaysSet = new Set<string>();
  for (const attempt of attempts) {
    const dateStr = attempt.completed_at?.slice(0, 10);
    if (dateStr && dateStr >= thirtyDaysAgoStr) {
      activeDaysSet.add(dateStr);
    }
  }
  const activeDays30 = activeDaysSet.size;
  const activeDaysRatio = Math.min(1, activeDays30 / 30);
  const quizCompletionRatio = Math.min(
    1,
    attempts.length / ENGAGEMENT_QUIZ_TARGETS[cefrLevel],
  );
  const totalWords = words.length;
  const wordsPracticedRatio = Math.min(
    1,
    totalWords / ACTIVE_VOCAB_TARGETS[cefrLevel],
  );
  const engagementScore = clampScore(
    activeDaysRatio * 40 + quizCompletionRatio * 30 + wordsPracticedRatio * 30,
  );

  const masteredWords = words.filter((word) => word.masteryLevel >= 4).length;
  const avgMasteryLevel =
    totalWords > 0
      ? Number(
          (
            words.reduce((sum, word) => sum + word.masteryLevel, 0) / totalWords
          ).toFixed(1),
        )
      : 0;

  // --- Activity stats ---
  const activityMap = new Map<string, { count: number; totalScore: number }>();
  for (const attempt of scoredAttempts) {
    const type = attempt.quizzes?.type || "unknown";
    const existing = activityMap.get(type) ?? { count: 0, totalScore: 0 };
    activityMap.set(type, {
      count: existing.count + 1,
      totalScore: existing.totalScore + (getScorePercent(attempt) ?? 0),
    });
  }

  const activityStats = Array.from(activityMap.entries())
    .map(([type, stat]) => ({
      type,
      label: ACTIVITY_LABELS[type] || type,
      count: stat.count,
      averageScore: clampScore(stat.totalScore / stat.count),
    }))
    .sort((left, right) => right.averageScore - left.averageScore);

  // --- Grammar topics ---
  const availableGrammarTopics = getTopicsForLevel(
    cefrLevel,
    targetLanguage,
  ).flatMap(({ level, topics }) =>
    topics.map((topicKey) => ({
      topicKey,
      label: topicKey,
      level,
    })),
  );
  const availableGrammarTopicMap = new Map(
    availableGrammarTopics.map((topic) => [topic.topicKey, topic]),
  );

  // Per-topic attempt stats (only sentence translation type)
  const topicAttemptMap = new Map<
    string,
    {
      topicKey: string;
      label: string;
      level: string;
      attempts: number;
      totalScore: number;
      scoredCount: number;
      highScoreAttempts: number;
    }
  >();

  for (const attempt of attempts) {
    const quizType = attempt.quizzes?.type;
    if (quizType !== "translation") continue;

    const topicKey = getPrimaryGrammarTopic(attempt.quizzes?.config);
    if (!topicKey) continue;

    const scorePercent = getScorePercent(attempt);
    const knownTopic = availableGrammarTopicMap.get(topicKey);
    const label = getGrammarTopicDisplayName(attempt.quizzes?.config, topicKey);
    const existing = topicAttemptMap.get(topicKey) ?? {
      topicKey,
      label,
      level: knownTopic?.level ?? cefrLevel,
      attempts: 0,
      totalScore: 0,
      scoredCount: 0,
      highScoreAttempts: 0,
    };

    topicAttemptMap.set(topicKey, {
      ...existing,
      label,
      attempts: existing.attempts + 1,
      totalScore: existing.totalScore + (scorePercent ?? 0),
      scoredCount: existing.scoredCount + (scorePercent == null ? 0 : 1),
      highScoreAttempts:
        existing.highScoreAttempts +
        (scorePercent != null && scorePercent >= GRAMMAR_MASTERY_MIN_SCORE
          ? 1
          : 0),
    });
  }

  // Build grammar topic mastery list for all available topics
  const grammarTopicMastery: GrammarTopicMasteryItem[] =
    availableGrammarTopics.map((topic) => {
      const stats = topicAttemptMap.get(topic.topicKey);
      const tutorSource = tutorMarkedTopics.get(topic.topicKey);
      const systemMastered =
        (stats?.highScoreAttempts ?? 0) >= GRAMMAR_MASTERY_MIN_ATTEMPTS;
      const mastered = systemMastered || tutorSource === "tutor";

      return {
        topicKey: topic.topicKey,
        label: topic.label,
        level: topic.level,
        mastered,
        source: systemMastered ? "system" : (tutorSource ?? null),
        attempts: stats?.attempts ?? 0,
        highScoreAttempts: stats?.highScoreAttempts ?? 0,
        averageScore:
          stats && stats.scoredCount > 0
            ? clampScore(stats.totalScore / stats.scoredCount)
            : null,
      };
    });

  const grammarMasteredCount = grammarTopicMastery.filter(
    (t) => t.mastered,
  ).length;

  // Legacy coveredTopics / remainingTopics (for backward compatibility with overview cards)
  const coveredTopics = Array.from(topicAttemptMap.values())
    .map((topic) => ({
      topicKey: topic.topicKey,
      label: topic.label,
      level: topic.level,
      attempts: topic.attempts,
      averageScore:
        topic.scoredCount > 0
          ? clampScore(topic.totalScore / topic.scoredCount)
          : null,
    }))
    .sort(
      (left, right) =>
        left.level.localeCompare(right.level) ||
        left.label.localeCompare(right.label),
    );

  const remainingTopics = availableGrammarTopics.filter(
    (topic) => !topicAttemptMap.has(topic.topicKey),
  );

  // --- Axis scores ---
  const activeVocabScore = clampScore(
    (totalWords / ACTIVE_VOCAB_TARGETS[cefrLevel]) * 100,
  );
  const passiveVocabScore = clampScore(
    (passiveSignals.equivalentWordCount / PASSIVE_VOCAB_TARGETS[cefrLevel]) *
      100,
  );
  const grammarVarietyScore =
    availableGrammarTopics.length > 0
      ? clampScore((grammarMasteredCount / availableGrammarTopics.length) * 100)
      : 0;
  const timeProgressScore = clampScore(
    (totalLearningHoursRaw / currentGuidedHours.averageHours) * 100,
  );
  const knownWordsScore = clampScore(
    (masteredWords / ACTIVE_VOCAB_TARGETS[cefrLevel]) * 100,
  );
  const addedWordsScore = clampScore(
    (totalWords / ACTIVE_VOCAB_TARGETS[cefrLevel]) * 100,
  );
  const overallPerformanceScore = clampScore(
    timeProgressScore * 0.3 +
      grammarVarietyScore * 0.25 +
      knownWordsScore * 0.25 +
      addedWordsScore * 0.2,
  );
  const overallPerformanceBand: StudentProgressSnapshot["overallPerformance"]["band"] =
    overallPerformanceScore >= 85
      ? "strong"
      : overallPerformanceScore >= 70
        ? "on_track"
        : overallPerformanceScore >= 50
          ? "building"
          : "needs_focus";

  const axes: StudentProgressAxis[] = [
    {
      key: "active_vocab",
      label: "Active Vocab",
      shortLabel: "Active",
      score: activeVocabScore,
      value: `${totalWords.toLocaleString()} / ${ACTIVE_VOCAB_TARGETS[cefrLevel].toLocaleString()} words`,
      helper: `Active vocabulary words tracked in the system. Target for ${cefrLevel}.`,
      beta: true,
    },
    {
      key: "grammar_variety",
      label: "Grammar Variety",
      shortLabel: "Grammar",
      score: grammarVarietyScore,
      value: `${grammarMasteredCount}/${availableGrammarTopics.length} topics mastered`,
      helper: `A topic is mastered after ${GRAMMAR_MASTERY_MIN_ATTEMPTS} sentence translations scored ${GRAMMAR_MASTERY_MIN_SCORE}%+`,
    },
    {
      key: "engagement",
      label: "Engagement",
      shortLabel: "Engagement",
      score: engagementScore,
      value: `${activeDays30}/30 active days`,
      helper: "40% active days, 30% quizzes completed, 30% words practiced",
    },
    {
      key: "accuracy",
      label: "Accuracy",
      shortLabel: "Accuracy",
      score: accuracyScore,
      value: `${accuracyScore}% average score`,
      helper: `${accuracyAttempts.length.toLocaleString()} scored gap-fill and translation attempts`,
    },
    {
      key: "passive_vocab",
      label: "Passive Vocab",
      shortLabel: "Passive",
      score: passiveVocabScore,
      value: `${passiveSignals.equivalentWordCount.toLocaleString()} / ${PASSIVE_VOCAB_TARGETS[cefrLevel].toLocaleString()} words`,
      helper: `Passive recognition vocabulary adjusted by CEFR level. Target for ${cefrLevel}.`,
      beta: true,
    },
  ];

  // Day streak (still used in overview cards)
  const today = new Date().toISOString().slice(0, 10);
  let streakDays = 0;
  const allDates = new Set(
    attempts
      .map((a) => a.completed_at?.slice(0, 10))
      .filter(Boolean) as string[],
  );
  const checkDate = new Date();
  // Allow today to be skipped (in-progress day)
  if (!allDates.has(today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (allDates.has(checkDate.toISOString().slice(0, 10))) {
    streakDays++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    profile: {
      fullName: profile.full_name,
      cefrLevel,
      targetLanguage,
      sourceLanguage,
      targetLanguageLabel: getLearningLanguageLabel(targetLanguage),
      sourceLanguageLabel: getSourceLanguageLabel(sourceLanguage),
    },
    axes,
    chartData: axes.map((axis) => ({
      axis: axis.shortLabel,
      score: axis.score,
      fullMark: 100,
    })),
    overview: {
      totalAttempts: attempts.length,
      avgScore: allAvgScore,
      bestScore,
      streakDays,
      activeDays30,
      totalWords,
      masteredWords,
      avgMasteryLevel,
      grammarMasteredCount,
      grammarAvailableCount: availableGrammarTopics.length,
      createdQuizCount: quizCountResult.count ?? 0,
    },
    timeMetrics: {
      appLearningSeconds,
      appLearningHours: Number(appLearningHoursRaw.toFixed(1)),
      lessonHours,
      totalLearningHours: Number(totalLearningHoursRaw.toFixed(1)),
      completedLessons,
    },
    cefrGuidedHours: {
      source:
        "Approximate cumulative guided learning hours based on Cambridge English CEFR guidance from beginner level.",
      levels: CEFR_LEVELS.map((level) => ({
        level,
        minHours: CEFR_GUIDED_HOURS[level].minHours,
        maxHours: CEFR_GUIDED_HOURS[level].maxHours,
        averageHours: CEFR_GUIDED_HOURS[level].averageHours,
      })),
      currentLevel: {
        level: cefrLevel,
        minHours: currentGuidedHours.minHours,
        maxHours: currentGuidedHours.maxHours,
        averageHours: currentGuidedHours.averageHours,
        progressPercent: timeProgressScore,
        remainingHours: Number(
          Math.max(0, currentGuidedHours.averageHours - totalLearningHoursRaw).toFixed(
            1,
          ),
        ),
      },
      nextLevel: nextLevel && nextGuidedHours
        ? {
            level: nextLevel,
            minHours: nextGuidedHours.minHours,
            maxHours: nextGuidedHours.maxHours,
            averageHours: nextGuidedHours.averageHours,
            progressPercent: clampScore(
              (totalLearningHoursRaw / nextGuidedHours.averageHours) * 100,
            ),
            remainingHours: Number(
              Math.max(0, nextGuidedHours.averageHours - totalLearningHoursRaw).toFixed(
                1,
              ),
            ),
          }
        : null,
    },
    overallPerformance: {
      score: overallPerformanceScore,
      band: overallPerformanceBand,
      components: {
        time: timeProgressScore,
        grammar: grammarVarietyScore,
        knownWords: knownWordsScore,
        addedWords: addedWordsScore,
      },
    },
    activityStats,
    recentAttempts: attempts.slice(0, 10).map((attempt) => ({
      title: attempt.quizzes?.title ?? "Untitled Quiz",
      type: attempt.quizzes?.type ?? "unknown",
      completedAt: attempt.completed_at,
      scorePercent: getScorePercent(attempt),
    })),
    grammar: {
      betaNotice:
        "Grammar variety tracks how many grammar topics you have mastered through sentence translation quizzes. A topic is mastered after 5 quizzes scored 90% or above.",
      coveredTopics,
      remainingTopics,
    },
    grammarTopicMastery,
    passiveSignals,
    words,
  };
}
