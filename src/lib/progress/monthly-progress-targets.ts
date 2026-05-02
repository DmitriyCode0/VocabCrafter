import type { CEFRLevel } from "@/types/quiz";

export const MONTHLY_GRAMMAR_MASTERY_MIN_ATTEMPTS = 5;

export interface StudentMonthlyProgressTargets {
  transcriptTarget: number;
  practiceTarget: number;
  passiveTarget: number;
  activeDaysTarget: number;
  activityTarget: number;
  grammarTarget: number;
}

export type StudentMonthlyProgressTargetOverrides =
  Partial<StudentMonthlyProgressTargets>;

export interface StudentMonthlyProgressFactors {
  transcriptActiveTerms: number;
  transcriptUsageCount: number;
  newPracticeWords: number;
  masteredWordsLevel45: number;
  studentSpeakingShare: number | null;
  passiveEquivalentWords: number;
  activeDays: number;
  daysElapsed: number;
  totalDaysInMonth: number;
  activityCount: number;
  completedLessons: number;
  completedQuizzes: number;
  grammarTopicsPracticed: number;
  confidentGrammarTopics: number;
  grammarHighScoreAttemptsTotal: number;
  accuracyAttemptCount: number;
  accuracyScore: number;
  availableGrammarTopicCount: number;
}

export interface StudentMonthlyProgressAxisData {
  key:
    | "active_vocab"
    | "grammar_variety"
    | "engagement"
    | "accuracy"
    | "passive_vocab";
  label: string;
  shortLabel: string;
  score: number;
  value: string;
  helper: string;
  beta?: boolean;
}

const MONTHLY_ACTIVE_VOCAB_TARGETS: Record<CEFRLevel, number> = {
  A1: 40,
  A2: 45,
  B1: 50,
  B2: 55,
  C1: 60,
  C2: 65,
};

const MONTHLY_PASSIVE_VOCAB_TARGETS: Record<CEFRLevel, number> = {
  A1: 10,
  A2: 16,
  B1: 24,
  B2: 32,
  C1: 40,
  C2: 48,
};

const MONTHLY_NEW_WORD_TARGETS: Record<CEFRLevel, number> = {
  A1: 10,
  A2: 16,
  B1: 24,
  B2: 32,
  C1: 40,
  C2: 48,
};

const MONTHLY_ACTIVITY_TARGETS: Record<CEFRLevel, number> = {
  A1: 12,
  A2: 16,
  B1: 20,
  B2: 24,
  C1: 28,
  C2: 32,
};

const MONTHLY_GRAMMAR_TOPIC_TARGETS: Record<CEFRLevel, number> = {
  A1: 3,
  A2: 5,
  B1: 8,
  B2: 10,
  C1: 12,
  C2: 14,
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizePositiveTarget(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(10_000, Math.round(value as number)));
}

export function getDefaultStudentMonthlyProgressTargets(
  cefrLevel: CEFRLevel,
  dayCount: number,
): StudentMonthlyProgressTargets {
  return {
    transcriptTarget: MONTHLY_ACTIVE_VOCAB_TARGETS[cefrLevel],
    practiceTarget: MONTHLY_NEW_WORD_TARGETS[cefrLevel],
    passiveTarget: MONTHLY_PASSIVE_VOCAB_TARGETS[cefrLevel],
    activeDaysTarget: Math.max(1, dayCount),
    activityTarget: MONTHLY_ACTIVITY_TARGETS[cefrLevel],
    grammarTarget: MONTHLY_GRAMMAR_TOPIC_TARGETS[cefrLevel],
  };
}

export function resolveStudentMonthlyProgressTargets({
  cefrLevel,
  dayCount,
  overrides,
}: {
  cefrLevel: CEFRLevel;
  dayCount: number;
  overrides?: StudentMonthlyProgressTargetOverrides | null;
}): StudentMonthlyProgressTargets {
  const defaults = getDefaultStudentMonthlyProgressTargets(cefrLevel, dayCount);

  return {
    transcriptTarget: normalizePositiveTarget(
      overrides?.transcriptTarget,
      defaults.transcriptTarget,
    ),
    practiceTarget: normalizePositiveTarget(
      overrides?.practiceTarget,
      defaults.practiceTarget,
    ),
    passiveTarget: normalizePositiveTarget(
      overrides?.passiveTarget,
      defaults.passiveTarget,
    ),
    activeDaysTarget: normalizePositiveTarget(
      overrides?.activeDaysTarget,
      defaults.activeDaysTarget,
    ),
    activityTarget: normalizePositiveTarget(
      overrides?.activityTarget,
      defaults.activityTarget,
    ),
    grammarTarget: normalizePositiveTarget(
      overrides?.grammarTarget,
      defaults.grammarTarget,
    ),
  };
}

