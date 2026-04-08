import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const updateLessonPriceSchema = z.object({
  lessonPriceCents: z.number().int().nonnegative(),
});

const createTopUpSchema = z.object({
  amountCents: z.number().int().positive(),
  direction: z.enum(["credit", "debit"]).default("credit"),
  note: z.string().trim().max(500).nullable().optional(),
});

async function requireTutorStudentConnection(studentId: string) {
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

  if (profileError || !profile || profile.role !== "tutor") {
    return {
      errorResponse: NextResponse.json(
        { error: "Only tutors can manage lesson finances" },
        { status: 403 },
      ),
    };
  }

  const { data: connection, error: connectionError } = await supabaseAdmin
    .from("tutor_students")
    .select("id, tutor_id, student_id, lesson_price_cents")
    .eq("tutor_id", user.id)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (connectionError) {
    console.error("Load lesson finance connection error:", connectionError);
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

  return { user, supabaseAdmin, connection };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const access = await requireTutorStudentConnection(studentId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateLessonPriceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await access.supabaseAdmin
    .from("tutor_students")
    .update({ lesson_price_cents: parsed.data.lessonPriceCents })
    .eq("id", access.connection.id)
    .select("id, lesson_price_cents")
    .single();

  if (error) {
    console.error("Update lesson price error:", error);
    return NextResponse.json(
      { error: "Failed to update lesson price" },
      { status: 500 },
    );
  }

  return NextResponse.json({ connection: data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const access = await requireTutorStudentConnection(studentId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = createTopUpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await access.supabaseAdmin
    .from("tutor_student_balance_transactions")
    .insert({
      tutor_id: access.user.id,
      student_id: studentId,
      created_by: access.user.id,
      amount_cents:
        parsed.data.direction === "debit"
          ? -parsed.data.amountCents
          : parsed.data.amountCents,
      note: parsed.data.note ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Create lesson balance top-up error:", error);
    return NextResponse.json(
      { error: "Failed to top up balance" },
      { status: 500 },
    );
  }

  return NextResponse.json({ transaction: data }, { status: 201 });
}
