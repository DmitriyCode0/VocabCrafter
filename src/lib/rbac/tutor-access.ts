import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function tutorHasStudentAccess(
  supabaseAdmin: SupabaseClient<Database>,
  tutorId: string,
  studentId: string,
) {
  const { data: connection, error: connectionError } = await supabaseAdmin
    .from("tutor_students")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (connectionError) {
    throw connectionError;
  }

  if (connection) {
    return true;
  }

  const { data: classes, error: classesError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("is_active", true);

  if (classesError) {
    throw classesError;
  }

  const classIds = (classes ?? []).map((item) => item.id);
  if (classIds.length === 0) {
    return false;
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("class_members")
    .select("id")
    .eq("student_id", studentId)
    .in("class_id", classIds)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  return Boolean(membership);
}

export async function tutorHasQuizAccess(
  supabaseAdmin: SupabaseClient<Database>,
  tutorId: string,
  quizId: string,
) {
  const { data: quiz, error: quizError } = await supabaseAdmin
    .from("quizzes")
    .select("creator_id")
    .eq("id", quizId)
    .maybeSingle();

  if (quizError) {
    throw quizError;
  }

  if (quiz?.creator_id === tutorId) {
    return true;
  }

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("assignments")
    .select("id")
    .eq("quiz_id", quizId)
    .eq("tutor_id", tutorId)
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    throw assignmentError;
  }

  return Boolean(assignment);
}
