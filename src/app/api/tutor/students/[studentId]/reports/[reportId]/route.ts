import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";
import {
  monthlyReportUpdateInputSchema,
  updateTutorStudentMonthlyReport,
} from "@/lib/progress/monthly-reports";

async function requireTutorAccess(studentId: string) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
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
        { error: "Only tutors can edit monthly reports" },
        { status: 403 },
      ),
    };
  }

  const hasAccess = await tutorHasStudentAccess(supabaseAdmin, user.id, studentId);

  if (!hasAccess) {
    return {
      errorResponse: NextResponse.json(
        { error: "You do not have access to this student" },
        { status: 403 },
      ),
    };
  }

  return { user };
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ studentId: string; reportId: string }>;
  },
) {
  const { studentId, reportId } = await params;
  const access = await requireTutorAccess(studentId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = monthlyReportUpdateInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const report = await updateTutorStudentMonthlyReport(
      access.user.id,
      studentId,
      reportId,
      parsed.data,
    );

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Save monthly report error:", error);
    return NextResponse.json(
      { error: "Failed to save monthly report" },
      { status: 500 },
    );
  }
}