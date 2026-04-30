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
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import {
  AlertTriangle,
  Loader2,
  PhoneOff,
  Radio,
  ShieldCheck,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { LiveKitMeetStage } from "@/components/lessons/livekit-meet-stage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { Role } from "@/types/roles";

interface LessonRoomJoinPayload {
  token: string;
  serverUrl: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
}

export interface LessonRoomClientProps {
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

function playJoinSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3,
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.warn("Could not play join sound:", error);
  }
}

function playLeaveSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3,
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.warn("Could not play leave sound:", error);
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
  const [, startRefreshTransition] = useTransition();
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [remoteParticipantCount, setRemoteParticipantCount] = useState(0);
  const [remoteMicrophoneTrackCount, setRemoteMicrophoneTrackCount] =
    useState(0);
  const [remoteVideoTrackCount, setRemoteVideoTrackCount] = useState(0);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState(
    initialRecordingStatus,
  );
  const [recordingConsentStatus, setRecordingConsentStatus] = useState(
    initialRecordingConsentStatus,
  );
  const [isSyncingSession, setIsSyncingSession] = useState(false);
  const [isRecordingActionPending, setIsRecordingActionPending] =
    useState(false);
  const [isVideoPlaybackBlocked, setIsVideoPlaybackBlocked] = useState(false);
  const [hasPausedRemoteVideo, setHasPausedRemoteVideo] = useState(false);

  const isConnected = connectionState === ConnectionState.Connected;
  const startRecordingDisabledReason = !hasJoined
    ? "Join the lesson room first"
    : remoteParticipantCount === 0
      ? "The student must join before recording can start"
      : remoteMicrophoneTrackCount === 0
        ? "The student must join with microphone enabled before recording can start"
        : !recordingConfigured
          ? "Recording storage setup is required"
          : recordingConsentStatus !== "granted"
            ? "Grant recording consent first"
            : null;

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

  const syncRoomState = useCallback((room: Room) => {
    let nextRemoteMicrophoneTrackCount = 0;
    let nextRemoteVideoTrackCount = 0;
    let nextHasPausedRemoteVideo = false;

    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.videoTrackPublications.values()) {
        const track = publication.track;

        if (!track || track.kind !== Track.Kind.Video) {
          continue;
        }

        nextRemoteVideoTrackCount += 1;
        nextHasPausedRemoteVideo ||=
          track.streamState === Track.StreamState.Paused;
      }

      for (const publication of participant.audioTrackPublications.values()) {
        const track = publication.track;

        if (!track || track.kind !== Track.Kind.Audio) {
          continue;
        }

        if (publication.source === Track.Source.Microphone) {
          nextRemoteMicrophoneTrackCount += 1;
        }
      }
    }

    setRemoteParticipantCount(room.remoteParticipants.size);
    setRemoteMicrophoneTrackCount(nextRemoteMicrophoneTrackCount);
    setRemoteVideoTrackCount(nextRemoteVideoTrackCount);
    setHasPausedRemoteVideo(nextHasPausedRemoteVideo);
    setIsVideoPlaybackBlocked(!room.canPlaybackVideo);
  }, []);

  const resumeRemoteVideo = useCallback(async () => {
    const room = roomRef.current;

    if (!room) {
      return;
    }

    try {
      await room.startVideo();
      setIsVideoPlaybackBlocked(!room.canPlaybackVideo);
      toast.success("Remote video playback resumed");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to resume remote video playback",
      );
    }
  }, []);

  async function handleJoin() {
    if (!isConfigured || roomRef.current) {
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    const room = new Room({ dynacast: true });
    roomRef.current = room;

    const syncState = () => syncRoomState(room);

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      setConnectionState(state);
    });
    room.on(RoomEvent.Connected, syncState);
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      syncState();

      if (participant.identity !== room.localParticipant.identity) {
        playJoinSound();
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      syncState();

      if (participant.identity !== room.localParticipant.identity) {
        playLeaveSound();
      }
    });
    room.on(RoomEvent.TrackSubscribed, syncState);
    room.on(RoomEvent.TrackUnsubscribed, syncState);
    room.on(RoomEvent.TrackStreamStateChanged, syncState);
    room.on(RoomEvent.LocalTrackPublished, syncState);
    room.on(RoomEvent.LocalTrackUnpublished, syncState);
    room.on(RoomEvent.VideoPlaybackStatusChanged, (canPlayback) => {
      setIsVideoPlaybackBlocked(!canPlayback);
    });
    room.on(RoomEvent.Disconnected, () => {
      if (roomRef.current === room) {
        roomRef.current = null;
      }

      setHasJoined(false);
      setRemoteParticipantCount(0);
      setRemoteMicrophoneTrackCount(0);
      setRemoteVideoTrackCount(0);
      setHasPausedRemoteVideo(false);
      setIsVideoPlaybackBlocked(false);
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
      } catch {
        setJoinError(
          "Connected to the room, but camera or microphone access was denied. Use the LiveKit controls below to retry.",
        );
      }

      syncState();
      setIsVideoPlaybackBlocked(!room.canPlaybackVideo);

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

      setHasJoined(false);
      setRemoteParticipantCount(0);
      setRemoteMicrophoneTrackCount(0);
      setRemoteVideoTrackCount(0);
      setHasPausedRemoteVideo(false);
      setIsVideoPlaybackBlocked(false);
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
      setHasJoined(false);
      setRemoteParticipantCount(0);
      setRemoteMicrophoneTrackCount(0);
      setRemoteVideoTrackCount(0);
      setHasPausedRemoteVideo(false);
      setIsVideoPlaybackBlocked(false);
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

  useEffect(() => {
    return () => {
      const room = roomRef.current;
      roomRef.current = null;

      if (room) {
        void room.disconnect(true);
      }
    };
  }, []);

  const statusTone = useMemo(() => {
    if (isConnected) {
      return "secondary" as const;
    }

    if (joinError) {
      return "destructive" as const;
    }

    return "outline" as const;
  }, [isConnected, joinError]);

  const toolbarButtonClassName =
    "h-14 rounded-[1.35rem] border border-white/10 bg-[#242424] px-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-[#303030] hover:text-white disabled:border-white/5 disabled:bg-[#171717] disabled:text-white/35";
  const toolbarDangerButtonClassName =
    "h-14 rounded-[1.35rem] border border-rose-400/30 bg-[#64241d] px-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-[#7a2a22] hover:text-white disabled:border-rose-400/10 disabled:bg-[#4d211d] disabled:text-white/60";

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="h-5 w-5 text-primary" />
                Lesson Room
              </CardTitle>
              <CardDescription>
                {isConfigured
                  ? "Join the private lesson room directly from the platform. The LiveKit stage now uses a Meet-style layout while keeping lesson-bound access, consent, and recording rules in place."
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
              <p className="font-medium text-foreground">
                LiveKit setup required
              </p>
              <p className="mt-2">
                Configure <span className="font-mono">LIVEKIT_URL</span>,{" "}
                <span className="font-mono">LIVEKIT_API_KEY</span>, and{" "}
                <span className="font-mono">LIVEKIT_API_SECRET</span> to enable
                in-platform lesson calls.
              </p>
            </div>
          ) : null}

          {serverUrl ? (
            <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Media server:{" "}
              <span className="font-medium text-foreground">{serverUrl}</span>
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

          {hasJoined && roomRef.current ? (
            <LiveKitMeetStage
              room={roomRef.current}
              toolbarActions={
                <>
                  {role === "tutor" ? (
                    recordingStatus === "recording" ? (
                      <Button
                        variant="ghost"
                        className={toolbarDangerButtonClassName}
                        onClick={() => void updateRecording("stop")}
                        disabled={isRecordingActionPending}
                      >
                        {isRecordingActionPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Radio className="mr-2 h-4 w-4" />
                        )}
                        Stop recording
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        className={toolbarButtonClassName}
                        onClick={() => void updateRecording("start")}
                        disabled={
                          isRecordingActionPending ||
                          startRecordingDisabledReason !== null
                        }
                        title={
                          startRecordingDisabledReason ?? "Start recording"
                        }
                      >
                        {isRecordingActionPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Radio className="mr-2 h-4 w-4" />
                        )}
                        Start recording
                      </Button>
                    )
                  ) : null}
                </>
              }
              toolbarTrailingActions={
                <Button
                  variant="ghost"
                  className={toolbarDangerButtonClassName}
                  onClick={() => void handleDisconnect()}
                  disabled={isSyncingSession || isRecordingActionPending}
                >
                  <PhoneOff className="mr-2 h-4 w-4" />
                  Leave room
                </Button>
              }
            />
          ) : (
            <div
              data-lk-theme="default"
              className="lk-room-container overflow-hidden rounded-[2rem] border border-border/60 bg-[radial-gradient(circle_at_top,_rgba(74,222,128,0.1),_transparent_35%),linear-gradient(180deg,_rgba(10,15,12,0.92),_rgba(3,7,4,0.98))] p-6 text-white shadow-[0_36px_120px_-48px_rgba(0,0,0,0.85)]"
            >
              <div className="flex min-h-[420px] items-center justify-center rounded-[1.75rem] border border-dashed border-white/10 bg-black/20 px-6 py-10 text-center">
                <div className="max-w-md space-y-3">
                  <Video className="mx-auto h-10 w-10 text-white/80" />
                  <p className="text-lg font-semibold text-white">
                    Meet-style lesson stage
                  </p>
                  <p className="text-sm text-white/65">
                    Join the lesson room to launch the new LiveKit meeting
                    layout with built-in device controls and the existing lesson
                    recording workflow.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isVideoPlaybackBlocked ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Your browser blocked remote video playback. Resume it to see
                  the student camera.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void resumeRemoteVideo()}
                >
                  Resume video
                </Button>
              </div>
            </div>
          ) : null}

          {hasPausedRemoteVideo && !isVideoPlaybackBlocked ? (
            <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Remote video is currently paused by the media pipeline. Keeping
              this tab visible and reconnecting the room should restore it.
            </div>
          ) : null}

          {hasJoined &&
          remoteParticipantCount > 0 &&
          remoteVideoTrackCount === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              The other participant is connected, but no remote camera track is
              publishing yet.
            </div>
          ) : null}

          {hasJoined && remoteParticipantCount === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Waiting for the other participant to join.
            </div>
          ) : null}

          {!hasJoined ? (
            <div className="flex flex-wrap gap-2">
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
            </div>
          ) : null}

          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Recording controls
                </p>
                <p className="text-sm text-muted-foreground">
                  Recording stays tutor-controlled and lesson-bound. Consent is
                  tracked separately from media state.
                </p>
                {role === "tutor" &&
                recordingStatus !== "recording" &&
                startRecordingDisabledReason ? (
                  <p className="text-sm text-muted-foreground">
                    {startRecordingDisabledReason}.
                  </p>
                ) : null}
              </div>
            </div>

            {role === "tutor" && !recordingConfigured ? (
              <div className="mt-4 rounded-2xl border border-dashed bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  Recording storage setup required
                </p>
                <p className="mt-1">
                  {recordingConfigurationError ||
                    "Add the LiveKit egress storage variables to enable server-side lesson recordings."}
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {role === "tutor" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Recording consent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Turn this on after the student confirms consent for lesson
              recording.
            </p>
            <p>
              If consent is off, recording stays unavailable until you enable it
              again.
            </p>
            <div className="flex flex-col gap-3 rounded-2xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  Status: {getRecordingConsentLabel(recordingConsentStatus)}
                </p>
                <p>Use the toggle to grant or revoke recording permission.</p>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-center">
                <span className="text-sm text-muted-foreground">
                  {recordingConsentStatus === "granted"
                    ? "Granted"
                    : "Not granted"}
                </span>
                <Switch
                  checked={recordingConsentStatus === "granted"}
                  onCheckedChange={(checked) => {
                    void updateConsent(checked ? "granted" : "declined");
                  }}
                  disabled={isSyncingSession || isRecordingActionPending}
                  aria-label="Toggle recording consent"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
