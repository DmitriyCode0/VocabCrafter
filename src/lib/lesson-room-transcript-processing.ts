import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { LessonRoomAccessData } from "@/lib/lesson-room-access";
import { normalizeLearningLanguage } from "@/lib/languages";
import {
  buildLessonActiveEvidenceSourceLabel,
  buildLessonTranscriptFullText,
  extractStudentActiveVocabularyTermsFromTranscriptSegments,
  normalizeLessonTranscriptSegments,
  type LessonTranscriptSegmentInput,
} from "@/lib/lesson-room-transcripts";
import { upsertActiveVocabularyEvidence } from "@/lib/mastery/active-vocabulary-evidence";
import type { Database } from "@/types/database";

export type LessonTranscriptDiarizationStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed";
export type LessonTranscriptReviewStatus = "pending" | "reviewed";

interface SaveLessonTranscriptInput {
  access: LessonRoomAccessData;
  recordingId: string;
  languageCode?: string | null;
  diarizationStatus: LessonTranscriptDiarizationStatus;
  reviewStatus: LessonTranscriptReviewStatus;
  fullText?: string | null;
  errorMessage?: string | null;
  segments?: LessonTranscriptSegmentInput[];
}

interface SaveLessonTranscriptResult {
  transcript: Database["public"]["Tables"]["lesson_room_transcripts"]["Row"];
  activeEvidence: {
    importedCount: number;
    createdCount: number;
    updatedCount: number;
  };
  sourceLabel: string;
}

function getSessionTranscriptStatus(
  diarizationStatus: LessonTranscriptDiarizationStatus,
) {
  switch (diarizationStatus) {
    case "ready":
      return "ready";
    case "failed":
      return "failed";
    default:
      return "processing";
  }
}

function getRecordingCompletionState(
  diarizationStatus: LessonTranscriptDiarizationStatus,
) {
  if (diarizationStatus === "ready" || diarizationStatus === "failed") {
    return {
      recordingStatus: "ready" as const,
      sessionRecordingStatus: "completed" as const,
    };
  }

  return {
    recordingStatus: "processing" as const,
    sessionRecordingStatus: "processing" as const,
  };
}

