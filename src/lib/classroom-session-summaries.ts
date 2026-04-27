import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type ClassroomSessionSummaryRow =
  Database["public"]["Tables"]["tutor_student_classroom_session_summaries"]["Row"];

interface UpsertTutorStudentClassroomSessionSummaryInput {
  classroomId: string;
  connectionId: string;
  actorUserId: string;
  sessionStartedAt: string;
  sessionEndedAt?: string | null;
  tutorSpeakingSeconds?: number | null;
  studentSpeakingSeconds?: number | null;
}

function normalizeNonNegativeInteger(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function getDurationSeconds(startedAt: string, endedAt?: string | null) {
  if (!endedAt) {
    return null;
  }

  return Math.max(
    0,
    Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000),
  );
}

export async function upsertTutorStudentClassroomSessionSummary({
  classroomId,
  connectionId,
  actorUserId,
  sessionStartedAt,
  sessionEndedAt,
  tutorSpeakingSeconds,
  studentSpeakingSeconds,
}: UpsertTutorStudentClassroomSessionSummaryInput) {
  const supabaseAdmin = createAdminClient();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("tutor_student_classroom_session_summaries")
    .select("*")
    .eq("classroom_id", classroomId)
    .eq("session_started_at", sessionStartedAt)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const normalizedTutorSeconds = normalizeNonNegativeInteger(
    tutorSpeakingSeconds,
  );
  const normalizedStudentSeconds = normalizeNonNegativeInteger(
    studentSpeakingSeconds,
  );
  const effectiveEndedAt = sessionEndedAt ?? existing?.session_ended_at ?? null;
  const payload = {
    classroom_id: classroomId,
    connection_id: connectionId,
    created_by: existing?.created_by ?? actorUserId,
    last_reported_by: actorUserId,
    session_started_at: sessionStartedAt,
    session_ended_at: effectiveEndedAt,
    duration_seconds:
      getDurationSeconds(sessionStartedAt, effectiveEndedAt) ??
      existing?.duration_seconds ??
      null,
    tutor_speaking_seconds: Math.max(
      existing?.tutor_speaking_seconds ?? 0,
      normalizedTutorSeconds,
    ),
    student_speaking_seconds: Math.max(
      existing?.student_speaking_seconds ?? 0,
      normalizedStudentSeconds,
    ),
    updated_at: new Date().toISOString(),
  };

  const result = existing
    ? await supabaseAdmin
        .from("tutor_student_classroom_session_summaries")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : await supabaseAdmin
        .from("tutor_student_classroom_session_summaries")
        .insert(payload)
        .select("*")
        .single();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Failed to save classroom session summary");
  }

  return result.data as ClassroomSessionSummaryRow;
}

export async function listTutorStudentClassroomSessionSummaries(
  classroomId: string,
  limit = 6,
) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tutor_student_classroom_session_summaries")
    .select("*")
    .eq("classroom_id", classroomId)
    .order("session_started_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as ClassroomSessionSummaryRow[];
}