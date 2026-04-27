import type { CEFRLevel } from "@/types/quiz";

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
  passiveEquivalentWords: number;
  activeDays: number;
  activityCount: number;
  completedLessons: number;
  completedQuizzes: number;
  grammarTopicsPracticed: number;
  confidentGrammarTopics: number;
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
  A1: 30,
  A2: 45,
  B1: 90,
  B2: 130,
  C1: 180,
  C2: 240,
};

const MONTHLY_PASSIVE_VOCAB_TARGETS: Record<CEFRLevel, number> = {
  A1: 50,
  A2: 80,
  B1: 160,
  B2: 240,
  C1: 320,
  C2: 420,
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
  const transcriptTermsRatio = Math.min(
    1,
    factors.transcriptActiveTerms / targets.transcriptTarget,
  );
  const newWordsRatio = Math.min(
    1,
    factors.newPracticeWords / targets.practiceTarget,
  );
  const activeDaysRatio = Math.min(
    1,
    factors.activeDays / targets.activeDaysTarget,
  );
  const activityRatio = Math.min(
    1,
    factors.activityCount / targets.activityTarget,
  );
  const activeVocabScore = clampScore(
    transcriptTermsRatio * 80 + newWordsRatio * 20,
  );
  const grammarVarietyScore = clampScore(
    (factors.confidentGrammarTopics / targets.grammarTarget) * 100,
  );
  const engagementScore = clampScore(
    newWordsRatio * 40 + activeDaysRatio * 30 + activityRatio * 30,
  );
  const passiveVocabScore = clampScore(
    (factors.passiveEquivalentWords / targets.passiveTarget) * 100,
  );

  const axes: StudentMonthlyProgressAxisData[] = [
    {
      key: "active_vocab",
      label: "Active Vocab",
      shortLabel: "Active",
      score: activeVocabScore,
      value: `${factors.transcriptActiveTerms.toLocaleString()}/${targets.transcriptTarget.toLocaleString()} transcript target, ${factors.newPracticeWords.toLocaleString()}/${targets.practiceTarget.toLocaleString()} practice target`,
      helper: "Monthly score = 80% transcript terms used in live lessons and 20% new words added for practice.",
      beta: true,
    },
    {
      key: "grammar_variety",
      label: "Grammar Variety",
      shortLabel: "Grammar",
      score: grammarVarietyScore,
      value: `${factors.confidentGrammarTopics}/${targets.grammarTarget} monthly confident-topic target`,
      helper: `${factors.availableGrammarTopicCount} topics are available at this level. A topic counts here after a sentence translation scored 90%+ during the month window.`,
    },
    {
      key: "engagement",
      label: "Engagement",
      shortLabel: "Engagement",
      score: engagementScore,
      value: `${factors.newPracticeWords.toLocaleString()} new words, ${factors.activeDays}/${targets.activeDaysTarget} active days`,
      helper: "40% new words added for practice, 30% active days, 30% quiz and lesson activity.",
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
      label: "Passive Vocab",
      shortLabel: "Passive",
      score: passiveVocabScore,
      value: `${factors.passiveEquivalentWords.toLocaleString()}/${targets.passiveTarget.toLocaleString()} monthly recognition target`,
      helper: "New passive-recognition evidence added during the month window, normalized against a monthly CEFR target.",
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