import { after, NextResponse } from "next/server";
import { FileState } from "@google/genai";
import { z } from "zod";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTutorStudentClassroomParticipantAccess } from "@/lib/classroom-access";
import {
  GEMINI_TRANSCRIPTION_MODEL,
  generateFromGeminiWithUsage,
  getGenAI,
} from "@/lib/gemini/client";
import {
  saveClassroomTranscriptAndSyncEvidence,
  type ClassroomTranscriptReviewStatus,
} from "@/lib/classroom-transcript-processing";
import { normalizeClassroomTranscriptSegments } from "@/lib/classroom-transcripts";

const fileStateSchema = z.enum([
  FileState.STATE_UNSPECIFIED,
  FileState.PROCESSING,
  FileState.ACTIVE,
  FileState.FAILED,
]);

const requestSchema = z.object({
  recordingId: z.string().uuid(),
  languageCode: z.string().trim().max(16).nullable().optional(),
  async: z.boolean().optional(),
});

const transcriptResultSchema = z.object({
  languageCode: z.string().trim().max(16).nullable().optional(),
  segments: z
    .array(
      z.object({
        speakerRole: z.enum(["student", "tutor", "unknown", "system"]),
        content: z.string().trim().min(1).max(10_000),
      }),
    )
    .min(1)
    .max(5000),
});

const DEFAULT_TRANSCRIPTION_MAX_FILE_BYTES = 15 * 1024 * 1024;

function getTranscriptionMaxFileBytes() {
  const parsed = Number.parseInt(
    process.env.TRANSCRIPTION_MAX_FILE_BYTES ??
      `${DEFAULT_TRANSCRIPTION_MAX_FILE_BYTES}`,
    10,
  );

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TRANSCRIPTION_MAX_FILE_BYTES;
  }

  return parsed;
}

function getRecordingMimeType(
  path: string | null,
  blobType: string | undefined,
) {
  if (blobType) {
    return blobType;
  }

  const normalizedPath = path?.toLowerCase() ?? "";

  if (normalizedPath.endsWith(".mp4") || normalizedPath.endsWith(".m4v")) {
    return "video/mp4";
  }

  if (normalizedPath.endsWith(".mov")) {
    return "video/quicktime";
  }

  if (normalizedPath.endsWith(".mp3")) {
    return "audio/mpeg";
  }

  if (normalizedPath.endsWith(".ogg") || normalizedPath.endsWith(".oga")) {
    return "audio/ogg";
  }

  if (normalizedPath.endsWith(".wav")) {
    return "audio/wav";
  }

  if (normalizedPath.endsWith(".m4a")) {
    return "audio/mp4";
  }

  return "video/mp4";
}

