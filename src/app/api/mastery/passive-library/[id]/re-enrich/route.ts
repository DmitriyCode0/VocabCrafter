import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  reEnrichPassiveVocabularyLibraryItem,
} from "@/lib/mastery/passive-vocabulary-library";
import { normalizeLearningLanguage } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "superadmin") {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { userId: user.id, adminClient: createAdminClient() };
}

async function resolveTargetLanguageForLibraryItem(
  adminClient: ReturnType<typeof createAdminClient>,
  libraryItemId: string,
) {
  const { data: evidenceRows, error: evidenceError } = await adminClient
    .from("passive_vocabulary_evidence")
    .select("student_id")
    .eq("library_item_id", libraryItemId)
    .limit(20);

  if (evidenceError) {
    throw new Error("Failed to load linked passive vocabulary evidence");
  }

  const studentIds = Array.from(
    new Set((evidenceRows ?? []).map((row) => row.student_id).filter(Boolean)),
  );

  if (studentIds.length === 0) {
    return normalizeLearningLanguage(null);
  }

  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select("preferred_language")
    .in("id", studentIds);

  if (profilesError) {
    throw new Error("Failed to resolve passive vocabulary language context");
  }

  const languageCounts = new Map<string, number>();

  for (const profile of profiles ?? []) {
    const language = normalizeLearningLanguage(profile.preferred_language);
    languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
  }

  return Array.from(languageCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0]
    ? normalizeLearningLanguage(
        Array.from(languageCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0],
      )
    : normalizeLearningLanguage(null);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireSuperadmin();
  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const { id } = await params;

  try {
    const targetLanguage = await resolveTargetLanguageForLibraryItem(
      access.adminClient,
      id,
    );
    const result = await reEnrichPassiveVocabularyLibraryItem({
      libraryItemId: id,
      targetLanguage,
      actorUserId: access.userId,
      adminClient: access.adminClient,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to re-enrich passive vocabulary library item",
      },
      { status: 500 },
    );
  }
}