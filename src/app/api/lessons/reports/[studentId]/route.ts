import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const lessonReportQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

async function requireTutorStudentConnection(studentId: string) {
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
        { error: "Only tutors can generate lesson reports" },
        { status: 403 },
      ),
    };
  }

  const { data: connection, error: connectionError } = await supabaseAdmin
    .from("tutor_students")
    .select("id")
    .eq("tutor_id", user.id)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (connectionError) {
    console.error("Load lesson report connection error:", connectionError);
    return {
      errorResponse: NextResponse.json(
        { error: "Failed to load tutor/student connection" },
        { status: 500 },
      ),
    };
  }

  if (!connection) {
    return {
      errorResponse: NextResponse.json(
        { error: "Connected student not found" },
        { status: 404 },
      ),
    };
  }

  return { user, supabaseAdmin };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const access = await requireTutorStudentConnection(studentId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const parsedQuery = lessonReportQuerySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  const { data: lessons, error } = await access.supabaseAdmin
    .from("tutor_student_lessons")
    .select("id, title, lesson_date, start_time, end_time")
    .eq("tutor_id", access.user.id)
    .eq("student_id", studentId)
    .eq("status", "completed")
    .order("lesson_date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(parsedQuery.data.limit);

  if (error) {
    console.error("Load lesson report lessons error:", error);
    return NextResponse.json(
      { error: "Failed to load lessons for the report" },
      { status: 500 },
    );
  }

  return NextResponse.json({ lessons: lessons ?? [] });
}