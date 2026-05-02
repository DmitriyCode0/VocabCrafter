import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeReportLanguage,
  reportLanguageSchema,
} from "@/lib/progress/monthly-report-language";
import type { Database } from "@/types/database";

const nullableTrimmedText = z
  .string()
  .trim()
  .max(2_000)
  .transform((value) => value || null)
  .nullable();

export const nullableWholeNumberSchema = z.number().int().min(0).nullable();
export const nullablePercentageSchema = z.number().min(0).max(100).nullable();

const REPORT_MONTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const grammarTopicKeysSchema = z
  .array(z.string().trim().min(1).max(160))
  .max(12)
  .default([]);

export const tutorStudentPlanSchema = z.object({
  planTitle: z
    .string()
    .trim()
    .max(120)
    .transform((value) => value || null)
    .nullable(),
  goalSummary: nullableTrimmedText,
  objectives: z.array(z.string().trim().min(1).max(240)).max(10).default([]),
  monthlySentenceTranslationTarget: nullableWholeNumberSchema.default(null),
  monthlyGapFillTarget: nullableWholeNumberSchema.default(null),
  monthlyCompletedLessonsTarget: nullableWholeNumberSchema.default(null),
  monthlyWordsAddedTarget: nullableWholeNumberSchema.default(null),
  monthlyMasteredWordsTarget: nullableWholeNumberSchema.default(null),
  monthlyStudentSpeakingShareTarget: nullablePercentageSchema.default(null),
  monthlyAverageScoreTarget: nullablePercentageSchema.default(null),
  grammarTopicKeys: grammarTopicKeysSchema,
  reportLanguage: reportLanguageSchema.default("uk"),
});

export const tutorStudentPlanInputSchema = z.object({
  planTitle: z.string().trim().max(120).optional(),
  goalSummary: z.string().trim().max(2_000).optional(),
  objectives: z.array(z.string().trim().min(1).max(240)).max(10).optional(),
  monthlySentenceTranslationTarget: nullableWholeNumberSchema.optional(),
  monthlyGapFillTarget: nullableWholeNumberSchema.optional(),
  monthlyCompletedLessonsTarget: nullableWholeNumberSchema.optional(),
  monthlyWordsAddedTarget: nullableWholeNumberSchema.optional(),
  monthlyMasteredWordsTarget: nullableWholeNumberSchema.optional(),
  monthlyStudentSpeakingShareTarget: nullablePercentageSchema.optional(),
  monthlyAverageScoreTarget: nullablePercentageSchema.optional(),
  grammarTopicKeys: grammarTopicKeysSchema.optional(),
  reportLanguage: reportLanguageSchema.optional(),
});

export type TutorStudentPlan = z.infer<typeof tutorStudentPlanSchema>;
export type TutorStudentPlanInput = z.infer<typeof tutorStudentPlanInputSchema>;

export interface TutorStudentPlanRecord {
  connectionId: string;
  tutorId: string;
  studentId: string;
  planMonth: string;
  updatedAt: string;
  plan: TutorStudentPlan;
}

export interface StudentTutorPlanCard extends TutorStudentPlanRecord {
  tutorProfile: {
    id: string;
    fullName: string | null;
    email: string;
  };
}

function normalizeObjectives(value: unknown) {
  return normalizeStringArray(value, 10);
}

function normalizeGrammarTopicKeys(value: unknown) {
  return Array.from(new Set(normalizeStringArray(value, 12)));
}

function normalizeStringArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toReportMonthString(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function getCurrentTutorStudentPlanMonth(
  referenceDate: Date = new Date(),
) {
  return toReportMonthString(referenceDate);
}

export function normalizeTutorStudentPlanMonth(
  value?: string | null,
  referenceDate: Date = new Date(),
) {
  if (value && REPORT_MONTH_PATTERN.test(value.trim())) {
    return value.trim();
  }

  return getCurrentTutorStudentPlanMonth(referenceDate);
}

type TutorStudentConnectionRow =
  Database["public"]["Tables"]["tutor_students"]["Row"];
type TutorStudentMonthlyPlanRow =
  Database["public"]["Tables"]["tutor_student_monthly_plans"]["Row"];

function isMissingMonthlyPlansTableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    code?: string;
    message?: string;
  };

  return (
    maybeError.code === "PGRST205" &&
    typeof maybeError.message === "string" &&
    maybeError.message.includes("tutor_student_monthly_plans")
  );
}

