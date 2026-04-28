import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTutorStudentClassroomParticipantAccess } from "@/lib/classroom-access";
import {
  getActiveTutorStudentClassroomRecording,
  reconcileTutorStudentClassroomRecordingStatus,
} from "@/lib/classroom-recordings";
import {
  createLiveKitClassroomRecordingOutput,
  createLiveKitEgressClient,
  getLiveKitPublishedParticipantTrack,
  getLiveKitRecordingConfigurationError,
  isLiveKitConfigured,
  isLiveKitRecordingConfigured,
} from "@/lib/livekit";

function buildStudentParticipantIdentity(connectionId: string, studentId: string) {
  return `classroom:${connectionId}:student:${studentId}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;
  const access = await requireTutorStudentClassroomParticipantAccess(connectionId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  if (access.role !== "tutor") {
    return NextResponse.json(
      { error: "Only tutors can control classroom recordings" },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    action?: "start" | "stop";
  } | null;

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
      const effectiveRecordingStatus =
        await reconcileTutorStudentClassroomRecordingStatus(
          access.classroom.id,
          access.classroom.recording_status,
        );

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

      if (access.classroom.recording_consent_status !== "granted") {
        return NextResponse.json(
          { error: "Confirm recording consent before starting a recording" },
          { status: 409 },
        );
      }

      const activeRecording = await getActiveTutorStudentClassroomRecording(
        access.classroom.id,
      );

      if (effectiveRecordingStatus === "recording" || activeRecording) {
        return NextResponse.json(
          { error: "A classroom recording is already active" },
          { status: 409 },
        );
      }

      const studentParticipantIdentity = buildStudentParticipantIdentity(
        connectionId,
        access.connection.student_id,
      );
      const studentParticipant = await getLiveKitPublishedParticipantTrack({
        roomName: access.classroom.provider_room_key,
        participantIdentity: studentParticipantIdentity,
      });

      if (!studentParticipant?.participant) {
        return NextResponse.json(
          {
            error: "The student must be connected before recording can start",
          },
          { status: 409 },
        );
      }

      const output = createLiveKitClassroomRecordingOutput({
        connectionId,
        classroomId: access.classroom.id,
      });
      const nowIso = new Date().toISOString();
      const egressClient = createLiveKitEgressClient();
      const egressInfo = await egressClient.startParticipantEgress(
        access.classroom.provider_room_key,
        studentParticipantIdentity,
        output,
      );

      const storageBucket =
        output.file?.output.case === "s3"
          ? output.file.output.value.bucket
          : null;
      const storagePath = output.file?.filepath ?? null;
      const { data: recording, error: recordingError } = await supabaseAdmin
        .from("tutor_student_classroom_recordings")
        .insert({
          classroom_id: access.classroom.id,
          created_by: access.userId,
          storage_bucket: storageBucket,
          storage_path: storagePath,
          provider_recording_id: egressInfo.egressId,
          status: "recording",
          consent_snapshot: {
            status: access.classroom.recording_consent_status,
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

        throw recordingError ?? new Error("Failed to persist classroom recording");
      }

      const { data: classroom, error: classroomError } = await supabaseAdmin
        .from("tutor_student_classrooms")
        .update({
          room_status: "live",
          recording_status: "recording",
          started_at: access.classroom.started_at ?? nowIso,
          last_recording_started_at: nowIso,
          last_activity_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", access.classroom.id)
        .select("*")
        .single();

      if (classroomError || !classroom) {
        try {
          await egressClient.stopEgress(egressInfo.egressId);
        } catch {
          // Best-effort cleanup if state persistence fails after starting egress.
        }

        await supabaseAdmin
          .from("tutor_student_classroom_recordings")
          .update({
            status: "failed",
            error_message:
              "Classroom state could not be updated after starting recording",
            updated_at: new Date().toISOString(),
          })
          .eq("id", recording.id);

        throw classroomError ?? new Error("Failed to update classroom state");
      }

      return NextResponse.json({ session: classroom, recording });
    }

    const activeRecording = await getActiveTutorStudentClassroomRecording(
      access.classroom.id,
    );

    if (!activeRecording) {
      return NextResponse.json(
        { error: "No active classroom recording was found" },
        { status: 404 },
      );
    }

    if (!activeRecording.provider_recording_id) {
      return NextResponse.json(
        {
          error:
            "The active classroom recording is missing a provider recording id",
        },
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
      .from("tutor_student_classroom_recordings")
      .update({
        status: "processing",
        duration_seconds: durationSeconds,
        updated_at: endedAtIso,
      })
      .eq("id", activeRecording.id)
      .select("*")
      .single();

    if (recordingError || !recording) {
      throw recordingError ?? new Error("Failed to update classroom recording");
    }

    const { data: classroom, error: classroomError } = await supabaseAdmin
      .from("tutor_student_classrooms")
      .update({
        recording_status: "processing",
        last_recording_ended_at: endedAtIso,
        last_activity_at: endedAtIso,
        updated_at: endedAtIso,
      })
      .eq("id", access.classroom.id)
      .select("*")
      .single();

    if (classroomError || !classroom) {
      throw classroomError ?? new Error("Failed to update classroom state");
    }

    return NextResponse.json({ session: classroom, recording });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update classroom recording",
      },
      { status: 500 },
    );
  }
}