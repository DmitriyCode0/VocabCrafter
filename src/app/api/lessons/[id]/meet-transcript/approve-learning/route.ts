import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { applyLessonTranscriptVocabulary } from "@/lib/lesson-transcript-vocab-analyzer";

const reviewItemSchema = z.object({
  term: z.string().trim().min(1).max(120),
  ukrainianTranslation: z.string().trim().max(240).nullable().optional(),
  englishDefinition: z.string().trim().max(320).nullable().optional(),
  partOfSpeech: z.string().trim().max(40).nullable().optional(),
  cefrLevel: z.string().trim().max(10).nullable().optional(),
  quote: z.string().trim().max(320).nullable().optional(),
  source: z.string().trim().max(40).nullable().optional(),
  graduatedFromLearning: z.boolean().optional(),
});

const approveTranscriptVocabSchema = z.object({
  activeItems: z.array(reviewItemSchema).max(600).optional(),
  passiveItems: z.array(reviewItemSchema).max(600).optional(),
  learningItems: z.array(reviewItemSchema).max(60).optional(),
  // Legacy fallback field name
  items: z.array(reviewItemSchema).max(60).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: lessonId } = await params;
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "tutor") {
      return NextResponse.json(
        { error: "Only tutors can apply lesson vocabulary" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = approveTranscriptVocabSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await applyLessonTranscriptVocabulary({
      lessonId,
      tutorId: user.id,
      activeItems: parsed.data.activeItems ?? [],
      passiveItems: parsed.data.passiveItems ?? [],
      learningItems: parsed.data.learningItems ?? parsed.data.items ?? [],
      adminClient: supabaseAdmin,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Apply lesson transcript vocabulary error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to apply lesson vocabulary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
