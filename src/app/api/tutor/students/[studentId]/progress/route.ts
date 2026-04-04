import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";
import {
  EMPTY_TUTOR_PROGRESS_OVERRIDE,
  parseTutorProgressOverride,
  tutorProgressOverrideSchema,
} from "@/lib/progress/contracts";

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
        { error: "Only tutors can manage student progress overrides" },
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

  return {
    supabaseAdmin,
    user,
  };
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
  const parsed = tutorProgressOverrideSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await access.supabaseAdmin
    .from("tutor_student_progress_overrides")
    .upsert(
      {
        tutor_id: access.user.id,
        student_id: studentId,
        axis_overrides: parsed.data.axisOverrides,
        insights_override: parsed.data.insightsOverride,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tutor_id,student_id" },
    )
    .select("axis_overrides, insights_override")
    .single();

  if (error) {
    console.error("Save tutor progress override error:", error);
    return NextResponse.json(
      { error: "Failed to save tutor progress overrides" },
      { status: 500 },
    );
  }

  return NextResponse.json(parseTutorProgressOverride(data));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const access = await requireTutorAccess(studentId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const { error } = await access.supabaseAdmin
    .from("tutor_student_progress_overrides")
    .delete()
    .eq("tutor_id", access.user.id)
    .eq("student_id", studentId);

  if (error) {
    console.error("Delete tutor progress override error:", error);
    return NextResponse.json(
      { error: "Failed to reset tutor progress overrides" },
      { status: 500 },
    );
  }

  return NextResponse.json(EMPTY_TUTOR_PROGRESS_OVERRIDE);
}
