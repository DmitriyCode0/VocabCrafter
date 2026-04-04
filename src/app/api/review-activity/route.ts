import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateFromGeminiWithUsage, GEMINI_MODEL } from "@/lib/gemini/client";
import { getQuizPrompt, getSystemInstruction } from "@/lib/gemini/prompts";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import { gapFillResponseSchema } from "@/lib/gemini/validation";
import { formatAppDate } from "@/lib/dates";
import {
  normalizeLearningLanguage,
  normalizeSourceLanguage,
} from "@/lib/languages";
import { REVIEW_ACTIVITY_TITLE_PREFIX } from "@/lib/constants";

const REVIEW_WORD_LIMIT = 5;

export async function POST() {
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

    // Get user's profile for CEFR level and language pair
    const { data: profile } = await supabase
      .from("profiles")
      .select("cefr_level, preferred_language, source_language")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 },
      );
    }

    // Prioritize overdue spaced-repetition words first, then backfill with
    // the weakest remaining words.
    const supabaseAdmin = createAdminClient();
    const nowIso = new Date().toISOString();
    const [
      { data: dueWords, error: dueWordsError },
      { data: fallbackWords, error: fallbackWordsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("word_mastery")
        .select("term, definition, mastery_level, next_review, last_practiced")
        .eq("student_id", user.id)
        .not("next_review", "is", null)
        .lte("next_review", nowIso)
        .order("next_review", { ascending: true })
        .order("mastery_level", { ascending: true })
        .order("last_practiced", { ascending: true, nullsFirst: true })
        .limit(REVIEW_WORD_LIMIT),
      supabaseAdmin
        .from("word_mastery")
        .select("term, definition, mastery_level, next_review, last_practiced")
        .eq("student_id", user.id)
        .lte("mastery_level", 4)
        .order("mastery_level", { ascending: true })
        .order("last_practiced", { ascending: true, nullsFirst: true })
        .limit(REVIEW_WORD_LIMIT * 4),
    ]);

    if (dueWordsError || fallbackWordsError) {
      console.error("Error fetching review activity words:", {
        dueWordsError,
        fallbackWordsError,
      });
      return NextResponse.json(
        { error: "Failed to fetch words" },
        { status: 500 },
      );
    }

    const selectedWords = [...(dueWords ?? [])];
    const selectedTerms = new Set(selectedWords.map((word) => word.term));

    for (const word of fallbackWords ?? []) {
      if (selectedWords.length >= REVIEW_WORD_LIMIT) {
        break;
      }

      if (selectedTerms.has(word.term)) {
        continue;
      }

      selectedWords.push(word);
      selectedTerms.add(word.term);
    }

    // If no words found, return empty/error message
    if (selectedWords.length === 0) {
      return NextResponse.json(
        {
          error:
            "No words to review. Import vocabulary or practice more quizzes to build your vocabulary.",
          code: "NO_WORDS_TO_REVIEW",
        },
        { status: 404 },
      );
    }

    // Format vocabulary terms for prompt
    const vocabularyTerms = selectedWords.map((w) => ({
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
      targetLanguage: normalizeLearningLanguage(profile.preferred_language),
      sourceLanguage: normalizeSourceLanguage(profile.source_language),
      vocabularyChallenge: "Standard" as const,
      grammarChallenge: "Standard" as const,
      teacherPersona: "standard" as const,
      timedMode: false,
    };

    const prompt = getQuizPrompt("gap_fill", vocabularyTerms, config);
    const systemInstruction = getSystemInstruction(config);

    const { data: generatedContent, usageSnapshot } =
      await generateFromGeminiWithUsage(
        {
          prompt,
          systemInstruction,
          temperature: 0.7,
        },
        gapFillResponseSchema,
      );

    await recordAIUsageEvent({
      userId: user.id,
      feature: "review_activity",
      requestType: "text",
      model: GEMINI_MODEL,
      snapshot: usageSnapshot,
    });

    const { data: quiz, error: quizError } = await supabaseAdmin
      .from("quizzes")
      .insert({
        creator_id: user.id,
        title: `${REVIEW_ACTIVITY_TITLE_PREFIX}${formatAppDate(new Date())}`,
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
      wordCount: selectedWords.length,
      dueWordCount: (dueWords ?? []).length,
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

export async function DELETE() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: reviewQuizzes, error: reviewQuizzesError } =
      await supabaseAdmin
        .from("quizzes")
        .select("id")
        .eq("creator_id", user.id)
        .ilike("title", `${REVIEW_ACTIVITY_TITLE_PREFIX}%`);

    if (reviewQuizzesError) {
      console.error("Review cleanup lookup error:", reviewQuizzesError);
      return NextResponse.json(
        { error: "Failed to find review sessions" },
        { status: 500 },
      );
    }

    const reviewQuizIds = (reviewQuizzes ?? []).map((quiz) => quiz.id);

    if (reviewQuizIds.length === 0) {
      return NextResponse.json({ deletedCount: 0 });
    }

    const [attemptDeleteResult, assignmentDeleteResult] = await Promise.all([
      supabaseAdmin.from("quiz_attempts").delete().in("quiz_id", reviewQuizIds),
      supabaseAdmin.from("assignments").delete().in("quiz_id", reviewQuizIds),
    ]);

    if (attemptDeleteResult.error || assignmentDeleteResult.error) {
      console.error("Review cleanup dependent delete error:", {
        attemptDeleteError: attemptDeleteResult.error,
        assignmentDeleteError: assignmentDeleteResult.error,
      });
      return NextResponse.json(
        { error: "Failed to delete review session dependencies" },
        { status: 500 },
      );
    }

    const { error: quizDeleteError } = await supabaseAdmin
      .from("quizzes")
      .delete()
      .eq("creator_id", user.id)
      .in("id", reviewQuizIds);

    if (quizDeleteError) {
      console.error("Review cleanup quiz delete error:", quizDeleteError);
      return NextResponse.json(
        { error: "Failed to delete review sessions" },
        { status: 500 },
      );
    }

    return NextResponse.json({ deletedCount: reviewQuizIds.length });
  } catch (error) {
    console.error("Review cleanup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
