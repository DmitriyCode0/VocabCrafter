import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";

const updateMasterySchema = z
  .object({
    masteryLevel: z.number().int().min(0).max(5).optional(),
    correctCount: z.number().int().min(0).optional(),
    incorrectCount: z.number().int().min(0).optional(),
    translationCorrectCount: z.number().int().min(0).optional(),
    streak: z.number().int().min(0).optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "At least one field must be provided",
    },
  );

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: masteryRow, error: masteryError } = await supabaseAdmin
      .from("word_mastery")
      .select("id, student_id")
      .eq("id", id)
      .maybeSingle();

    if (masteryError) {
      return NextResponse.json(
        { error: masteryError.message },
        { status: 500 },
      );
    }

    if (!masteryRow) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isOwner = masteryRow.student_id === user.id;
    const isTutor = profile.role === "tutor";
    const isSuperadmin = profile.role === "superadmin";

    if (!isOwner && !isTutor && !isSuperadmin) {
      return NextResponse.json(
        { error: "You do not have permission to delete this word" },
        { status: 403 },
      );
    }

    if (
      !isOwner &&
      isTutor &&
      !(await tutorHasStudentAccess(
        supabaseAdmin,
        user.id,
        masteryRow.student_id,
      ))
    ) {
      return NextResponse.json(
        { error: "You do not have access to this student" },
        { status: 403 },
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("word_mastery")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete mastery word error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (profile.role !== "tutor" && profile.role !== "superadmin") {
      return NextResponse.json(
        { error: "Only tutors can edit mastery values" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = updateMasterySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: masteryRow, error: masteryError } = await supabaseAdmin
      .from("word_mastery")
      .select("id, student_id")
      .eq("id", id)
      .maybeSingle();

    if (masteryError) {
      return NextResponse.json(
        { error: masteryError.message },
        { status: 500 },
      );
    }

    if (!masteryRow) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }

    if (
      profile.role !== "superadmin" &&
      !(await tutorHasStudentAccess(
        supabaseAdmin,
        user.id,
        masteryRow.student_id,
      ))
    ) {
      return NextResponse.json(
        { error: "You do not have access to this student" },
        { status: 403 },
      );
    }

    const updates = {
      mastery_level: parsed.data.masteryLevel,
      correct_count: parsed.data.correctCount,
      incorrect_count: parsed.data.incorrectCount,
      translation_correct_count: parsed.data.translationCorrectCount,
      streak: parsed.data.streak,
    };

    const { data: updatedRow, error: updateError } = await supabaseAdmin
      .from("word_mastery")
      .update(updates)
      .eq("id", id)
      .select(
        "id, term, definition, mastery_level, correct_count, incorrect_count, translation_correct_count, streak, last_practiced, next_review",
      )
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ word: updatedRow });
  } catch (error) {
    console.error("Update mastery word error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
