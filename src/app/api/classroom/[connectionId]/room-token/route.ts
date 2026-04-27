import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTutorStudentClassroomParticipantAccess } from "@/lib/classroom-access";
import {
  createLiveKitJoinToken,
  getLiveKitServerUrl,
  isLiveKitConfigured,
} from "@/lib/livekit";

function buildParticipantIdentity({
  connectionId,
  userId,
  role,
}: {
  connectionId: string;
  userId: string;
  role: string;
}) {
  return `classroom:${connectionId}:${role}:${userId}`;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;
  const access = await requireTutorStudentClassroomParticipantAccess(connectionId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  if (!isLiveKitConfigured()) {
    return NextResponse.json(
      { error: "Classroom media backend is not configured" },
      { status: 503 },
    );
  }

  if (access.classroom.room_status === "archived") {
    return NextResponse.json(
      { error: "This classroom has been archived" },
      { status: 409 },
    );
  }

  const participantName =
    access.role === "tutor"
      ? access.connection.tutor_profile?.full_name ||
        access.connection.tutor_profile?.email ||
        "Tutor"
      : access.connection.student_profile?.full_name ||
        access.connection.student_profile?.email ||
        "Student";
  const participantIdentity = buildParticipantIdentity({
    connectionId,
    userId: access.userId,
    role: access.role,
  });
  const roomName = access.classroom.provider_room_key;
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
      connectionId,
      classroomId: access.classroom.id,
      userId: access.userId,
      role: access.role,
    },
  });

  if (access.classroom.room_status !== "live") {
    const supabaseAdmin = createAdminClient();
    await supabaseAdmin
      .from("tutor_student_classrooms")
      .update({
        room_status: "open",
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", access.classroom.id);
  }

  return NextResponse.json({
    token,
    serverUrl,
    roomName,
    participantIdentity,
    participantName,
  });
}