export async function saveLessonTranscriptAndSyncEvidence({
  access,
  recordingId,
  languageCode,
  diarizationStatus,
  reviewStatus,
  fullText,
  errorMessage,
  segments,
}: SaveLessonTranscriptInput): Promise<SaveLessonTranscriptResult> {
  const supabaseAdmin = createAdminClient();
  const { data: recording, error: recordingError } = await supabaseAdmin
    .from("lesson_room_recordings")
    .select("id, lesson_id, session_id, created_at")
    .eq("id", recordingId)
    .eq("lesson_id", access.lesson.id)
    .maybeSingle();

  if (recordingError) {
    throw new Error("Failed to load lesson recording");
  }

  if (!recording || recording.session_id !== access.session.id) {
    throw new Error("Lesson recording not found");
  }

  const { data: existingTranscript, error: existingTranscriptError } =
    await supabaseAdmin
      .from("lesson_room_transcripts")
      .select("id, full_text, active_evidence_synced_at")
      .eq("recording_id", recording.id)
      .maybeSingle();

  if (existingTranscriptError) {
    throw new Error("Failed to inspect lesson transcript");
  }

  const hasSegmentsUpdate = Array.isArray(segments);
  const normalizedSegments = normalizeLessonTranscriptSegments(segments);

  if (
    diarizationStatus === "ready" &&
    !hasSegmentsUpdate &&
    !(fullText?.trim() || existingTranscript?.full_text)
  ) {
    throw new Error("Ready transcripts require text or segments");
  }

  const nowIso = new Date().toISOString();
  const nextFullText =
    fullText?.trim() ||
    (hasSegmentsUpdate
      ? buildLessonTranscriptFullText(normalizedSegments)
      : existingTranscript?.full_text ?? null);

  const transcriptPayload = {
    recording_id: recording.id,
    lesson_id: access.lesson.id,
    language_code: languageCode?.trim() || null,
    diarization_status: diarizationStatus,
    review_status: reviewStatus,
    full_text: nextFullText,
    error_message: errorMessage?.trim() || null,
    updated_at: nowIso,
  };

  const transcriptResult = existingTranscript
    ? await supabaseAdmin
        .from("lesson_room_transcripts")
        .update(transcriptPayload)
        .eq("id", existingTranscript.id)
        .select("*")
        .single()
    : await supabaseAdmin
        .from("lesson_room_transcripts")
        .insert(transcriptPayload)
        .select("*")
        .single();

  if (transcriptResult.error || !transcriptResult.data) {
    throw new Error("Failed to save lesson transcript");
  }

  let transcript = transcriptResult.data;

  if (hasSegmentsUpdate) {
    const { error: deleteSegmentsError } = await supabaseAdmin
      .from("lesson_room_transcript_segments")
      .delete()
      .eq("transcript_id", transcript.id);

    if (deleteSegmentsError) {
      throw new Error("Failed to replace transcript segments");
    }

    if (normalizedSegments.length > 0) {
      const { error: insertSegmentsError } = await supabaseAdmin
        .from("lesson_room_transcript_segments")
        .insert(
          normalizedSegments.map((segment) => ({
            transcript_id: transcript.id,
            lesson_id: access.lesson.id,
            speaker_role: segment.speakerRole,
            speaker_label: segment.speakerLabel ?? null,
            started_at_seconds: segment.startedAtSeconds ?? null,
            ended_at_seconds: segment.endedAtSeconds ?? null,
            content: segment.content,
            confidence: segment.confidence ?? null,
            needs_review: segment.needsReview ?? false,
            updated_at: nowIso,
          })),
        );

      if (insertSegmentsError) {
        throw new Error("Failed to save transcript segments");
      }
    }
  }

  let activeEvidence = {
    importedCount: 0,
    createdCount: 0,
    updatedCount: 0,
  };
  const shouldSyncActiveEvidence =
    diarizationStatus === "ready" &&
    hasSegmentsUpdate &&
    !transcript.active_evidence_synced_at;

  if (shouldSyncActiveEvidence && access.lesson.student_id) {
    const studentTerms =
      extractStudentActiveVocabularyTermsFromTranscriptSegments(
        normalizedSegments,
      );

    if (studentTerms.length > 0) {
      const { data: studentProfile, error: studentProfileError } =
        await supabaseAdmin
          .from("profiles")
          .select("preferred_language")
          .eq("id", access.lesson.student_id)
          .maybeSingle();

      if (studentProfileError) {
        throw new Error("Failed to load the student's language profile");
      }

      activeEvidence = await upsertActiveVocabularyEvidence({
        adminClient: supabaseAdmin,
        studentId: access.lesson.student_id,
        actorUserId: access.userId,
        targetLanguage: normalizeLearningLanguage(
          studentProfile?.preferred_language,
        ),
        terms: studentTerms,
        sourceType: "lesson_recording",
        sourceLabel: buildLessonActiveEvidenceSourceLabel(access.lesson),
        usedAt: recording.created_at,
      });
    }

    const syncedTranscriptResult = await supabaseAdmin
      .from("lesson_room_transcripts")
      .update({
        active_evidence_synced_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", transcript.id)
      .select("*")
      .single();

    if (syncedTranscriptResult.error || !syncedTranscriptResult.data) {
      throw new Error("Failed to finalize lesson transcript processing");
    }

    transcript = syncedTranscriptResult.data;
  }

  const recordingCompletionState = getRecordingCompletionState(
    diarizationStatus,
  );
  const { error: recordingUpdateError } = await supabaseAdmin
    .from("lesson_room_recordings")
    .update({
      status: recordingCompletionState.recordingStatus,
      updated_at: nowIso,
    })
    .eq("id", recording.id);

  if (recordingUpdateError) {
    throw new Error("Failed to update lesson recording status");
  }

  const { error: sessionUpdateError } = await supabaseAdmin
    .from("lesson_room_sessions")
    .update({
      recording_status: recordingCompletionState.sessionRecordingStatus,
      transcript_status: getSessionTranscriptStatus(diarizationStatus),
      updated_at: nowIso,
    })
    .eq("id", access.session.id);

  if (sessionUpdateError) {
    throw new Error("Failed to update lesson room session");
  }

  return {
    transcript,
    activeEvidence,
    sourceLabel: buildLessonActiveEvidenceSourceLabel(access.lesson),
  };
}
