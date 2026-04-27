import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/roles";
import type {
  Database,
  LessonRoomSession,
  TutorStudentLesson,
} from "@/types/database";

type LessonRoomStatus = LessonRoomSession["room_status"];

interface LessonRoomLessonRow extends TutorStudentLesson {
  tutor_profile: {
    full_name: string | null;
    email: string | null;
  } | null;
  student_profile: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface LessonRoomAccessData {
  userId: string;
  role: Role;
  lesson: LessonRoomLessonRow;
  session: LessonRoomSession;
}

interface LessonRoomAccessFailure {
  redirectPath: string;
  status: number;
  error: string;
}

function getInitialLessonRoomStatus(
  lessonStatus: TutorStudentLesson["status"],
): LessonRoomStatus {
  if (lessonStatus === "cancelled") {
    return "archived";
  }

  return "scheduled";
}

async function ensureLessonRoomSession(
  lessonId: string,
  actorUserId: string,
  lessonStatus: TutorStudentLesson["status"],
) {
  const supabaseAdmin = createAdminClient();

  const { data: existingSession, error: existingSessionError } =
    await supabaseAdmin
      .from("lesson_room_sessions")
      .select("*")
      .eq("lesson_id", lessonId)
      .maybeSingle();

  if (existingSessionError) {
    throw existingSessionError;
  }

  if (existingSession) {
    return existingSession;
  }

  const nowIso = new Date().toISOString();
  const insertPayload: Database["public"]["Tables"]["lesson_room_sessions"]["Insert"] = {
    lesson_id: lessonId,
    provider: "livekit",
    provider_room_key: `lesson-${lessonId}`,
    room_status: getInitialLessonRoomStatus(lessonStatus),
    recording_consent_status: "pending",
    recording_status: "idle",
    transcript_status: "idle",
    created_by: actorUserId,
    updated_at: nowIso,
  };

  const { data: createdSession, error: createdSessionError } =
    await supabaseAdmin
      .from("lesson_room_sessions")
      .insert(insertPayload)
      .select("*")
      .single();

  if (!createdSessionError && createdSession) {
    return createdSession;
  }

  const { data: fallbackSession, error: fallbackSessionError } =
    await supabaseAdmin
      .from("lesson_room_sessions")
      .select("*")
      .eq("lesson_id", lessonId)
      .maybeSingle();

  if (fallbackSessionError) {
    throw fallbackSessionError;
  }

  if (fallbackSession) {
    return fallbackSession;
  }

  throw createdSessionError ?? new Error("Failed to initialize lesson room");
}

async function resolveLessonRoomAccess(
  lessonId: string,
): Promise<LessonRoomAccessData | LessonRoomAccessFailure> {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      redirectPath: "/login",
      status: 401,
      error: "Unauthorized",
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      redirectPath: "/lessons",
      status: 401,
      error: "Unauthorized",
    };
  }

  const role = profile.role as Role;

  if (role !== "student" && role !== "tutor") {
    return {
      redirectPath: "/dashboard",
      status: 403,
      error: "Forbidden",
    };
  }

  const { data: lesson, error: lessonError } = await supabaseAdmin
    .from("tutor_student_lessons")
    .select(
      "id, tutor_id, student_id, title, lesson_date, start_time, end_time, notes, status, price_cents, created_at, updated_at, tutor_profile:profiles!tutor_student_lessons_tutor_id_fkey(full_name, email), student_profile:profiles!tutor_student_lessons_student_id_fkey(full_name, email)",
    )
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonError || !lesson) {
    return {
      redirectPath: "/lessons",
      status: 404,
      error: "Lesson not found",
    };
  }

  const hasAccess =
    (role === "tutor" && lesson.tutor_id === user.id) ||
    (role === "student" && lesson.student_id === user.id);

  if (!hasAccess) {
    return {
      redirectPath: "/lessons",
      status: 403,
      error: "You do not have access to this lesson room",
    };
  }

  const session = await ensureLessonRoomSession(
    lesson.id,
    user.id,
    lesson.status,
  );

  return {
    userId: user.id,
    role,
    lesson: lesson as LessonRoomLessonRow,
    session,
  };
}

export async function getLessonRoomAccess(
  lessonId: string,
): Promise<LessonRoomAccessData> {
  const access = await resolveLessonRoomAccess(lessonId);

  if ("redirectPath" in access) {
    redirect(access.redirectPath);
  }

  return access;
}

export async function requireLessonRoomParticipantAccess(lessonId: string) {
  const access = await resolveLessonRoomAccess(lessonId);

  if ("redirectPath" in access) {
    return {
      errorResponse: NextResponse.json(
        { error: access.error },
        { status: access.status },
      ),
    };
  }

  return access;
}