export async function isTutorStudentMonthlyPlansTableAvailable() {
  const admin = createAdminClient();
  const { error } = await admin
    .from("tutor_student_monthly_plans")
    .select("id")
    .limit(1);

  if (!error) {
    return true;
  }

  if (isMissingMonthlyPlansTableError(error)) {
    return false;
  }

  throw error;
}

function normalizePlanShape(input: {
  plan_title?: string | null;
  goal_summary?: string | null;
  objectives?: unknown;
  monthly_sentence_translation_target?: number | null;
  monthly_gap_fill_target?: number | null;
  monthly_completed_lessons_target?: number | null;
  monthly_words_added_target?: number | null;
  monthly_mastered_words_target?: number | null;
  monthly_student_speaking_share_target?: number | null;
  monthly_new_mastery_words_target?: number | null;
  monthly_average_score_target?: number | null;
  grammar_topic_keys?: unknown;
  report_language?: string | null;
}): TutorStudentPlan {
  const wordsAddedTarget =
    normalizeNullableNumber(input.monthly_words_added_target) ??
    normalizeNullableNumber(input.monthly_new_mastery_words_target);
  const masteredWordsTarget =
    normalizeNullableNumber(input.monthly_mastered_words_target) ??
    normalizeNullableNumber(input.monthly_new_mastery_words_target);

  return tutorStudentPlanSchema.parse({
    planTitle: normalizeText(input.plan_title),
    goalSummary: normalizeText(input.goal_summary),
    objectives: normalizeObjectives(input.objectives),
    monthlySentenceTranslationTarget: normalizeNullableNumber(
      input.monthly_sentence_translation_target,
    ),
    monthlyGapFillTarget: normalizeNullableNumber(
      input.monthly_gap_fill_target,
    ),
    monthlyCompletedLessonsTarget: normalizeNullableNumber(
      input.monthly_completed_lessons_target,
    ),
    monthlyWordsAddedTarget: wordsAddedTarget,
    monthlyMasteredWordsTarget: masteredWordsTarget,
    monthlyStudentSpeakingShareTarget: normalizeNullableNumber(
      input.monthly_student_speaking_share_target,
    ),
    monthlyAverageScoreTarget: normalizeNullableNumber(
      input.monthly_average_score_target,
    ),
    grammarTopicKeys: normalizeGrammarTopicKeys(input.grammar_topic_keys),
    reportLanguage: normalizeReportLanguage(input.report_language),
  });
}

export function hasConfiguredTutorStudentPlan(plan: TutorStudentPlan) {
  return Boolean(
    plan.planTitle ||
    plan.goalSummary ||
    plan.objectives.length > 0 ||
    plan.grammarTopicKeys.length > 0 ||
    plan.monthlySentenceTranslationTarget != null ||
    plan.monthlyGapFillTarget != null ||
    plan.monthlyCompletedLessonsTarget != null ||
    plan.monthlyWordsAddedTarget != null ||
    plan.monthlyMasteredWordsTarget != null ||
    plan.monthlyStudentSpeakingShareTarget != null ||
    plan.monthlyAverageScoreTarget != null,
  );
}

async function getActiveTutorStudentConnection(
  tutorId: string,
  studentId: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutor_students")
    .select(
      "id, tutor_id, student_id, plan_title, goal_summary, objectives, monthly_sentence_translation_target, monthly_gap_fill_target, monthly_completed_lessons_target, monthly_new_mastery_words_target, monthly_average_score_target, grammar_topic_keys, report_language, updated_at",
    )
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Tutor-student connection not found");
  }

  return data;
}

async function getTutorStudentMonthlyPlanRow(
  tutorId: string,
  studentId: string,
  planMonth: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutor_student_monthly_plans")
    .select(
      "id, connection_id, tutor_id, student_id, plan_month, plan_title, goal_summary, objectives, grammar_topic_keys, report_language, monthly_sentence_translation_target, monthly_gap_fill_target, monthly_completed_lessons_target, monthly_words_added_target, monthly_mastered_words_target, monthly_student_speaking_share_target, monthly_average_score_target, updated_at",
    )
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId)
    .eq("plan_month", planMonth)
    .maybeSingle();

  if (error) {
    if (isMissingMonthlyPlansTableError(error)) {
      return null;
    }

    throw error;
  }

  return data;
}

