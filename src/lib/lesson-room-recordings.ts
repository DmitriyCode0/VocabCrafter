import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type LessonRoomRecordingRow =
  Database["public"]["Tables"]["lesson_room_recordings"]["Row"];
type LessonRoomSessionRecordingStatus =
  Database["public"]["Tables"]["lesson_room_sessions"]["Row"]["recording_status"];

export async function getActiveLessonRoomRecording(sessionId: string) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("lesson_room_recordings")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "recording")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as LessonRoomRecordingRow | null;
}

async function getLatestLessonRoomRecording(sessionId: string) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("lesson_room_recordings")
    .select("id, status")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function mapRecordingRowStatusToSessionStatus(
  recordingStatus?: LessonRoomRecordingRow["status"] | null,
): LessonRoomSessionRecordingStatus {
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

export async function reconcileLessonRoomSessionRecordingStatus(
  sessionId: string,
  currentStatus: LessonRoomSessionRecordingStatus,
) {
  if (currentStatus !== "processing") {
    return currentStatus;
  }

  const activeRecording = await getActiveLessonRoomRecording(sessionId);

  if (activeRecording) {
    return currentStatus;
  }

  const latestRecording = await getLatestLessonRoomRecording(sessionId);
  const nextStatus = mapRecordingRowStatusToSessionStatus(
    latestRecording?.status ?? null,
  );

  if (nextStatus === currentStatus) {
    return currentStatus;
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("lesson_room_sessions")
    .update({
      recording_status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    throw error;
  }

  return nextStatus;
}
