import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractWordResults,
  upsertWordMastery,
} from "@/lib/mastery/engine";

/**
 * POST /api/mastery/backfill
 * Processes ALL existing quiz attempts and populates word_mastery.
 * Only tutors / superadmins can trigger this.
 * Processes attempts in chronological order per student so mastery levels
 * accumulate correctly.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only tutors / superadmins
    const supabaseAdmin = createAdminClient();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["tutor", "superadmin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all attempts ordered by completion date (oldest first)
    const { data: attempts, error: attErr } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id, student_id, quiz_id, answers, completed_at")
      .order("completed_at", { ascending: true });

    if (attErr) {
      console.error("Backfill: failed to load attempts", attErr);
      return NextResponse.json(
        { error: "Failed to load attempts" },
        { status: 500 },
      );
    }

    if (!attempts || attempts.length === 0) {
      return NextResponse.json({ processed: 0, skipped: 0 });
    }

    // Pre-fetch all quizzes we need
    const quizIds = [...new Set(attempts.map((a) => a.quiz_id))];
    const { data: quizzes } = await supabaseAdmin
      .from("quizzes")
      .select("id, type, vocabulary_terms, generated_content")
      .in("id", quizIds);

    const quizMap = new Map(
      (quizzes ?? []).map((q) => [
        q.id,
        {
          type: q.type as string,
          vocabulary_terms: (q.vocabulary_terms ?? []) as {
            term: string;
            definition: string;
          }[],
          generated_content: (q.generated_content ?? {}) as Record<
            string,
            unknown
          >,
        },
      ]),
    );

    let processed = 0;
    let skipped = 0;

    for (const attempt of attempts) {
      const quiz = quizMap.get(attempt.quiz_id);
      if (!quiz) {
        skipped++;
        continue;
      }

      try {
        const answers = (attempt.answers ?? {}) as Record<string, unknown>;
        const wordResults = extractWordResults(
          quiz.type,
          answers,
          quiz.vocabulary_terms,
          quiz.generated_content,
        );

        if (wordResults.length > 0) {
          await upsertWordMastery(
            supabaseAdmin,
            attempt.student_id,
            wordResults,
          );
          processed++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(
          `Backfill: error processing attempt ${attempt.id}:`,
          err,
        );
        skipped++;
      }
    }

    return NextResponse.json({ processed, skipped, total: attempts.length });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
