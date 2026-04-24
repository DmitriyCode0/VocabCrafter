import "server-only";

import { z } from "zod";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import {
  GEMINI_MODEL,
  generateFromGeminiWithUsage,
} from "@/lib/gemini/client";
import { getPlan } from "@/lib/plans-server";
import { getStudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import {
  getReportLanguageLocale,
  getReportLanguagePromptName,
  normalizeReportLanguage,
  type ReportLanguage,
} from "@/lib/progress/monthly-report-language";
import {
  getTutorStudentPlan,
  hasConfiguredTutorStudentPlan,
  nullablePercentageSchema,
  nullableWholeNumberSchema,
  tutorStudentPlanSchema,
  updateTutorStudentPlan,
  type TutorStudentPlan,
} from "@/lib/progress/tutor-student-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type MonthlyReportRow =
  Database["public"]["Tables"]["tutor_student_monthly_reports"]["Row"];

export const monthlyReportGoalsSchema = tutorStudentPlanSchema;

export const monthlyReportMetricsSchema = z.object({
  activeDays: z.number().int().min(0),
  completedQuizzes: z.number().int().min(0),
  completedLessons: z.number().int().min(0),
  totalHours: z.number().min(0).default(0),
  newMasteryWords: z.number().int().min(0),
  practicedWords: z.number().int().min(0),
  trackedWordsTotal: z.number().int().min(0),
  averageScore: z.number().min(0).max(100).nullable(),
});

export const monthlyReportStatusSchema = z.enum([
  "draft",
  "published",
  "failed",
  "quota_blocked",
]);

export const monthlyReportGenerationSourceSchema = z.enum([
  "manual",
  "scheduled",
]);

export const monthlyReportAiPayloadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1200),
  targetAssessment: z.string().trim().min(1).max(1200),
  highlights: z.array(z.string().trim().min(1).max(240)).min(2).max(5),
  focusAreas: z.array(z.string().trim().min(1).max(240)).max(5),
  nextSteps: z.array(z.string().trim().min(1).max(240)).min(2).max(5),
});

export const monthlyReportSettingsInputSchema = z.object({
  monthlyQuizTarget: nullableWholeNumberSchema,
  monthlyCompletedLessonsTarget: nullableWholeNumberSchema,
  monthlyNewMasteryWordsTarget: nullableWholeNumberSchema,
  monthlyAverageScoreTarget: nullablePercentageSchema,
});

export const monthlyReportGenerationInputSchema = z.object({
  forceRegenerate: z.boolean().optional().default(false),
});

export const monthlyReportUpdateInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  publishedContent: z.string().trim().min(1).max(20_000),
  tutorAddendum: z.string().trim().max(4_000).nullable().optional(),
});

export type MonthlyReportGoals = TutorStudentPlan;
export type MonthlyReportMetrics = z.infer<typeof monthlyReportMetricsSchema>;
export type MonthlyReportStatus = z.infer<typeof monthlyReportStatusSchema>;
export type MonthlyReportGenerationSource = z.infer<
  typeof monthlyReportGenerationSourceSchema
>;
export type MonthlyReportAiPayload = z.infer<
  typeof monthlyReportAiPayloadSchema
>;
export type MonthlyReportSettingsInput = z.infer<
  typeof monthlyReportSettingsInputSchema
>;
export type MonthlyReportUpdateInput = z.infer<
  typeof monthlyReportUpdateInputSchema
>;

export interface MonthlyReportMonthWindow {
  reportMonth: string;
  periodStart: string;
  periodEnd: string;
  nextMonthStart: string;
  endExclusive: string;
}

export interface MonthlyReportQuotaSnapshot {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
}

