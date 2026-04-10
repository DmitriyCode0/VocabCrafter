import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function autoCompleteOverduePlannedLessons({
  tutorId,
  studentId,
  supabaseAdmin = createAdminClient(),
}: {
  tutorId?: string;
  studentId?: string;
  supabaseAdmin?: SupabaseAdminClient;
}) {
  if (!tutorId && !studentId) {
    return;
  }

  const todayIsoDate = toIsoDate(new Date());
  const nowIso = new Date().toISOString();

  let query = supabaseAdmin
    .from("tutor_student_lessons")
    .update({
      status: "completed",
      updated_at: nowIso,
    })
    .eq("status", "planned")
    .lt("lesson_date", todayIsoDate);

  if (tutorId) {
    query = query.eq("tutor_id", tutorId);
  }

  if (studentId) {
    query = query.eq("student_id", studentId);
  }

  const { error } = await query;

  if (error) {
    throw error;
  }
}