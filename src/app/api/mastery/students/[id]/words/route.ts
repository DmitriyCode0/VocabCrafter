import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: studentId } = await params;
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

    const isOwner = user.id === studentId;
    const isTutor = profile.role === "tutor";
    const isSuperadmin = profile.role === "superadmin";

    if (!isOwner && !isTutor && !isSuperadmin) {
      return NextResponse.json(
        { error: "You do not have permission to view these words" },
        { status: 403 },
      );
    }

    const supabaseAdmin = createAdminClient();

    if (
      !isOwner &&
      isTutor &&
      !(await tutorHasStudentAccess(supabaseAdmin, user.id, studentId))
    ) {
      return NextResponse.json(
        { error: "You do not have access to this student" },
        { status: 403 },
      );
    }

    const { data: words, error } = await supabaseAdmin
      .from("word_mastery")
      .select(
        "id, term, definition, mastery_level, correct_count, incorrect_count, translation_correct_count, streak, last_practiced",
      )
      .eq("student_id", studentId)
      .order("mastery_level", { ascending: true })
      .order("last_practiced", { ascending: false, nullsFirst: true })
      .order("term", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ words: words ?? [] });
  } catch (error) {
    console.error("Fetch student mastery words error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
