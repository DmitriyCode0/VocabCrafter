import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  fetchGoogleMeetTranscriptForLesson,
  GoogleMeetTranscriptError,
} from "@/lib/google-meet-transcripts";
import { analyzeLessonTranscriptAndAutoApply } from "@/lib/lesson-transcript-vocab-analyzer";

const syncTranscriptSchema = z.object({
  mode: z.enum(["auto", "manual"]).default("auto"),
  rawText: z.string().max(250000).optional(),
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

    const body = await request.json().catch(() => ({}));
    const parsed = syncTranscriptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const [{ data: tutorProfile }, { data: lesson, error: lessonError }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("role, full_name")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("tutor_student_lessons")
          .select("id, tutor_id, student_id, title, lesson_date, meet_url")
          .eq("id", lessonId)
          .maybeSingle(),
      ]);

    if (!tutorProfile || tutorProfile.role !== "tutor") {
      return NextResponse.json(
        { error: "Only tutors can sync lesson transcripts" },
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

    if (!lesson.student_id) {
      return NextResponse.json(
        {
          error:
            "Assign a student to this lesson before analyzing transcript vocabulary.",
        },
        { status: 400 },
      );
    }

    const { data: studentProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", lesson.student_id)
      .maybeSingle();

    const studentName = studentProfile?.full_name ?? null;

    let rawText = "";
    let sourceType: "google_drive" | "manual_paste" = "google_drive";
    let googleDriveFileId: string | null = null;
    let googleDriveFileName: string | null = null;
    let googleDriveWebViewLink: string | null = null;

    if (parsed.data.mode === "manual") {
      const pasted = parsed.data.rawText?.trim() ?? "";
      if (pasted.length < 20) {
        return NextResponse.json(
          { error: "Please paste a transcript (at least 20 characters)." },
          { status: 400 },
        );
      }
      rawText = pasted;
      sourceType = "manual_paste";
    } else {
      const fetched = await fetchGoogleMeetTranscriptForLesson({
        lessonId: lesson.id,
        tutorId: user.id,
        supabaseAdmin,
        lessonTitle: lesson.title,
        lessonDate: lesson.lesson_date,
        meetUrl: lesson.meet_url,
        studentName,
      });
      rawText = fetched.rawText;
      googleDriveFileId = fetched.driveFileId;
      googleDriveFileName = fetched.driveFileName;
      googleDriveWebViewLink = fetched.driveWebViewLink;
      sourceType = "google_drive";
    }

    const transcript = await analyzeLessonTranscriptAndAutoApply({
      lessonId: lesson.id,
      tutorId: user.id,
      tutorName: tutorProfile.full_name ?? null,
      studentId: lesson.student_id,
      studentName,
      lessonTitle: lesson.title,
      lessonDate: lesson.lesson_date,
      sourceType,
      googleDriveFileId,
      googleDriveFileName,
      googleDriveWebViewLink,
      rawText,
      adminClient: supabaseAdmin,
    });

    return NextResponse.json({ transcript });
  } catch (error) {
    if (error instanceof GoogleMeetTranscriptError) {
      const status =
        error.code === "NEEDS_DRIVE_SCOPE"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "NO_CONNECTION"
              ? 400
              : 502;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }

    console.error("Sync lesson meet transcript error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to sync lesson transcript";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
