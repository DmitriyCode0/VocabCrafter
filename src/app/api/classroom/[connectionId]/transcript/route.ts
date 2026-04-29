import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTutorStudentClassroomParticipantAccess } from "@/lib/classroom-access";
import {
  saveClassroomTranscriptAndSyncEvidence,
  type ClassroomTranscriptDiarizationStatus,
  type ClassroomTranscriptReviewStatus,
} from "@/lib/classroom-transcript-processing";
import { type ClassroomTranscriptSegmentInput } from "@/lib/classroom-transcripts";

const transcriptSegmentSchema = z
  .object({
    speakerRole: z.enum(["tutor", "student", "unknown", "system"]),
    speakerLabel: z.string().trim().max(160).nullable().optional(),
    startedAtSeconds: z.number().min(0).nullable().optional(),
    endedAtSeconds: z.number().min(0).nullable().optional(),
    content: z.string().trim().min(1).max(10_000),
    confidence: z.number().min(0).max(1).nullable().optional(),
    needsReview: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.startedAtSeconds == null ||
      value.endedAtSeconds == null ||
      value.endedAtSeconds >= value.startedAtSeconds,
    {
      message:
        "endedAtSeconds must be greater than or equal to startedAtSeconds",
      path: ["endedAtSeconds"],
    },
  );

const classroomTranscriptPayloadSchema = z.object({
  recordingId: z.string().uuid(),
  languageCode: z.string().trim().max(16).nullable().optional(),
  diarizationStatus: z
    .enum(["pending", "processing", "ready", "failed"])
    .default("ready"),
  reviewStatus: z.enum(["pending", "reviewed"]).default("pending"),
  fullText: z.string().trim().max(100_000).nullable().optional(),
  errorMessage: z.string().trim().max(1_000).nullable().optional(),
  segments: z.array(transcriptSegmentSchema).max(5_000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;
  const access =
    await requireTutorStudentClassroomParticipantAccess(connectionId);

  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  if (access.role !== "tutor") {
    return NextResponse.json(
      { error: "Only tutors can save classroom transcripts" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = classroomTranscriptPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await saveClassroomTranscriptAndSyncEvidence({
      access,
      recordingId: parsed.data.recordingId,
      languageCode: parsed.data.languageCode ?? null,
      diarizationStatus: parsed.data
        .diarizationStatus as ClassroomTranscriptDiarizationStatus,
      reviewStatus: parsed.data.reviewStatus as ClassroomTranscriptReviewStatus,
      fullText: parsed.data.fullText ?? null,
      errorMessage: parsed.data.errorMessage ?? null,
      segments: (parsed.data.segments ??
        []) as ClassroomTranscriptSegmentInput[],
      syncActiveEvidence: false,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save classroom transcript",
      },
      { status: 500 },
    );
  }
}
