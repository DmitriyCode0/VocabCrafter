import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { TutorStudentClassroomAccessData } from "@/lib/classroom-access";
import { normalizeLearningLanguage } from "@/lib/languages";
import {
  buildClassroomActiveEvidenceSourceLabel,
  buildClassroomTranscriptFullText,
  extractStudentActiveVocabularyTermsFromClassroomTranscriptSegments,
  normalizeClassroomTranscriptSegments,
  type ClassroomTranscriptSegmentInput,
} from "@/lib/classroom-transcripts";
import { extractPassiveVocabularyTermOccurrencesFromText } from "@/lib/mastery/passive-vocabulary";
import { upsertActiveVocabularyEvidence } from "@/lib/mastery/active-vocabulary-evidence";
import type { Database } from "@/types/database";

export type ClassroomTranscriptDiarizationStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed";
export type ClassroomTranscriptReviewStatus = "pending" | "reviewed";

interface SaveClassroomTranscriptInput {
  access: TutorStudentClassroomAccessData;
  recordingId: string;
  languageCode?: string | null;
  diarizationStatus: ClassroomTranscriptDiarizationStatus;
  reviewStatus: ClassroomTranscriptReviewStatus;
  fullText?: string | null;
  errorMessage?: string | null;
  segments?: ClassroomTranscriptSegmentInput[];
  syncActiveEvidence?: boolean;
}

interface SaveClassroomTranscriptResult {
  transcript: Database["public"]["Tables"]["tutor_student_classroom_transcripts"]["Row"];
  activeEvidence: {
    importedCount: number;
    createdCount: number;
    updatedCount: number;
  };
  sourceLabel: string;
}

function getClassroomTranscriptStatus(
  diarizationStatus: ClassroomTranscriptDiarizationStatus,
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
  diarizationStatus: ClassroomTranscriptDiarizationStatus,
) {
  if (diarizationStatus === "ready" || diarizationStatus === "failed") {
    return {
      recordingStatus: "ready" as const,
      classroomRecordingStatus: "completed" as const,
    };
  }

  return {
    recordingStatus: "processing" as const,
    classroomRecordingStatus: "processing" as const,
  };
}

function getTutorLabel(access: TutorStudentClassroomAccessData) {
  return (
    access.connection.tutor_profile?.full_name ||
    access.connection.tutor_profile?.email ||
    "Tutor"
  );
}

function getStudentLabel(access: TutorStudentClassroomAccessData) {
  return (
    access.connection.student_profile?.full_name ||
    access.connection.student_profile?.email ||
    "Student"
  );
}

