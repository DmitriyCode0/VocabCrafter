import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveQuizTermsWithDictionary } from "@/lib/quiz/quiz-term-resolution";

const resolveQuizTermsSchema = z.object({
  terms: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    }),
  ),
  targetLanguage: z.enum(["english", "spanish"]).optional(),
  sourceLanguage: z.enum(["english", "ukrainian"]).optional(),
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
    const parsed = resolveQuizTermsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const resolvedTerms = await resolveQuizTermsWithDictionary({
      adminClient: createAdminClient(),
      actorUserId: user.id,
      studentId: user.id,
      targetLanguage: parsed.data.targetLanguage,
      sourceLanguage: parsed.data.sourceLanguage,
      terms: parsed.data.terms,
    });

    return NextResponse.json({
      terms: resolvedTerms.map(({ term, definition }) => ({ term, definition })),
    });
  } catch (error) {
    console.error("Resolve quiz terms error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}