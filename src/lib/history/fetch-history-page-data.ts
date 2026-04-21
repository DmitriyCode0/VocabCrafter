import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/types/roles";

export const HISTORY_PAGE_SIZE = 20;
const HISTORY_PAGE_SIZE_MAX = 50;

export interface HistoryAttempt extends Record<string, unknown> {
  id: string;
  student_id: string;
  score: number | null;
  max_score: number | null;
  completed_at: string;
  quizzes?: {
    title: string | null;
    type: string | null;
    cefr_level: string | null;
    vocabulary_terms?: unknown;
    config?: unknown;
    generated_content?: unknown;
  } | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

export interface HistoryStudent extends Record<string, unknown> {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  cefr_level: string | null;
}

interface FetchHistoryPageDataParams {
  role: Role;
  userId: string;
  limit?: number;
  offset?: number;
  studentId?: string | null;
  quizType?: string | null;
  quizId?: string | null;
}

interface FetchHistoryPageDataResult {
  attempts: HistoryAttempt[];
  hasMore: boolean;
  students: HistoryStudent[];
  activeStudentFilter: string | null;
}

function normalizeFilterValue(value?: string | null) {
  if (!value || value === "all") {
    return null;
  }

  return value;
}

export async function fetchConnectedStudents(userId: string) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tutor_students")
    .select(
      "student_id, profiles!tutor_students_student_id_fkey(id, full_name, email, avatar_url, cefr_level)",
    )
    .eq("tutor_id", userId)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return (data ?? []).flatMap((connection) => {
    const profile = connection.profiles;

    if (!profile || typeof profile.id !== "string") {
      return [];
    }

    return [
      {
        id: profile.id,
        full_name: profile.full_name ?? null,
        email: profile.email ?? null,
        avatar_url: profile.avatar_url ?? null,
        cefr_level: profile.cefr_level ?? null,
      } satisfies HistoryStudent,
    ];
  });
}

export async function fetchHistoryPageData({
  role,
  userId,
  limit = HISTORY_PAGE_SIZE,
  offset = 0,
  studentId,
  quizType,
  quizId,
}: FetchHistoryPageDataParams): Promise<FetchHistoryPageDataResult> {
  const safeLimit = Math.min(Math.max(limit, 1), HISTORY_PAGE_SIZE_MAX);
  const safeOffset = Math.max(offset, 0);
  const normalizedQuizType = normalizeFilterValue(quizType);
  const normalizedQuizId = normalizeFilterValue(quizId);
  const requestedStudentId = normalizeFilterValue(studentId);
  const students =
    role === "student" ? [] : await fetchConnectedStudents(userId);
  const allowedStudentIds =
    role === "student"
      ? [userId]
      : Array.from(new Set([userId, ...students.map((student) => student.id)]));
  const activeStudentFilter =
    requestedStudentId && allowedStudentIds.includes(requestedStudentId)
      ? requestedStudentId
      : null;

  const supabaseAdmin = createAdminClient();
  const quizzesRelation = normalizedQuizType ? "quizzes!inner" : "quizzes";
  let query = supabaseAdmin
    .from("quiz_attempts")
    .select(
      [
        "*",
        `${quizzesRelation}(title, type, cefr_level, vocabulary_terms, config, generated_content)`,
        "profiles(full_name, email, avatar_url)",
      ].join(", "),
    )
    .order("completed_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit);

  if (role === "student") {
    query = query.eq("student_id", userId);
  } else if (activeStudentFilter) {
    query = query.eq("student_id", activeStudentFilter);
  } else {
    query = query.in("student_id", allowedStudentIds);
  }

  if (normalizedQuizType) {
    query = query.eq("quizzes.type", normalizedQuizType);
  }

  if (normalizedQuizId) {
    query = query.eq("quiz_id", normalizedQuizId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const attempts = (data ?? []) as unknown as HistoryAttempt[];

  return {
    attempts: attempts.slice(0, safeLimit),
    hasMore: attempts.length > safeLimit,
    students,
    activeStudentFilter,
  };
}
