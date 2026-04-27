import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type ClassroomRecordingRow =
  Database["public"]["Tables"]["tutor_student_classroom_recordings"]["Row"];
type ClassroomRecordingStatus =
  Database["public"]["Tables"]["tutor_student_classrooms"]["Row"]["recording_status"];

export async function getActiveTutorStudentClassroomRecording(
  classroomId: string,
) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tutor_student_classroom_recordings")
    .select("*")
    .eq("classroom_id", classroomId)
    .eq("status", "recording")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ClassroomRecordingRow | null;
}

async function getLatestTutorStudentClassroomRecording(classroomId: string) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tutor_student_classroom_recordings")
    .select("id, status")
    .eq("classroom_id", classroomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function mapRecordingRowStatusToClassroomStatus(
  recordingStatus?: ClassroomRecordingRow["status"] | null,
): ClassroomRecordingStatus {
  switch (recordingStatus) {
    case "recording":
      return "recording";
    case "failed":
      return "failed";
    case null:
    case undefined:
      return "idle";
    default:
      return "completed";
  }
}

export async function reconcileTutorStudentClassroomRecordingStatus(
  classroomId: string,
  currentStatus: ClassroomRecordingStatus,
) {
  if (currentStatus !== "processing") {
    return currentStatus;
  }

  const activeRecording = await getActiveTutorStudentClassroomRecording(
    classroomId,
  );

  if (activeRecording) {
    return currentStatus;
  }

  const latestRecording = await getLatestTutorStudentClassroomRecording(
    classroomId,
  );
  const nextStatus = mapRecordingRowStatusToClassroomStatus(
    latestRecording?.status ?? null,
  );

  if (nextStatus === currentStatus) {
    return currentStatus;
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("tutor_student_classrooms")
    .update({
      recording_status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", classroomId);

  if (error) {
    throw error;
  }

  return nextStatus;
}