export async function getTutorStudentPlan(
  tutorId: string,
  studentId: string,
  options?: {
    planMonth?: string | null;
  },
): Promise<TutorStudentPlanRecord> {
  const planMonth = normalizeTutorStudentPlanMonth(options?.planMonth);
  const [connection, monthlyPlan] = await Promise.all([
    getActiveTutorStudentConnection(tutorId, studentId),
    getTutorStudentMonthlyPlanRow(tutorId, studentId, planMonth),
  ]);
  const source = monthlyPlan ?? connection;

  return {
    connectionId: connection.id,
    tutorId,
    studentId,
    planMonth,
    updatedAt: source.updated_at,
    plan: normalizePlanShape(source),
  };
}

export async function updateTutorStudentPlan(
  tutorId: string,
  studentId: string,
  input: TutorStudentPlanInput,
  options?: {
    planMonth?: string | null;
  },
): Promise<TutorStudentPlanRecord> {
  const parsed = tutorStudentPlanInputSchema.parse(input);
  const admin = createAdminClient();
  const planMonth = normalizeTutorStudentPlanMonth(options?.planMonth);
  const [connection, currentMonthlyPlan] = await Promise.all([
    getActiveTutorStudentConnection(tutorId, studentId),
    getTutorStudentMonthlyPlanRow(tutorId, studentId, planMonth),
  ]);
  const basePlan = normalizePlanShape(currentMonthlyPlan ?? connection);
  const patch = Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined),
  );
  const nextPlan = tutorStudentPlanSchema.parse({
    ...basePlan,
    ...patch,
  });

  const { data, error } = await admin
    .from("tutor_student_monthly_plans")
    .upsert(
      {
        connection_id: connection.id,
        tutor_id: tutorId,
        student_id: studentId,
        plan_month: planMonth,
        plan_title: nextPlan.planTitle,
        goal_summary: nextPlan.goalSummary,
        objectives: nextPlan.objectives,
        grammar_topic_keys: nextPlan.grammarTopicKeys,
        report_language: normalizeReportLanguage(nextPlan.reportLanguage),
        monthly_sentence_translation_target:
          nextPlan.monthlySentenceTranslationTarget,
        monthly_gap_fill_target: nextPlan.monthlyGapFillTarget,
        monthly_completed_lessons_target:
          nextPlan.monthlyCompletedLessonsTarget,
        monthly_words_added_target: nextPlan.monthlyWordsAddedTarget,
        monthly_mastered_words_target: nextPlan.monthlyMasteredWordsTarget,
        monthly_student_speaking_share_target:
          nextPlan.monthlyStudentSpeakingShareTarget,
        monthly_average_score_target: nextPlan.monthlyAverageScoreTarget,
      },
      {
        onConflict: "tutor_id,student_id,plan_month",
      },
    )
    .select(
      "id, connection_id, tutor_id, student_id, plan_month, plan_title, goal_summary, objectives, grammar_topic_keys, report_language, monthly_sentence_translation_target, monthly_gap_fill_target, monthly_completed_lessons_target, monthly_words_added_target, monthly_mastered_words_target, monthly_student_speaking_share_target, monthly_average_score_target, updated_at",
    )
    .single();

  if (error || !data) {
    if (error && isMissingMonthlyPlansTableError(error)) {
      const { data: legacyData, error: legacyError } = await admin
        .from("tutor_students")
        .update({
          plan_title: nextPlan.planTitle,
          goal_summary: nextPlan.goalSummary,
          objectives: nextPlan.objectives,
          grammar_topic_keys: nextPlan.grammarTopicKeys,
          report_language: normalizeReportLanguage(nextPlan.reportLanguage),
          monthly_sentence_translation_target:
            nextPlan.monthlySentenceTranslationTarget,
          monthly_gap_fill_target: nextPlan.monthlyGapFillTarget,
          monthly_completed_lessons_target:
            nextPlan.monthlyCompletedLessonsTarget,
          monthly_new_mastery_words_target:
            nextPlan.monthlyWordsAddedTarget ??
            nextPlan.monthlyMasteredWordsTarget,
          monthly_average_score_target: nextPlan.monthlyAverageScoreTarget,
        })
        .eq("tutor_id", tutorId)
        .eq("student_id", studentId)
        .eq("status", "active")
        .select(
          "id, tutor_id, student_id, plan_title, goal_summary, objectives, monthly_sentence_translation_target, monthly_gap_fill_target, monthly_completed_lessons_target, monthly_new_mastery_words_target, monthly_average_score_target, grammar_topic_keys, report_language, updated_at",
        )
        .single();

      if (legacyError || !legacyData) {
        throw legacyError ?? new Error("Failed to save tutor-student plan");
      }

      return {
        connectionId: legacyData.id,
        tutorId,
        studentId,
        planMonth,
        updatedAt: legacyData.updated_at,
        plan: normalizePlanShape(legacyData),
      };
    }

    throw error ?? new Error("Failed to save monthly tutor-student plan");
  }

  return {
    connectionId: data.connection_id,
    tutorId,
    studentId,
    planMonth,
    updatedAt: data.updated_at,
    plan: normalizePlanShape(data),
  };
}

