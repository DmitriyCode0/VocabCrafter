import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const coverageSchema = z.object({
  studentId: z.string().uuid(),
  topicId: z.string().uuid(),
});

async function requireTutor() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "tutor") {
    return {
      errorResponse: NextResponse.json({ error: "Only tutors can manage covered topics" }, { status: 403 }),
    };
  }

  return { supabaseAdmin, user };
}

async function parseBody(request: NextRequest) {
  const parsed = coverageSchema.safeParse(await request.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

export async function POST(request: NextRequest) {
  const access = await requireTutor();
  if ("errorResponse" in access) return access.errorResponse;

  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: connection } = await access.supabaseAdmin
    .from("tutor_students")
    .select("id")
    .eq("tutor_id", access.user.id)
    .eq("student_id", body.studentId)
    .eq("status", "active")
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: "Student is not connected" }, { status: 403 });
  }

  const { error } = await access.supabaseAdmin
    .from("tutor_student_lesson_topics")
    .upsert({
      tutor_id: access.user.id,
      student_id: body.studentId,
      topic_id: body.topicId,
    });

  if (error) {
    console.error("Cover lesson topic error:", error);
    return NextResponse.json({ error: "Failed to mark topic covered" }, { status: 500 });
  }

  return NextResponse.json({ covered: true });
}

export async function DELETE(request: NextRequest) {
  const access = await requireTutor();
  if ("errorResponse" in access) return access.errorResponse;

  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { error } = await access.supabaseAdmin
    .from("tutor_student_lesson_topics")
    .delete()
    .eq("tutor_id", access.user.id)
    .eq("student_id", body.studentId)
    .eq("topic_id", body.topicId);

  if (error) {
    console.error("Uncover lesson topic error:", error);
    return NextResponse.json({ error: "Failed to unmark topic" }, { status: 500 });
  }

  return NextResponse.json({ covered: false });
}