import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";

const toggleSchema = z.object({
  topicKey: z.string().trim().min(1),
  marked: z.boolean(),
});

async function requireTutorAccess(studentId: string) {
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

  if (profileError || !profile) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  if (profile.role !== "tutor" && profile.role !== "superadmin") {
    return {
      errorResponse: NextResponse.json(
        { error: "Only tutors can manage grammar topic mastery" },
        { status: 403 },
      ),
    };
  }

  if (profile.role !== "superadmin") {
    const hasAccess = await tutorHasStudentAccess(
      supabaseAdmin,
      user.id,
      studentId,
    );

    if (!hasAccess) {
      return {
        errorResponse: NextResponse.json(
          { error: "You do not have access to this student" },
          { status: 403 },
        ),
      };
    }
  }

  return { supabaseAdmin, user };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const access = await requireTutorAccess(studentId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = toggleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { topicKey, marked } = parsed.data;

  if (marked) {
    const { error } = await access.supabaseAdmin
      .from("student_grammar_topic_mastery")
      .upsert(
        {
          student_id: studentId,
          topic_key: topicKey,
          source: "tutor",
          tutor_id: access.user.id,
        },
        { onConflict: "student_id,topic_key" },
      );

    if (error) {
      console.error("Toggle grammar topic mastery error:", error);
      return NextResponse.json(
        { error: "Failed to mark grammar topic" },
        { status: 500 },
      );
    }
  } else {
    const { error } = await access.supabaseAdmin
      .from("student_grammar_topic_mastery")
      .delete()
      .eq("student_id", studentId)
      .eq("topic_key", topicKey)
      .eq("source", "tutor");

    if (error) {
      console.error("Toggle grammar topic mastery error:", error);
      return NextResponse.json(
        { error: "Failed to unmark grammar topic" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true, topicKey, marked });
}
