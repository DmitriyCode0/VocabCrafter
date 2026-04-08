import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { LESSON_STATUSES } from "@/lib/lessons";

const timeSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  .nullable()
  .optional();

const updateLessonSchema = z
  .object({
    studentId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: timeSchema,
    endTime: timeSchema,
    notes: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(LESSON_STATUSES),
  })
  .refine(
    (value) => !value.startTime || !value.endTime || value.endTime > value.startTime,
    {
      message: "End time must be after start time",
      path: ["endTime"],
    },
  );

async function requireOwnedLessonAccess(lessonId: string) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "tutor") {
    return {
      errorResponse: NextResponse.json(
        { error: "Only tutors can manage lessons" },
        { status: 403 },
      ),
    };
  }

  const { data: lesson, error: lessonError } = await supabaseAdmin
    .from("tutor_student_lessons")
    .select("id, tutor_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonError) {
    return {
      errorResponse: NextResponse.json(
        { error: "Failed to load lesson" },
        { status: 500 },
      ),
    };
  }

  if (!lesson) {
    return {
      errorResponse: NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 },
      ),
    };
  }

  if (lesson.tutor_id !== user.id) {
    return {
      errorResponse: NextResponse.json(
        { error: "You do not have access to this lesson" },
        { status: 403 },
      ),
    };
  }

  return { supabaseAdmin, user };
}

async function validateConnectedStudent(
  tutorId: string,
  studentId: string,
  supabaseAdmin = createAdminClient(),
) {
  const { data: connection, error } = await supabaseAdmin
    .from("tutor_students")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(connection);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireOwnedLessonAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateLessonSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const hasConnection = await validateConnectedStudent(
      access.user.id,
      parsed.data.studentId,
      access.supabaseAdmin,
    );

    if (!hasConnection) {
      return NextResponse.json(
        { error: "You can only assign lessons to connected students" },
        { status: 403 },
      );
    }

    const { data, error } = await access.supabaseAdmin
      .from("tutor_student_lessons")
      .update({
        student_id: parsed.data.studentId,
        title: parsed.data.title,
        lesson_date: parsed.data.lessonDate,
        start_time: parsed.data.startTime ?? null,
        end_time: parsed.data.endTime ?? null,
        notes: parsed.data.notes ?? null,
        status: parsed.data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update lesson error:", error);
      return NextResponse.json(
        { error: "Failed to update lesson" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Validate lesson connection error:", error);
    return NextResponse.json(
      { error: "Failed to validate tutor/student connection" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireOwnedLessonAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const { error } = await access.supabaseAdmin
    .from("tutor_student_lessons")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete lesson error:", error);
    return NextResponse.json(
      { error: "Failed to delete lesson" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}