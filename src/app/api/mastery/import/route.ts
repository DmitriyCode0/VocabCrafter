import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNextReviewDateForLevel } from "@/lib/mastery/engine";

const importVocabularySchema = z.object({
  terms: z
    .array(
      z.object({
        term: z.string().min(1),
        definition: z.string().min(1),
      }),
    )
    .min(1)
    .max(100),
  startingLevel: z.coerce
    .number()
    .int()
    .min(0)
    .max(5)
    .default(DEFAULT_IMPORTED_LEVEL),
});

const DEFAULT_IMPORTED_LEVEL = 2;

function getImportSeedForLevel(level: number) {
  switch (level) {
    case 5:
      return {
        masteryLevel: 5,
        correctCount: 6,
        translationCorrectCount: 2,
        streak: 4,
      };
    case 4:
      return {
        masteryLevel: 4,
        correctCount: 4,
        translationCorrectCount: 0,
        streak: 3,
      };
    case 3:
      return {
        masteryLevel: 3,
        correctCount: 2,
        translationCorrectCount: 0,
        streak: 2,
      };
    case 2:
      return {
        masteryLevel: 2,
        correctCount: 1,
        translationCorrectCount: 0,
        streak: 1,
      };
    case 1:
      return {
        masteryLevel: 1,
        correctCount: 0,
        translationCorrectCount: 0,
        streak: 0,
      };
    default:
      return {
        masteryLevel: 0,
        correctCount: 0,
        translationCorrectCount: 0,
        streak: 0,
      };
  }
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

    const { startingLevel } = parsed.data;
    const importSeed = getImportSeedForLevel(startingLevel);

    const dedupedTerms = new Map<
      string,
      { term: string; definition: string }
    >();

    for (const rawTerm of parsed.data.terms) {
      const normalizedTerm = rawTerm.term.trim().toLowerCase();
      const normalizedDefinition = rawTerm.definition.trim();

      if (!normalizedTerm || !normalizedDefinition) {
        continue;
      }

      dedupedTerms.set(normalizedTerm, {
        term: normalizedTerm,
        definition: normalizedDefinition,
      });
    }

    const terms = Array.from(dedupedTerms.values());

    if (terms.length === 0) {
      return NextResponse.json(
        { error: "No valid vocabulary terms provided" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("word_mastery")
      .select(
        "term, definition, mastery_level, correct_count, incorrect_count, translation_correct_count, streak, last_practiced, next_review",
      )
      .eq("student_id", user.id)
      .in(
        "term",
        terms.map((term) => term.term),
      );

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to inspect existing vocabulary" },
        { status: 500 },
      );
    }

    const existingMap = new Map(
      (existingRows ?? []).map((row) => [row.term, row]),
    );
    const now = new Date();
    const nowIso = now.toISOString();

    const upsertRows = terms.map(({ term, definition }) => {
      const existing = existingMap.get(term);

      if (!existing) {
        return {
          student_id: user.id,
          term,
          definition,
          mastery_level: importSeed.masteryLevel,
          correct_count: importSeed.correctCount,
          incorrect_count: 0,
          translation_correct_count: importSeed.translationCorrectCount,
          streak: importSeed.streak,
          last_practiced: nowIso,
          next_review: getNextReviewDateForLevel(importSeed.masteryLevel, now),
        };
      }

      const nextLevel = Math.max(
        existing.mastery_level ?? 0,
        importSeed.masteryLevel,
      );
      const nextCorrectCount = Math.max(
        existing.correct_count ?? 0,
        importSeed.correctCount,
      );
      const nextTranslationCorrectCount = Math.max(
        existing.translation_correct_count ?? 0,
        importSeed.translationCorrectCount,
      );
      const nextStreak = Math.max(existing.streak ?? 0, importSeed.streak);
      const wasPromoted = nextLevel !== (existing.mastery_level ?? 0);
      const needsCounterSync =
        nextCorrectCount !== (existing.correct_count ?? 0) ||
        nextTranslationCorrectCount !==
          (existing.translation_correct_count ?? 0) ||
        nextStreak !== (existing.streak ?? 0);
      const shouldReschedule = wasPromoted || needsCounterSync;

      return {
        student_id: user.id,
        term,
        definition: definition || existing.definition,
        mastery_level: nextLevel,
        correct_count: nextCorrectCount,
        incorrect_count: existing.incorrect_count ?? 0,
        translation_correct_count: nextTranslationCorrectCount,
        streak: nextStreak,
        last_practiced: shouldReschedule
          ? nowIso
          : (existing.last_practiced ?? nowIso),
        next_review: shouldReschedule
          ? getNextReviewDateForLevel(nextLevel, now)
          : (existing.next_review ?? getNextReviewDateForLevel(nextLevel, now)),
      };
    });

    const { error: upsertError } = await supabaseAdmin
      .from("word_mastery")
      .upsert(upsertRows, {
        onConflict: "student_id,term",
      });

    if (upsertError) {
      console.error("Import vocabulary upsert error:", upsertError);
      return NextResponse.json(
        { error: "Failed to save imported vocabulary" },
        { status: 500 },
      );
    }

    const existingTerms = new Set((existingRows ?? []).map((row) => row.term));
    const createdCount = terms.filter(
      (term) => !existingTerms.has(term.term),
    ).length;
    const updatedCount = terms.length - createdCount;

    return NextResponse.json({
      importedCount: terms.length,
      createdCount,
      updatedCount,
      startingLevel,
    });
  } catch (error) {
    console.error("Import vocabulary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