export async function saveClassroomTranscriptAndSyncEvidence({
  access,
  recordingId,
  languageCode,
  diarizationStatus,
  reviewStatus,
  fullText,
  errorMessage,
  segments,
  syncActiveEvidence = true,
}: SaveClassroomTranscriptInput): Promise<SaveClassroomTranscriptResult> {
  const supabaseAdmin = createAdminClient();
  const { data: recording, error: recordingError } = await supabaseAdmin
    .from("tutor_student_classroom_recordings")
    .select("id, classroom_id, created_at")
    .eq("id", recordingId)
    .eq("classroom_id", access.classroom.id)
    .maybeSingle();

  if (recordingError) {
    throw new Error("Failed to load classroom recording");
  }

  if (!recording) {
    throw new Error("Classroom recording not found");
  }

  const { data: existingTranscript, error: existingTranscriptError } =
    await supabaseAdmin
      .from("tutor_student_classroom_transcripts")
      .select("id, full_text, active_evidence_synced_at")
      .eq("recording_id", recording.id)
      .maybeSingle();

  if (existingTranscriptError) {
    throw new Error("Failed to inspect classroom transcript");
  }

  const hasSegmentsUpdate = Array.isArray(segments);
  const normalizedSegments = normalizeClassroomTranscriptSegments(segments);

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
      ? buildClassroomTranscriptFullText(normalizedSegments)
      : (existingTranscript?.full_text ?? null));

  const transcriptPayload = {
    recording_id: recording.id,
    classroom_id: access.classroom.id,
    language_code: languageCode?.trim() || null,
    diarization_status: diarizationStatus,
    review_status: reviewStatus,
    full_text: nextFullText,
    error_message: errorMessage?.trim() || null,
    updated_at: nowIso,
  };

  const transcriptResult = existingTranscript
    ? await supabaseAdmin
        .from("tutor_student_classroom_transcripts")
        .update(transcriptPayload)
        .eq("id", existingTranscript.id)
        .select("*")
        .single()
    : await supabaseAdmin
        .from("tutor_student_classroom_transcripts")
        .insert(transcriptPayload)
        .select("*")
        .single();

  if (transcriptResult.error || !transcriptResult.data) {
    throw new Error("Failed to save classroom transcript");
  }

  let transcript = transcriptResult.data;

  if (hasSegmentsUpdate) {
    const { error: deleteSegmentsError } = await supabaseAdmin
      .from("tutor_student_classroom_transcript_segments")
      .delete()
      .eq("transcript_id", transcript.id);

    if (deleteSegmentsError) {
      throw new Error("Failed to replace classroom transcript segments");
    }

    if (normalizedSegments.length > 0) {
      const { error: insertSegmentsError } = await supabaseAdmin
        .from("tutor_student_classroom_transcript_segments")
        .insert(
          normalizedSegments.map((segment) => ({
            transcript_id: transcript.id,
            classroom_id: access.classroom.id,
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
        throw new Error("Failed to save classroom transcript segments");
      }
    }
  }

  let activeEvidence = {
    importedCount: 0,
    createdCount: 0,
    updatedCount: 0,
  };
  const shouldSyncActiveEvidence =
    syncActiveEvidence &&
    diarizationStatus === "ready" &&
    hasSegmentsUpdate &&
    !transcript.active_evidence_synced_at;

  if (shouldSyncActiveEvidence) {
    const studentTerms =
      extractStudentActiveVocabularyTermsFromClassroomTranscriptSegments(
        normalizedSegments,
      );

    if (studentTerms.length > 0) {
      const { data: studentProfile, error: studentProfileError } =
        await supabaseAdmin
          .from("profiles")
          .select("preferred_language")
          .eq("id", access.connection.student_id)
          .maybeSingle();

      if (studentProfileError) {
        throw new Error("Failed to load the student's language profile");
      }

      activeEvidence = await upsertActiveVocabularyEvidence({
        adminClient: supabaseAdmin,
        studentId: access.connection.student_id,
        actorUserId: access.userId,
        targetLanguage: normalizeLearningLanguage(
          studentProfile?.preferred_language,
        ),
        terms: studentTerms,
        sourceType: "lesson_recording",
        sourceLabel: buildClassroomActiveEvidenceSourceLabel({
          tutorName: getTutorLabel(access),
          studentName: getStudentLabel(access),
          recordedAt: recording.created_at,
        }),
        usedAt: recording.created_at,
      });
    }

    const syncedTranscriptResult = await supabaseAdmin
      .from("tutor_student_classroom_transcripts")
      .update({
        active_evidence_synced_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", transcript.id)
      .select("*")
      .single();

    if (syncedTranscriptResult.error || !syncedTranscriptResult.data) {
      throw new Error("Failed to finalize classroom transcript processing");
    }

    transcript = syncedTranscriptResult.data;
  }

  const recordingCompletionState =
    getRecordingCompletionState(diarizationStatus);
  const { error: recordingUpdateError } = await supabaseAdmin
    .from("tutor_student_classroom_recordings")
    .update({
      status: recordingCompletionState.recordingStatus,
      updated_at: nowIso,
    })
    .eq("id", recording.id);

  if (recordingUpdateError) {
    throw new Error("Failed to update classroom recording status");
  }

  const { error: classroomUpdateError } = await supabaseAdmin
    .from("tutor_student_classrooms")
    .update({
      recording_status: recordingCompletionState.classroomRecordingStatus,
      transcript_status: getClassroomTranscriptStatus(diarizationStatus),
      updated_at: nowIso,
    })
    .eq("id", access.classroom.id);

  if (classroomUpdateError) {
    throw new Error("Failed to update classroom state");
  }

  return {
    transcript,
    activeEvidence,
    sourceLabel: buildClassroomActiveEvidenceSourceLabel({
      tutorName: getTutorLabel(access),
      studentName: getStudentLabel(access),
      recordedAt: recording.created_at,
    }),
  };
}

export async function approveClassroomTranscriptActiveEvidence({
  access,
  transcriptId,
  approvedTerms,
}: {
  access: TutorStudentClassroomAccessData;
  transcriptId: string;
  approvedTerms: string[];
}) {
  const normalizedApprovedTerms = new Set(
    approvedTerms
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length > 0),
  );

  if (normalizedApprovedTerms.size === 0) {
    throw new Error("Choose at least one term to approve");
  }

  const supabaseAdmin = createAdminClient();
  const { data: transcript, error: transcriptError } = await supabaseAdmin
    .from("tutor_student_classroom_transcripts")
    .select("id, recording_id, classroom_id, full_text, active_evidence_synced_at")
    .eq("id", transcriptId)
    .eq("classroom_id", access.classroom.id)
    .maybeSingle();

  if (transcriptError) {
    throw new Error("Failed to load classroom transcript");
  }

  if (!transcript) {
    throw new Error("Classroom transcript not found");
  }

  if (transcript.active_evidence_synced_at) {
    throw new Error("This transcript has already been approved");
  }

  const { data: recording, error: recordingError } = await supabaseAdmin
    .from("tutor_student_classroom_recordings")
    .select("id, created_at")
    .eq("id", transcript.recording_id)
    .eq("classroom_id", access.classroom.id)
    .maybeSingle();

  if (recordingError) {
    throw new Error("Failed to load classroom recording");
  }

  if (!recording) {
    throw new Error("Classroom recording not found");
  }

  const { data: segments, error: segmentsError } = await supabaseAdmin
    .from("tutor_student_classroom_transcript_segments")
    .select("speaker_role, content")
    .eq("transcript_id", transcript.id)
    .order("created_at", { ascending: true });

  if (segmentsError) {
    throw new Error("Failed to load classroom transcript segments");
  }

  const normalizedSegments = normalizeClassroomTranscriptSegments(
    (segments ?? []).map((segment) => ({
      speakerRole:
        segment.speaker_role as ClassroomTranscriptSegmentInput["speakerRole"],
      content: segment.content,
    })),
  );

  let selectedOccurrences =
    extractStudentActiveVocabularyTermsFromClassroomTranscriptSegments(
      normalizedSegments,
    ).filter((term) => normalizedApprovedTerms.has(term));

  if (selectedOccurrences.length === 0) {
    const nonTutorOccurrences = normalizedSegments
      .filter((segment) => segment.speakerRole !== "tutor")
      .flatMap((segment) =>
        extractPassiveVocabularyTermOccurrencesFromText(segment.content),
      )
      .filter((term) => normalizedApprovedTerms.has(term));

    selectedOccurrences = nonTutorOccurrences;
  }

  if (selectedOccurrences.length === 0) {
    selectedOccurrences = extractPassiveVocabularyTermOccurrencesFromText(
      transcript.full_text ?? "",
    ).filter((term) => normalizedApprovedTerms.has(term));
  }

  if (selectedOccurrences.length === 0) {
    throw new Error("No approved student terms were available to import");
  }

  const { data: studentProfile, error: studentProfileError } =
    await supabaseAdmin
      .from("profiles")
      .select("preferred_language")
      .eq("id", access.connection.student_id)
      .maybeSingle();

  if (studentProfileError) {
    throw new Error("Failed to load the student's language profile");
  }

  const activeEvidence = await upsertActiveVocabularyEvidence({
    adminClient: supabaseAdmin,
    studentId: access.connection.student_id,
    actorUserId: access.userId,
    targetLanguage: normalizeLearningLanguage(
      studentProfile?.preferred_language,
    ),
    terms: selectedOccurrences,
    sourceType: "lesson_recording",
    sourceLabel: buildClassroomActiveEvidenceSourceLabel({
      tutorName: getTutorLabel(access),
      studentName: getStudentLabel(access),
      recordedAt: recording.created_at,
    }),
    usedAt: recording.created_at,
  });

  const nowIso = new Date().toISOString();
  const { data: updatedTranscript, error: updatedTranscriptError } =
    await supabaseAdmin
      .from("tutor_student_classroom_transcripts")
      .update({
        active_evidence_synced_at: nowIso,
        review_status: "reviewed",
        updated_at: nowIso,
      })
      .eq("id", transcript.id)
      .select("*")
      .single();

  if (updatedTranscriptError || !updatedTranscript) {
    throw new Error("Failed to finalize classroom transcript approval");
  }

  return {
    transcript: updatedTranscript,
    activeEvidence,
  };
}