async function waitForGeminiFileActive(fileName: string) {
  let attemptsRemaining = 30;

  while (attemptsRemaining > 0) {
    const file = await getGenAI().files.get({ name: fileName });
    const state = fileStateSchema.parse(
      file.state ?? FileState.STATE_UNSPECIFIED,
    );

    if (state === FileState.ACTIVE) {
      return file;
    }

    if (state === FileState.FAILED) {
      throw new Error("Gemini failed to process the uploaded recording");
    }

    attemptsRemaining -= 1;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Timed out while Gemini prepared the classroom recording");
}

function buildTranscriptionPrompt(languageCode?: string | null) {
  const languageHint = languageCode?.trim()
    ? `The expected primary lesson language code is ${languageCode.trim()}.`
    : "Infer the language code from the recording when possible.";

  return `You are transcribing a private 1:1 language lesson between a tutor and a student.

${languageHint}

Return valid JSON only in this exact shape:
{
  "languageCode": "en",
  "segments": [
    {
      "speakerRole": "student",
      "content": "Exact spoken text"
    }
  ]
}

Rules:
- Use only these speakerRole values: student, tutor, unknown, system.
- Transcribe the spoken content faithfully. Do not summarize or paraphrase.
- Split into utterance-sized segments, not word-by-word fragments.
- Prefer student for learner speech and tutor for teacher speech.
- If speaker identity is unclear, use unknown.
- Exclude silence-only segments and background noise.
- Keep the original language in the transcript text.`;
}

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
      { error: "Only tutors can transcribe classroom recordings" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminClient();
  const { data: recording, error: recordingError } = await supabaseAdmin
    .from("tutor_student_classroom_recordings")
    .select("id, classroom_id, storage_bucket, storage_path")
    .eq("id", parsed.data.recordingId)
    .eq("classroom_id", access.classroom.id)
    .maybeSingle();

  if (recordingError) {
    return NextResponse.json(
      { error: "Failed to load classroom recording" },
      { status: 500 },
    );
  }

  if (!recording) {
    return NextResponse.json(
      { error: "Classroom recording not found" },
      { status: 404 },
    );
  }

  if (!recording.storage_bucket || !recording.storage_path) {
    return NextResponse.json(
      {
        error:
          "The selected classroom recording does not have a stored media file",
      },
      { status: 409 },
    );
  }

  const recordingStorageBucket = recording.storage_bucket;
  const recordingStoragePath = recording.storage_path;

  const { data: existingTranscript, error: existingTranscriptError } =
    await supabaseAdmin
      .from("tutor_student_classroom_transcripts")
      .select(
        "id, recording_id, classroom_id, language_code, diarization_status, review_status, full_text, error_message, active_evidence_synced_at, created_at, updated_at",
      )
      .eq("recording_id", recording.id)
      .maybeSingle();

  if (existingTranscriptError) {
    return NextResponse.json(
      { error: "Failed to inspect existing classroom transcript" },
      { status: 500 },
    );
  }

  if (existingTranscript?.diarization_status === "ready") {
    return NextResponse.json({
      transcript: existingTranscript,
      activeEvidence: {
        importedCount: 0,
        createdCount: 0,
        updatedCount: 0,
      },
      sourceLabel: "",
      alreadyTranscribed: true,
    });
  }

  if (existingTranscript?.diarization_status === "processing") {
    return NextResponse.json(
      { error: "Classroom transcript generation is already in progress" },
      { status: 409 },
    );
  }

  const markTranscriptionFailed = async (errorMessage: string) => {
    try {
      await saveClassroomTranscriptAndSyncEvidence({
        access,
        recordingId: parsed.data.recordingId,
        languageCode: parsed.data.languageCode ?? null,
        diarizationStatus: "failed",
        reviewStatus: "pending" as ClassroomTranscriptReviewStatus,
        errorMessage,
        syncActiveEvidence: false,
      });
    } catch {
      await supabaseAdmin
        .from("tutor_student_classrooms")
        .update({
          transcript_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", access.classroom.id);
    }
  };

  const runTranscription = async () => {
    await saveClassroomTranscriptAndSyncEvidence({
      access,
      recordingId: parsed.data.recordingId,
      languageCode: parsed.data.languageCode ?? null,
      diarizationStatus: "processing",
      reviewStatus: "pending" as ClassroomTranscriptReviewStatus,
      syncActiveEvidence: false,
    });

    const { data: recordingBlob, error: downloadError } =
      await supabaseAdmin.storage
        .from(recordingStorageBucket)
        .download(recordingStoragePath);

    if (downloadError || !recordingBlob) {
      throw new Error("Failed to download the classroom recording");
    }

    if (recordingBlob.size === 0) {
      throw new Error("The classroom recording is empty");
    }

    const maxFileBytes = getTranscriptionMaxFileBytes();

    if (recordingBlob.size > maxFileBytes) {
      throw new Error(
        `Recording is too large to transcribe automatically (${Math.ceil(
          recordingBlob.size / (1024 * 1024),
        )} MB). Current limit is ${Math.ceil(maxFileBytes / (1024 * 1024))} MB.`,
      );
    }

    const mimeType = getRecordingMimeType(
      recordingStoragePath,
      recordingBlob.type || undefined,
    );
    const prompt = buildTranscriptionPrompt(parsed.data.languageCode ?? null);
    let uploadedFileName: string | null = null;

    try {
      const uploadedFile = await getGenAI().files.upload({
        file: new Blob([recordingBlob], { type: mimeType }),
        config: {
          mimeType,
          displayName: `classroom-recording-${recording.id}`,
        },
      });

      if (!uploadedFile.name) {
        throw new Error("Gemini did not return an uploaded file reference");
      }

      uploadedFileName = uploadedFile.name;
      const readyFile = await waitForGeminiFileActive(uploadedFile.name);

      if (!readyFile.uri || !readyFile.mimeType) {
        throw new Error(
          "Gemini did not return a usable uploaded recording reference",
        );
      }

      const contents = [
        { text: prompt },
        {
          fileData: {
            fileUri: readyFile.uri,
            mimeType: readyFile.mimeType,
          },
        },
      ];
      const { data: transcription, usageSnapshot } =
        await generateFromGeminiWithUsage(
          {
            model: GEMINI_TRANSCRIPTION_MODEL,
            prompt,
            contents,
            systemInstruction:
              "You are a careful transcription system. Return only valid JSON that matches the requested schema and preserve the spoken words as faithfully as possible.",
            temperature: 0.1,
          },
          transcriptResultSchema,
        );
      const result = await saveClassroomTranscriptAndSyncEvidence({
        access,
        recordingId: parsed.data.recordingId,
        languageCode:
          transcription.languageCode ?? parsed.data.languageCode ?? null,
        diarizationStatus: "ready",
        reviewStatus: "pending" as ClassroomTranscriptReviewStatus,
        segments: normalizeClassroomTranscriptSegments(
          transcription.segments.map((segment) => ({
            speakerRole: segment.speakerRole,
            content: segment.content,
          })),
        ),
        syncActiveEvidence: false,
      });

      await recordAIUsageEvent({
        userId: access.userId,
        feature: "classroom_transcript",
        requestType: "text",
        model: GEMINI_TRANSCRIPTION_MODEL,
        snapshot: usageSnapshot,
      });

      return result;
    } finally {
      if (uploadedFileName) {
        try {
          await getGenAI().files.delete({ name: uploadedFileName });
        } catch {
          // Best-effort cleanup for uploaded Gemini files.
        }
      }
    }
  };

  const runAsync = parsed.data.async !== false;

  if (runAsync) {
    after(async () => {
      try {
        await runTranscription();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to transcribe classroom recording";
        await markTranscriptionFailed(errorMessage);
      }
    });

    return NextResponse.json(
      {
        queued: true,
        status: "processing",
      },
      { status: 202 },
    );
  }

  try {
    const result = await runTranscription();
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to transcribe classroom recording";
    await markTranscriptionFailed(errorMessage);

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
