import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateFromGeminiWithUsage, GEMINI_MODEL } from "@/lib/gemini/client";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import {
  getLearningLanguageLabel,
  getSourceLanguageLabel,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
} from "@/lib/languages";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const requestSchema = z.object({
  quizType: z.enum([
    "mcq",
    "gap_fill",
    "translation",
    "text_translation",
    "flashcards",
    "discussion",
    "results",
  ]),
  cefrLevel: z.string().trim().max(10).optional(),
  targetLanguage: z.string().trim().max(32).optional(),
  sourceLanguage: z.string().trim().max(32).optional(),
  isAnswered: z.boolean(),
  context: z.object({
    itemLabel: z.string().trim().max(200).optional(),
    questionText: z.string().trim().max(4000).optional(),
    sourceSentence: z.string().trim().max(4000).optional(),
    targetTerm: z.string().trim().max(500).optional(),
    definition: z.string().trim().max(1000).optional(),
    example: z.string().trim().max(1500).optional(),
    hint: z.string().trim().max(1000).optional(),
    options: z.array(z.string().trim().max(500)).max(10).optional(),
    userAnswer: z.string().trim().max(4000).optional(),
    correctAnswer: z.string().trim().max(4000).optional(),
    isCorrect: z.boolean().optional(),
    score: z.number().min(0).max(100).optional(),
    feedback: z.string().trim().max(4000).optional(),
    grammarTopic: z.string().trim().max(300).optional(),
  }),
  messages: z.array(messageSchema).min(1).max(20),
});

