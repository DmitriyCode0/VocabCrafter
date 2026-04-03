import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateFromGemini } from "@/lib/gemini/client";
import { getQuizPrompt, getSystemInstruction } from "@/lib/gemini/prompts";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { gapFillResponseSchema } from "@/lib/gemini/validation";
import { formatAppDate } from "@/lib/dates";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- Enforce AI quota ---
    const quota = await checkAIQuota(user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `AI call limit reached (${quota.limit}/month). Upgrade your plan for more.`,
          code: "QUOTA_EXCEEDED",
        },
        { status: 429 },
      );
    }

    // Get user's profile for CEFR level
    const { data: profile } = await supabase
      .from("profiles")
      .select("cefr_level")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 },
      );
    }

    // Fetch least known words (mastery_level 0-4) - limit to 5
    const supabaseAdmin = createAdminClient();
    const { data: leastKnownWords, error: wordError } = await supabaseAdmin
      .from("word_mastery")
      .select("term, definition, mastery_level")
      .eq("student_id", user.id)
      .lte("mastery_level", 4)
      .order("mastery_level", { ascending: true })
      .order("last_practiced", { ascending: true, nullsFirst: true })
      .limit(5);

    if (wordError) {
      console.error("Error fetching least known words:", wordError);
      return NextResponse.json(
        { error: "Failed to fetch words" },
        { status: 500 },
      );
    }

    // If no words found, return empty/error message
    if (!leastKnownWords || leastKnownWords.length === 0) {
      // Could return a message or generate from scratch - for now we'll error
      return NextResponse.json(
        {
          error:
            "No words to review. Practice more quizzes to build your vocabulary.",
          code: "NO_WORDS_TO_REVIEW",
        },
        { status: 404 },
      );
    }

    // Format vocabulary terms for prompt
    const vocabularyTerms = leastKnownWords.map((w) => ({
      term: w.term,
      definition: w.definition || "",
    }));

    // Generate gap fill exercises using Gemini
    const cefrLevel = (profile.cefr_level || "B1") as
      | "A1"
      | "A2"
      | "B1"
      | "B2"
      | "C1"
      | "C2";

    const config = {
      cefrLevel: cefrLevel,
      vocabularyChallenge: "Standard" as const,
      grammarChallenge: "Standard" as const,
      teacherPersona: "standard" as const,
      timedMode: false,
    };

    const prompt = getQuizPrompt("gap_fill", vocabularyTerms, config);
    const systemInstruction = getSystemInstruction(config);

    const generatedContent = await generateFromGemini(
      { prompt, systemInstruction, temperature: 0.7 },
      gapFillResponseSchema,
    );

    const { data: quiz, error: quizError } = await supabaseAdmin
      .from("quizzes")
      .insert({
        creator_id: user.id,
        title: `Review Activity - ${formatAppDate(new Date())}`,
        type: "gap_fill",
        cefr_level: cefrLevel,
        vocabulary_terms: vocabularyTerms as unknown as Record<
          string,
          unknown
        >[],
        generated_content: generatedContent,
        config: config,
        is_public: false,
      })
      .select()
      .single();

    if (quizError) {
      console.error("Quiz creation error:", quizError);
      return NextResponse.json(
        { error: "Failed to create review quiz" },
        { status: 500 },
      );
    }

    // Increment AI call counter after successful generation
    await incrementAICalls(user.id);

    return NextResponse.json({
      quiz: quiz,
      wordCount: leastKnownWords.length,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 502 },
      );
    }

    console.error("Review activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
