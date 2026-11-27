import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { mapLessonMeetTranscriptRowToView } from "@/lib/lesson-transcript-vocab-analyzer";

export async function GET(
  _request: NextRequest,
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

    const [{ data: profile }, { data: lesson, error: lessonError }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("tutor_student_lessons")
          .select("id, tutor_id, student_id, title, lesson_date, meet_url")
          .eq("id", lessonId)
          .maybeSingle(),
      ]);

    if (!profile || profile.role !== "tutor") {
      return NextResponse.json(
        { error: "Only tutors can manage lesson transcripts" },
        { status: 403 },
      );
    }

    if (lessonError) {
      return NextResponse.json(
        { error: "Failed to load lesson" },
        { status: 500 },
      );
    }

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (lesson.tutor_id !== user.id) {
      return NextResponse.json(
        { error: "You do not have access to this lesson" },
        { status: 403 },
      );
    }

    const { data: transcriptRow, error: transcriptError } = await supabaseAdmin
      .from("lesson_meet_transcripts")
      .select("*")
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (transcriptError) {
      return NextResponse.json(
        { error: "Failed to load transcript" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      transcript: transcriptRow
        ? mapLessonMeetTranscriptRowToView(transcriptRow)
        : null,
    });
  } catch (error) {
    console.error("Get lesson meet transcript error:", error);
    return NextResponse.json(
      { error: "Failed to load lesson transcript" },
      { status: 500 },
    );
  }
}
