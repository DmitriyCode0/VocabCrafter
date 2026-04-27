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
import { getGrammarTopicPromptCatalogUpToLevel } from "@/lib/grammar/prompt-overrides";
import {
  summarizeActiveVocabularyEvidence,
  type ActiveVocabularyEvidenceRow,
  type ActiveVocabularySignalSummary,
} from "@/lib/mastery/active-vocabulary-evidence";
import {
  getGrammarTopicDisplayName,
  getPrimaryGrammarTopic,
} from "@/lib/utils";
import {
  extractPassiveVocabularyTermOccurrencesFromText,
  normalizePassiveVocabularyLibraryAttributes,
  summarizePassiveVocabularyEvidence,
  type PassiveVocabularyEvidenceRow,
} from "@/lib/mastery/passive-vocabulary";
import {
  buildStudentMonthlyProgressPresentation,
  resolveStudentMonthlyProgressTargets,
  type StudentMonthlyProgressFactors,
  type StudentMonthlyProgressTargetOverrides,
  type StudentMonthlyProgressTargets,
} from "@/lib/progress/monthly-progress-targets";
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
 * Live-lesson active evidence observes only the vocabulary we have actually
 * heard the student produce, so it uses smaller targets than the full CEFR
 * productive lexicon targets above.
 */
