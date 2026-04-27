"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import {
  AlertTriangle,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  ShieldCheck,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Role } from "@/types/roles";

interface LessonRoomJoinPayload {
  token: string;
  serverUrl: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
}

interface LessonRoomClientProps {
  lessonId: string;
  role: Role;
  isConfigured: boolean;
  serverUrl: string | null;
  initialRecordingStatus: string;
  initialRecordingConsentStatus: string;
  recordingConfigured: boolean;
  recordingConfigurationError: string | null;
}

interface LessonRoomSessionPayload {
  session: {
    room_status: string;
    recording_consent_status: string;
    recording_status: string;
    transcript_status: string;
  };
  participantCount?: number;
}

interface LessonRoomRecordingPayload {
  session: {
    room_status: string;
    recording_consent_status: string;
    recording_status: string;
    transcript_status: string;
  };
  recording: {
    id: string;
    status: string;
    storage_path: string | null;
  };
}

function getConnectionStateLabel(state: ConnectionState) {
  switch (state) {
    case ConnectionState.Connected:
      return "Connected";
    case ConnectionState.Connecting:
      return "Connecting";
    case ConnectionState.Reconnecting:
      return "Reconnecting";
    case ConnectionState.SignalReconnecting:
      return "Signal reconnecting";
    default:
      return "Disconnected";
  }
}

function clearMediaContainer(container: HTMLDivElement | null) {
  if (!container) {
    return;
  }

  const mediaElements = Array.from(
    container.querySelectorAll("audio, video"),
  ) as HTMLMediaElement[];

  for (const mediaElement of mediaElements) {
    mediaElement.pause();
    mediaElement.srcObject = null;
    mediaElement.remove();
  }

  container.innerHTML = "";
}

