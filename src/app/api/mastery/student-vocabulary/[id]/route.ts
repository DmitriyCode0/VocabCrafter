import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteStudentVocabularyItem,
  updateStudentVocabularyItem,
} from "@/lib/mastery/student-vocabulary-state";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";
import { createClient } from "@/lib/supabase/server";

const updateStudentVocabularySchema = z
  .object({
    group: z
      .enum(["passive_only", "active_and_passive", "learning"])
      .optional(),
    customDefinition: z.string().max(400).nullable().optional(),
  })
  .refine(
    (value) => value.group !== undefined || value.customDefinition !== undefined,
    {
      message: "At least one field must be provided",
    },
  );

async function requireStudentVocabularyAccess(rowId: string) {
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
  const { data: vocabularyRow, error: vocabularyError } = await supabaseAdmin
    .from("student_vocabulary_items")
    .select(
      "id, student_id, library_item_id, term, normalized_term, item_type, current_state, group_override, custom_definition, has_active_evidence, has_passive_evidence, moved_to_learning_at, learning_archived_at, created_at, updated_at",
    )
    .eq("id", rowId)
    .maybeSingle();

  if (vocabularyError) {
    return {
      errorResponse: NextResponse.json(
        { error: vocabularyError.message },
        { status: 500 },
      ),
    };
  }

  if (!vocabularyRow) {
    return {
      errorResponse: NextResponse.json(
        { error: "Student vocabulary item not found" },
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

  const isOwner = vocabularyRow.student_id === user.id;
  const isTutor = profile.role === "tutor";
  const isSuperadmin = profile.role === "superadmin";

  if (!isOwner && !isTutor && !isSuperadmin) {
    return {
      errorResponse: NextResponse.json(
        {
          error: "You do not have permission to manage this student vocabulary item",
        },
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
      vocabularyRow.student_id,
    ))
  ) {
    return {
      errorResponse: NextResponse.json(
        { error: "You do not have access to this student" },
        { status: 403 },
      ),
    };
  }

  return { supabaseAdmin, vocabularyRow };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireStudentVocabularyAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateStudentVocabularySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updatedRow = await updateStudentVocabularyItem({
      adminClient: access.supabaseAdmin,
      rowId: access.vocabularyRow.id,
      group: parsed.data.group,
      customDefinition: parsed.data.customDefinition,
    });

    return NextResponse.json({ item: updatedRow, deleted: updatedRow === null });
  } catch (error) {
    console.error("Update student vocabulary item error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update student vocabulary item",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireStudentVocabularyAccess(id);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  try {
    await deleteStudentVocabularyItem({
      adminClient: access.supabaseAdmin,
      rowId: access.vocabularyRow.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete student vocabulary item error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete student vocabulary item",
      },
      { status: 500 },
    );
  }
}