const OBSERVED_ACTIVE_VOCAB_TARGETS: Record<CEFRLevel, number> = {
  A1: 30,
  A2: 45,
  B1: 90,
  B2: 130,
  C1: 180,
  C2: 240,
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

const MONTHLY_ACTIVITY_TARGETS: Record<CEFRLevel, number> = {
  A1: 12,
  A2: 16,
  B1: 20,
  B2: 24,
  C1: 28,
  C2: 32,
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
  created_at?: string;
  passive_vocabulary_library: {
    cefr_level: string | null;
    part_of_speech: string | null;
    attributes: Record<string, unknown> | null;
  } | null;
}

interface ActiveEvidenceWithLibraryRow {
  id: string;
  term: string;
  source_type: "lesson_recording" | "manual_list" | "other";
  source_label: string | null;
  usage_count: number;
  first_used_at: string;
  last_used_at: string;
  passive_vocabulary_library: {
    cefr_level: string | null;
    part_of_speech: string | null;
    attributes: Record<string, unknown> | null;
  } | null;
}

interface MonthlyWordAdditionRow {
  created_at: string;
}

interface MonthlyLessonRow {
  id: string;
  lesson_date: string;
  status: string;
}

interface MonthlyTranscriptRow {
  id: string;
  lesson_id: string;
}

interface MonthlyClassroomRecordingRow {
  id: string;
  created_at: string;
}

interface MonthlyClassroomTranscriptRow {
  id: string;
  recording_id: string;
}

interface MonthlyTranscriptSegmentRow {
  transcript_id: string;
  occurred_at: string;
  speaker_role: string;
  content: string;
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

export interface StudentOverallPerformanceComponents {
  time: number;
  activeVocab: number;
  passiveVocab: number;
  grammar: number;
  addedWords: number;
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
    timeAdjustmentHours: number;
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
    components: StudentOverallPerformanceComponents;
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
  activeSignals: ActiveVocabularySignalSummary;
  words: StudentProgressWord[];
}

export interface StudentMonthlyProgressSnapshot {
  window: {
    reportMonth: string;
    periodStart: string;
    periodEnd: string;
    endExclusive: string;
    dayCount: number;
  };
  targets: StudentMonthlyProgressTargets;
  axes: StudentProgressAxis[];
  chartData: Array<{
    axis: string;
    score: number;
    fullMark: number;
  }>;
  factors: StudentMonthlyProgressFactors;
}

export interface StudentMonthlyComparisonSnapshot {
  currentMonth: StudentMonthlyProgressSnapshot;
  previousMonth: StudentMonthlyProgressSnapshot;
}

interface ProgressMonthWindow {
  reportMonth: string;
  periodStart: string;
  periodEnd: string;
  endExclusive: string;
  dayCount: number;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getOverallPerformanceBand(score: number) {
  if (score >= 85) {
    return "strong" as const;
  }

  if (score >= 70) {
    return "on_track" as const;
  }

  if (score >= 50) {
    return "building" as const;
  }

  return "needs_focus" as const;
}

function calculateOverallPerformanceScore(
  components: StudentOverallPerformanceComponents,
) {
  return clampScore(
    (components.time +
      components.activeVocab +
      components.passiveVocab +
      components.grammar +
      components.addedWords) /
      5,
  );
}

export function applyTutorTimeAdjustmentToSnapshot(
  snapshot: StudentProgressSnapshot,
  timeAdjustmentHours: number,
): StudentProgressSnapshot {
  const normalizedTimeAdjustmentHours = Number(
    (Number.isFinite(timeAdjustmentHours) ? timeAdjustmentHours : 0).toFixed(2),
  );
  const baseTotalLearningHoursRaw =
    snapshot.timeMetrics.appLearningSeconds / 3600 +
    snapshot.timeMetrics.lessonHours;
  const adjustedTotalLearningHoursRaw = Math.max(
    0,
    baseTotalLearningHoursRaw + normalizedTimeAdjustmentHours,
  );
  const timeProgressScore = clampScore(
    (adjustedTotalLearningHoursRaw /
      snapshot.cefrGuidedHours.currentLevel.averageHours) *
      100,
  );
  const overallPerformanceComponents: StudentOverallPerformanceComponents = {
    ...snapshot.overallPerformance.components,
    time: timeProgressScore,
  };
  const overallPerformanceScore = calculateOverallPerformanceScore(
    overallPerformanceComponents,
  );

  return {
    ...snapshot,
    timeMetrics: {
      ...snapshot.timeMetrics,
      totalLearningHours: Number(adjustedTotalLearningHoursRaw.toFixed(1)),
      timeAdjustmentHours: normalizedTimeAdjustmentHours,
    },
    cefrGuidedHours: {
      ...snapshot.cefrGuidedHours,
      currentLevel: {
        ...snapshot.cefrGuidedHours.currentLevel,
        progressPercent: timeProgressScore,
        remainingHours: Number(
          Math.max(
            0,
            snapshot.cefrGuidedHours.currentLevel.averageHours -
              adjustedTotalLearningHoursRaw,
          ).toFixed(1),
        ),
      },
      nextLevel: snapshot.cefrGuidedHours.nextLevel
        ? {
            ...snapshot.cefrGuidedHours.nextLevel,
            progressPercent: clampScore(
              (adjustedTotalLearningHoursRaw /
                snapshot.cefrGuidedHours.nextLevel.averageHours) *
                100,
            ),
            remainingHours: Number(
              Math.max(
                0,
                snapshot.cefrGuidedHours.nextLevel.averageHours -
                  adjustedTotalLearningHoursRaw,
              ).toFixed(1),
            ),
          }
        : null,
    },
    overallPerformance: {
      score: overallPerformanceScore,
      band: getOverallPerformanceBand(overallPerformanceScore),
      components: overallPerformanceComponents,
    },
  };
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

function toUtcDateString(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addUtcDays(date: Date, amount: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function buildProgressMonthWindow(referenceDate: Date): ProgressMonthWindow {
  const monthStart = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1),
  );
  const periodEndDate = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );

  return {
    reportMonth: toUtcDateString(monthStart),
    periodStart: toUtcDateString(monthStart),
    periodEnd: toUtcDateString(periodEndDate),
    endExclusive: toUtcDateString(addUtcDays(periodEndDate, 1)),
    dayCount:
      Math.floor((periodEndDate.getTime() - monthStart.getTime()) / 86_400_000) + 1,
  };
}

function getComparablePreviousMonthReferenceDate(referenceDate: Date) {
  const previousMonthLastDay = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth() - 1,
      Math.min(referenceDate.getUTCDate(), previousMonthLastDay),
    ),
  );
}

function getIsoDateFromTimestamp(value?: string | null) {
  return value?.slice(0, 10) ?? null;
}

function isIsoDateInWindow(
  isoDate: string | null,
  window: Pick<ProgressMonthWindow, "periodStart" | "periodEnd">,
) {
  return Boolean(
    isoDate && isoDate >= window.periodStart && isoDate <= window.periodEnd,
  );
}

function buildMonthlyChartDataFromAxes(axes: StudentProgressAxis[]) {
  return axes.map((axis) => ({
    axis: axis.shortLabel,
    score: axis.score,
    fullMark: 100,
  }));
}

function mapPassiveEvidenceRows(
  rows: PassiveEvidenceWithLibraryRow[],
): PassiveVocabularyEvidenceRow[] {
  return rows.map(
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
}

function mapActiveEvidenceRows(
  rows: ActiveEvidenceWithLibraryRow[],
): ActiveVocabularyEvidenceRow[] {
  return rows.map(
    (row): ActiveVocabularyEvidenceRow => ({
      id: row.id,
      term: row.term,
      source_type: row.source_type,
      source_label: row.source_label,
      usage_count: row.usage_count,
      first_used_at: row.first_used_at,
      last_used_at: row.last_used_at,
      library_cefr_level:
        (row.passive_vocabulary_library?.cefr_level as
          | ActiveVocabularyEvidenceRow["library_cefr_level"]
          | null) ?? null,
      library_part_of_speech:
        (row.passive_vocabulary_library?.part_of_speech as
          | ActiveVocabularyEvidenceRow["library_part_of_speech"]
          | null) ?? null,
      library_attributes: normalizePassiveVocabularyLibraryAttributes(
        row.passive_vocabulary_library?.attributes,
      ),
    }),
  );
}

function buildStudentMonthlyProgressSnapshot({
  cefrLevel,
  availableGrammarTopicCount,
  attempts,
  wordAdditions,
  passiveEvidenceRows,
  lessons,
  transcriptSegments,
  window,
  monthlyTargetOverrides,
}: {
  cefrLevel: CEFRLevel;
  availableGrammarTopicCount: number;
  attempts: AttemptRow[];
  wordAdditions: MonthlyWordAdditionRow[];
  passiveEvidenceRows: PassiveEvidenceWithLibraryRow[];
  lessons: MonthlyLessonRow[];
  transcriptSegments: MonthlyTranscriptSegmentRow[];
  window: ProgressMonthWindow;
  monthlyTargetOverrides?: StudentMonthlyProgressTargetOverrides | null;
}): StudentMonthlyProgressSnapshot {
  const attemptsInWindow = attempts.filter((attempt) =>
    isIsoDateInWindow(getIsoDateFromTimestamp(attempt.completed_at), window),
  );
  const newWordsInWindow = wordAdditions.filter((word) =>
    isIsoDateInWindow(getIsoDateFromTimestamp(word.created_at), window),
  );
  const passiveEvidenceInWindow = passiveEvidenceRows.filter((row) =>
    isIsoDateInWindow(getIsoDateFromTimestamp(row.created_at), window),
  );
  const lessonsInWindow = lessons.filter((lesson) =>
    isIsoDateInWindow(lesson.lesson_date, window),
  );
  const transcriptSegmentsInWindow = transcriptSegments.filter((segment) =>
    isIsoDateInWindow(getIsoDateFromTimestamp(segment.occurred_at), window),
  );

  const activeTerms = transcriptSegmentsInWindow.flatMap((segment) =>
    extractPassiveVocabularyTermOccurrencesFromText(segment.content),
  );
  const transcriptUniqueTerms = new Set(activeTerms).size;
  const transcriptUsageCount = activeTerms.length;
  const newPracticeWords = newWordsInWindow.length;
  const passiveSignals = summarizePassiveVocabularyEvidence(
    mapPassiveEvidenceRows(passiveEvidenceInWindow),
    cefrLevel,
  );

  const accuracyAttempts = attemptsInWindow.filter((attempt) => {
    const type = attempt.quizzes?.type;
    return type === "gap_fill" || type === "translation";
  });
  const scoredAccuracyAttempts = accuracyAttempts.filter(
    (attempt) => getScorePercent(attempt) !== null,
  );
  const accuracyScore =
    scoredAccuracyAttempts.length > 0
      ? clampScore(
          scoredAccuracyAttempts.reduce(
            (sum, attempt) => sum + (getScorePercent(attempt) ?? 0),
            0,
          ) / scoredAccuracyAttempts.length,
        )
      : 0;

  const confidentGrammarTopics = new Set<string>();
  const practicedGrammarTopics = new Set<string>();
  for (const attempt of attemptsInWindow) {
    if (attempt.quizzes?.type !== "translation") {
      continue;
    }

    const topicKey = getPrimaryGrammarTopic(attempt.quizzes?.config);
    if (!topicKey) {
      continue;
    }

    practicedGrammarTopics.add(topicKey);
    const scorePercent = getScorePercent(attempt);
    if (scorePercent != null && scorePercent >= GRAMMAR_MASTERY_MIN_SCORE) {
      confidentGrammarTopics.add(topicKey);
    }
  }

  const completedLessons = lessonsInWindow.filter(
    (lesson) => lesson.status === "completed",
  ).length;
  const completedQuizzes = attemptsInWindow.length;
  const activityCount = completedQuizzes + completedLessons;
  const activityDays = new Set<string>();

  for (const attempt of attemptsInWindow) {
    const isoDate = getIsoDateFromTimestamp(attempt.completed_at);
    if (isoDate) {
      activityDays.add(isoDate);
    }
  }

  for (const lesson of lessonsInWindow) {
    activityDays.add(lesson.lesson_date);
  }

  for (const word of newWordsInWindow) {
    const isoDate = getIsoDateFromTimestamp(word.created_at);
    if (isoDate) {
      activityDays.add(isoDate);
    }
  }

  for (const evidence of passiveEvidenceInWindow) {
    const isoDate = getIsoDateFromTimestamp(evidence.created_at);
    if (isoDate) {
      activityDays.add(isoDate);
    }
  }

  const activeDays = activityDays.size;
  const factors: StudentMonthlyProgressFactors = {
    transcriptActiveTerms: transcriptUniqueTerms,
    transcriptUsageCount,
    newPracticeWords,
    passiveEquivalentWords: passiveSignals.equivalentWordCount,
    activeDays,
    activityCount,
    completedLessons,
    completedQuizzes,
    grammarTopicsPracticed: practicedGrammarTopics.size,
    confidentGrammarTopics: confidentGrammarTopics.size,
    accuracyAttemptCount: scoredAccuracyAttempts.length,
    accuracyScore,
    availableGrammarTopicCount,
  };
  const targets = resolveStudentMonthlyProgressTargets({
    cefrLevel,
    dayCount: window.dayCount,
    overrides: monthlyTargetOverrides,
  });
  const presentation = buildStudentMonthlyProgressPresentation({
    factors,
    targets,
  });

  return {
    window,
    targets,
    axes: presentation.axes,
    chartData: presentation.chartData,
    factors,
  };
}

export async function getStudentMonthlyComparisonSnapshot(
  userId: string,
  referenceDate: Date = new Date(),
  monthlyTargetOverrides?: StudentMonthlyProgressTargetOverrides | null,
): Promise<StudentMonthlyComparisonSnapshot> {
  const supabaseAdmin = createAdminClient();
  const currentWindow = buildProgressMonthWindow(referenceDate);
  const previousReferenceDate = getComparablePreviousMonthReferenceDate(
    referenceDate,
  );
  const previousWindow = buildProgressMonthWindow(previousReferenceDate);

  const [
    profileResult,
    attemptsResult,
    wordAdditionsResult,
    passiveEvidenceResult,
    lessonsResult,
    classroomsResult,
  ] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("cefr_level, preferred_language")
        .eq("id", userId)
        .single(),
      supabaseAdmin
        .from("quiz_attempts")
        .select("score, max_score, completed_at, quizzes(type, config)")
        .eq("student_id", userId)
        .gte("completed_at", `${previousWindow.periodStart}T00:00:00.000Z`)
        .lt("completed_at", `${currentWindow.endExclusive}T00:00:00.000Z`),
      supabaseAdmin
        .from("word_mastery")
        .select("created_at")
        .eq("student_id", userId)
        .gte("created_at", `${previousWindow.periodStart}T00:00:00.000Z`)
        .lt("created_at", `${currentWindow.endExclusive}T00:00:00.000Z`),
      supabaseAdmin
        .from("passive_vocabulary_evidence")
        .select(
          "term, definition, item_type, source_type, source_label, import_count, last_imported_at, created_at, passive_vocabulary_library(cefr_level, part_of_speech, attributes)",
        )
        .eq("student_id", userId)
        .gte("created_at", `${previousWindow.periodStart}T00:00:00.000Z`)
        .lt("created_at", `${currentWindow.endExclusive}T00:00:00.000Z`),
      supabaseAdmin
        .from("tutor_student_lessons")
        .select("id, lesson_date, status")
        .eq("student_id", userId)
        .gte("lesson_date", previousWindow.periodStart)
        .lte("lesson_date", currentWindow.periodEnd),
      supabaseAdmin
        .from("tutor_student_classrooms")
        .select("id")
        .eq("student_id", userId),
    ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error("Failed to load student monthly progress profile");
  }

  const cefrLevel = normalizeCefrLevel(profileResult.data.cefr_level);
  const targetLanguage = normalizeLearningLanguage(
    profileResult.data.preferred_language,
  );
  const availableGrammarTopicCatalog =
    await getGrammarTopicPromptCatalogUpToLevel(targetLanguage, cefrLevel);
  const availableGrammarTopicCount = availableGrammarTopicCatalog.reduce(
    (sum, group) => sum + group.topics.length,
    0,
  );
  const lessons = (lessonsResult.data ?? []) as MonthlyLessonRow[];
  const lessonIds = lessons.map((lesson) => lesson.id);
  const lessonDateById = new Map(
    lessons.map((lesson) => [lesson.id, lesson.lesson_date]),
  );
  const classroomIds = (classroomsResult.data ?? []).map(
    (classroom) => classroom.id,
  );

  let transcriptSegments: MonthlyTranscriptSegmentRow[] = [];
  if (lessonIds.length > 0) {
    const { data: transcriptsResult, error: transcriptsError } = await supabaseAdmin
      .from("lesson_room_transcripts")
      .select("id, lesson_id")
      .in("lesson_id", lessonIds)
      .eq("diarization_status", "ready");

    if (transcriptsError) {
      throw transcriptsError;
    }

    const transcriptIds = ((transcriptsResult ?? []) as MonthlyTranscriptRow[]).map(
      (transcript) => transcript.id,
    );

    if (transcriptIds.length > 0) {
      const { data: segmentsResult, error: segmentsError } = await supabaseAdmin
        .from("lesson_room_transcript_segments")
        .select("transcript_id, lesson_id, speaker_role, content")
        .in("transcript_id", transcriptIds)
        .eq("speaker_role", "student");

      if (segmentsError) {
        throw segmentsError;
      }

      transcriptSegments = (segmentsResult ?? []).flatMap((segment) => {
        const occurredAt = lessonDateById.get(segment.lesson_id);

        if (!occurredAt) {
          return [];
        }

        return [
          {
            transcript_id: segment.transcript_id,
            occurred_at: occurredAt,
            speaker_role: segment.speaker_role,
            content: segment.content,
          },
        ];
      });
    }
  }

  if (classroomIds.length > 0) {
    const { data: classroomRecordingsResult, error: classroomRecordingsError } =
      await supabaseAdmin
        .from("tutor_student_classroom_recordings")
        .select("id, created_at")
        .in("classroom_id", classroomIds)
        .gte("created_at", `${previousWindow.periodStart}T00:00:00.000Z`)
        .lt("created_at", `${currentWindow.endExclusive}T00:00:00.000Z`);

    if (classroomRecordingsError) {
      throw classroomRecordingsError;
    }

    const classroomRecordings =
      (classroomRecordingsResult ?? []) as MonthlyClassroomRecordingRow[];
    const classroomRecordingIds = classroomRecordings.map(
      (recording) => recording.id,
    );
    const classroomRecordingDateById = new Map(
      classroomRecordings.map((recording) => [recording.id, recording.created_at]),
    );

    if (classroomRecordingIds.length > 0) {
      const {
        data: classroomTranscriptsResult,
        error: classroomTranscriptsError,
      } = await supabaseAdmin
        .from("tutor_student_classroom_transcripts")
        .select("id, recording_id")
        .in("recording_id", classroomRecordingIds)
        .eq("diarization_status", "ready");

      if (classroomTranscriptsError) {
        throw classroomTranscriptsError;
      }

      const classroomTranscripts =
        (classroomTranscriptsResult ?? []) as MonthlyClassroomTranscriptRow[];
      const classroomTranscriptIds = classroomTranscripts.map(
        (transcript) => transcript.id,
      );
      const classroomRecordingIdByTranscriptId = new Map(
        classroomTranscripts.map((transcript) => [
          transcript.id,
          transcript.recording_id,
        ]),
      );

      if (classroomTranscriptIds.length > 0) {
        const {
          data: classroomSegmentsResult,
          error: classroomSegmentsError,
        } = await supabaseAdmin
          .from("tutor_student_classroom_transcript_segments")
          .select("transcript_id, speaker_role, content")
          .in("transcript_id", classroomTranscriptIds)
          .eq("speaker_role", "student");

        if (classroomSegmentsError) {
          throw classroomSegmentsError;
        }

        transcriptSegments = transcriptSegments.concat(
          (classroomSegmentsResult ?? []).flatMap((segment) => {
            const recordingId = classroomRecordingIdByTranscriptId.get(
              segment.transcript_id,
            );
            const occurredAt = recordingId
              ? classroomRecordingDateById.get(recordingId)
              : null;

            if (!occurredAt) {
              return [];
            }

            return [
              {
                transcript_id: segment.transcript_id,
                occurred_at: occurredAt,
                speaker_role: segment.speaker_role,
                content: segment.content,
              },
            ];
          }),
        );
      }
    }
  }

  const currentMonth = buildStudentMonthlyProgressSnapshot({
    cefrLevel,
    availableGrammarTopicCount,
    attempts: (attemptsResult.data ?? []) as AttemptRow[],
    wordAdditions: (wordAdditionsResult.data ?? []) as MonthlyWordAdditionRow[],
    passiveEvidenceRows:
      (passiveEvidenceResult.data ?? []) as PassiveEvidenceWithLibraryRow[],
    lessons,
    transcriptSegments,
    window: currentWindow,
    monthlyTargetOverrides,
  });
  const previousMonth = buildStudentMonthlyProgressSnapshot({
    cefrLevel,
    availableGrammarTopicCount,
    attempts: (attemptsResult.data ?? []) as AttemptRow[],
    wordAdditions: (wordAdditionsResult.data ?? []) as MonthlyWordAdditionRow[],
    passiveEvidenceRows:
      (passiveEvidenceResult.data ?? []) as PassiveEvidenceWithLibraryRow[],
    lessons,
    transcriptSegments,
    window: previousWindow,
    monthlyTargetOverrides,
  });

  return {
    currentMonth,
    previousMonth,
  };
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
    activeEvidenceResult,
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
      .from("active_vocabulary_evidence")
      .select(
        "id, term, source_type, source_label, usage_count, first_used_at, last_used_at, passive_vocabulary_library:passive_vocabulary_library!active_vocabulary_evidence_library_item_id_fkey(cefr_level, part_of_speech, attributes)",
      )
      .eq("student_id", userId)
      .eq("source_type", "lesson_recording"),
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
  const availableGrammarTopicCatalog =
    await getGrammarTopicPromptCatalogUpToLevel(targetLanguage, cefrLevel);
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
  const activeSignals = summarizeActiveVocabularyEvidence(
    mapActiveEvidenceRows(
      (activeEvidenceResult.data ?? []) as ActiveEvidenceWithLibraryRow[],
    ),
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
  const availableGrammarTopics = availableGrammarTopicCatalog.flatMap(
    ({ level, topics }) =>
      topics.map((topic) => ({
        topicKey: topic.topicKey,
        label: topic.displayName,
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

  const liveLessonActiveVocabScore = clampScore(
    Math.min(
      1,
      activeSignals.uniqueItems / OBSERVED_ACTIVE_VOCAB_TARGETS[cefrLevel],
    ) *
      80 +
      Math.min(1, masteredWords / ACTIVE_VOCAB_TARGETS[cefrLevel]) * 20,
  );

  // --- Axis scores ---
  const activeVocabScore = liveLessonActiveVocabScore;
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
  const activeVocabPerformanceScore = liveLessonActiveVocabScore;
  const addedWordsScore = clampScore(
    (totalWords / ACTIVE_VOCAB_TARGETS[cefrLevel]) * 100,
  );
  const overallPerformanceComponents: StudentOverallPerformanceComponents = {
    time: timeProgressScore,
    activeVocab: activeVocabPerformanceScore,
    passiveVocab: passiveVocabScore,
    grammar: grammarVarietyScore,
    addedWords: addedWordsScore,
  };
  const overallPerformanceScore = calculateOverallPerformanceScore(
    overallPerformanceComponents,
  );
  const overallPerformanceBand: StudentProgressSnapshot["overallPerformance"]["band"] =
    getOverallPerformanceBand(overallPerformanceScore);

  const axes: StudentProgressAxis[] = [
    {
      key: "active_vocab",
      label: "Active Vocab",
      shortLabel: "Active",
      score: activeVocabScore,
      value: `${activeSignals.uniqueItems.toLocaleString()} live-lesson words, ${masteredWords.toLocaleString()} at mastery 4-5`,
      helper: `Based primarily on unique words actually used in live lessons and synced as active evidence, with a smaller boost from words practiced to mastery levels 4 and 5. ${activeSignals.totalUsageCount.toLocaleString()} total lesson-based uses recorded.`,
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
      timeAdjustmentHours: 0,
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
      components: overallPerformanceComponents,
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
    activeSignals,
    words,
  };
}
