import { NextResponse } from "next/server";
import { requireLessonRoomParticipantAccess } from "@/lib/lesson-room-access";
import { createAdminClient } from "@/lib/supabase/admin";

function getAggregateRecordingStatus(statuses: string[]) {
  if (statuses.some((status) => status === "recording")) {
    return "recording";
  }

  if (statuses.some((status) => status === "processing")) {
    return "processing";
  }

  if (statuses.some((status) => status === "ready" || status === "completed")) {
    return "completed";
  }

  if (statuses.some((status) => status === "failed")) {
    return "failed";
  }

  return "idle";
}

function getAggregateTranscriptStatus(statuses: string[]) {
  if (statuses.some((status) => status === "ready")) {
    return "ready";
  }

  if (
    statuses.some((status) => status === "processing" || status === "pending")
  ) {
    return "processing";
  }

  if (statuses.some((status) => status === "failed")) {
    return "failed";
  }

  return "idle";
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; recordingId: string }> },
) {
  const { id, recordingId } = await params;
  const access = await requireLessonRoomParticipantAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  if (access.role !== "tutor") {
    return NextResponse.json(
      { error: "Only tutors can delete lesson recordings" },
      { status: 403 },
    );
  }

  const supabaseAdmin = createAdminClient();
  const { data: recording, error: recordingError } = await supabaseAdmin
    .from("lesson_room_recordings")
    .select("id, lesson_id, session_id, status, storage_bucket, storage_path")
    .eq("id", recordingId)
    .eq("lesson_id", id)
    .maybeSingle();

  if (recordingError) {
    return NextResponse.json(
      { error: "Failed to load lesson recording" },
      { status: 500 },
    );
  }

  if (!recording || recording.session_id !== access.session.id) {
    return NextResponse.json(
      { error: "Lesson recording not found" },
      { status: 404 },
    );
  }

  if (recording.status === "recording") {
    return NextResponse.json(
      { error: "Stop the active lesson recording before deleting it" },
      { status: 409 },
    );
  }

  const { data: transcripts, error: transcriptsError } = await supabaseAdmin
    .from("lesson_room_transcripts")
    .select("id")
    .eq("recording_id", recording.id);

  if (transcriptsError) {
    return NextResponse.json(
      { error: "Failed to load lesson transcripts" },
      { status: 500 },
    );
  }

  const transcriptIds = (transcripts ?? []).map((transcript) => transcript.id);

  if (transcriptIds.length > 0) {
    const { error: deleteSegmentsError } = await supabaseAdmin
      .from("lesson_room_transcript_segments")
      .delete()
      .in("transcript_id", transcriptIds);

    if (deleteSegmentsError) {
      return NextResponse.json(
        { error: "Failed to delete lesson transcript segments" },
        { status: 500 },
      );
    }

    const { error: deleteTranscriptsError } = await supabaseAdmin
      .from("lesson_room_transcripts")
      .delete()
      .in("id", transcriptIds);

    if (deleteTranscriptsError) {
      return NextResponse.json(
        { error: "Failed to delete lesson transcripts" },
        { status: 500 },
      );
    }
  }

  if (recording.storage_bucket && recording.storage_path) {
    const { error: removeStorageError } = await supabaseAdmin.storage
      .from(recording.storage_bucket)
      .remove([recording.storage_path]);

    if (removeStorageError) {
      return NextResponse.json(
        { error: "Failed to delete the lesson recording file" },
        { status: 500 },
      );
    }
  }

  const { error: deleteRecordingError } = await supabaseAdmin
    .from("lesson_room_recordings")
    .delete()
    .eq("id", recording.id);

  if (deleteRecordingError) {
    return NextResponse.json(
      { error: "Failed to delete lesson recording" },
      { status: 500 },
    );
  }

  const [remainingRecordingsResult, remainingTranscriptsResult] =
    await Promise.all([
      supabaseAdmin
        .from("lesson_room_recordings")
        .select("status")
        .eq("session_id", access.session.id),
      supabaseAdmin
        .from("lesson_room_transcripts")
        .select("diarization_status")
        .eq("lesson_id", access.lesson.id),
    ]);

  if (remainingRecordingsResult.error || remainingTranscriptsResult.error) {
    return NextResponse.json(
      { error: "Failed to refresh lesson recording state" },
      { status: 500 },
    );
  }

  const { error: sessionUpdateError } = await supabaseAdmin
    .from("lesson_room_sessions")
    .update({
      recording_status: getAggregateRecordingStatus(
        (remainingRecordingsResult.data ?? []).map((item) => item.status),
      ),
      transcript_status: getAggregateTranscriptStatus(
        (remainingTranscriptsResult.data ?? []).map(
          (item) => item.diarization_status,
        ),
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", access.session.id);

  if (sessionUpdateError) {
    return NextResponse.json(
      { error: "Failed to update lesson recording state" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
