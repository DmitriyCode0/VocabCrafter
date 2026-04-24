import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";
import { createClient } from "@/lib/supabase/server";

const updateAttemptTimeSchema = z.object({
  timeSpentSeconds: z.number().int().min(0),
});

async function requireTutorAttemptAccess(attemptId: string) {
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
        { error: "Only tutors can edit student app time" },
        { status: 403 },
      ),
    };
  }

  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("quiz_attempts")
    .select("id, student_id, time_spent_seconds")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) {
    return {
      errorResponse: NextResponse.json(
        { error: attemptError.message },
        { status: 500 },
      ),
    };
  }

  if (!attempt) {
    return {
      errorResponse: NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 },
      ),
    };
  }

  if (profile.role !== "superadmin") {
    if (attempt.student_id === user.id) {
      return {
        errorResponse: NextResponse.json(
          { error: "Tutors can only edit student attempts" },
          { status: 403 },
        ),
      };
    }

    const hasStudentAccess = await tutorHasStudentAccess(
      supabaseAdmin,
      user.id,
      attempt.student_id,
    );

    if (!hasStudentAccess) {
      return {
        errorResponse: NextResponse.json(
          { error: "You do not have access to this attempt" },
          { status: 403 },
        ),
      };
    }
  }

  return {
    supabaseAdmin,
    attempt,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await params;
  const access = await requireTutorAttemptAccess(attemptId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateAttemptTimeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await access.supabaseAdmin
    .from("quiz_attempts")
    .update({ time_spent_seconds: parsed.data.timeSpentSeconds })
    .eq("id", access.attempt.id)
    .select("id, time_spent_seconds")
    .single();

  if (error) {
    console.error("Update attempt time error:", error);
    return NextResponse.json(
      { error: "Failed to update app time" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: data.id,
    timeSpentSeconds: data.time_spent_seconds,
  });
}