function createParticipantVideoSlot(label: string, element: HTMLMediaElement) {
  const wrapper = document.createElement("div");
  wrapper.className =
    "relative aspect-video overflow-hidden rounded-2xl border bg-black/95";

  element.className = "h-full w-full object-cover";

  if (element instanceof HTMLVideoElement) {
    element.autoplay = true;
    element.playsInline = true;
  }

  const badge = document.createElement("div");
  badge.className =
    "absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white";
  badge.textContent = label;

  wrapper.appendChild(element);
  wrapper.appendChild(badge);

  return wrapper;
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

function getRecordingConsentLabel(status: string) {
  switch (status) {
    case "granted":
      return "Granted";
    case "declined":
      return "Declined";
    default:
      return "Pending";
  }
}

export function LessonRoomClient({
  lessonId,
  role,
  isConfigured,
  serverUrl,
  initialRecordingStatus,
  initialRecordingConsentStatus,
  recordingConfigured,
  recordingConfigurationError,
}: LessonRoomClientProps) {
  const router = useRouter();
  const roomRef = useRef<Room | null>(null);
  const localVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const remoteAudioContainerRef = useRef<HTMLDivElement | null>(null);
  const [, startRefreshTransition] = useTransition();
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [remoteParticipantCount, setRemoteParticipantCount] = useState(0);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState(initialRecordingStatus);
  const [recordingConsentStatus, setRecordingConsentStatus] = useState(
    initialRecordingConsentStatus,
  );
  const [isSyncingSession, setIsSyncingSession] = useState(false);
  const [isRecordingActionPending, setIsRecordingActionPending] = useState(false);

  const isConnected = connectionState === ConnectionState.Connected;

  useEffect(() => {
    setRecordingStatus(initialRecordingStatus);
  }, [initialRecordingStatus]);

  useEffect(() => {
    setRecordingConsentStatus(initialRecordingConsentStatus);
  }, [initialRecordingConsentStatus]);

  const refreshRoute = useCallback(() => {
    startRefreshTransition(() => {
      router.refresh();
    });
  }, [router, startRefreshTransition]);

  const postJson = useCallback(
    async <T,>(url: string, body: Record<string, unknown>) => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json().catch(() => null)) as
        | T
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && typeof data === "object" && "error" in data
            ? data.error || "Request failed"
            : "Request failed",
        );
      }

      return data as T;
    },
    [],
  );

  const syncSessionState = useCallback(
    async (action: "participant-connected" | "participant-disconnected") => {
      setIsSyncingSession(true);

      try {
        const payload = await postJson<LessonRoomSessionPayload>(
          `/api/lessons/${lessonId}/room-session`,
          { action },
        );

        setRecordingStatus(payload.session.recording_status);
        setRecordingConsentStatus(payload.session.recording_consent_status);
        refreshRoute();
      } finally {
        setIsSyncingSession(false);
      }
    },
    [lessonId, postJson, refreshRoute],
  );

  const updateConsent = useCallback(
    async (consentStatus: "granted" | "declined") => {
      setIsSyncingSession(true);

      try {
        const payload = await postJson<LessonRoomSessionPayload>(
          `/api/lessons/${lessonId}/room-session`,
          {
            action: "set-consent",
            consentStatus,
          },
        );

        setRecordingConsentStatus(payload.session.recording_consent_status);
        toast.success(
          consentStatus === "granted"
            ? "Recording consent confirmed"
            : "Recording consent marked as declined",
        );
        refreshRoute();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update recording consent",
        );
      } finally {
        setIsSyncingSession(false);
      }
    },
    [lessonId, postJson, refreshRoute],
  );

  const updateRecording = useCallback(
    async (action: "start" | "stop") => {
      setIsRecordingActionPending(true);

      try {
        const payload = await postJson<LessonRoomRecordingPayload>(
          `/api/lessons/${lessonId}/recording`,
          { action },
        );

        setRecordingStatus(payload.session.recording_status);
        setRecordingConsentStatus(payload.session.recording_consent_status);
        toast.success(
          action === "start"
            ? "Lesson recording started"
            : "Lesson recording stopped and is now processing",
        );
        refreshRoute();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Failed to ${action} lesson recording`,
        );
      } finally {
        setIsRecordingActionPending(false);
      }
    },
    [lessonId, postJson, refreshRoute],
  );

  const clearMediaElements = useCallback(() => {
    clearMediaContainer(localVideoContainerRef.current);
    clearMediaContainer(remoteVideoContainerRef.current);
    clearMediaContainer(remoteAudioContainerRef.current);
  }, []);

  const syncRoomMedia = useCallback((room: Room) => {
    clearMediaElements();

    const localVideoContainer = localVideoContainerRef.current;
    const remoteVideoContainer = remoteVideoContainerRef.current;
    const remoteAudioContainer = remoteAudioContainerRef.current;

    if (!localVideoContainer || !remoteVideoContainer || !remoteAudioContainer) {
      return;
    }

    for (const publication of room.localParticipant.videoTrackPublications.values()) {
      const track = publication.track;

      if (!track || track.kind !== Track.Kind.Video) {
        continue;
      }

      const element = track.attach();

      if (element instanceof HTMLVideoElement) {
        element.muted = true;
      }

      localVideoContainer.appendChild(createParticipantVideoSlot("You", element));
    }

    for (const participant of room.remoteParticipants.values()) {
      const participantLabel = participant.name || participant.identity;

      for (const publication of participant.videoTrackPublications.values()) {
        const track = publication.track;

        if (!track || track.kind !== Track.Kind.Video) {
          continue;
        }

        const element = track.attach();
        remoteVideoContainer.appendChild(
          createParticipantVideoSlot(participantLabel, element),
        );
      }

      for (const publication of participant.audioTrackPublications.values()) {
        const track = publication.track;

        if (!track || track.kind !== Track.Kind.Audio) {
          continue;
        }

        const element = track.attach();

        if (element instanceof HTMLAudioElement) {
          element.autoplay = true;
        }

        element.className = "hidden";
        remoteAudioContainer.appendChild(element);
      }
    }

    setRemoteParticipantCount(room.remoteParticipants.size);
  }, [clearMediaElements]);

  async function handleJoin() {
    if (!isConfigured || roomRef.current) {
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const syncMedia = () => syncRoomMedia(room);

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      setConnectionState(state);
    });
    room.on(RoomEvent.Connected, syncMedia);
    room.on(RoomEvent.ParticipantConnected, syncMedia);
    room.on(RoomEvent.ParticipantDisconnected, syncMedia);
    room.on(RoomEvent.TrackSubscribed, syncMedia);
    room.on(RoomEvent.TrackUnsubscribed, syncMedia);
    room.on(RoomEvent.LocalTrackPublished, syncMedia);
    room.on(RoomEvent.LocalTrackUnpublished, syncMedia);
    room.on(RoomEvent.Disconnected, () => {
      if (roomRef.current === room) {
        roomRef.current = null;
      }

      clearMediaElements();
      setHasJoined(false);
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      setRemoteParticipantCount(0);
      setConnectionState(ConnectionState.Disconnected);
    });

    try {
      const response = await fetch(`/api/lessons/${lessonId}/room-token`, {
        method: "POST",
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as
        | LessonRoomJoinPayload
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && "error" in data
            ? data.error || "Failed to create lesson-room token"
            : "Failed to create lesson-room token",
        );
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("serverUrl" in data) ||
        !("token" in data)
      ) {
        throw new Error("Failed to create lesson-room token");
      }

      await room.connect(data.serverUrl, data.token);
      setHasJoined(true);

      try {
        await room.localParticipant.enableCameraAndMicrophone();
        setCameraEnabled(true);
        setMicrophoneEnabled(true);
      } catch {
        setJoinError(
          "Connected to the room, but camera or microphone access was denied. Use the controls below to retry.",
        );
      }

      syncMedia();

      try {
        await syncSessionState("participant-connected");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Joined the room, but failed to sync lesson-room status",
        );
      }
    } catch (error) {
      if (roomRef.current === room) {
        roomRef.current = null;
      }

      clearMediaElements();
      setHasJoined(false);
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      setRemoteParticipantCount(0);
      setConnectionState(ConnectionState.Disconnected);

      try {
        await room.disconnect(true);
      } catch {
        // Ignore cleanup errors when the room never connected successfully.
      }

      setJoinError(
        error instanceof Error
          ? error.message
          : "Failed to join the lesson room",
      );
    } finally {
      setIsJoining(false);
    }
  }

  async function handleDisconnect() {
    const room = roomRef.current;

    if (!room) {
      return;
    }

    if (recordingStatus === "recording") {
      setJoinError("Stop the recording before leaving the lesson room.");
      return;
    }

    roomRef.current = null;
    setIsJoining(false);
    setJoinError(null);

    try {
      await room.disconnect(true);
    } finally {
      clearMediaElements();
      setHasJoined(false);
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      setRemoteParticipantCount(0);
      setConnectionState(ConnectionState.Disconnected);

      try {
        await syncSessionState("participant-disconnected");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Left the room, but failed to sync lesson-room status",
        );
      }
    }
  }

  async function toggleCamera() {
    const room = roomRef.current;

    if (!room) {
      return;
    }

    const nextEnabled = !cameraEnabled;
    await room.localParticipant.setCameraEnabled(nextEnabled);
    setCameraEnabled(nextEnabled);
    syncRoomMedia(room);
  }

  async function toggleMicrophone() {
    const room = roomRef.current;

    if (!room) {
      return;
    }

    const nextEnabled = !microphoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(nextEnabled);
    setMicrophoneEnabled(nextEnabled);
    syncRoomMedia(room);
  }

  useEffect(() => {
    return () => {
      const room = roomRef.current;
      roomRef.current = null;

      if (room) {
        void room.disconnect(true);
      }

      clearMediaElements();
    };
  }, [clearMediaElements]);

  const statusTone = useMemo(() => {
    if (isConnected) {
      return "secondary" as const;
    }

    if (joinError) {
      return "destructive" as const;
    }

    return "outline" as const;
  }, [isConnected, joinError]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-5 w-5 text-primary" />
              Native Lesson Room
            </CardTitle>
            <CardDescription>
              {isConfigured
                ? "Join the private lesson room directly from the platform. The tutor and linked student receive short-lived room credentials only after lesson-bound access checks."
                : "LiveKit is not configured yet, so the lesson room cannot connect to realtime media yet."}
            </CardDescription>
          </div>

          <Badge variant={statusTone}>
            {getConnectionStateLabel(connectionState)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConfigured ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">LiveKit setup required</p>
            <p className="mt-2">
              Configure <span className="font-mono">LIVEKIT_URL</span>, <span className="font-mono">LIVEKIT_API_KEY</span>, and <span className="font-mono">LIVEKIT_API_SECRET</span> to enable in-platform lesson calls.
            </p>
          </div>
        ) : null}

        {serverUrl ? (
          <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Media server: <span className="font-medium text-foreground">{serverUrl}</span>
          </div>
        ) : null}

        {joinError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{joinError}</span>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Your camera</p>
              <Badge variant="outline">{cameraEnabled ? "Camera on" : "Camera off"}</Badge>
            </div>
            <div className="relative rounded-2xl border border-dashed bg-muted/20 p-3">
              <div
                ref={localVideoContainerRef}
                className="grid min-h-[220px] gap-3"
              />
              {!hasJoined ? (
                <div className="pointer-events-none absolute inset-3 flex items-center justify-center">
                  <div className="space-y-2 text-center text-sm text-muted-foreground">
                    <Video className="mx-auto h-8 w-8" />
                    <p>Join the lesson room to publish your local video.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Remote participants</p>
              <Badge variant="outline">
                <Users className="mr-1 h-3.5 w-3.5" />
                {remoteParticipantCount}
              </Badge>
            </div>
            <div className="relative rounded-2xl border border-dashed bg-muted/20 p-3">
              <div
                ref={remoteVideoContainerRef}
                className="grid min-h-[220px] gap-3"
              />
              {hasJoined && remoteParticipantCount === 0 ? (
                <div className="pointer-events-none absolute inset-3 flex items-center justify-center">
                  <div className="rounded-2xl border border-dashed bg-background/60 p-6 text-center text-sm text-muted-foreground">
                    Waiting for the other participant to join.
                  </div>
                </div>
              ) : null}
            </div>
            <div ref={remoteAudioContainerRef} className="hidden" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!hasJoined ? (
            <Button
              onClick={handleJoin}
              disabled={!isConfigured || isJoining || isSyncingSession}
            >
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining room...
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  Join lesson room
                </>
              )}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => void toggleCamera()}>
                {cameraEnabled ? (
                  <>
                    <VideoOff className="mr-2 h-4 w-4" />
                    Turn camera off
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    Turn camera on
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => void toggleMicrophone()}>
                {microphoneEnabled ? (
                  <>
                    <MicOff className="mr-2 h-4 w-4" />
                    Mute microphone
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" />
                    Unmute microphone
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDisconnect()}
                disabled={isSyncingSession || isRecordingActionPending}
              >
                <PhoneOff className="mr-2 h-4 w-4" />
                Leave room
              </Button>
            </>
          )}
        </div>

        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Recording controls</p>
              <p className="text-sm text-muted-foreground">
                Recording stays tutor-controlled and lesson-bound. Consent is tracked separately from media state.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                Consent {getRecordingConsentLabel(recordingConsentStatus)}
              </Badge>
              <Badge
                variant={recordingStatus === "recording" ? "secondary" : "outline"}
              >
                <Radio className="mr-1 h-3.5 w-3.5" />
                Recording {getRecordingStatusLabel(recordingStatus)}
              </Badge>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {role === "tutor" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => void updateConsent("granted")}
                  disabled={
                    isSyncingSession ||
                    isRecordingActionPending ||
                    recordingConsentStatus === "granted"
                  }
                >
                  Confirm recording consent
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void updateConsent("declined")}
                  disabled={
                    isSyncingSession ||
                    isRecordingActionPending ||
                    recordingConsentStatus === "declined"
                  }
                >
                  Mark consent declined
                </Button>
                {recordingStatus === "recording" ? (
                  <Button
                    variant="destructive"
                    onClick={() => void updateRecording("stop")}
                    disabled={isRecordingActionPending}
                  >
                    {isRecordingActionPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Stopping recording...
                      </>
                    ) : (
                      <>
                        <Radio className="mr-2 h-4 w-4" />
                        Stop recording
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => void updateRecording("start")}
                    disabled={
                      !hasJoined ||
                      !recordingConfigured ||
                      isRecordingActionPending ||
                      recordingConsentStatus !== "granted" ||
                      recordingStatus === "processing"
                    }
                  >
                    {isRecordingActionPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting recording...
                      </>
                    ) : (
                      <>
                        <Radio className="mr-2 h-4 w-4" />
                        Start recording
                      </>
                    )}
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only tutors can control lesson recordings. You can still see the current consent and recording state here.
              </p>
            )}
          </div>

          {role === "tutor" && !recordingConfigured ? (
            <div className="mt-4 rounded-2xl border border-dashed bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Recording storage setup required</p>
              <p className="mt-1">
                {recordingConfigurationError ||
                  "Add the LiveKit egress storage variables to enable server-side lesson recordings."}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {role === "tutor"
            ? "Tutor participants currently receive room-admin grants for moderation and recording control inside the linked lesson room."
            : "Student participants receive lesson-bound room access only and can publish their own media inside the linked lesson room."}
        </div>
      </CardContent>
    </Card>
  );
}