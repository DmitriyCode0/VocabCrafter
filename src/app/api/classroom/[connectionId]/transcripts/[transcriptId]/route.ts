import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTutorStudentClassroomParticipantAccess } from "@/lib/classroom-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveClassroomTranscriptActiveEvidence } from "@/lib/classroom-transcript-processing";

const approveTranscriptSchema = z.object({
  approvedTerms: z.array(z.string().trim().min(1).max(200)).min(1).max(500),
});

function getAggregateTranscriptStatus(
  statuses: string[],
): "ready" | "processing" | "failed" | "idle" {
  if (statuses.some((status) => status === "ready")) {
    return "ready";
  }

  if (
    statuses.some((status) => status === "processing" || status === "pending")
  ) {
    return "processing";
  }

  if (statuses.some((status) => status === "failed")) {
    return "failed";
  }

  return "idle";
}

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ connectionId: string; transcriptId: string }> },
) {
  const { connectionId, transcriptId } = await params;
  const access =
    await requireTutorStudentClassroomParticipantAccess(connectionId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  if (access.role !== "tutor") {
    return NextResponse.json(
      { error: "Only tutors can approve classroom transcripts" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = approveTranscriptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await approveClassroomTranscriptActiveEvidence({
      access,
      transcriptId,
      approvedTerms: parsed.data.approvedTerms,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to approve classroom transcript",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ connectionId: string; transcriptId: string }> },
) {
  const { connectionId, transcriptId } = await params;
  const access =
    await requireTutorStudentClassroomParticipantAccess(connectionId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  if (access.role !== "tutor") {
    return NextResponse.json(
      { error: "Only tutors can delete classroom transcripts" },
      { status: 403 },
    );
  }

  const supabaseAdmin = createAdminClient();
  const { data: transcript, error: transcriptError } = await supabaseAdmin
    .from("tutor_student_classroom_transcripts")
    .select("id")
    .eq("id", transcriptId)
    .eq("classroom_id", access.classroom.id)
    .maybeSingle();

  if (transcriptError) {
    return NextResponse.json(
      { error: "Failed to load classroom transcript" },
      { status: 500 },
    );
  }

  if (!transcript) {
    return NextResponse.json(
      { error: "Classroom transcript not found" },
      { status: 404 },
    );
  }

  const { error: deleteSegmentsError } = await supabaseAdmin
    .from("tutor_student_classroom_transcript_segments")
    .delete()
    .eq("transcript_id", transcript.id);

  if (deleteSegmentsError) {
    return NextResponse.json(
      { error: "Failed to delete classroom transcript segments" },
      { status: 500 },
    );
  }

  const { error: deleteTranscriptError } = await supabaseAdmin
    .from("tutor_student_classroom_transcripts")
    .delete()
    .eq("id", transcript.id);

  if (deleteTranscriptError) {
    return NextResponse.json(
      { error: "Failed to delete classroom transcript" },
      { status: 500 },
    );
  }

  const { data: remainingTranscripts, error: remainingTranscriptsError } =
    await supabaseAdmin
      .from("tutor_student_classroom_transcripts")
      .select("diarization_status")
      .eq("classroom_id", access.classroom.id);

  if (remainingTranscriptsError) {
    return NextResponse.json(
      { error: "Failed to refresh classroom transcript state" },
      { status: 500 },
    );
  }

  const { error: classroomUpdateError } = await supabaseAdmin
    .from("tutor_student_classrooms")
    .update({
      transcript_status: getAggregateTranscriptStatus(
        (remainingTranscripts ?? []).map((item) => item.diarization_status),
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", access.classroom.id);

  if (classroomUpdateError) {
    return NextResponse.json(
      { error: "Failed to update classroom transcript status" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
