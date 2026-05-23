import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractWordResults, upsertWordMastery } from "@/lib/mastery/engine";
import {
  syncStudentVocabularyStateFromActiveEvidence,
  syncStudentVocabularyStateFromPassiveEvidence,
} from "@/lib/mastery/student-vocabulary-state";
import { parseQuizSnapshot } from "@/lib/quiz-snapshot";

const BACKFILL_PAGE_SIZE = 1000;
const QUIZ_BATCH_SIZE = 500;

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

async function loadAllQuizAttempts(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
) {
  const rows: Array<{
    id: string;
    student_id: string;
    quiz_id: string;
    answers: unknown;
    completed_at: string;
    quiz_snapshot: unknown;
  }> = [];

  for (let from = 0; ; from += BACKFILL_PAGE_SIZE) {
    const to = from + BACKFILL_PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id, student_id, quiz_id, answers, completed_at, quiz_snapshot")
      .order("completed_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);

    if (data.length < BACKFILL_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function loadAllPassiveEvidenceRows(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
) {
  const rows: Array<{
    student_id: string;
    term: string;
    normalized_term: string;
    item_type: "word" | "phrase";
    library_item_id: string | null;
  }> = [];

  for (let from = 0; ; from += BACKFILL_PAGE_SIZE) {
    const to = from + BACKFILL_PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from("passive_vocabulary_evidence")
      .select("student_id, term, normalized_term, item_type, library_item_id")
      .order("student_id", { ascending: true })
      .order("normalized_term", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);

    if (data.length < BACKFILL_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function loadAllActiveEvidenceRows(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
) {
  const rows: Array<{
    student_id: string;
    term: string;
    normalized_term: string;
    library_item_id: string | null;
  }> = [];

  for (let from = 0; ; from += BACKFILL_PAGE_SIZE) {
    const to = from + BACKFILL_PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from("active_vocabulary_evidence")
      .select("student_id, term, normalized_term, library_item_id")
      .order("student_id", { ascending: true })
      .order("normalized_term", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);

    if (data.length < BACKFILL_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function loadQuizzesByIds(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  quizIds: string[],
) {
  const rows: Array<{
    id: string;
    type: string;
    vocabulary_terms: Record<string, unknown>[] | null;
    generated_content: Record<string, unknown> | null;
  }> = [];

  for (const quizIdChunk of chunkArray(quizIds, QUIZ_BATCH_SIZE)) {
    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .select("id, type, vocabulary_terms, generated_content")
      .in("id", quizIdChunk)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));
  }

  return rows;
}

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
    let attempts;

    try {
      attempts = await loadAllQuizAttempts(supabaseAdmin);
    } catch (attErr) {
      console.error("Backfill: failed to load attempts", attErr);
      return NextResponse.json(
        { error: "Failed to load attempts" },
        { status: 500 },
      );
    }

    if (!attempts || attempts.length === 0) {
      return NextResponse.json({ processed: 0, skipped: 0 });
    }

    const [{ error: resetMasteryError }, { error: resetStateError }] =
      await Promise.all([
        supabaseAdmin.from("word_mastery").delete().not("id", "is", null),
        supabaseAdmin
          .from("student_vocabulary_items")
          .delete()
          .not("id", "is", null),
      ]);

    if (resetMasteryError || resetStateError) {
      console.error("Backfill: failed to reset mastery/state tables", {
        resetMasteryError,
        resetStateError,
      });
      return NextResponse.json(
        { error: "Failed to reset mastery state" },
        { status: 500 },
      );
    }

    let passiveEvidenceRows;
    let activeEvidenceRows;

    try {
      [passiveEvidenceRows, activeEvidenceRows] = await Promise.all([
        loadAllPassiveEvidenceRows(supabaseAdmin),
        loadAllActiveEvidenceRows(supabaseAdmin),
      ]);
    } catch (evidenceError) {
      console.error("Backfill: failed to load evidence rows", {
        evidenceError,
      });
      return NextResponse.json(
        { error: "Failed to load vocabulary evidence" },
        { status: 500 },
      );
    }

    const passiveRowsByStudent = new Map<
      string,
      Array<{
        term: string;
        normalizedTerm: string;
        itemType: "word" | "phrase";
        libraryItemId: string | null;
      }>
    >();
    for (const row of passiveEvidenceRows) {
      const studentRows = passiveRowsByStudent.get(row.student_id) ?? [];
      studentRows.push({
        term: row.term,
        normalizedTerm: row.normalized_term,
        itemType: row.item_type,
        libraryItemId: row.library_item_id,
      });
      passiveRowsByStudent.set(row.student_id, studentRows);
    }

    for (const [studentId, items] of passiveRowsByStudent) {
      await syncStudentVocabularyStateFromPassiveEvidence({
        adminClient: supabaseAdmin,
        studentId,
        items,
      });
    }

    const activeRowsByStudent = new Map<
      string,
      Array<{
        term: string;
        normalizedTerm: string;
        itemType: "word";
        libraryItemId: string | null;
      }>
    >();
    for (const row of activeEvidenceRows) {
      const studentRows = activeRowsByStudent.get(row.student_id) ?? [];
      studentRows.push({
        term: row.term,
        normalizedTerm: row.normalized_term,
        itemType: "word",
        libraryItemId: row.library_item_id,
      });
      activeRowsByStudent.set(row.student_id, studentRows);
    }

    for (const [studentId, items] of activeRowsByStudent) {
      await syncStudentVocabularyStateFromActiveEvidence({
        adminClient: supabaseAdmin,
        studentId,
        items,
      });
    }

    // Pre-fetch all quizzes we need
    const quizIds = [...new Set(attempts.map((a) => a.quiz_id))];
    let quizzes;

    try {
      quizzes = await loadQuizzesByIds(supabaseAdmin, quizIds);
    } catch (quizLoadError) {
      console.error("Backfill: failed to load quizzes", quizLoadError);
      return NextResponse.json(
        { error: "Failed to load quizzes" },
        { status: 500 },
      );
    }

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
      const quiz =
        quizMap.get(attempt.quiz_id) ??
        (() => {
          const snapshot = parseQuizSnapshot(attempt.quiz_snapshot);

          if (!snapshot || !snapshot.type) {
            return null;
          }

          return {
            type: snapshot.type,
            vocabulary_terms: snapshot.vocabulary_terms,
            generated_content: snapshot.generated_content,
          };
        })();

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
        console.error(`Backfill: error processing attempt ${attempt.id}:`, err);
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
