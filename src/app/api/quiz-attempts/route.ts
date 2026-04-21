import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { extractWordResults, upsertWordMastery } from "@/lib/mastery/engine";
import {
  fetchHistoryPageData,
  HISTORY_PAGE_SIZE,
} from "@/lib/history/fetch-history-page-data";
import type { Role } from "@/types/roles";

const createAttemptSchema = z.object({
  quizId: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  score: z.number().min(0).nullable(),
  maxScore: z.number().min(0).nullable(),
  timeSpentSeconds: z.number().int().min(0).optional(),
});

const getAttemptsQuerySchema = z.object({
  quizId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(HISTORY_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  student: z.string().uuid().optional(),
  type: z.string().min(1).optional(),
});

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
    const parsed = createAttemptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { quizId, answers, score, maxScore, timeSpentSeconds } = parsed.data;

    const { data: attempt, error: insertError } = await supabase
      .from("quiz_attempts")
      .insert({
        quiz_id: quizId,
        student_id: user.id,
        answers: answers as Record<string, unknown>,
        score,
        max_score: maxScore,
        time_spent_seconds: timeSpentSeconds ?? 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Attempt insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save attempt" },
        { status: 500 },
      );
    }

    // ── Update word mastery ──────────────────────────────
    try {
      const supabaseAdmin = createAdminClient();
      const { data: quiz } = await supabaseAdmin
        .from("quizzes")
        .select("type, vocabulary_terms, generated_content")
        .eq("id", quizId)
        .single();

      if (quiz) {
        const vocabTerms = (quiz.vocabulary_terms ?? []) as {
          term: string;
          definition: string;
        }[];
        const genContent = (quiz.generated_content ?? {}) as Record<
          string,
          unknown
        >;
        const wordResults = extractWordResults(
          quiz.type,
          answers,
          vocabTerms,
          genContent,
        );
        await upsertWordMastery(supabaseAdmin, user.id, wordResults);
      }
    } catch (masteryErr) {
      // Don't fail the attempt save if mastery update fails
      console.error("Word mastery update error:", masteryErr);
    }

    return NextResponse.json({ attempt });
  } catch (error) {
    console.error("Create attempt error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = getAttemptsQuerySchema.safeParse({
      quizId: searchParams.get("quizId") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      student: searchParams.get("student") ?? undefined,
      type: searchParams.get("type") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Fetch attempts profile error:", profileError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { quizId, limit, offset, student, type } = parsed.data;

    if (profile.role === "superadmin") {
      return NextResponse.json(
        { error: "History is not available for superadmin" },
        { status: 403 },
      );
    }

    const { attempts, hasMore, activeStudentFilter } =
      await fetchHistoryPageData({
        role: profile.role as Role,
        userId: user.id,
        limit,
        offset,
        studentId: student,
        quizType: type,
        quizId,
      });

    return NextResponse.json({
      attempts,
      hasMore,
      activeStudentFilter,
    });
  } catch (error) {
    console.error("Fetch attempts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
