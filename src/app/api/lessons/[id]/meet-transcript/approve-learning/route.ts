import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { approveLessonLearningCandidates } from "@/lib/lesson-transcript-vocab-analyzer";

const approveLearningSchema = z.object({
  items: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(120),
        ukrainianTranslation: z.string().trim().max(240).nullable().optional(),
        englishDefinition: z.string().trim().max(320).nullable().optional(),
        partOfSpeech: z.string().trim().max(40).nullable().optional(),
      }),
    )
    .max(50),
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
        { error: "Only tutors can approve learning words" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = approveLearningSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await approveLessonLearningCandidates({
      lessonId,
      tutorId: user.id,
      approvedItems: parsed.data.items,
      adminClient: supabaseAdmin,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Approve lesson learning candidates error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to approve learning words";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
