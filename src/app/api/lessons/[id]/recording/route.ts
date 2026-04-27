import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLessonRoomParticipantAccess } from "@/lib/lesson-room-access";
import {
  createLiveKitEgressClient,
  createLiveKitRecordingOutput,
  getDefaultLiveKitRecordingOptions,
  getLiveKitRecordingConfigurationError,
  isLiveKitConfigured,
  isLiveKitRecordingConfigured,
} from "@/lib/livekit";
import type { Database } from "@/types/database";

type LessonRoomRecordingRow =
  Database["public"]["Tables"]["lesson_room_recordings"]["Row"];

async function getActiveRecording(sessionId: string) {
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireLessonRoomParticipantAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  if (access.role !== "tutor") {
    return NextResponse.json(
      { error: "Only tutors can control lesson recordings" },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | { action?: "start" | "stop" }
    | null;

  if (!payload?.action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  if (!isLiveKitConfigured()) {
    return NextResponse.json(
      { error: "LiveKit is not configured" },
      { status: 503 },
    );
  }

  const supabaseAdmin = createAdminClient();

  try {
    if (payload.action === "start") {
      if (!isLiveKitRecordingConfigured()) {
        return NextResponse.json(
          {
            error:
              getLiveKitRecordingConfigurationError() ||
              "LiveKit recording storage is not configured",
          },
          { status: 503 },
        );
      }

      if (access.session.recording_consent_status !== "granted") {
        return NextResponse.json(
          { error: "Confirm recording consent before starting a recording" },
          { status: 409 },
        );
      }

      if (
        access.session.recording_status === "recording" ||
        access.session.recording_status === "processing"
      ) {
        return NextResponse.json(
          { error: "A lesson recording is already active or still processing" },
          { status: 409 },
        );
      }

      const output = createLiveKitRecordingOutput({
        lessonId: id,
        sessionId: access.session.id,
      });
      const nowIso = new Date().toISOString();
      const egressClient = createLiveKitEgressClient();
      const egressInfo = await egressClient.startRoomCompositeEgress(
        access.session.provider_room_key,
        output,
        getDefaultLiveKitRecordingOptions(),
      );

      const storageBucket =
        output.file?.output.case === "s3" ? output.file.output.value.bucket : null;
      const storagePath = output.file?.filepath ?? null;
      const { data: recording, error: recordingError } = await supabaseAdmin
        .from("lesson_room_recordings")
        .insert({
          session_id: access.session.id,
          lesson_id: id,
          created_by: access.userId,
          storage_bucket: storageBucket,
          storage_path: storagePath,
          provider_recording_id: egressInfo.egressId,
          status: "recording",
          consent_snapshot: {
            status: access.session.recording_consent_status,
            confirmedBy: access.userId,
            capturedAt: nowIso,
          },
          updated_at: nowIso,
        })
        .select("*")
        .single();

      if (recordingError || !recording) {
        try {
          await egressClient.stopEgress(egressInfo.egressId);
        } catch {
          // Best-effort cleanup if persistence fails after starting egress.
        }

        throw recordingError ?? new Error("Failed to persist lesson recording");
      }

      const { data: session, error: sessionError } = await supabaseAdmin
        .from("lesson_room_sessions")
        .update({
          room_status: "live",
          recording_status: "recording",
          started_at: access.session.started_at ?? nowIso,
          last_recording_started_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", access.session.id)
        .select("*")
        .single();

      if (sessionError || !session) {
        try {
          await egressClient.stopEgress(egressInfo.egressId);
        } catch {
          // Best-effort cleanup if session persistence fails after starting egress.
        }

        await supabaseAdmin
          .from("lesson_room_recordings")
          .update({
            status: "failed",
            error_message: "Lesson room session could not be updated after starting recording",
            updated_at: new Date().toISOString(),
          })
          .eq("id", recording.id);

        throw sessionError ?? new Error("Failed to update lesson room session");
      }

      return NextResponse.json({ session, recording });
    }

    const activeRecording = await getActiveRecording(access.session.id);

    if (!activeRecording) {
      return NextResponse.json(
        { error: "No active lesson recording was found" },
        { status: 404 },
      );
    }

    if (!activeRecording.provider_recording_id) {
      return NextResponse.json(
        { error: "The active lesson recording is missing a provider recording id" },
        { status: 409 },
      );
    }

    const egressClient = createLiveKitEgressClient();
    await egressClient.stopEgress(activeRecording.provider_recording_id);

    const endedAtIso = new Date().toISOString();
    const durationSeconds = Math.max(
      0,
      Math.round(
        (Date.parse(endedAtIso) - Date.parse(activeRecording.created_at)) / 1000,
      ),
    );
    const { data: recording, error: recordingError } = await supabaseAdmin
      .from("lesson_room_recordings")
      .update({
        status: "processing",
        duration_seconds: durationSeconds,
        updated_at: endedAtIso,
      })
      .eq("id", activeRecording.id)
      .select("*")
      .single();

    if (recordingError || !recording) {
      throw recordingError ?? new Error("Failed to update lesson recording");
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("lesson_room_sessions")
      .update({
        recording_status: "processing",
        last_recording_ended_at: endedAtIso,
        updated_at: endedAtIso,
      })
      .eq("id", access.session.id)
      .select("*")
      .single();

    if (sessionError || !session) {
      throw sessionError ?? new Error("Failed to update lesson room session");
    }

    return NextResponse.json({ session, recording });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update lesson recording",
      },
      { status: 500 },
    );
  }
}