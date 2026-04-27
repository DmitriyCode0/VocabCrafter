import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EMPTY_TUTOR_PROGRESS_OVERRIDE,
  hasTutorProgressOverrideContent,
  parseTutorProgressOverride,
  tutorTimeAdjustmentHoursSchema,
} from "@/lib/progress/contracts";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";
import { createClient } from "@/lib/supabase/server";

const updateTutorTimeLoggedSchema = z.object({
  timeAdjustmentHours: tutorTimeAdjustmentHoursSchema,
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
        { error: "Only tutors can update student time logged" },
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
  const parsed = updateTutorTimeLoggedSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: existingRow, error: existingError } = await access.supabaseAdmin
    .from("tutor_student_progress_overrides")
    .select(
      "axis_overrides, insights_override, monthly_target_overrides, time_adjustment_hours",
    )
    .eq("tutor_id", access.user.id)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existingError) {
    console.error("Load tutor time adjustment error:", existingError);
    return NextResponse.json(
      { error: "Failed to load existing progress override" },
      { status: 500 },
    );
  }

  const existingOverride = parseTutorProgressOverride(existingRow);
  const nextOverride = {
    ...existingOverride,
    timeAdjustmentHours: parsed.data.timeAdjustmentHours,
  };

  if (!hasTutorProgressOverrideContent(nextOverride)) {
    if (existingRow) {
      const { error: deleteError } = await access.supabaseAdmin
        .from("tutor_student_progress_overrides")
        .delete()
        .eq("tutor_id", access.user.id)
        .eq("student_id", studentId);

      if (deleteError) {
        console.error("Delete tutor time adjustment error:", deleteError);
        return NextResponse.json(
          { error: "Failed to clear time adjustment" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(EMPTY_TUTOR_PROGRESS_OVERRIDE);
  }

  const { data, error } = await access.supabaseAdmin
    .from("tutor_student_progress_overrides")
    .upsert(
      {
        tutor_id: access.user.id,
        student_id: studentId,
        time_adjustment_hours: parsed.data.timeAdjustmentHours,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tutor_id,student_id" },
    )
    .select(
      "axis_overrides, insights_override, monthly_target_overrides, time_adjustment_hours",
    )
    .single();

  if (error) {
    console.error("Save tutor time adjustment error:", error);
    return NextResponse.json(
      { error: "Failed to update time logged" },
      { status: 500 },
    );
  }

  return NextResponse.json(parseTutorProgressOverride(data));
}