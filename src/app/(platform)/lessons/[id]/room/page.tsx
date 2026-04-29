import Link from "next/link";
import {
  CalendarDays,
  Download,
  FileText,
  Mic,
  ShieldCheck,
} from "lucide-react";
import { DeleteRecordingButton } from "@/components/lessons/delete-recording-button";
import { LessonRoomClient } from "@/components/lessons/lesson-room-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAppDateTime } from "@/lib/dates";
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

function formatRecordingDurationLabel(seconds: number | null) {
  if (typeof seconds !== "number" || seconds <= 0) {
    return "Duration pending";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
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
  let lessonRecordings: Array<{
    id: string;
    createdAt: string;
    status: string;
    durationSeconds: number | null;
    hasStoredMedia: boolean;
  }> = [];

  const supabaseAdmin = createAdminClient();
  const { data: recordings, error: recordingsError } = await supabaseAdmin
    .from("lesson_room_recordings")
    .select(
      "id, created_at, status, duration_seconds, storage_bucket, storage_path",
    )
    .eq("lesson_id", id)
    .order("created_at", { ascending: false })
    .limit(12);

  if (recordingsError) {
    throw recordingsError;
  }

  lessonRecordings = (recordings ?? []).map((recording) => ({
    id: recording.id,
    createdAt: recording.created_at,
    status: recording.status,
    durationSeconds: recording.duration_seconds,
    hasStoredMedia: Boolean(recording.storage_bucket && recording.storage_path),
  }));

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
            Consent {session.recording_consent_status}
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
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

        <div className="grid gap-4 xl:grid-cols-2">
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
                Student Audio Recording
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Tutors can confirm consent and capture a downloadable,
                student-only audio recording from the lesson room.
              </p>
              <p>
                Recording starts only when the student is connected with a
                published microphone track.
              </p>
              <p>
                Stopping the recording finalizes an OGG audio file in private
                storage for later download and transcription.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-5 w-5 text-primary" />
                Student Audio Recordings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {lessonRecordings.length === 0 ? (
                <p className="text-muted-foreground">
                  Saved student audio recordings will appear here once recording
                  has been started and stopped from the lesson room.
                </p>
              ) : (
                lessonRecordings.map((recording) => {
                  const canDownload =
                    recording.hasStoredMedia &&
                    recording.status !== "recording" &&
                    recording.status !== "failed";

                  return (
                    <div
                      key={recording.id}
                      className="rounded-2xl border bg-muted/20 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {formatAppDateTime(recording.createdAt)}
                          </p>
                          <p className="text-muted-foreground">
                            {formatRecordingDurationLabel(
                              recording.durationSeconds,
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {getRecordingStatusLabel(recording.status)}
                          </Badge>
                          {role === "tutor" &&
                          recording.status !== "recording" ? (
                            <DeleteRecordingButton
                              deleteUrl={`/api/lessons/${id}/recordings/${recording.id}`}
                              recordingLabel={formatAppDateTime(
                                recording.createdAt,
                              )}
                              appLanguage="en"
                              scope="lesson"
                            />
                          ) : null}
                          {canDownload ? (
                            <Button asChild size="sm" variant="outline">
                              <a
                                href={`/api/lessons/${id}/recordings/${recording.id}/download`}
                              >
                                Download
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      {!canDownload ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          {recording.status === "recording"
                            ? "Download becomes available after the active recording is stopped."
                            : recording.status === "failed"
                              ? "This recording could not be finalized for download."
                              : "The audio file is still being finalized in private storage."}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

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
                      ? "/vocabulary?tab=active"
                      : "/vocabulary?tab=active#active-evidence"
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
