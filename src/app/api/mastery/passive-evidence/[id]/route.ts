import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";
import { createClient } from "@/lib/supabase/server";
import { normalizePassiveVocabularyText } from "@/lib/mastery/passive-vocabulary";

const updatePassiveEvidenceSchema = z.object({
  term: z.string().trim().min(1).max(200),
  definition: z.string().trim().max(400).nullable().optional(),
  itemType: z.enum(["word", "phrase"]),
  sourceType: z.enum(["full_text", "manual_list", "curated_list"]),
  sourceLabel: z.string().trim().max(160).nullable().optional(),
  confidence: z.number().int().min(1).max(5),
});

async function requirePassiveEvidenceAccess(evidenceId: string) {
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
    .from("passive_vocabulary_evidence")
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
        { error: "Passive evidence not found" },
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
        { error: "You do not have permission to manage this passive evidence" },
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

  return { user, supabaseAdmin, evidenceRow };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requirePassiveEvidenceAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = updatePassiveEvidenceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const normalizedTerm = normalizePassiveVocabularyText(parsed.data.term);
  const { data: updatedRow, error } = await access.supabaseAdmin
    .from("passive_vocabulary_evidence")
    .update({
      term: parsed.data.term.trim().replace(/\s+/g, " "),
      normalized_term: normalizedTerm,
      definition: parsed.data.definition?.trim() || null,
      item_type: parsed.data.itemType,
      source_type: parsed.data.sourceType,
      source_label: parsed.data.sourceLabel?.trim() || null,
      confidence: parsed.data.confidence,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Update passive evidence error:", error);
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? "A matching passive evidence item already exists"
            : "Failed to update passive evidence",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ evidence: updatedRow });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requirePassiveEvidenceAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const { error } = await access.supabaseAdmin
    .from("passive_vocabulary_evidence")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete passive evidence error:", error);
    return NextResponse.json(
      { error: "Failed to delete passive evidence" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
