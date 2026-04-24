import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeReportLanguage,
  reportLanguageSchema,
} from "@/lib/progress/monthly-report-language";

const nullableTrimmedText = z
  .string()
  .trim()
  .max(2_000)
  .transform((value) => value || null)
  .nullable();

export const nullableWholeNumberSchema = z.number().int().min(0).nullable();
export const nullablePercentageSchema = z.number().min(0).max(100).nullable();

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
  monthlyQuizTarget: nullableWholeNumberSchema.default(null),
  monthlyCompletedLessonsTarget: nullableWholeNumberSchema.default(null),
  monthlyNewMasteryWordsTarget: nullableWholeNumberSchema.default(null),
  monthlyAverageScoreTarget: nullablePercentageSchema.default(null),
  grammarTopicKeys: grammarTopicKeysSchema,
  reportLanguage: reportLanguageSchema.default("uk"),
});

export const tutorStudentPlanInputSchema = z.object({
  planTitle: z.string().trim().max(120).optional(),
  goalSummary: z.string().trim().max(2_000).optional(),
  objectives: z.array(z.string().trim().min(1).max(240)).max(10).optional(),
  monthlyQuizTarget: nullableWholeNumberSchema.optional(),
  monthlyCompletedLessonsTarget: nullableWholeNumberSchema.optional(),
  monthlyNewMasteryWordsTarget: nullableWholeNumberSchema.optional(),
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

function normalizePlanShape(input: {
  plan_title?: string | null;
  goal_summary?: string | null;
  objectives?: unknown;
  monthly_quiz_target?: number | null;
  monthly_completed_lessons_target?: number | null;
  monthly_new_mastery_words_target?: number | null;
  monthly_average_score_target?: number | null;
  grammar_topic_keys?: unknown;
  report_language?: string | null;
}): TutorStudentPlan {
  return tutorStudentPlanSchema.parse({
    planTitle: normalizeText(input.plan_title),
    goalSummary: normalizeText(input.goal_summary),
    objectives: normalizeObjectives(input.objectives),
    monthlyQuizTarget: normalizeNullableNumber(input.monthly_quiz_target),
    monthlyCompletedLessonsTarget: normalizeNullableNumber(
      input.monthly_completed_lessons_target,
    ),
    monthlyNewMasteryWordsTarget: normalizeNullableNumber(
      input.monthly_new_mastery_words_target,
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
    plan.monthlyQuizTarget != null ||
    plan.monthlyCompletedLessonsTarget != null ||
    plan.monthlyNewMasteryWordsTarget != null ||
    plan.monthlyAverageScoreTarget != null,
  );
}

export async function getTutorStudentPlan(
  tutorId: string,
  studentId: string,
): Promise<TutorStudentPlanRecord> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutor_students")
    .select(
      "id, tutor_id, student_id, plan_title, goal_summary, objectives, monthly_quiz_target, monthly_completed_lessons_target, monthly_new_mastery_words_target, monthly_average_score_target, grammar_topic_keys, report_language, updated_at",
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

  return {
    connectionId: data.id,
    tutorId: data.tutor_id,
    studentId: data.student_id,
    updatedAt: data.updated_at,
    plan: normalizePlanShape(data),
  };
}

export async function updateTutorStudentPlan(
  tutorId: string,
  studentId: string,
  input: TutorStudentPlanInput,
): Promise<TutorStudentPlanRecord> {
  const parsed = tutorStudentPlanInputSchema.parse(input);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutor_students")
    .update({
      plan_title:
        parsed.planTitle == null ? undefined : normalizeText(parsed.planTitle),
      goal_summary:
        parsed.goalSummary == null
          ? undefined
          : normalizeText(parsed.goalSummary),
      objectives:
        parsed.objectives == null
          ? undefined
          : normalizeObjectives(parsed.objectives),
      monthly_quiz_target: parsed.monthlyQuizTarget,
      monthly_completed_lessons_target: parsed.monthlyCompletedLessonsTarget,
      monthly_new_mastery_words_target: parsed.monthlyNewMasteryWordsTarget,
      monthly_average_score_target: parsed.monthlyAverageScoreTarget,
      grammar_topic_keys:
        parsed.grammarTopicKeys == null
          ? undefined
          : normalizeGrammarTopicKeys(parsed.grammarTopicKeys),
      report_language:
        parsed.reportLanguage == null
          ? undefined
          : normalizeReportLanguage(parsed.reportLanguage),
    })
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .select(
      "id, tutor_id, student_id, plan_title, goal_summary, objectives, monthly_quiz_target, monthly_completed_lessons_target, monthly_new_mastery_words_target, monthly_average_score_target, grammar_topic_keys, report_language, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return {
    connectionId: data.id,
    tutorId: data.tutor_id,
    studentId: data.student_id,
    updatedAt: data.updated_at,
    plan: normalizePlanShape(data),
  };
}

export async function listStudentTutorPlans(
  studentId: string,
): Promise<StudentTutorPlanCard[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutor_students")
    .select(
      "id, tutor_id, student_id, plan_title, goal_summary, objectives, monthly_quiz_target, monthly_completed_lessons_target, monthly_new_mastery_words_target, monthly_average_score_target, grammar_topic_keys, report_language, updated_at, profiles!tutor_students_tutor_id_fkey(id, full_name, email)",
    )
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("connected_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    connectionId: row.id,
    tutorId: row.tutor_id,
    studentId: row.student_id,
    updatedAt: row.updated_at,
    tutorProfile: {
      id: row.profiles?.id ?? row.tutor_id,
      fullName: row.profiles?.full_name ?? null,
      email: row.profiles?.email ?? "",
    },
    plan: normalizePlanShape(row),
  }));
}
