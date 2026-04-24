import { createAdminClient } from "@/lib/supabase/admin";
import type { AppLanguage } from "@/lib/i18n/app-language";

const APP_LANGUAGE_LOCALES: Record<AppLanguage, string> = {
  en: "en-GB",
  uk: "uk-UA",
};

export interface TutorStudentMonthlyActivityPoint {
  date: string;
  label: string;
  description: string;
  quizzes: number;
  lessons: number;
}

export type StudentMonthlyActivityPoint = TutorStudentMonthlyActivityPoint;

export interface TutorStudentMonthlyActivitySnapshot {
  points: TutorStudentMonthlyActivityPoint[];
  totalQuizzes: number;
  totalLessons: number;
  activeDays: number;
  startDateLabel: string;
  endDateLabel: string;
}

export type StudentMonthlyActivitySnapshot =
  TutorStudentMonthlyActivitySnapshot;

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = stripTime(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(date: Date, appLanguage: AppLanguage) {
  return new Intl.DateTimeFormat(APP_LANGUAGE_LOCALES[appLanguage], {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatLongDate(date: Date, appLanguage: AppLanguage) {
  return new Intl.DateTimeFormat(APP_LANGUAGE_LOCALES[appLanguage], {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export async function getTutorStudentMonthlyActivity(
  studentId: string,
  appLanguage: AppLanguage,
): Promise<TutorStudentMonthlyActivitySnapshot> {
  const supabaseAdmin = createAdminClient();
  const today = stripTime(new Date());
  const startDate = addDays(today, -29);
  const endExclusive = addDays(today, 1);

  const [{ data: attemptsResult }, { data: lessonsResult }] = await Promise.all(
    [
      supabaseAdmin
        .from("quiz_attempts")
        .select("completed_at")
        .eq("student_id", studentId)
        .gte("completed_at", `${toIsoDate(startDate)}T00:00:00`)
        .lt("completed_at", `${toIsoDate(endExclusive)}T00:00:00`),
      supabaseAdmin
        .from("tutor_student_lessons")
        .select("lesson_date")
        .eq("student_id", studentId)
        .eq("status", "completed")
        .gte("lesson_date", toIsoDate(startDate))
        .lte("lesson_date", toIsoDate(today)),
    ],
  );

  const quizCounts = new Map<string, number>();
  const lessonCounts = new Map<string, number>();

  for (const attempt of attemptsResult ?? []) {
    const isoDate = attempt.completed_at?.slice(0, 10);

    if (!isoDate) {
      continue;
    }

    quizCounts.set(isoDate, (quizCounts.get(isoDate) ?? 0) + 1);
  }

  for (const lesson of lessonsResult ?? []) {
    const isoDate = lesson.lesson_date;

    if (!isoDate) {
      continue;
    }

    lessonCounts.set(isoDate, (lessonCounts.get(isoDate) ?? 0) + 1);
  }

  const points = Array.from({ length: 30 }, (_, index) => {
    const date = addDays(startDate, index);
    const isoDate = toIsoDate(date);
    const quizzes = quizCounts.get(isoDate) ?? 0;
    const lessons = lessonCounts.get(isoDate) ?? 0;

    return {
      date: isoDate,
      label: formatShortDate(date, appLanguage),
      description: formatLongDate(date, appLanguage),
      quizzes,
      lessons,
    } satisfies TutorStudentMonthlyActivityPoint;
  });

  return {
    points,
    totalQuizzes: (attemptsResult ?? []).length,
    totalLessons: (lessonsResult ?? []).length,
    activeDays: points.filter((point) => point.quizzes > 0 || point.lessons > 0)
      .length,
    startDateLabel: formatLongDate(startDate, appLanguage),
    endDateLabel: formatLongDate(today, appLanguage),
  };
}

export const getStudentMonthlyActivity = getTutorStudentMonthlyActivity;
