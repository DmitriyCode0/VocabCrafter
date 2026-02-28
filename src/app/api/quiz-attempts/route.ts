import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createAttemptSchema = z.object({
  quizId: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  score: z.number().min(0).nullable(),
  maxScore: z.number().min(0).nullable(),
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

    const { quizId, answers, score, maxScore } = parsed.data;

    const { data: attempt, error: insertError } = await supabase
      .from("quiz_attempts")
      .insert({
        quiz_id: quizId,
        student_id: user.id,
        answers: answers as Record<string, unknown>,
        score,
        max_score: maxScore,
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
    const quizId = searchParams.get("quizId");

    let query = supabase
      .from("quiz_attempts")
      .select("*, quizzes(title, type, cefr_level)")
      .eq("student_id", user.id)
      .order("completed_at", { ascending: false });

    if (quizId) {
      query = query.eq("quiz_id", quizId);
    }

    const { data: attempts, error } = await query;

    if (error) {
      console.error("Fetch attempts error:", error);
      return NextResponse.json(
        { error: "Failed to fetch attempts" },
        { status: 500 },
      );
    }

    return NextResponse.json({ attempts });
  } catch (error) {
    console.error("Fetch attempts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
