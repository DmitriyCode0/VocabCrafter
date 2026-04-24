import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  tutorHasQuizAccess,
  tutorHasStudentAccess,
} from "@/lib/rbac/tutor-access";

const updateAttemptSchema = z.union([
  z.object({
    questionIndex: z.number().int().min(0),
    score: z.number().min(0).max(100),
  }),
  z.object({
    questionIndex: z.number().int().min(0),
    isCorrect: z.boolean(),
  }),
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (profile.role !== "tutor" && profile.role !== "superadmin") {
      return NextResponse.json(
        { error: "Only tutors can edit attempt results" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = updateAttemptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id, quiz_id, student_id, answers, quizzes(type, creator_id)")
      .eq("id", id)
      .maybeSingle();

    if (attemptError) {
      return NextResponse.json(
        { error: attemptError.message },
        { status: 500 },
      );
    }

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const quiz = attempt.quizzes as { type: string; creator_id: string } | null;

    if (!quiz || (quiz.type !== "translation" && quiz.type !== "gap_fill")) {
      return NextResponse.json(
        { error: "Only translation and gap-fill attempts can be edited" },
        { status: 400 },
      );
    }

    const hasQuizAccess = await tutorHasQuizAccess(
      supabaseAdmin,
      user.id,
      attempt.quiz_id,
    );
    const hasStudentAccess = await tutorHasStudentAccess(
      supabaseAdmin,
      user.id,
      attempt.student_id,
    );

    if (profile.role !== "superadmin" && !hasQuizAccess && !hasStudentAccess) {
      return NextResponse.json(
        { error: "You do not have access to this attempt" },
        { status: 403 },
      );
    }

    const answers = (attempt.answers ?? {}) as {
      type?: string;
      results?: Array<Record<string, unknown>>;
    };
    const results = Array.isArray(answers.results)
      ? [...answers.results]
      : null;

    if (!results) {
      return NextResponse.json(
        { error: "Translation results are missing" },
        { status: 400 },
      );
    }

    const targetResult = results[parsed.data.questionIndex];
    if (!targetResult) {
      return NextResponse.json(
        { error: "Sentence not found" },
        { status: 404 },
      );
    }

    let overallScore = 0;
    let maxScore = 0;

    if (quiz.type === "translation") {
      if (!("score" in parsed.data)) {
        return NextResponse.json(
          { error: "Translation attempts require a score update" },
          { status: 400 },
        );
      }

      results[parsed.data.questionIndex] = {
        ...targetResult,
        score: Math.round(parsed.data.score),
      };

      const numericScores = results.map((result) => {
        const score = result.score;
        return typeof score === "number" && Number.isFinite(score)
          ? score
          : 0;
      });
      overallScore =
        numericScores.length > 0
          ? Math.round(
              numericScores.reduce((sum, score) => sum + score, 0) /
                numericScores.length,
            )
          : 0;
      maxScore = 100;
    } else {
      if (!("isCorrect" in parsed.data)) {
        return NextResponse.json(
          { error: "Gap-fill attempts require a correct/wrong update" },
          { status: 400 },
        );
      }

      results[parsed.data.questionIndex] = {
        ...targetResult,
        isCorrect: parsed.data.isCorrect,
      };

      overallScore = results.reduce((sum, result) => {
        return sum + (result.isCorrect === true ? 1 : 0);
      }, 0);
      maxScore = results.length;
    }

    const updatedAnswers = {
      ...answers,
      results,
    };

    const { error: updateError } = await supabaseAdmin
      .from("quiz_attempts")
      .update({
        answers: updatedAnswers,
        score: overallScore,
        max_score: maxScore,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      overallScore,
      maxScore,
      result: results[parsed.data.questionIndex],
    });
  } catch (error) {
    console.error("Update translation score error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
