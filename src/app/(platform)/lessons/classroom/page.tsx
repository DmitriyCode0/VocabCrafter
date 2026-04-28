import Link from "next/link";
import {
  CalendarDays,
  Download,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { ClassroomConnectionPicker } from "@/components/lessons/classroom-connection-picker";
import { ClassroomRoomClient } from "@/components/lessons/classroom-room-client";
import { LessonsPageHeader } from "@/components/lessons/lessons-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getClassroomParticipantName,
  getTutorStudentClassroomAccess,
  listTutorStudentClassroomConnectionsForUser,
} from "@/lib/classroom-access";
import { listTutorStudentClassroomSessionSummaries } from "@/lib/classroom-session-summaries";
import { getAppMessages } from "@/lib/i18n/messages";
import { getLessonsViewerAccess } from "@/lib/lessons-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLiveKitRecordingConfigurationError,
  getLiveKitServerUrl,
  isLiveKitConfigured,
  isLiveKitRecordingConfigured,
} from "@/lib/livekit";

export const dynamic = "force-dynamic";

const APP_LANGUAGE_LOCALES = {
  en: "en-GB",
  uk: "uk-UA",
} as const;

function getRoomStatusLabel(status: string) {
  switch (status) {
    case "live":
      return "Live";
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
    default:
      return "Open";
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

function formatConnectedAt(value: string | null, appLanguage: "en" | "uk") {
  if (!value) {
    return appLanguage === "uk" ? "Нещодавно" : "Recently";
  }

  return new Intl.DateTimeFormat(APP_LANGUAGE_LOCALES[appLanguage], {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatSessionDateTime(value: string, appLanguage: "en" | "uk") {
  return new Intl.DateTimeFormat(APP_LANGUAGE_LOCALES[appLanguage], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDurationLabel(seconds: number | null, appLanguage: "en" | "uk") {
  if (typeof seconds !== "number" || seconds <= 0) {
    return appLanguage === "uk" ? "Менше хвилини" : "Under a minute";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return appLanguage === "uk"
      ? `${remainingSeconds} с`
      : `${remainingSeconds}s`;
  }

  return appLanguage === "uk"
    ? `${minutes} хв ${remainingSeconds.toString().padStart(2, "0")} с`
    : `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function getRecordingDownloadHint(
  status: string,
  hasStoredMedia: boolean,
  appLanguage: "en" | "uk",
) {
  if (status === "recording") {
    return appLanguage === "uk"
      ? "Завантаження стане доступним після зупинки активного запису."
      : "Download becomes available after the active recording is stopped.";
  }

  if (status === "failed") {
    return appLanguage === "uk"
      ? "Цей запис не вдалося підготувати для завантаження."
      : "This recording could not be finalized for download.";
  }

  if (!hasStoredMedia) {
    return appLanguage === "uk"
      ? "Медіафайл ще фіналізується у приватному сховищі."
      : "The media file is still being finalized in private storage.";
  }

  return appLanguage === "uk"
    ? "Файл запису ще обробляється."
    : "The recording file is still being processed.";
}

function getSpeakingShareLabel(
  speakerSeconds: number,
  otherSpeakerSeconds: number,
) {
  const total = speakerSeconds + otherSpeakerSeconds;

  if (total === 0) {
    return 0;
  }

  return Math.round((speakerSeconds / total) * 100);
}

export default async function ClassroomPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  const { connection: requestedConnectionId } = await searchParams;
  const { userId, role, appLanguage } = await getLessonsViewerAccess();
  const messages = getAppMessages(appLanguage);
  const liveKitServerUrl = getLiveKitServerUrl();
  const liveKitConfigured = isLiveKitConfigured();
  const liveKitRecordingConfigured = isLiveKitRecordingConfigured();
  const liveKitRecordingConfigurationError =
    getLiveKitRecordingConfigurationError();
  const connections = await listTutorStudentClassroomConnectionsForUser(
    userId,
    role,
  );
  const selectedConnection =
    connections.find((item) => item.id === requestedConnectionId) ??
    connections[0] ??
    null;
  const access = selectedConnection
    ? await getTutorStudentClassroomAccess(selectedConnection.id)
    : null;
  const participantName = selectedConnection
    ? getClassroomParticipantName(role, selectedConnection)
    : null;
  let classroomRecordings: Array<{
    id: string;
    createdAt: string;
    status: string;
    durationSeconds: number | null;
    hasStoredMedia: boolean;
  }> = [];
  let sessionSummaries: Array<{
    id: string;
    sessionStartedAt: string;
    sessionEndedAt: string | null;
    durationSeconds: number | null;
    tutorSpeakingSeconds: number;
    studentSpeakingSeconds: number;
  }> = [];

  if (access) {
    const supabaseAdmin = createAdminClient();
    const [
      { data: recordings, error: recordingsError },
      recentSummaries,
    ] = await Promise.all([
      supabaseAdmin
        .from("tutor_student_classroom_recordings")
        .select(
          "id, created_at, status, duration_seconds, storage_bucket, storage_path",
        )
        .eq("classroom_id", access.classroom.id)
        .order("created_at", { ascending: false })
        .limit(12),
      listTutorStudentClassroomSessionSummaries(access.classroom.id),
    ]);

    if (recordingsError) {
      throw recordingsError;
    }

    classroomRecordings = (recordings ?? []).map((recording) => ({
      id: recording.id,
      createdAt: recording.created_at,
      status: recording.status,
      durationSeconds: recording.duration_seconds,
      hasStoredMedia: Boolean(recording.storage_bucket && recording.storage_path),
    }));

    sessionSummaries = recentSummaries
      .filter((summary) => summary.session_ended_at)
      .map((summary) => ({
        id: summary.id,
        sessionStartedAt: summary.session_started_at,
        sessionEndedAt: summary.session_ended_at,
        durationSeconds: summary.duration_seconds,
        tutorSpeakingSeconds: summary.tutor_speaking_seconds,
        studentSpeakingSeconds: summary.student_speaking_seconds,
      }));
  }

  return (
    <div className="space-y-6">
      <LessonsPageHeader
        role={role}
        currentSection="classroom"
        title={messages.lessons.title}
        description={messages.lessons.classroomDescription}
        actions={
          selectedConnection && connections.length > 1 ? (
            <ClassroomConnectionPicker
              connections={connections.map((item) => ({
                id: item.id,
                label: getClassroomParticipantName(role, item),
              }))}
              activeConnectionId={selectedConnection.id}
            />
          ) : null
        }
      />

      {!selectedConnection || !access ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {appLanguage === "uk"
                ? "Поки немає доступної classroom-кімнати"
                : "No classroom available yet"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              {role === "tutor"
                ? appLanguage === "uk"
                  ? "Підключіть учня, щоб відкрити окрему classroom-сторінку для дзвінків поза розкладом."
                  : "Connect a student first to open a dedicated classroom for ad-hoc calls."
                : appLanguage === "uk"
                  ? "Classroom з’явиться тут, щойно у вас буде активне підключення з викладачем."
                  : "A classroom will appear here once you have an active tutor connection."}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={role === "tutor" ? "/students" : "/tutors"}>
                {role === "tutor"
                  ? appLanguage === "uk"
                    ? "Відкрити учнів"
                    : "Open students"
                  : appLanguage === "uk"
                    ? "Відкрити викладачів"
                    : "Open tutors"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">
                  {participantName}
                </h2>
                <Badge variant="outline">
                  {role === "tutor"
                    ? appLanguage === "uk"
                      ? "Активне підключення"
                      : "Active connection"
                    : appLanguage === "uk"
                      ? "Ваш classroom"
                      : "Your classroom"}
                </Badge>
                <Badge variant="secondary">
                  {getRoomStatusLabel(access.classroom.room_status)}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {appLanguage === "uk"
                  ? "Ця classroom-кімната прив’язана до активного підключення між викладачем і студентом та підходить для дзвінків поза розкладом."
                  : "This classroom is tied to the active tutor-student connection and can be used for ad-hoc sessions outside the lesson calendar."}
              </p>
            </div>

          </div>

          <div className="space-y-4">
            <ClassroomRoomClient
              connectionId={selectedConnection.id}
              role={role}
              isConfigured={liveKitConfigured}
              serverUrl={liveKitServerUrl}
              initialRoomStatus={access.classroom.room_status}
              initialRecordingStatus={access.classroom.recording_status}
              initialRecordingConsentStatus={access.classroom.recording_consent_status}
              recordingConfigured={liveKitRecordingConfigured}
              recordingConfigurationError={liveKitRecordingConfigurationError}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-5 w-5 text-primary" />
                    {appLanguage === "uk" ? "Контекст кімнати" : "Classroom Context"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">
                      {role === "tutor"
                        ? appLanguage === "uk"
                          ? "Учень"
                          : "Student"
                        : appLanguage === "uk"
                          ? "Викладач"
                          : "Tutor"}
                      :
                    </span>{" "}
                    {participantName}
                  </p>
                  <p>
                    <span className="font-medium">Room key:</span>{" "}
                    {access.classroom.provider_room_key}
                  </p>
                  <p>
                    <span className="font-medium">Provider:</span>{" "}
                    {access.classroom.provider}
                  </p>
                  <p>
                    <span className="font-medium">
                      {appLanguage === "uk" ? "Підключення" : "Connected"}:
                    </span>{" "}
                    {formatConnectedAt(selectedConnection.connectedAt, appLanguage)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    {appLanguage === "uk" ? "Модель доступу" : "Access Model"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    {appLanguage === "uk"
                      ? "Доступ мають лише учасники активного підключення tutor-student."
                      : "Only the participants of the active tutor-student connection can open this classroom."}
                  </p>
                  <p>
                    {appLanguage === "uk"
                      ? "Це окрема кімната для дзвінків поза розкладом, тому вона не потребує запланованого уроку."
                      : "This is a separate room for ad-hoc calls, so it does not require a scheduled lesson."}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Download className="h-5 w-5 text-primary" />
                    {appLanguage === "uk"
                      ? "Аудіозаписи студента"
                      : "Student Audio Recordings"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {classroomRecordings.length === 0 ? (
                    <p className="text-muted-foreground">
                      {appLanguage === "uk"
                        ? "Збережені аудіозаписи студента з’являться тут після старту й зупинки запису у classroom."
                        : "Saved student audio recordings will appear here after classroom recording has been started and stopped."}
                    </p>
                  ) : (
                    classroomRecordings.map((recording) => {
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
                                {formatSessionDateTime(
                                  recording.createdAt,
                                  appLanguage,
                                )}
                              </p>
                              <p className="text-muted-foreground">
                                {formatDurationLabel(
                                  recording.durationSeconds,
                                  appLanguage,
                                )}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">
                                {getRecordingStatusLabel(recording.status)}
                              </Badge>
                              {canDownload ? (
                                <Button asChild size="sm" variant="outline">
                                  <a
                                    href={`/api/classroom/${selectedConnection.id}/recordings/${recording.id}/download`}
                                  >
                                    {appLanguage === "uk"
                                      ? "Завантажити"
                                      : "Download"}
                                  </a>
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          {!canDownload ? (
                            <p className="mt-3 text-xs text-muted-foreground">
                              {getRecordingDownloadHint(
                                recording.status,
                                recording.hasStoredMedia,
                                appLanguage,
                              )}
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
                    <Sparkles className="h-5 w-5 text-primary" />
                    {appLanguage === "uk" ? "Інструменти classroom" : "Classroom Toolkit"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    {appLanguage === "uk"
                      ? "У classroom вже доступні screen share, browser PiP і live speaking timer для локального балансу розмови під час дзвінка."
                      : "The classroom now includes screen sharing, browser PiP, and a live speaking timer for in-call speaking balance."}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    {appLanguage === "uk"
                      ? "Останні classroom-сесії"
                      : "Recent Classroom Sessions"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {sessionSummaries.length === 0 ? (
                    <p className="text-muted-foreground">
                      {appLanguage === "uk"
                        ? "Завершені classroom-сесії збережуться тут разом із тривалістю та балансом мовлення."
                        : "Completed classroom sessions will appear here with duration and speaking balance."}
                    </p>
                  ) : (
                    sessionSummaries.map((summary) => {
                      const tutorShare = getSpeakingShareLabel(
                        summary.tutorSpeakingSeconds,
                        summary.studentSpeakingSeconds,
                      );
                      const studentShare = getSpeakingShareLabel(
                        summary.studentSpeakingSeconds,
                        summary.tutorSpeakingSeconds,
                      );

                      return (
                        <div
                          key={summary.id}
                          className="rounded-2xl border bg-muted/20 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-foreground">
                              {formatSessionDateTime(
                                summary.sessionStartedAt,
                                appLanguage,
                              )}
                            </p>
                            <Badge variant="outline">
                              {formatDurationLabel(
                                summary.durationSeconds,
                                appLanguage,
                              )}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-muted-foreground">Tutor</p>
                              <p className="font-medium text-foreground">
                                {tutorShare}% • {formatDurationLabel(summary.tutorSpeakingSeconds, appLanguage)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Student</p>
                              <p className="font-medium text-foreground">
                                {studentShare}% • {formatDurationLabel(summary.studentSpeakingSeconds, appLanguage)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}