export interface StoredMonthlyReport {
  id: string;
  tutorId: string;
  studentId: string;
  generatedBy: string | null;
  reportMonth: string;
  periodStart: string;
  periodEnd: string;
  generationSource: MonthlyReportGenerationSource;
  status: MonthlyReportStatus;
  title: string;
  aiDraft: string | null;
  publishedContent: string | null;
  tutorAddendum: string | null;
  goalsSnapshot: MonthlyReportGoals;
  metricsSnapshot: MonthlyReportMetrics;
  generationError: string | null;
  createdAt: string;
  updatedAt: string;
  generatedAt: string;
  publishedAt: string | null;
}

const MONTHLY_REPORT_SECTION_LABELS: Record<
  ReportLanguage,
  {
    summary: string;
    goalCheck: string;
    highlights: string;
    focusAreas: string;
    nextSteps: string;
  }
> = {
  en: {
    summary: "Summary",
    goalCheck: "Goal Check",
    highlights: "Highlights",
    focusAreas: "Focus Areas",
    nextSteps: "Next Steps",
  },
  uk: {
    summary: "Підсумок",
    goalCheck: "Перевірка цілей",
    highlights: "Ключові моменти",
    focusAreas: "Зони уваги",
    nextSteps: "Наступні кроки",
  },
};

const TIME_PATTERN = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
const DEFAULT_LESSON_DURATION_HOURS = 1;

function toUtcDateString(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseUtcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function addUtcDays(date: Date, amount: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function getMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getNextMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function roundScore(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function parseTimeToMinutes(value?: string | null) {
  if (!value || !TIME_PATTERN.test(value)) {
    return null;
  }

  const [hourText, minuteText] = value.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

function getLessonDurationHours(
  startTime?: string | null,
  endTime?: string | null,
) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes
  ) {
    return DEFAULT_LESSON_DURATION_HOURS;
  }

  return (endMinutes - startMinutes) / 60;
}

function parseStoredMonthlyReport(row: MonthlyReportRow): StoredMonthlyReport {
  return {
    id: row.id,
    tutorId: row.tutor_id,
    studentId: row.student_id,
    generatedBy: row.generated_by,
    reportMonth: row.report_month,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    generationSource: monthlyReportGenerationSourceSchema.parse(
      row.generation_source,
    ),
    status: monthlyReportStatusSchema.parse(row.status),
    title: row.title,
    aiDraft: row.ai_draft,
    publishedContent: row.published_content,
    tutorAddendum: row.tutor_addendum,
    goalsSnapshot: monthlyReportGoalsSchema.parse(row.plan_snapshot),
    metricsSnapshot: monthlyReportMetricsSchema.parse(row.metrics_snapshot),
    generationError: row.generation_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    generatedAt: row.generated_at,
    publishedAt: row.published_at,
  };
}

function buildReportMonthWindow(referenceDate: Date): MonthlyReportMonthWindow {
  const monthStart = getMonthStart(referenceDate);
  const nextMonthStart = getNextMonthStart(referenceDate);
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
    nextMonthStart: toUtcDateString(nextMonthStart),
    endExclusive: toUtcDateString(addUtcDays(periodEndDate, 1)),
  };
}

export function getCurrentMonthlyReportWindow(referenceDate: Date = new Date()) {
  return buildReportMonthWindow(referenceDate);
}

export function formatMonthlyReportMonthLabel(
  reportMonth: string,
  locale: string,
) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseUtcDate(reportMonth));
}

export async function getTutorStudentMonthlyReportSettings(
  tutorId: string,
  studentId: string,
) {
  const data = await getTutorStudentPlan(tutorId, studentId);

  return {
    connectionId: data.connectionId,
    settings: data.plan,
  };
}

