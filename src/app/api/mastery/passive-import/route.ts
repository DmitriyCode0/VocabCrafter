import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPassiveVocabularyCompositeKey,
  normalizePassiveVocabularyText,
  passiveVocabularyImportSchema,
} from "@/lib/mastery/passive-vocabulary";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";
import { createClient } from "@/lib/supabase/server";

async function resolveTargetStudentId(
  userId: string,
  requestedStudentId: string | undefined,
) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const studentId = requestedStudentId ?? userId;
  if (studentId === userId) {
    return { studentId, supabaseAdmin };
  }

  if (profile.role !== "tutor" && profile.role !== "superadmin") {
    return {
      response: NextResponse.json(
        { error: "You do not have permission to import passive vocabulary" },
        { status: 403 },
      ),
    };
  }

  if (
    profile.role === "tutor" &&
    !(await tutorHasStudentAccess(supabaseAdmin, userId, studentId))
  ) {
    return {
      response: NextResponse.json(
        { error: "You do not have access to this student" },
        { status: 403 },
      ),
    };
  }

  return { studentId, supabaseAdmin };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = passiveVocabularyImportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const authorizedTarget = await resolveTargetStudentId(
      user.id,
      parsed.data.studentId,
    );

    if ("response" in authorizedTarget) {
      return authorizedTarget.response;
    }

    const { studentId, supabaseAdmin } = authorizedTarget;
    const { confidence, sourceLabel, sourceType } = parsed.data;
    const dedupedItems = new Map<
      string,
      {
        term: string;
        definition: string | null;
        normalizedTerm: string;
        itemType: "word" | "phrase";
      }
    >();

    for (const rawItem of parsed.data.items) {
      const trimmedTerm = rawItem.term.trim().replace(/\s+/g, " ");
      const normalizedTerm = normalizePassiveVocabularyText(trimmedTerm);
      const definition = rawItem.definition?.trim() || null;

      if (!normalizedTerm) {
        continue;
      }

      const key = getPassiveVocabularyCompositeKey(
        normalizedTerm,
        rawItem.itemType,
      );
      dedupedItems.set(key, {
        term: trimmedTerm,
        definition,
        normalizedTerm,
        itemType: rawItem.itemType,
      });
    }

    const items = Array.from(dedupedItems.values());
    if (items.length === 0) {
      return NextResponse.json(
        { error: "No valid passive vocabulary items provided" },
        { status: 400 },
      );
    }

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("passive_vocabulary_evidence")
      .select(
        "student_id, normalized_term, item_type, definition, source_label, confidence, import_count",
      )
      .eq("student_id", studentId)
      .in(
        "normalized_term",
        items.map((item) => item.normalizedTerm),
      );

    if (existingError) {
      console.error("Passive vocabulary lookup error:", existingError);
      return NextResponse.json(
        { error: "Failed to inspect passive vocabulary evidence" },
        { status: 500 },
      );
    }

    const existingMap = new Map(
      (existingRows ?? []).map((row) => [
        getPassiveVocabularyCompositeKey(row.normalized_term, row.item_type),
        row,
      ]),
    );
    const nowIso = new Date().toISOString();

    const upsertRows = items.map((item) => {
      const existing = existingMap.get(
        getPassiveVocabularyCompositeKey(item.normalizedTerm, item.itemType),
      );

      return {
        student_id: studentId,
        imported_by: user.id,
        term: item.term,
        normalized_term: item.normalizedTerm,
        definition: item.definition ?? existing?.definition ?? null,
        item_type: item.itemType,
        source_type: sourceType,
        source_label: sourceLabel ?? existing?.source_label ?? null,
        confidence: Math.max(existing?.confidence ?? 0, confidence),
        import_count: (existing?.import_count ?? 0) + 1,
        last_imported_at: nowIso,
        updated_at: nowIso,
      };
    });

    const { error: upsertError } = await supabaseAdmin
      .from("passive_vocabulary_evidence")
      .upsert(upsertRows, {
        onConflict: "student_id,normalized_term,item_type",
      });

    if (upsertError) {
      console.error("Passive vocabulary upsert error:", upsertError);
      return NextResponse.json(
        { error: "Failed to save passive vocabulary evidence" },
        { status: 500 },
      );
    }

    const createdCount = items.filter(
      (item) =>
        !existingMap.has(
          getPassiveVocabularyCompositeKey(item.normalizedTerm, item.itemType),
        ),
    ).length;

    return NextResponse.json({
      importedCount: items.length,
      createdCount,
      updatedCount: items.length - createdCount,
      studentId,
      sourceType,
      confidence,
    });
  } catch (error) {
    console.error("Passive vocabulary import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
