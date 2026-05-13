import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const updateQuizSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isPublic: z.boolean().optional(),
  generatedContent: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  request: Request,
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

    const body = await request.json();
    const parsed = updateQuizSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.isPublic !== undefined)
      updates.is_public = parsed.data.isPublic;
    if (parsed.data.generatedContent !== undefined)
      updates.generated_content = parsed.data.generatedContent;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const { data: quiz, error } = await supabase
      .from("quizzes")
      .update(updates)
      .eq("id", id)
      .eq("creator_id", user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("Quiz update error:", error);
      return NextResponse.json(
        { error: "Failed to update quiz" },
        { status: 500 },
      );
    }

    return NextResponse.json({ quiz });
  } catch (error) {
    console.error("Update quiz error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
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

    // Use admin client for assignment cleanup and archival updates.
    const supabaseAdmin = createAdminClient();

    // Verify the quiz belongs to this user before proceeding
    const { data: owned } = await supabaseAdmin
      .from("quizzes")
      .select("id, deleted_at")
      .eq("id", id)
      .eq("creator_id", user.id)
      .single();

    if (!owned) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    if (owned.deleted_at) {
      return NextResponse.json({ success: true });
    }

    const { error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .delete()
      .eq("quiz_id", id);

    if (assignmentError) {
      console.error("Quiz assignment cleanup error:", assignmentError);
      return NextResponse.json(
        { error: "Failed to archive quiz" },
        { status: 500 },
      );
    }

    const { error } = await supabaseAdmin
      .from("quizzes")
      .update({
        deleted_at: new Date().toISOString(),
        generated_content: {},
        vocabulary_terms: [],
        is_public: false,
      })
      .eq("id", id)
      .eq("creator_id", user.id)
      .is("deleted_at", null);

    if (error) {
      console.error("Quiz delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete quiz" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete quiz error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
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

    const { data: quiz, error } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json({ quiz });
  } catch (error) {
    console.error("Get quiz error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