export async function updateTutorStudentMonthlyReportSettings(
  tutorId: string,
  studentId: string,
  input: MonthlyReportSettingsInput,
) {
  const parsed = monthlyReportSettingsInputSchema.parse(input);
  const existingPlan = await getTutorStudentPlan(tutorId, studentId);
  const data = await updateTutorStudentPlan(tutorId, studentId, {
    planTitle: existingPlan.plan.planTitle ?? "",
    goalSummary: existingPlan.plan.goalSummary ?? "",
    objectives: existingPlan.plan.objectives,
    grammarTopicKeys: existingPlan.plan.grammarTopicKeys,
    reportLanguage: existingPlan.plan.reportLanguage,
    monthlyQuizTarget: parsed.monthlyQuizTarget,
    monthlyCompletedLessonsTarget: parsed.monthlyCompletedLessonsTarget,
    monthlyNewMasteryWordsTarget: parsed.monthlyNewMasteryWordsTarget,
    monthlyAverageScoreTarget: parsed.monthlyAverageScoreTarget,
  });

  return {
    connectionId: data.connectionId,
    settings: data.plan,
  };
}

export async function getTutorStudentMonthlyReportMetrics(
  studentId: string,
  referenceDate: Date = new Date(),
): Promise<MonthlyReportMetrics> {
  const admin = createAdminClient();
  const window = buildReportMonthWindow(referenceDate);

  const [attemptsResult, lessonsResult, newWordsResult, practicedWordsResult, totalWordsResult] =
    await Promise.all([
      admin
        .from("quiz_attempts")
        .select("completed_at, score, max_score")
        .eq("student_id", studentId)
        .gte("completed_at", `${window.periodStart}T00:00:00.000Z`)
        .lt("completed_at", `${window.endExclusive}T00:00:00.000Z`),
      admin
        .from("tutor_student_lessons")
        .select("lesson_date, start_time, end_time")
        .eq("student_id", studentId)
        .eq("status", "completed")
        .gte("lesson_date", window.periodStart)
        .lte("lesson_date", window.periodEnd),
      admin
        .from("word_mastery")
        .select("created_at")
        .eq("student_id", studentId)
        .gte("created_at", `${window.periodStart}T00:00:00.000Z`)
        .lt("created_at", `${window.endExclusive}T00:00:00.000Z`),
      admin
        .from("word_mastery")
        .select("id, last_practiced")
        .eq("student_id", studentId)
        .gte("last_practiced", `${window.periodStart}T00:00:00.000Z`)
        .lt("last_practiced", `${window.endExclusive}T00:00:00.000Z`),
      admin
        .from("word_mastery")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId),
    ]);

  if (attemptsResult.error) {
    throw attemptsResult.error;
  }

  if (lessonsResult.error) {
    throw lessonsResult.error;
  }

  if (newWordsResult.error) {
    throw newWordsResult.error;
  }

  if (practicedWordsResult.error) {
    throw practicedWordsResult.error;
  }

  if (totalWordsResult.error) {
    throw totalWordsResult.error;
  }

  const activeDays = new Set<string>();
  let scoredAttempts = 0;
  let totalScore = 0;
  let totalHours = 0;

  for (const attempt of attemptsResult.data ?? []) {
    const isoDate = attempt.completed_at?.slice(0, 10);

    if (isoDate) {
      activeDays.add(isoDate);
    }

    if (
      attempt.score != null &&
      attempt.max_score != null &&
      Number(attempt.max_score) > 0
    ) {
      scoredAttempts += 1;
      totalScore +=
        (Number(attempt.score) / Number(attempt.max_score)) * 100;
    }
  }

  for (const lesson of lessonsResult.data ?? []) {
    if (lesson.lesson_date) {
      activeDays.add(lesson.lesson_date);
    }

    totalHours += getLessonDurationHours(lesson.start_time, lesson.end_time);
  }

  for (const word of practicedWordsResult.data ?? []) {
    const isoDate = word.last_practiced?.slice(0, 10);

    if (isoDate) {
      activeDays.add(isoDate);
    }
  }

  return {
    activeDays: activeDays.size,
    completedQuizzes: (attemptsResult.data ?? []).length,
    completedLessons: (lessonsResult.data ?? []).length,
    totalHours: roundHours(totalHours),
    newMasteryWords: (newWordsResult.data ?? []).length,
    practicedWords: (practicedWordsResult.data ?? []).length,
    trackedWordsTotal: totalWordsResult.count ?? 0,
    averageScore:
      scoredAttempts > 0 ? roundScore(totalScore / scoredAttempts) : null,
  };
}

