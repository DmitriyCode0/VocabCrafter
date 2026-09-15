import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LESSON_LIBRARY } from "@/lib/lesson-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  studentId: z.string().uuid(),
  lessonKey: z.string().min(1),
  completed: z.boolean(),
});

async function getTutor() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "tutor") {
    return { error: NextResponse.json({ error: "Only tutors can manage lesson library progress" }, { status: 403 }) };
  }

  return { user, supabaseAdmin };
}

async function hasActiveConnection(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  tutorId: string,
  studentId: string,
) {
  const { data } = await supabaseAdmin
    .from("tutor_students")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  return Boolean(data);
}

export async function GET(request: NextRequest) {
  const tutor = await getTutor();
  if ("error" in tutor) return tutor.error;

  const studentId = request.nextUrl.searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  if (!(await hasActiveConnection(tutor.supabaseAdmin, tutor.user.id, studentId))) {
    return NextResponse.json({ error: "Student is not connected" }, { status: 403 });
  }

  const { data, error } = await tutor.supabaseAdmin
    .from("tutor_student_lesson_library")
    .select("lesson_key")
    .eq("tutor_id", tutor.user.id)
    .eq("student_id", studentId);

  if (error) {
    return NextResponse.json({ error: "Failed to load lesson library progress" }, { status: 500 });
  }

  return NextResponse.json({ completedLessonKeys: data.map((item) => item.lesson_key) });
}

export async function PATCH(request: NextRequest) {
  const tutor = await getTutor();
  if ("error" in tutor) return tutor.error;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !LESSON_LIBRARY.some((lesson) => lesson.key === parsed.data?.lessonKey)) {
    return NextResponse.json({ error: "Invalid lesson library update" }, { status: 400 });
  }

  const { studentId, lessonKey, completed } = parsed.data;
  if (!(await hasActiveConnection(tutor.supabaseAdmin, tutor.user.id, studentId))) {
    return NextResponse.json({ error: "Student is not connected" }, { status: 403 });
  }

  const query = completed
    ? tutor.supabaseAdmin.from("tutor_student_lesson_library").upsert(
        { tutor_id: tutor.user.id, student_id: studentId, lesson_key: lessonKey },
        { onConflict: "tutor_id,student_id,lesson_key" },
      )
    : tutor.supabaseAdmin
        .from("tutor_student_lesson_library")
        .delete()
        .eq("tutor_id", tutor.user.id)
        .eq("student_id", studentId)
        .eq("lesson_key", lessonKey);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to save lesson library progress" }, { status: 500 });
  }

  return NextResponse.json({ lessonKey, completed });
}