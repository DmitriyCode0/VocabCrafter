import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";

const createProgressReviewSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
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
        { error: "Only tutors can manage student progress reviews" },
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const access = await requireTutorAccess(studentId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const { data, error } = await access.supabaseAdmin
    .from("student_progress_reviews")
    .select(
      "id, student_id, tutor_id, content, rating, created_at, updated_at, profiles!student_progress_reviews_tutor_id_fkey(full_name, email)",
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load student progress reviews error:", error);
    return NextResponse.json(
      { error: "Failed to load student progress reviews" },
      { status: 500 },
    );
  }

  return NextResponse.json({ reviews: data ?? [] });
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
  const parsed = createProgressReviewSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await access.supabaseAdmin
    .from("student_progress_reviews")
    .insert({
      student_id: studentId,
      tutor_id: access.user.id,
      content: parsed.data.content,
      rating: parsed.data.rating ?? null,
      updated_at: nowIso,
    })
    .select("id, student_id, tutor_id, content, rating, created_at, updated_at")
    .single();

  if (error) {
    console.error("Create student progress review error:", error);
    return NextResponse.json(
      { error: "Failed to save student progress review" },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