export async function getTutorMonthlyReportQuota(
  tutorId: string,
  referenceDate: Date = new Date(),
): Promise<MonthlyReportQuotaSnapshot> {
  const admin = createAdminClient();
  const window = buildReportMonthWindow(referenceDate);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", tutorId)
    .single();

  if (profileError || !profile) {
    return { allowed: false, remaining: 0, limit: 0, used: 0 };
  }

  const plan = await getPlan(profile.plan);
  const limit = plan.reportsPerMonth;

  if (!Number.isFinite(limit)) {
    return {
      allowed: true,
      remaining: Number.POSITIVE_INFINITY,
      limit,
      used: 0,
    };
  }

  const { count, error } = await admin
    .from("tutor_student_monthly_reports")
    .select("id", { count: "exact", head: true })
    .eq("tutor_id", tutorId)
    .eq("status", "published")
    .gte("generated_at", `${window.reportMonth}T00:00:00.000Z`)
    .lt("generated_at", `${window.nextMonthStart}T00:00:00.000Z`);

  if (error) {
    throw error;
  }

  const used = count ?? 0;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    remaining,
    limit,
    used,
  };
}

export async function listTutorStudentMonthlyReports(
  tutorId: string,
  studentId: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutor_student_monthly_reports")
    .select("*")
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId)
    .order("report_month", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(parseStoredMonthlyReport);
}

export async function listStudentPublishedMonthlyReports(studentId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutor_student_monthly_reports")
    .select("*")
    .eq("student_id", studentId)
    .eq("status", "published")
    .order("report_month", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(parseStoredMonthlyReport);
}

export async function getMonthlyReportById(reportId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutor_student_monthly_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? parseStoredMonthlyReport(data) : null;
}

function buildSelectedGrammarTopicLines(
  topicKeys: string[],
  snapshot: Awaited<ReturnType<typeof getStudentProgressSnapshot>>,
) {
  if (topicKeys.length === 0) {
    return ["- No grammar topics selected."];
  }

  const coveredTopicMap = new Map(
    snapshot.grammar.coveredTopics.map((topic) => [topic.topicKey, topic]),
  );
  const masteryMap = new Map(
    snapshot.grammarTopicMastery.map((topic) => [topic.topicKey, topic]),
  );
  const remainingTopicMap = new Map(
    snapshot.grammar.remainingTopics.map((topic) => [topic.topicKey, topic]),
  );

  return topicKeys.map((topicKey) => {
    const coveredTopic = coveredTopicMap.get(topicKey);

    if (coveredTopic) {
      return `- ${coveredTopic.label}: ${coveredTopic.attempts} tracked attempts, average ${
        coveredTopic.averageScore == null ? "n/a" : `${coveredTopic.averageScore}%`
      }, current level ${coveredTopic.level}`;
    }

    const masteryTopic = masteryMap.get(topicKey);

    if (masteryTopic) {
      return `- ${masteryTopic.label}: ${
        masteryTopic.mastered ? "currently marked as mastered" : "not yet mastered"
      }, ${masteryTopic.attempts} tracked attempts, average ${
        masteryTopic.averageScore == null ? "n/a" : `${masteryTopic.averageScore}%`
      }`;
    }

    const remainingTopic = remainingTopicMap.get(topicKey);

    if (remainingTopic) {
      return `- ${remainingTopic.label}: selected as a focus topic, not yet covered in tracked grammar progress, target level ${remainingTopic.level}`;
    }

    return `- ${topicKey}: selected as a focus topic with no tracked grammar evidence yet.`;
  });
}

function formatTargetLine(
  label: string,
  actual: number | null,
  target: number | null,
  formatter: (value: number) => string = (value) =>
    Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, ""),
) {
  const actualValue = actual == null ? "n/a" : formatter(actual);

  if (target == null) {
    return `${label}: ${actualValue} (no target set)`;
  }

  const targetValue = formatter(target);

  if (actual == null) {
    return `${label}: ${actualValue} vs target ${targetValue}`;
  }

  const delta = actual - target;

  if (delta === 0) {
    return `${label}: ${actualValue} vs target ${targetValue} (on target)`;
  }

  const direction = delta > 0 ? "above" : "below";
  return `${label}: ${actualValue} vs target ${targetValue} (${formatter(Math.abs(delta))} ${direction})`;
}