export function areStudentMonthlyProgressTargetsEqual(
  left: StudentMonthlyProgressTargets,
  right: StudentMonthlyProgressTargets,
) {
  return (
    left.transcriptTarget === right.transcriptTarget &&
    left.practiceTarget === right.practiceTarget &&
    left.passiveTarget === right.passiveTarget &&
    left.activeDaysTarget === right.activeDaysTarget &&
    left.activityTarget === right.activityTarget &&
    left.grammarTarget === right.grammarTarget
  );
}

export function buildStudentMonthlyProgressPresentation({
  factors,
  targets,
}: {
  factors: StudentMonthlyProgressFactors;
  targets: StudentMonthlyProgressTargets;
}) {
  const speakingShareRatio = Math.min(
    1,
    (factors.studentSpeakingShare ?? 0) / targets.transcriptTarget,
  );
  const newWordsRatio = Math.min(
    1,
    factors.newPracticeWords / targets.practiceTarget,
  );
  const masteredWordsRatio = Math.min(
    1,
    factors.masteredWordsLevel45 / targets.passiveTarget,
  );
  const activeDaysRatio = Math.min(
    1,
    factors.activeDays / targets.activeDaysTarget,
  );
  const activityRatio = Math.min(
    1,
    factors.activityCount / targets.activityTarget,
  );
  const activeVocabScore = clampScore(speakingShareRatio * 100);
  const grammarVarietyScore = clampScore(
    (factors.confidentGrammarTopics / targets.grammarTarget) * 100,
  );
  const engagementScore = clampScore(
    (activeDaysRatio * 0.5 + activityRatio * 0.5) * 100,
  );
  const passiveVocabScore = clampScore(newWordsRatio * 30 + masteredWordsRatio * 70);
  const grammarSentencesRemaining = Math.max(
    0,
    targets.grammarTarget * MONTHLY_GRAMMAR_MASTERY_MIN_ATTEMPTS -
      factors.grammarHighScoreAttemptsTotal,
  );

  const axes: StudentMonthlyProgressAxisData[] = [
    {
      key: "active_vocab",
      label: "Speaking",
      shortLabel: "Speaking",
      score: activeVocabScore,
      value: `${factors.studentSpeakingShare == null ? "n/a" : `${factors.studentSpeakingShare.toFixed(1).replace(/\.0$/, "")}%`} / ${targets.transcriptTarget.toLocaleString()}% speaking target`,
      helper: "Monthly score follows student speaking share against the speaking goal from the month plan.",
      beta: true,
    },
    {
      key: "grammar_variety",
      label: "Grammar Variety",
      shortLabel: "Grammar",
      score: grammarVarietyScore,
      value: `${factors.confidentGrammarTopics}/${targets.grammarTarget} topics mastered this month`,
      helper: `A topic is mastered after 5 translation quizzes scored 90%+. Remaining auto-complete quizzes: ${grammarSentencesRemaining}.`,
    },
    {
      key: "engagement",
      label: "Engagement",
      shortLabel: "Engagement",
      score: engagementScore,
      value: `${factors.activeDays}/${targets.activeDaysTarget} active days this month, ${factors.activityCount}/${targets.activityTarget} objective completions`,
      helper: "50% active days in app this month, 50% objective completions progress.",
    },
    {
      key: "accuracy",
      label: "Accuracy",
      shortLabel: "Accuracy",
      score: factors.accuracyScore,
      value: `${factors.accuracyScore}% average score`,
      helper: `${factors.accuracyAttemptCount.toLocaleString()} scored gap-fill and translation attempts in the month window.`,
    },
    {
      key: "passive_vocab",
      label: "Vocabulary",
      shortLabel: "Vocab",
      score: passiveVocabScore,
      value: `${factors.newPracticeWords.toLocaleString()}/${targets.practiceTarget.toLocaleString()} words added, ${factors.masteredWordsLevel45.toLocaleString()}/${targets.passiveTarget.toLocaleString()} mastered to level 4-5`,
      helper: "Monthly vocabulary score = 30% words added vs target and 70% words reaching mastery levels 4-5 vs target.",
      beta: true,
    },
  ];

  return {
    axes,
    chartData: axes.map((axis) => ({
      axis: axis.shortLabel,
      score: axis.score,
      fullMark: 100,
    })),
  };
}