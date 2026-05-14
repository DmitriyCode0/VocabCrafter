import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLearningLanguage } from "@/lib/languages";
import { normalizePassiveVocabularyText } from "@/lib/mastery/passive-vocabulary";
import { upsertActiveVocabularyEvidence } from "@/lib/mastery/active-vocabulary-evidence";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";
import { isEnglishWord } from "@/lib/text/language-detection";

const importVocabularySchema = z.object({
  studentId: z.string().uuid().optional(),
  sourceLabel: z.string().trim().max(160).optional(),
  items: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(200),
      }),
    )
    .min(1)
    .max(500),
});

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
        { error: "You do not have permission to import active vocabulary" },
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

function getUniqueActiveVocabularyTerms(items: Array<{ term: string }>) {
  const dedupedTerms = new Map<string, string>();

  for (const item of items) {
    const trimmedTerm = item.term.trim().replace(/\s+/g, " ");
    const normalizedTerm = normalizePassiveVocabularyText(trimmedTerm);

    if (!normalizedTerm || !isEnglishWord(trimmedTerm)) {
      continue;
    }

    dedupedTerms.set(normalizedTerm, trimmedTerm);
  }

  return Array.from(dedupedTerms.values()).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
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
    const parsed = importVocabularySchema.safeParse(body);

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
    const terms = getUniqueActiveVocabularyTerms(parsed.data.items);

    if (terms.length === 0) {
      return NextResponse.json(
        { error: "No valid active vocabulary terms provided" },
        { status: 400 },
      );
    }

    const { data: studentProfile, error: studentProfileError } = await supabaseAdmin
      .from("profiles")
      .select("preferred_language")
      .eq("id", studentId)
      .single();

    if (studentProfileError || !studentProfile) {
      return NextResponse.json(
        { error: "Failed to load the student's language profile" },
        { status: 500 },
      );
    }

    try {
      const result = await upsertActiveVocabularyEvidence({
        adminClient: supabaseAdmin,
        studentId,
        actorUserId: user.id,
        targetLanguage: normalizeLearningLanguage(
          studentProfile.preferred_language,
        ),
        terms,
        sourceType: "manual_list",
        sourceLabel: parsed.data.sourceLabel?.trim() || null,
      });

      return NextResponse.json({
        ...result,
        processedCount: terms.length,
        studentId,
      });
    } catch (error) {
      console.error("Import active vocabulary error:", error);
      return NextResponse.json(
        { error: "Failed to save active vocabulary" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Import vocabulary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
