import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createLiveKitJoinToken,
  getLiveKitServerUrl,
  isLiveKitConfigured,
} from "@/lib/livekit";
import { requireLessonRoomParticipantAccess } from "@/lib/lesson-room-access";

function buildParticipantIdentity({
  lessonId,
  userId,
  role,
}: {
  lessonId: string;
  userId: string;
  role: string;
}) {
  return `lesson:${lessonId}:${role}:${userId}`;
}

function buildParticipantName(
  access: Awaited<ReturnType<typeof requireLessonRoomParticipantAccess>> extends {
    errorResponse: NextResponse;
  }
    ? never
    : never,
) {
  return access;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireLessonRoomParticipantAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  if (!isLiveKitConfigured()) {
    return NextResponse.json(
      { error: "Lesson room media backend is not configured" },
      { status: 503 },
    );
  }

  if (access.lesson.status === "cancelled") {
    return NextResponse.json(
      { error: "Cancelled lessons cannot open a live room" },
      { status: 409 },
    );
  }

  if (access.session.room_status === "archived") {
    return NextResponse.json(
      { error: "This lesson room has been archived" },
      { status: 409 },
    );
  }

  const participantName =
    access.role === "tutor"
      ? access.lesson.tutor_profile?.full_name ||
        access.lesson.tutor_profile?.email ||
        "Tutor"
      : access.lesson.student_profile?.full_name ||
        access.lesson.student_profile?.email ||
        "Student";
  const participantIdentity = buildParticipantIdentity({
    lessonId: id,
    userId: access.userId,
    role: access.role,
  });
  const roomName = access.session.provider_room_key;
  const serverUrl = getLiveKitServerUrl();

  if (!serverUrl) {
    return NextResponse.json(
      { error: "LiveKit URL is not configured" },
      { status: 503 },
    );
  }

  const token = await createLiveKitJoinToken({
    roomName,
    participantIdentity,
    participantName,
    role: access.role,
    metadata: {
      lessonId: id,
      sessionId: access.session.id,
      userId: access.userId,
      role: access.role,
    },
  });

  if (access.session.room_status === "scheduled") {
    const supabaseAdmin = createAdminClient();
    await supabaseAdmin
      .from("lesson_room_sessions")
      .update({
        room_status: "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", access.session.id);
  }

  return NextResponse.json({
    token,
    serverUrl,
    roomName,
    participantIdentity,
    participantName,
  });
}