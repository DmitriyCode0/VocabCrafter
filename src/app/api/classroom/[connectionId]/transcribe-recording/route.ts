import { NextResponse } from "next/server";
import { FileState, type Part } from "@google/genai";
import { z } from "zod";
import { extractTextUsageSnapshot, recordAIUsageEvent } from "@/lib/ai/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTutorStudentClassroomParticipantAccess } from "@/lib/classroom-access";
import {
  GEMINI_TRANSCRIPTION_MODEL,
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

  const { data: recordingBlob, error: downloadError } =
    await supabaseAdmin.storage
      .from(recording.storage_bucket)
      .download(recording.storage_path);

  if (downloadError || !recordingBlob) {
    return NextResponse.json(
      { error: "Failed to download the classroom recording" },
      { status: 500 },
    );
  }

  if (recordingBlob.size === 0) {
    return NextResponse.json(
      { error: "The classroom recording is empty" },
      { status: 409 },
    );
  }

  const mimeType = getRecordingMimeType(
    recording.storage_path,
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

    const contents: Part[] = [
      { text: prompt },
      {
        fileData: {
          fileUri: readyFile.uri,
          mimeType: readyFile.mimeType,
        },
      },
    ];
    const response = await getGenAI().models.generateContent({
      model: GEMINI_TRANSCRIPTION_MODEL,
      contents,
      config: {
        systemInstruction:
          "You are a careful transcription system. Return only valid JSON that matches the requested schema and preserve the spoken words as faithfully as possible.",
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Gemini returned an empty transcription response");
    }

    const transcription = transcriptResultSchema.parse(
      JSON.parse(responseText),
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
      snapshot: extractTextUsageSnapshot({
        prompt,
        responseText,
        usageMetadata: response.usageMetadata,
      }),
    });

    return NextResponse.json(result);
  } catch (error) {
    await supabaseAdmin
      .from("tutor_student_classrooms")
      .update({
        transcript_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", access.classroom.id);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to transcribe classroom recording",
      },
      { status: 500 },
    );
  } finally {
    if (uploadedFileName) {
      try {
        await getGenAI().files.delete({ name: uploadedFileName });
      } catch {
        // Best-effort cleanup for uploaded Gemini files.
      }
    }
  }
}
