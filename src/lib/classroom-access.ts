import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database, TutorStudentClassroom } from "@/types/database";
import type { Role } from "@/types/roles";

interface ClassroomConnectionRow {
  id: string;
  tutor_id: string;
  student_id: string;
  status: string;
  connected_at: string | null;
  tutor_profile: {
    full_name: string | null;
    email: string | null;
  } | null;
  student_profile: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface ClassroomConnectionOption {
  id: string;
  tutorId: string;
  studentId: string;
  connectedAt: string | null;
  tutorProfile: {
    fullName: string | null;
    email: string | null;
  } | null;
  studentProfile: {
    fullName: string | null;
    email: string | null;
  } | null;
}

export interface TutorStudentClassroomAccessData {
  userId: string;
  role: Role;
  connection: ClassroomConnectionRow;
  classroom: TutorStudentClassroom;
}

interface ClassroomAccessFailure {
  redirectPath: string;
  status: number;
  error: string;
}

function mapConnectionRowToOption(
  row: ClassroomConnectionRow,
): ClassroomConnectionOption {
  return {
    id: row.id,
    tutorId: row.tutor_id,
    studentId: row.student_id,
    connectedAt: row.connected_at,
    tutorProfile: row.tutor_profile
      ? {
          fullName: row.tutor_profile.full_name,
          email: row.tutor_profile.email,
        }
      : null,
    studentProfile: row.student_profile
      ? {
          fullName: row.student_profile.full_name,
          email: row.student_profile.email,
        }
      : null,
  };
}

export function getClassroomParticipantName(
  role: Role,
  connection: ClassroomConnectionOption,
) {
  return role === "tutor"
    ? connection.studentProfile?.fullName ||
        connection.studentProfile?.email ||
        "Student"
    : connection.tutorProfile?.fullName ||
        connection.tutorProfile?.email ||
        "Tutor";
}

export async function listTutorStudentClassroomConnectionsForUser(
  userId: string,
  role: Role,
): Promise<ClassroomConnectionOption[]> {
  const supabaseAdmin = createAdminClient();
  const query = supabaseAdmin
    .from("tutor_students")
    .select(
      "id, tutor_id, student_id, status, connected_at, tutor_profile:profiles!tutor_students_tutor_id_fkey(full_name, email), student_profile:profiles!tutor_students_student_id_fkey(full_name, email)",
    )
    .eq("status", "active")
    .order("connected_at", { ascending: false });

  const scopedQuery =
    role === "tutor" ? query.eq("tutor_id", userId) : query.eq("student_id", userId);
  const { data, error } = await scopedQuery;

  if (error) {
    throw error;
  }

  return ((data ?? []) as ClassroomConnectionRow[]).map(mapConnectionRowToOption);
}

async function ensureTutorStudentClassroom(
  connectionId: string,
  actorUserId: string,
) {
  const supabaseAdmin = createAdminClient();
  const { data: existingClassroom, error: existingClassroomError } =
    await supabaseAdmin
      .from("tutor_student_classrooms")
      .select("*")
      .eq("connection_id", connectionId)
      .maybeSingle();

  if (existingClassroomError) {
    throw existingClassroomError;
  }

  if (existingClassroom) {
    return existingClassroom;
  }

  const nowIso = new Date().toISOString();
  const insertPayload: Database["public"]["Tables"]["tutor_student_classrooms"]["Insert"] = {
    connection_id: connectionId,
    provider: "livekit",
    provider_room_key: `classroom-${connectionId}`,
    room_status: "open",
    created_by: actorUserId,
    last_activity_at: nowIso,
    updated_at: nowIso,
  };

  const { data: createdClassroom, error: createdClassroomError } =
    await supabaseAdmin
      .from("tutor_student_classrooms")
      .insert(insertPayload)
      .select("*")
      .single();

  if (!createdClassroomError && createdClassroom) {
    return createdClassroom;
  }

  const { data: fallbackClassroom, error: fallbackClassroomError } =
    await supabaseAdmin
      .from("tutor_student_classrooms")
      .select("*")
      .eq("connection_id", connectionId)
      .maybeSingle();

  if (fallbackClassroomError) {
    throw fallbackClassroomError;
  }

  if (fallbackClassroom) {
    return fallbackClassroom;
  }

  throw createdClassroomError ?? new Error("Failed to initialize classroom");
}

async function resolveTutorStudentClassroomAccess(
  connectionId: string,
): Promise<TutorStudentClassroomAccessData | ClassroomAccessFailure> {
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
      redirectPath: "/lessons/classroom",
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

  const { data: connection, error: connectionError } = await supabaseAdmin
    .from("tutor_students")
    .select(
      "id, tutor_id, student_id, status, connected_at, tutor_profile:profiles!tutor_students_tutor_id_fkey(full_name, email), student_profile:profiles!tutor_students_student_id_fkey(full_name, email)",
    )
    .eq("id", connectionId)
    .eq("status", "active")
    .maybeSingle();

  if (connectionError || !connection) {
    return {
      redirectPath: "/lessons/classroom",
      status: 404,
      error: "Classroom connection not found",
    };
  }

  const hasAccess =
    (role === "tutor" && connection.tutor_id === user.id) ||
    (role === "student" && connection.student_id === user.id);

  if (!hasAccess) {
    return {
      redirectPath: "/lessons/classroom",
      status: 403,
      error: "You do not have access to this classroom",
    };
  }

  const classroom = await ensureTutorStudentClassroom(connection.id, user.id);

  return {
    userId: user.id,
    role,
    connection: connection as ClassroomConnectionRow,
    classroom,
  };
}

export async function getTutorStudentClassroomAccess(
  connectionId: string,
): Promise<TutorStudentClassroomAccessData> {
  const access = await resolveTutorStudentClassroomAccess(connectionId);

  if ("redirectPath" in access) {
    redirect(access.redirectPath);
  }

  return access;
}

export async function requireTutorStudentClassroomParticipantAccess(
  connectionId: string,
) {
  const access = await resolveTutorStudentClassroomAccess(connectionId);

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