export async function listStudentTutorPlans(
  studentId: string,
  options?: {
    planMonth?: string | null;
  },
): Promise<StudentTutorPlanCard[]> {
  const planMonth = normalizeTutorStudentPlanMonth(options?.planMonth);
  const admin = createAdminClient();
  const { data: connections, error } = await admin
    .from("tutor_students")
    .select(
      "id, tutor_id, student_id, plan_title, goal_summary, objectives, monthly_sentence_translation_target, monthly_gap_fill_target, monthly_completed_lessons_target, monthly_new_mastery_words_target, monthly_average_score_target, grammar_topic_keys, report_language, updated_at, profiles!tutor_students_tutor_id_fkey(id, full_name, email)",
    )
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("connected_at", { ascending: false });

  if (error) {
    throw error;
  }

  const tutorIds = (connections ?? []).map((row) => row.tutor_id);
  const { data: monthlyPlans, error: monthlyPlansError } =
    tutorIds.length === 0
      ? { data: [] as TutorStudentMonthlyPlanRow[], error: null }
      : await admin
          .from("tutor_student_monthly_plans")
          .select(
            "connection_id, tutor_id, student_id, plan_month, plan_title, goal_summary, objectives, grammar_topic_keys, report_language, monthly_sentence_translation_target, monthly_gap_fill_target, monthly_completed_lessons_target, monthly_words_added_target, monthly_mastered_words_target, monthly_student_speaking_share_target, monthly_average_score_target, updated_at",
          )
          .eq("student_id", studentId)
          .eq("plan_month", planMonth)
          .in("tutor_id", tutorIds);

  if (monthlyPlansError) {
    if (isMissingMonthlyPlansTableError(monthlyPlansError)) {
      return (connections ?? []).map((connection) => ({
        connectionId: connection.id,
        tutorId: connection.tutor_id,
        studentId: connection.student_id,
        planMonth,
        updatedAt: connection.updated_at,
        tutorProfile: {
          id: connection.profiles?.id ?? connection.tutor_id,
          fullName: connection.profiles?.full_name ?? null,
          email: connection.profiles?.email ?? "",
        },
        plan: normalizePlanShape(connection),
      }));
    }

    throw monthlyPlansError;
  }

  const monthlyPlanByTutorId = new Map(
    (monthlyPlans ?? []).map((row) => [row.tutor_id, row]),
  );

  return (connections ?? []).map((connection) => {
    const monthlyPlan = monthlyPlanByTutorId.get(connection.tutor_id);
    const source = monthlyPlan ?? connection;

    return {
      connectionId: connection.id,
      tutorId: connection.tutor_id,
      studentId: connection.student_id,
      planMonth,
      updatedAt: source.updated_at,
      tutorProfile: {
        id: connection.profiles?.id ?? connection.tutor_id,
        fullName: connection.profiles?.full_name ?? null,
        email: connection.profiles?.email ?? "",
      },
      plan: normalizePlanShape(source),
    };
  });
}
