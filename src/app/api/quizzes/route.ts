import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

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

    const { data: quizzes, error } = await supabase
      .from("quizzes")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch quizzes" },
        { status: 500 },
      );
    }

    return NextResponse.json({ quizzes });
  } catch (error) {
    console.error("Fetch quizzes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
