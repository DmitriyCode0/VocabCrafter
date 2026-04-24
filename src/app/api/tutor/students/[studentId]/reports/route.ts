import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";
import {
  generateTutorStudentMonthlyReport,
  listTutorStudentMonthlyReports,
  monthlyReportGenerationInputSchema,
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
        { error: "Only tutors can manage monthly reports" },
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const access = await requireTutorAccess(studentId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  try {
    const reports = await listTutorStudentMonthlyReports(access.user.id, studentId);
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Load monthly reports error:", error);
    return NextResponse.json(
      { error: "Failed to load monthly reports" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const access = await requireTutorAccess(studentId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = monthlyReportGenerationInputSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await generateTutorStudentMonthlyReport({
      tutorId: access.user.id,
      studentId,
      generatedBy: access.user.id,
      generationSource: "manual",
      forceRegenerate: parsed.data.forceRegenerate,
    });

    if (result.report.status === "quota_blocked") {
      return NextResponse.json(
        { error: result.report.generationError || "Monthly report quota reached" },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        report: result.report,
        quota: result.quota,
        created: result.created,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    console.error("Generate monthly report error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate monthly report";
    const status = message.includes("Set up a plan")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}