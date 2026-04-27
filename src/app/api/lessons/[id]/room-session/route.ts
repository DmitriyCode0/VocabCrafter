import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLessonRoomParticipantAccess } from "@/lib/lesson-room-access";
import { reconcileLessonRoomSessionRecordingStatus } from "@/lib/lesson-room-recordings";
import {
  createLiveKitRoomServiceClient,
  isLiveKitConfigured,
} from "@/lib/livekit";
import type { Database } from "@/types/database";

type LessonRoomSessionUpdate =
  Database["public"]["Tables"]["lesson_room_sessions"]["Update"];

async function updateLessonRoomSession(
  sessionId: string,
  patch: LessonRoomSessionUpdate,
) {
  const supabaseAdmin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("lesson_room_sessions")
    .update({
      ...patch,
      updated_at: nowIso,
    })
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to update lesson room session");
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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireLessonRoomParticipantAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        action?:
          | "participant-connected"
          | "participant-disconnected"
          | "set-consent";
        consentStatus?: "pending" | "granted" | "declined";
      }
    | null;

  if (!payload?.action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  try {
    if (payload.action === "participant-connected") {
      const nowIso = new Date().toISOString();
      const recordingStatus =
        await reconcileLessonRoomSessionRecordingStatus(
          access.session.id,
          access.session.recording_status,
        );
      const session = await updateLessonRoomSession(access.session.id, {
        room_status: access.session.room_status === "archived" ? "archived" : "live",
        started_at: access.session.started_at ?? nowIso,
        ended_at: null,
        recording_status: recordingStatus,
      });

      return NextResponse.json({ session, participantCount: 1 });
    }

    if (payload.action === "participant-disconnected") {
      const participantCount = await getRoomParticipantCount(
        access.session.provider_room_key,
      );
      const nowIso = new Date().toISOString();
      const nextStatus =
        access.session.room_status === "archived"
          ? "archived"
          : participantCount > 0
            ? "live"
            : access.lesson.status === "completed"
              ? "completed"
              : "open";
      const session = await updateLessonRoomSession(access.session.id, {
        room_status: nextStatus,
        ended_at: participantCount > 0 ? null : nowIso,
      });

      return NextResponse.json({ session, participantCount });
    }

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

    const session = await updateLessonRoomSession(access.session.id, {
      recording_consent_status: consentStatus,
    });

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update lesson room session",
      },
      { status: 500 },
    );
  }
}