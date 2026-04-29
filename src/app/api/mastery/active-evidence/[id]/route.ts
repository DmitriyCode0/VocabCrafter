import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";
import { createClient } from "@/lib/supabase/server";

async function requireActiveEvidenceAccess(evidenceId: string) {
  const supabase = await createClient();
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

  const supabaseAdmin = createAdminClient();
  const { data: evidenceRow, error: evidenceError } = await supabaseAdmin
    .from("active_vocabulary_evidence")
    .select("id, student_id")
    .eq("id", evidenceId)
    .maybeSingle();

  if (evidenceError) {
    return {
      errorResponse: NextResponse.json(
        { error: evidenceError.message },
        { status: 500 },
      ),
    };
  }

  if (!evidenceRow) {
    return {
      errorResponse: NextResponse.json(
        { error: "Active evidence not found" },
        { status: 404 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
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

  const isOwner = evidenceRow.student_id === user.id;
  const isTutor = profile.role === "tutor";
  const isSuperadmin = profile.role === "superadmin";

  if (!isOwner && !isTutor && !isSuperadmin) {
    return {
      errorResponse: NextResponse.json(
        { error: "You do not have permission to manage this active evidence" },
        { status: 403 },
      ),
    };
  }

  if (
    !isOwner &&
    isTutor &&
    !(await tutorHasStudentAccess(
      supabaseAdmin,
      user.id,
      evidenceRow.student_id,
    ))
  ) {
    return {
      errorResponse: NextResponse.json(
        { error: "You do not have access to this student" },
        { status: 403 },
      ),
    };
  }

  return { supabaseAdmin };
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireActiveEvidenceAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const { error } = await access.supabaseAdmin
    .from("active_vocabulary_evidence")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete active evidence error:", error);
    return NextResponse.json(
      { error: "Failed to delete active evidence" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}