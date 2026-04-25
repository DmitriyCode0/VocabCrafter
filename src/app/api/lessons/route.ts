import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { syncLessonToGoogleCalendar } from "@/lib/google-calendar";
import { LESSON_STATUSES } from "@/lib/lessons";

const lessonTitleSchema = z
  .union([z.string().trim().max(200), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  });

const timeSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  .nullable()
  .optional();

const createLessonSchema = z
  .object({
    studentId: z.string().uuid().nullable().optional(),
    title: lessonTitleSchema,
    lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: timeSchema,
    endTime: timeSchema,
    notes: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(LESSON_STATUSES).default("completed"),
    priceCents: z.number().int().nonnegative().optional(),
  })
  .refine(
    (value) =>
      !value.startTime || !value.endTime || value.endTime > value.startTime,
    {
      message: "End time must be after start time",
      path: ["endTime"],
    },
  );

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "tutor") {
    return NextResponse.json(
      { error: "Only tutors can create lessons" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createLessonSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let connection: { id: string; lesson_price_cents: number } | null = null;

  if (parsed.data.studentId) {
    const { data: connectionData, error: connectionError } = await supabaseAdmin
      .from("tutor_students")
      .select("id, lesson_price_cents")
      .eq("tutor_id", user.id)
      .eq("student_id", parsed.data.studentId)
      .eq("status", "active")
      .maybeSingle();

    if (connectionError) {
      console.error("Lesson connection check error:", connectionError);
      return NextResponse.json(
        { error: "Failed to validate tutor/student connection" },
        { status: 500 },
      );
    }

    if (!connectionData) {
      return NextResponse.json(
        { error: "You can only add lessons for connected students" },
        { status: 403 },
      );
    }

    connection = connectionData;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("tutor_student_lessons")
    .insert({
      tutor_id: user.id,
      student_id: parsed.data.studentId ?? null,
      title: parsed.data.title,
      lesson_date: parsed.data.lessonDate,
      start_time: parsed.data.startTime ?? null,
      end_time: parsed.data.endTime ?? null,
      notes: parsed.data.notes ?? null,
      status: parsed.data.status,
      price_cents:
        parsed.data.priceCents ?? connection?.lesson_price_cents ?? 0,
      updated_at: nowIso,
    })
    .select()
    .single();

  if (error) {
    console.error("Create lesson error:", error);
    return NextResponse.json(
      { error: "Failed to create lesson" },
      { status: 500 },
    );
  }

  const calendarSync = await syncLessonToGoogleCalendar({
    lessonId: data.id,
    tutorId: user.id,
    supabaseAdmin,
  });

  return NextResponse.json({ ...data, calendarSync }, { status: 201 });
}
