import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTutorStudentClassroomParticipantAccess } from "@/lib/classroom-access";
import { reconcileTutorStudentClassroomRecordingStatus } from "@/lib/classroom-recordings";
import { upsertTutorStudentClassroomSessionSummary } from "@/lib/classroom-session-summaries";
import {
  createLiveKitRoomServiceClient,
  isLiveKitConfigured,
} from "@/lib/livekit";
import type { Database } from "@/types/database";

type ClassroomUpdate =
  Database["public"]["Tables"]["tutor_student_classrooms"]["Update"];

async function updateTutorStudentClassroom(
  classroomId: string,
  patch: ClassroomUpdate,
) {
  const supabaseAdmin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("tutor_student_classrooms")
    .update({
      ...patch,
      updated_at: nowIso,
    })
    .eq("id", classroomId)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to update classroom state");
  }

  return data;
}

async function getRoomParticipantCount(roomName: string) {
  if (!isLiveKitConfigured()) {
    return 0;
  }

  try {
    const roomServiceClient = createLiveKitRoomServiceClient();
    const participants = await roomServiceClient.listParticipants(roomName);
    return participants.length;
  } catch {
    return 0;
  }
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

  const payload = (await request.json().catch(() => null)) as {
    action?:
      | "participant-connected"
      | "participant-disconnected"
      | "set-consent";
    consentStatus?: "pending" | "granted" | "declined";
    speakingSummary?: {
      tutorSpeakingSeconds?: number;
      studentSpeakingSeconds?: number;
    };
  } | null;

  if (!payload?.action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  try {
    if (payload.action === "participant-connected") {
      const nowIso = new Date().toISOString();
      const sessionStartedAt =
        access.classroom.room_status === "live" && access.classroom.started_at
          ? access.classroom.started_at
          : nowIso;
      const recordingStatus =
        await reconcileTutorStudentClassroomRecordingStatus(
          access.classroom.id,
          access.classroom.recording_status,
        );
      await upsertTutorStudentClassroomSessionSummary({
        classroomId: access.classroom.id,
        connectionId: access.connection.id,
        actorUserId: access.userId,
        sessionStartedAt,
      });
      const classroom = await updateTutorStudentClassroom(access.classroom.id, {
        room_status: "live",
        started_at: sessionStartedAt,
        ended_at: null,
        last_activity_at: nowIso,
        recording_status: recordingStatus,
      });

      return NextResponse.json({ session: classroom, participantCount: 1 });
    }

    if (payload.action === "set-consent") {
      if (access.role !== "tutor") {
        return NextResponse.json(
          { error: "Only tutors can update recording consent" },
          { status: 403 },
        );
      }

      const consentStatus = payload.consentStatus;

      if (
        consentStatus !== "pending" &&
        consentStatus !== "granted" &&
        consentStatus !== "declined"
      ) {
        return NextResponse.json(
          { error: "Invalid consent status" },
          { status: 400 },
        );
      }

      const classroom = await updateTutorStudentClassroom(access.classroom.id, {
        recording_consent_status: consentStatus,
        last_activity_at: new Date().toISOString(),
      });

      return NextResponse.json({ session: classroom });
    }

    const participantCount = await getRoomParticipantCount(
      access.classroom.provider_room_key,
    );
    const nowIso = new Date().toISOString();
    const sessionStartedAt = access.classroom.started_at ?? nowIso;

    await upsertTutorStudentClassroomSessionSummary({
      classroomId: access.classroom.id,
      connectionId: access.connection.id,
      actorUserId: access.userId,
      sessionStartedAt,
      sessionEndedAt: participantCount > 0 ? null : nowIso,
      tutorSpeakingSeconds: payload.speakingSummary?.tutorSpeakingSeconds,
      studentSpeakingSeconds: payload.speakingSummary?.studentSpeakingSeconds,
    });

    const classroom = await updateTutorStudentClassroom(access.classroom.id, {
      room_status: participantCount > 0 ? "live" : "open",
      started_at: participantCount > 0 ? access.classroom.started_at : null,
      ended_at: participantCount > 0 ? null : nowIso,
      last_activity_at: nowIso,
    });

    return NextResponse.json({ session: classroom, participantCount });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update classroom state",
      },
      { status: 500 },
    );
  }
}