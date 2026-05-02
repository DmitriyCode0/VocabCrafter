import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTutorStudentMonthlyReportMetrics } from "@/lib/progress/monthly-reports";
import {
  getTutorStudentPlan,
  normalizeTutorStudentPlanMonth,
  tutorStudentPlanInputSchema,
  updateTutorStudentPlan,
} from "@/lib/progress/tutor-student-plan";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";

function resolvePlanMonth(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  return normalizeTutorStudentPlanMonth(month);
}

function toReferenceDate(planMonth: string) {
  return new Date(`${planMonth}T00:00:00.000Z`);
}

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

  if (
    profileError ||
    !profile ||
    (profile.role !== "tutor" && profile.role !== "superadmin")
  ) {
    return {
      errorResponse: NextResponse.json(
        { error: "Only tutors can manage student plans" },
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

  return { user };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const planMonth = resolvePlanMonth(request);
  const referenceDate = toReferenceDate(planMonth);
  const access = await requireTutorAccess(studentId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  try {
    const [plan, metrics] = await Promise.all([
      getTutorStudentPlan(access.user.id, studentId, { planMonth }),
      getTutorStudentMonthlyReportMetrics(studentId, referenceDate, {
        tutorId: access.user.id,
      }),
    ]);

    return NextResponse.json({ plan, metrics });
  } catch (error) {
    console.error("Load student plan error:", error);
    return NextResponse.json(
      { error: "Failed to load student plan" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const planMonth = resolvePlanMonth(request);
  const referenceDate = toReferenceDate(planMonth);
  const access = await requireTutorAccess(studentId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = tutorStudentPlanInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const [plan, metrics] = await Promise.all([
      updateTutorStudentPlan(access.user.id, studentId, parsed.data, {
        planMonth,
      }),
      getTutorStudentMonthlyReportMetrics(studentId, referenceDate, {
        tutorId: access.user.id,
      }),
    ]);

    return NextResponse.json({ plan, metrics });
  } catch (error) {
    console.error("Save student plan error:", error);
    return NextResponse.json(
      { error: "Failed to save student plan" },
      { status: 500 },
    );
  }
}