function buildMonthlyReportPrompt({
  monthLabel,
  studentName,
  tutorName,
  snapshot,
  goals,
  metrics,
}: {
  monthLabel: string;
  studentName: string;
  tutorName: string;
  snapshot: Awaited<ReturnType<typeof getStudentProgressSnapshot>>;
  goals: MonthlyReportGoals;
  metrics: MonthlyReportMetrics;
}) {
  const targetLanguage = snapshot.profile.targetLanguageLabel;
  const sourceLanguage = snapshot.profile.sourceLanguageLabel;
  const scoreLine =
    metrics.averageScore == null
      ? "Average scored quiz result this month: n/a"
      : `Average scored quiz result this month: ${metrics.averageScore}%`;
  const reportLanguageName = getReportLanguagePromptName(goals.reportLanguage);
  const objectivesLine =
    goals.objectives.length > 0
      ? goals.objectives.map((objective) => `- ${objective}`)
      : ["- No specific objectives listed."];
  const grammarTopicLines = buildSelectedGrammarTopicLines(
    goals.grammarTopicKeys,
    snapshot,
  );

  return [
    `Write a concise monthly language-learning progress report for ${studentName} for ${monthLabel}.`,
    `The report is created by tutor ${tutorName} and will be visible to the student.`,
    "Use only the supplied facts. Do not invent lessons, struggles, or achievements.",
    "Keep the tone encouraging but concrete. Mention missed targets directly if needed.",
    `Write the title and all report text in ${reportLanguageName}.`,
    "Return JSON only.",
    "",
    "Student context:",
    `- Learning language: ${targetLanguage}`,
    `- Source language: ${sourceLanguage}`,
    `- Target CEFR level: ${snapshot.profile.cefrLevel}`,
    `- Total tracked words overall: ${snapshot.overview.totalWords}`,
    `- Mastered words overall: ${snapshot.overview.masteredWords}`,
    `- Current streak: ${snapshot.overview.streakDays} days`,
    `- Passive vocabulary evidence items: ${snapshot.passiveSignals.uniqueItems}`,
    `- Passive equivalent words: ${snapshot.passiveSignals.equivalentWordCount}`,
    `- Overall average score: ${snapshot.overview.avgScore}%`,
    goals.planTitle ? `- Plan title: ${goals.planTitle}` : null,
    goals.goalSummary ? `- Plan summary: ${goals.goalSummary}` : null,
    "",
    "This month metrics:",
    `- Active days: ${metrics.activeDays}`,
    `- Completed quizzes: ${metrics.completedQuizzes}`,
    `- Completed lessons: ${metrics.completedLessons}`,
    `- New mastery words: ${metrics.newMasteryWords}`,
    `- Practiced tracked words: ${metrics.practicedWords}`,
    `- Tracked words total: ${metrics.trackedWordsTotal}`,
    `- ${scoreLine}`,
    "",
    "Current learning plan objectives:",
    ...objectivesLine,
    "",
    "Selected grammar focus topics:",
    ...grammarTopicLines,
    "",
    "Targets:",
    `- ${formatTargetLine("Completed quizzes", metrics.completedQuizzes, goals.monthlyQuizTarget)}`,
    `- ${formatTargetLine("Completed lessons", metrics.completedLessons, goals.monthlyCompletedLessonsTarget)}`,
    `- ${formatTargetLine("New mastery words", metrics.newMasteryWords, goals.monthlyNewMasteryWordsTarget)}`,
    `- ${formatTargetLine("Average quiz score", metrics.averageScore, goals.monthlyAverageScoreTarget, (value) => `${Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, "")}%`)}`,
    "",
    "Return JSON with:",
    '- title: short report title',
    '- summary: 1 short paragraph overview',
    '- targetAssessment: 1 short paragraph about target progress',
    '- highlights: 2 to 5 concise bullet-style sentences',
    '- focusAreas: 0 to 5 concise bullet-style sentences',
    '- nextSteps: 2 to 5 concrete next-step sentences',
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function buildMonthlyReportContent(
  payload: MonthlyReportAiPayload,
  reportLanguage: ReportLanguage,
) {
  const labels = MONTHLY_REPORT_SECTION_LABELS[normalizeReportLanguage(reportLanguage)];
  const sections = [
    `${labels.summary}\n${payload.summary}`,
    `${labels.goalCheck}\n${payload.targetAssessment}`,
    `${labels.highlights}\n${payload.highlights.map((item) => `- ${item}`).join("\n")}`,
  ];

  if (payload.focusAreas.length > 0) {
    sections.push(
      `${labels.focusAreas}\n${payload.focusAreas.map((item) => `- ${item}`).join("\n")}`,
    );
  }

  sections.push(
    `${labels.nextSteps}\n${payload.nextSteps.map((item) => `- ${item}`).join("\n")}`,
  );

  return sections.join("\n\n");
}

async function upsertMonthlyReportRow(
  payload: Database["public"]["Tables"]["tutor_student_monthly_reports"]["Insert"],
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutor_student_monthly_reports")
    .upsert(payload, { onConflict: "tutor_id,student_id,report_month" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return parseStoredMonthlyReport(data);
}

export async function updateTutorStudentMonthlyReport(
  tutorId: string,
  studentId: string,
  reportId: string,
  input: MonthlyReportUpdateInput,
) {
  const parsed = monthlyReportUpdateInputSchema.parse(input);
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("tutor_student_monthly_reports")
    .update({
      title: parsed.title,
      published_content: parsed.publishedContent,
      tutor_addendum: parsed.tutorAddendum ?? null,
      status: "published",
      published_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", reportId)
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return parseStoredMonthlyReport(data);
}

export async function generateTutorStudentMonthlyReport({
  tutorId,
  studentId,
  generatedBy,
  generationSource,
  referenceDate = new Date(),
  forceRegenerate = false,
}: {
  tutorId: string;
  studentId: string;
  generatedBy: string | null;
  generationSource: MonthlyReportGenerationSource;
  referenceDate?: Date;
  forceRegenerate?: boolean;
}) {
  const admin = createAdminClient();
  const monthWindow = buildReportMonthWindow(referenceDate);

  const [planResult, metrics, quota, existingRows, snapshot, tutorProfile, studentProfile] =
    await Promise.all([
      getTutorStudentPlan(tutorId, studentId),
      getTutorStudentMonthlyReportMetrics(studentId, referenceDate),
      getTutorMonthlyReportQuota(tutorId, referenceDate),
      listTutorStudentMonthlyReports(tutorId, studentId),
      getStudentProgressSnapshot(studentId),
      admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", tutorId)
        .single(),
      admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", studentId)
        .single(),
    ]);

  const goals = planResult.plan;
  const existing = existingRows.find(
    (report) => report.reportMonth === monthWindow.reportMonth,
  );

  if (!hasConfiguredTutorStudentPlan(goals)) {
    throw new Error("Set up a plan before generating a report");
  }

  if (existing && !forceRegenerate) {
    return {
      report: existing,
      quota,
      created: false,
    };
  }

  if (!existing && !quota.allowed) {
    const nowIso = new Date().toISOString();
    const blockedReport = await upsertMonthlyReportRow({
      tutor_id: tutorId,
      student_id: studentId,
      generated_by: generatedBy,
      report_month: monthWindow.reportMonth,
      period_start: monthWindow.periodStart,
      period_end: monthWindow.periodEnd,
      generation_source: generationSource,
      status: "quota_blocked",
      title: `Monthly report for ${monthWindow.reportMonth}`,
      ai_draft: null,
      published_content: null,
      tutor_addendum: null,
      plan_snapshot: goals,
      metrics_snapshot: metrics,
      generation_error: `Monthly report quota reached (${quota.limit}/month).`,
      generated_at: nowIso,
      updated_at: nowIso,
      published_at: null,
    });

    return {
      report: blockedReport,
      quota,
      created: true,
    };
  }

  const tutorName =
    tutorProfile.data?.full_name || tutorProfile.data?.email || "Tutor";
  const studentName =
    studentProfile.data?.full_name || studentProfile.data?.email || "Student";
  const monthLabel = formatMonthlyReportMonthLabel(
    monthWindow.reportMonth,
    getReportLanguageLocale(goals.reportLanguage),
  );
  const prompt = buildMonthlyReportPrompt({
    monthLabel,
    studentName,
    tutorName,
    snapshot,
    goals,
    metrics,
  });

  try {
    const { data: payload, usageSnapshot } = await generateFromGeminiWithUsage(
      {
        prompt,
        systemInstruction:
          "You write student-facing monthly language progress reports. Use only supplied evidence, keep claims conservative, and return valid JSON only.",
        temperature: 0.4,
      },
      monthlyReportAiPayloadSchema,
    );

    await recordAIUsageEvent({
      userId: tutorId,
      feature: "monthly_report",
      requestType: "text",
      model: GEMINI_MODEL,
      snapshot: usageSnapshot,
    });

    const nowIso = new Date().toISOString();
    const content = buildMonthlyReportContent(payload, goals.reportLanguage);
    const report = await upsertMonthlyReportRow({
      tutor_id: tutorId,
      student_id: studentId,
      generated_by: generatedBy,
      report_month: monthWindow.reportMonth,
      period_start: monthWindow.periodStart,
      period_end: monthWindow.periodEnd,
      generation_source: generationSource,
      status: "published",
      title: payload.title,
      ai_draft: content,
      published_content: content,
      tutor_addendum: existing?.tutorAddendum ?? null,
      plan_snapshot: goals,
      metrics_snapshot: metrics,
      generation_error: null,
      generated_at: nowIso,
      updated_at: nowIso,
      published_at: nowIso,
    });

    return {
      report,
      quota,
      created: !existing,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed";
    const nowIso = new Date().toISOString();

    if (!existing) {
      await upsertMonthlyReportRow({
        tutor_id: tutorId,
        student_id: studentId,
        generated_by: generatedBy,
        report_month: monthWindow.reportMonth,
        period_start: monthWindow.periodStart,
        period_end: monthWindow.periodEnd,
        generation_source: generationSource,
        status: "failed",
        title: `Monthly report for ${monthWindow.reportMonth}`,
        ai_draft: null,
        published_content: null,
        tutor_addendum: null,
        plan_snapshot: goals,
        metrics_snapshot: metrics,
        generation_error: message,
        generated_at: nowIso,
        updated_at: nowIso,
        published_at: null,
      });
    } else {
      await admin
        .from("tutor_student_monthly_reports")
        .update({ generation_error: message, updated_at: nowIso })
        .eq("id", existing.id)
        .eq("tutor_id", tutorId)
        .eq("student_id", studentId);
    }

    throw error;
  }
}