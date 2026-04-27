import Link from "next/link";
import { CalendarDays, FileText, Mic, ShieldCheck } from "lucide-react";
import { LessonRoomClient } from "@/components/lessons/lesson-room-client";
import { ManualTranscriptSubmitCard } from "@/components/lessons/manual-transcript-submit-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLessonRoomAccess } from "@/lib/lesson-room-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLiveKitRecordingConfigurationError,
  getLiveKitServerUrl,
  isLiveKitConfigured,
  isLiveKitRecordingConfigured,
} from "@/lib/livekit";
import {
  formatLessonDayLabel,
  formatLessonTimeRange,
  getLessonDisplayTitle,
  getLessonStatusLabel,
} from "@/lib/lessons";

export const dynamic = "force-dynamic";

function getRoomStatusLabel(status: string) {
  switch (status) {
    case "open":
      return "Open";
    case "live":
      return "Live";
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
    default:
      return "Scheduled";
  }
}

function getRecordingStatusLabel(status: string) {
  switch (status) {
    case "ready":
      return "Ready";
    case "recording":
      return "Recording";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

function getTranscriptStatusLabel(status: string) {
  switch (status) {
    case "processing":
      return "Processing";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

export default async function LessonRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role, lesson, session } = await getLessonRoomAccess(id);
  const liveKitServerUrl = getLiveKitServerUrl();
  const liveKitConfigured = isLiveKitConfigured();
  const liveKitRecordingConfigured = isLiveKitRecordingConfigured();
  const liveKitRecordingConfigurationError =
    getLiveKitRecordingConfigurationError();
  const lessonTitle = getLessonDisplayTitle(lesson.title);
  const participantLabel =
    role === "tutor"
      ? lesson.student_profile?.full_name ||
        lesson.student_profile?.email ||
        "One-time lesson"
      : lesson.tutor_profile?.full_name ||
        lesson.tutor_profile?.email ||
        "Tutor";
  let transcriptToolRecordings: Array<{
    id: string;
    createdAt: string;
    status: string;
    durationSeconds: number | null;
    activeEvidenceSyncedAt: string | null;
  }> = [];

  if (role === "tutor") {
    const supabaseAdmin = createAdminClient();
    const [
      { data: recordings, error: recordingsError },
      { data: transcripts, error: transcriptsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("lesson_room_recordings")
        .select("id, created_at, status, duration_seconds")
        .eq("lesson_id", id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabaseAdmin
        .from("lesson_room_transcripts")
        .select("recording_id, active_evidence_synced_at")
        .eq("lesson_id", id),
    ]);

    if (recordingsError) {
      throw recordingsError;
    }

    if (transcriptsError) {
      throw transcriptsError;
    }

    const syncedByRecordingId = new Map(
      (transcripts ?? []).map((transcript) => [
        transcript.recording_id,
        transcript.active_evidence_synced_at,
      ]),
    );

    transcriptToolRecordings = (recordings ?? []).map((recording) => ({
      id: recording.id,
      createdAt: recording.created_at,
      status: recording.status,
      durationSeconds: recording.duration_seconds,
      activeEvidenceSyncedAt: syncedByRecordingId.get(recording.id) ?? null,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button asChild variant="ghost" className="-ml-3 w-fit px-3">
            <Link href="/lessons">Back to Lessons</Link>
          </Button>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {lessonTitle}
              </h1>
              <Badge variant="outline">
                {getLessonStatusLabel(lesson.status)}
              </Badge>
              <Badge variant="secondary">
                {getRoomStatusLabel(session.room_status)}
              </Badge>
            </div>

            <p className="text-muted-foreground">
              This private lesson room is bound to the scheduled lesson and only
              available to the linked participants.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            Recording {getRecordingStatusLabel(session.recording_status)}
          </Badge>
          <Badge variant="outline">
            Transcript {getTranscriptStatusLabel(session.transcript_status)}
          </Badge>
          <Badge variant="outline">
            Consent {session.recording_consent_status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <LessonRoomClient
          lessonId={id}
          role={role}
          isConfigured={liveKitConfigured}
          serverUrl={liveKitServerUrl}
          initialRecordingStatus={session.recording_status}
          initialRecordingConsentStatus={session.recording_consent_status}
          recordingConfigured={liveKitRecordingConfigured}
          recordingConfigurationError={liveKitRecordingConfigurationError}
        />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-5 w-5 text-primary" />
                Lesson Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Date:</span>{" "}
                {formatLessonDayLabel(lesson.lesson_date)}
              </p>
              <p>
                <span className="font-medium">Time:</span>{" "}
                {formatLessonTimeRange(lesson.start_time, lesson.end_time)}
              </p>
              <p>
                <span className="font-medium">
                  {role === "tutor" ? "Student" : "Tutor"}:
                </span>{" "}
                {participantLabel}
              </p>
              <p>
                <span className="font-medium">Room key:</span>{" "}
                {session.provider_room_key}
              </p>
              <p>
                <span className="font-medium">Provider:</span>{" "}
                {session.provider}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="h-5 w-5 text-primary" />
                Recording Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Recording status is persisted on the room session now.</p>
              <p>
                Tutors can now confirm consent and control server-side recording
                from the connected room.
              </p>
              <p>
                Transcript processing will attach to lesson artifacts after the
                recording upload finishes.
              </p>
            </CardContent>
          </Card>

          {role === "tutor" ? (
            <ManualTranscriptSubmitCard
              lessonId={id}
              recordings={transcriptToolRecordings}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Privacy Model
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Room access is tied directly to the lesson participant
                relationship.
              </p>
              <p>
                Recording consent, recording state, and transcript state are
                tracked separately.
              </p>
              <p>
                Artifact playback will use private storage and signed access,
                not public URLs.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-primary" />
                Vocabulary Follow-up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Lesson-derived student speech will flow into active evidence,
                not directly into mastery.
              </p>
              <p>
                Those candidates will appear in the unified vocabulary workspace
                for review and promotion.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link
                  href={
                    role === "tutor"
                      ? "/mastery"
                      : "/vocabulary#active-evidence"
                  }
                >
                  {role === "tutor"
                    ? "Open student vocabulary evidence"
                    : "Open my active evidence"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