const assistantResponseSchema = z.object({
  reply: z.string().trim().min(1),
  followUps: z
    .array(z.string().trim().min(1))
    .max(3)
    .optional()
    .default([]),
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("app_language, source_language")
      .eq("id", user.id)
      .single();

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

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

    const {
      quizType,
      cefrLevel = "B1",
      targetLanguage: rawTargetLanguage,
      sourceLanguage: rawSourceLanguage,
      isAnswered,
      context,
      messages,
    } = parsed.data;

    const appLanguage = normalizeAppLanguage(profile?.app_language);
    const targetLanguage = normalizeLearningLanguage(rawTargetLanguage);
    const sourceLanguage = normalizeSourceLanguage(
      rawSourceLanguage ?? profile?.source_language,
    );
    const targetLanguageName = getLearningLanguageLabel(targetLanguage);
    const sourceLanguageName = getSourceLanguageLabel(sourceLanguage);

    const defaultExplanationLanguage =
      appLanguage === "uk" || sourceLanguage === "ukrainian"
        ? "Ukrainian"
        : "English";

    const isGradedUnanswered =
      !isAnswered &&
      (quizType === "mcq" ||
        quizType === "gap_fill" ||
        quizType === "translation" ||
        quizType === "text_translation");

    const contextLines: string[] = [
      `- Exercise Type: ${quizType}`,
      `- Student CEFR Level: ${cefrLevel}`,
      `- Target Learning Language: ${targetLanguageName}`,
      `- Student Native/Source Language: ${sourceLanguageName}`,
      `- Question State: ${
        isGradedUnanswered
          ? "UNANSWERED (Student has NOT submitted their answer yet — HINT MODE ONLY)"
          : "ANSWERED / REVIEW MODE (Full explanation allowed)"
      }`,
    ];

    if (context.itemLabel) {
      contextLines.push(`- Item: ${context.itemLabel}`);
    }
    if (context.questionText) {
      contextLines.push(`- Question / Prompt: "${context.questionText}"`);
    }
    if (context.sourceSentence) {
      contextLines.push(`- Source Text to Translate: "${context.sourceSentence}"`);
    }
    if (context.targetTerm) {
      contextLines.push(
        `- Target Vocabulary Term: "${
          isGradedUnanswered && quizType === "gap_fill"
            ? "[Hidden until student submits]"
            : context.targetTerm
        }"`,
      );
    }
    if (context.definition) {
      contextLines.push(`- Definition / Translation: "${context.definition}"`);
    }
    if (context.example) {
      contextLines.push(`- Example Sentence: "${context.example}"`);
    }
    if (context.hint) {
      contextLines.push(`- Hint Shown to Student: "${context.hint}"`);
    }
    if (context.grammarTopic) {
      contextLines.push(`- Grammar Focus: ${context.grammarTopic}`);
    }
    if (context.options && context.options.length > 0) {
      contextLines.push(`- Choices: ${context.options.map((o) => `"${o}"`).join(", ")}`);
    }
    if (context.userAnswer) {
      contextLines.push(`- Student's Current/Submitted Answer: "${context.userAnswer}"`);
    }

    if (!isGradedUnanswered) {
      if (context.correctAnswer) {
        contextLines.push(`- Correct / Reference Answer: "${context.correctAnswer}"`);
      }
      if (typeof context.isCorrect === "boolean") {
        contextLines.push(
          `- Evaluation Outcome: ${context.isCorrect ? "Correct" : "Incorrect"}`,
        );
      }
      if (typeof context.score === "number") {
        contextLines.push(`- Evaluation Score: ${context.score}/100`);
      }
      if (context.feedback) {
        contextLines.push(`- Previous Automated Feedback: "${context.feedback}"`);
      }
    } else if (context.correctAnswer) {
      contextLines.push(
        `- Secret Reference Answer (DO NOT REVEAL VERBATIM): "${context.correctAnswer}"`,
      );
    }

    const conversationHistory = messages
      .map(
        (m) =>
          `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`,
      )
      .join("\n\n");

    const modeInstructions = isGradedUnanswered
      ? `CRITICAL SPOILER RULE (HINT MODE):
The student has NOT submitted their answer yet.
1. NEVER reveal the exact correct word/option or write out the full translated target sentence for them.
2. Guide them like a supportive tutor: explain the grammar rule needed, clarify what clues in the sentence point to the answer, explain the meaning or part of speech required, or give a parallel example with different words.
3. If the student typed a draft answer, tell them what is on the right track or what grammar/vocabulary aspect to rethink without handing them the final answer.`
      : `EXPLANATION MODE (POST-ANSWER / STUDY):
The student has already submitted their answer (or is reviewing flashcards/discussion/results).
1. Give a direct, clear, and complete explanation.
2. Explain WHY the correct/reference answer works and, if the student made a mistake, gently explain why their answer didn't fit and how to remember the distinction.
3. Provide 1–2 short, natural example sentences in ${targetLanguageName} tailored to CEFR level ${cefrLevel}.`;

    const prompt = `You are a warm, concise, and expert language tutor assisting a student inside an interactive exercise on VocabCrafter.

EXERCISE CONTEXT:
${contextLines.join("\n")}

${modeInstructions}

LANGUAGE RULE:
- Default explanation language: ${defaultExplanationLanguage}.
- If the student writes their question in a specific language (for example Ukrainian or English), reply in that same language while keeping ${targetLanguageName} vocabulary terms and example sentences in ${targetLanguageName}.

STYLE GUIDELINES:
- Keep your response concise, practical, and easy to scan on mobile (2–4 short paragraphs or bullet points).
- Use **bold** for key vocabulary or grammar patterns.
- Also return 2 short, helpful follow-up questions ("followUps") in the same language as your reply that the student might want to click next.

CONVERSATION SO FAR:
${conversationHistory}

Respond with valid JSON matching this schema:
{
  "reply": "Your helpful tutor response here (supports **bold** and bullet points)",
  "followUps": ["Short follow-up question 1?", "Short follow-up question 2?"]
}`;

    const { data: result, usageSnapshot } = await generateFromGeminiWithUsage(
      {
        prompt,
        systemInstruction:
          "You are an expert language tutor inside VocabCrafter. Always respond with valid JSON only.",
        temperature: 0.4,
      },
      assistantResponseSchema,
    );

    await recordAIUsageEvent({
      userId: user.id,
      feature: "exercise_assistant",
      requestType: "text",
      model: GEMINI_MODEL,
      snapshot: usageSnapshot,
    });

    await incrementAICalls(user.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Exercise assistant error:", error);
    return NextResponse.json(
      { error: "Failed to get response from AI Assistant" },
      { status: 500 },
    );
  }
}

