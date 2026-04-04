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
import { calculateDayStreak } from "@/lib/history/calculate-day-streak";
import { getTopicsForLevel } from "@/lib/grammar/topics";
import {
  getGrammarTopicDisplayName,
  getPrimaryGrammarTopic,
} from "@/lib/utils";
import type { CEFRLevel } from "@/types/quiz";

const CEFR_LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const BREADTH_TARGETS_BY_LEVEL: Record<CEFRLevel, number> = {
  A1: 60,
  A2: 140,
  B1: 320,
  B2: 550,
  C1: 900,
  C2: 1300,
};
const DETERMINATION_TARGET_DAYS = 21;

type ProgressAxisKey =
  | "vocabulary"
  | "grammar"
  | "determination"
  | "accuracy"
  | "breadth";

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
    totalWords: number;
    masteredWords: number;
    avgMasteryLevel: number;
    grammarCoveredCount: number;
    grammarAvailableCount: number;
    createdQuizCount: number;
  };
  activityStats: StudentProgressActivityStat[];
  recentAttempts: StudentProgressRecentAttempt[];
  grammar: {
    betaNotice: string;
    coveredTopics: StudentProgressTopicStat[];
    remainingTopics: Array<{ topicKey: string; label: string; level: string }>;
  };
  words: StudentProgressWord[];
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeCefrLevel(value?: string | null): CEFRLevel {
  return CEFR_LEVELS.includes(value as CEFRLevel) ? (value as CEFRLevel) : "A1";
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

  const [profileResult, attemptsResult, masteryResult, quizCountResult] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("full_name, cefr_level, preferred_language, source_language")
        .eq("id", userId)
        .single(),
      supabaseAdmin
        .from("quiz_attempts")
        .select(
          "score, max_score, completed_at, quizzes(title, type, cefr_level, vocabulary_terms, config)",
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

  const scoredAttempts = attempts.filter(
    (attempt) => getScorePercent(attempt) !== null,
  );
  const avgScore =
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
  const streakDays = calculateDayStreak(
    attempts.map((attempt) => attempt.completed_at),
  );

  const totalWords = words.length;
  const masteredWords = words.filter((word) => word.masteryLevel >= 4).length;
  const stableWords = words.filter((word) => word.masteryLevel >= 3).length;
  const avgMasteryLevel =
    totalWords > 0
      ? Number(
          (
            words.reduce((sum, word) => sum + word.masteryLevel, 0) / totalWords
          ).toFixed(1),
        )
      : 0;

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
  const coveredGrammarTopicMap = new Map<
    string,
    {
      topicKey: string;
      label: string;
      level: string;
      attempts: number;
      totalScore: number;
      scoredCount: number;
    }
  >();

  for (const attempt of attempts) {
    const topicKey = getPrimaryGrammarTopic(attempt.quizzes?.config);

    if (!topicKey) {
      continue;
    }

    const scorePercent = getScorePercent(attempt);
    const knownTopic = availableGrammarTopicMap.get(topicKey);
    const label = getGrammarTopicDisplayName(attempt.quizzes?.config, topicKey);
    const existing = coveredGrammarTopicMap.get(topicKey) ?? {
      topicKey,
      label,
      level: knownTopic?.level ?? cefrLevel,
      attempts: 0,
      totalScore: 0,
      scoredCount: 0,
    };

    coveredGrammarTopicMap.set(topicKey, {
      ...existing,
      label,
      attempts: existing.attempts + 1,
      totalScore: existing.totalScore + (scorePercent ?? 0),
      scoredCount: existing.scoredCount + (scorePercent == null ? 0 : 1),
    });
  }

  const coveredTopics = Array.from(coveredGrammarTopicMap.values())
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
    (topic) => !coveredGrammarTopicMap.has(topic.topicKey),
  );

  const translationAttempts = scoredAttempts.filter((attempt) => {
    const type = attempt.quizzes?.type;
    return type === "translation" || type === "text_translation";
  });
  const translationAverageScore =
    translationAttempts.length > 0
      ? clampScore(
          translationAttempts.reduce(
            (sum, attempt) => sum + (getScorePercent(attempt) ?? 0),
            0,
          ) / translationAttempts.length,
        )
      : 0;
  const grammarCoveragePercent =
    availableGrammarTopics.length > 0
      ? (coveredTopics.length / availableGrammarTopics.length) * 100
      : 0;

  const vocabularyScore =
    totalWords > 0
      ? clampScore((avgMasteryLevel / 5) * 68 + (stableWords / totalWords) * 32)
      : 0;
  const grammarScore =
    coveredTopics.length === 0 && translationAttempts.length === 0
      ? 15
      : clampScore(
          translationAverageScore * 0.7 + grammarCoveragePercent * 0.3,
        );
  const determinationScore = clampScore(
    (streakDays / DETERMINATION_TARGET_DAYS) * 100,
  );
  const breadthScore = clampScore(
    (totalWords / BREADTH_TARGETS_BY_LEVEL[cefrLevel]) * 100,
  );

  const axes: StudentProgressAxis[] = [
    {
      key: "vocabulary",
      label: "Vocabulary",
      shortLabel: "Vocab",
      score: vocabularyScore,
      value: `${avgMasteryLevel.toFixed(1)}/5 avg mastery`,
      helper: `${stableWords.toLocaleString()} stable words at level 3 or above`,
    },
    {
      key: "grammar",
      label: "Grammar",
      shortLabel: "Grammar",
      score: grammarScore,
      value: `${coveredTopics.length}/${availableGrammarTopics.length || 0} topics covered`,
      helper:
        coveredTopics.length > 0
          ? `Translation average ${translationAverageScore}% across grammar-aware work`
          : "Beta axis based on grammar-topic exposure and translation performance",
      beta: true,
    },
    {
      key: "determination",
      label: "Determination",
      shortLabel: "Grit",
      score: determinationScore,
      value: `${streakDays} day streak`,
      helper: `21 days is treated as a full habit-forming streak`,
    },
    {
      key: "accuracy",
      label: "Accuracy",
      shortLabel: "Accuracy",
      score: avgScore,
      value: `${avgScore}% average score`,
      helper: `${scoredAttempts.length.toLocaleString()} scored attempts measured`,
    },
    {
      key: "breadth",
      label: "Breadth",
      shortLabel: "Breadth",
      score: breadthScore,
      value: `${totalWords.toLocaleString()} unique words`,
      helper: `Normalized against a typical ${cefrLevel} vocabulary target`,
    },
  ];

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
      avgScore,
      bestScore,
      streakDays,
      totalWords,
      masteredWords,
      avgMasteryLevel,
      grammarCoveredCount: coveredTopics.length,
      grammarAvailableCount: availableGrammarTopics.length,
      createdQuizCount: quizCountResult.count ?? 0,
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
        "Grammar is currently estimated from grammar-topic exposure and translation performance. It is useful for coaching, but not yet a full grammar-mastery model.",
      coveredTopics,
      remainingTopics,
    },
    words,
  };
}
