import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const PASSING_SCORE_PERCENT = 80;

function canReuseAssignedQuiz(attempt: {
  score: number | null;
  max_score: number | null;
}) {
  if (attempt.score == null || attempt.max_score == null) {
    return true;
  }

  if (attempt.max_score <= 0) {
    return false;
  }

  return attempt.score / attempt.max_score >= PASSING_SCORE_PERCENT / 100;
}

const createQuizSchema = z.object({
  title: z.string().min(1),
  type: z.string(),
  cefrLevel: z.string(),
  vocabularyTerms: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    }),
  ),
  generatedContent: z.record(z.string(), z.unknown()),
  config: z.record(z.string(), z.unknown()).optional(),
  isPublic: z.boolean().optional(),
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
    const parsed = createQuizSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      title,
      type,
      cefrLevel,
      vocabularyTerms,
      generatedContent,
      config,
      isPublic,
    } = parsed.data;

    const { data: quiz, error: insertError } = await supabase
      .from("quizzes")
      .insert({
        creator_id: user.id,
        title,
        type,
        cefr_level: cefrLevel,
        vocabulary_terms: vocabularyTerms as unknown as Record<
          string,
          unknown
        >[],
        generated_content: generatedContent,
        config: config ?? null,
        is_public: isPublic ?? false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Quiz insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save quiz" },
        { status: 500 },
      );
    }

    return NextResponse.json({ quiz });
  } catch (error) {
    console.error("Create quiz error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [{ data: profile, error: profileError }, { data: ownQuizzes, error }] =
      await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).single(),
        supabase
          .from("quizzes")
          .select("*")
          .eq("creator_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

    if (profileError || !profile) {
      console.error("Fetch quizzes profile error:", profileError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch quizzes" },
        { status: 500 },
      );
    }

    const baseQuizzes = ownQuizzes ?? [];

    if (profile.role !== "student") {
      return NextResponse.json({ quizzes: baseQuizzes });
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("class_members")
      .select("class_id")
      .eq("student_id", user.id);

    if (membershipsError) {
      console.error("Fetch quiz memberships error:", membershipsError);
      return NextResponse.json(
        { error: "Failed to fetch quizzes" },
        { status: 500 },
      );
    }

    const classIds = memberships?.map((membership) => membership.class_id) ?? [];

    if (classIds.length === 0) {
      return NextResponse.json({ quizzes: baseQuizzes });
    }

    const admin = createAdminClient();
    const { data: assignments, error: assignmentsError } = await admin
      .from("assignments")
      .select("quiz_id")
      .in("class_id", classIds);

    if (assignmentsError) {
      console.error("Fetch assigned quizzes error:", assignmentsError);
      return NextResponse.json(
        { error: "Failed to fetch quizzes" },
        { status: 500 },
      );
    }

    const assignedQuizIds = Array.from(
      new Set(
        (assignments ?? [])
          .map((assignment) => assignment.quiz_id)
          .filter((quizId): quizId is string => Boolean(quizId)),
      ),
    );

    if (assignedQuizIds.length === 0) {
      return NextResponse.json({ quizzes: baseQuizzes });
    }

    const { data: attempts, error: attemptsError } = await supabase
      .from("quiz_attempts")
      .select("quiz_id, score, max_score")
      .eq("student_id", user.id)
      .in("quiz_id", assignedQuizIds);

    if (attemptsError) {
      console.error("Fetch quiz attempts error:", attemptsError);
      return NextResponse.json(
        { error: "Failed to fetch quizzes" },
        { status: 500 },
      );
    }

    const reusableAssignedQuizIds = Array.from(
      new Set(
        (attempts ?? [])
          .filter(canReuseAssignedQuiz)
          .map((attempt) => attempt.quiz_id),
      ),
    );

    if (reusableAssignedQuizIds.length === 0) {
      return NextResponse.json({ quizzes: baseQuizzes });
    }

    const { data: assignedQuizzes, error: assignedQuizzesError } = await admin
      .from("quizzes")
      .select("*")
      .in("id", reusableAssignedQuizIds);

    if (assignedQuizzesError) {
      console.error("Fetch reusable assigned quizzes error:", assignedQuizzesError);
      return NextResponse.json(
        { error: "Failed to fetch quizzes" },
        { status: 500 },
      );
    }

    const quizzes = [...baseQuizzes, ...(assignedQuizzes ?? [])]
      .filter(
        (quiz, index, collection) =>
          collection.findIndex((candidate) => candidate.id === quiz.id) === index,
      )
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      );

    return NextResponse.json({ quizzes });
  } catch (error) {
    console.error("Fetch quizzes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
