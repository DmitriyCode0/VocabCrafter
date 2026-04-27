import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
        { error: "You do not have permission to view this active evidence" },
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

    const { data: items, error } = await supabaseAdmin
      .from("active_vocabulary_evidence")
      .select(
        "id, term, source_type, source_label, usage_count, first_used_at, last_used_at, passive_vocabulary_library:passive_vocabulary_library!active_vocabulary_evidence_library_item_id_fkey(cefr_level, part_of_speech)",
      )
      .eq("student_id", studentId)
      .order("last_used_at", { ascending: false })
      .order("term", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: items ?? [] });
  } catch (error) {
    console.error("Fetch active evidence error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
