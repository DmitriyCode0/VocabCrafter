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
  Mic,
  Monitor,
  PictureInPicture2,
  PhoneOff,
  Radio,
  ShieldCheck,
  Users,
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

interface ClassroomJoinPayload {
  token: string;
  serverUrl: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
}

interface ClassroomRoomClientProps {
  connectionId: string;
  role: Role;
  isConfigured: boolean;
  serverUrl: string | null;
  initialRoomStatus: string;
  initialRecordingStatus: string;
  initialRecordingConsentStatus: string;
  recordingConfigured: boolean;
  recordingConfigurationError: string | null;
}

interface ClassroomSessionPayload {
  session: {
    room_status: string;
    recording_consent_status: string;
    recording_status: string;
    transcript_status: string;
  };
  participantCount?: number;
}

interface ClassroomSpeakingSummaryPayload {
  tutorSpeakingSeconds: number;
  studentSpeakingSeconds: number;
}

interface ClassroomRecordingPayload {
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

type PiPParticipantType = "local" | "remote";
type PiPTrackKind = "camera" | "screen";

interface PiPVideoTile {
  label: string;
  video: HTMLVideoElement | null;
  placeholder: string;
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

// Audio notification functions
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
    // Silently fail if audio context is not available
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
    // Silently fail if audio context is not available
    console.warn("Could not play leave sound:", error);
  }
}

function formatSpeakingDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function getPiPTrackElements(container: HTMLDivElement | null) {
  return Array.from(
    container?.querySelectorAll("[data-pip-track-kind]") ?? [],
  ).filter(
    (element): element is HTMLDivElement => element instanceof HTMLDivElement,
  );
}

function getPiPTrackElement(
  elements: HTMLDivElement[],
  participantType: PiPParticipantType,
  trackKind: PiPTrackKind,
) {
  return (
    elements.find(
      (element) =>
        element.dataset.pipParticipantType === participantType &&
        element.dataset.pipTrackKind === trackKind,
    ) ?? null
  );
}

function getPiPTrackVideo(element: HTMLDivElement | null) {
  const video = element?.querySelector("video") ?? null;
  return video instanceof HTMLVideoElement ? video : null;
}

function drawPiPVideoFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return false;
  }

  const sourceAspectRatio = sourceWidth / sourceHeight;
  const targetAspectRatio = width / height;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (sourceAspectRatio > targetAspectRatio) {
    cropWidth = sourceHeight * targetAspectRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetAspectRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  context.drawImage(
    video,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    x,
    y,
    width,
    height,
  );

  return true;
}

function drawPiPTile(
  context: CanvasRenderingContext2D,
  tile: PiPVideoTile,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = "#111111";
  context.fillRect(x, y, width, height);

  const canDrawVideo =
    tile.video && tile.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

  if (tile.video && canDrawVideo) {
    drawPiPVideoFrame(context, tile.video, x, y, width, height);
  } else {
    context.fillStyle = "#202020";
    context.fillRect(x, y, width, height);
    context.fillStyle = "rgba(255, 255, 255, 0.7)";
    context.font = "500 28px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(tile.placeholder, x + width / 2, y + height / 2);
  }

  context.fillStyle = "rgba(0, 0, 0, 0.72)";
  context.fillRect(x + 24, y + 24, Math.max(160, tile.label.length * 16), 52);
  context.fillStyle = "#ffffff";
  context.font = "600 28px sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(tile.label, x + 40, y + 50);
}

export function ClassroomRoomClient({
  connectionId,
  role,
  isConfigured,
  serverUrl,
  initialRoomStatus,
  initialRecordingStatus,
  initialRecordingConsentStatus,
  recordingConfigured,
  recordingConfigurationError,
}: ClassroomRoomClientProps) {
  const router = useRouter();
  const roomRef = useRef<Room | null>(null);
  const speakingTimerRef = useRef<number | null>(null);
  const speakingTotalsRef = useRef({ local: 0, remote: 0 });
  const meetStageRef = useRef<HTMLDivElement | null>(null);
  const pictureInPictureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pictureInPictureVideoRef = useRef<HTMLVideoElement | null>(null);
  const pictureInPictureFrameRef = useRef<number | null>(null);
  const pictureInPictureStreamRef = useRef<MediaStream | null>(null);
  const [, startRefreshTransition] = useTransition();
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [roomStatus, setRoomStatus] = useState(initialRoomStatus);
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
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
  const [pictureInPictureSupported, setPictureInPictureSupported] =
    useState(false);
  const [pictureInPictureActive, setPictureInPictureActive] = useState(false);
  const [speakingTotals, setSpeakingTotals] = useState({
    local: 0,
    remote: 0,
  });
  const [isVideoPlaybackBlocked, setIsVideoPlaybackBlocked] = useState(false);
  const [hasPausedRemoteVideo, setHasPausedRemoteVideo] = useState(false);

  const isConnected = connectionState === ConnectionState.Connected;
  const localSpeakingLabel = role === "tutor" ? "Tutor" : "Student";
  const remoteSpeakingLabel = role === "tutor" ? "Student" : "Tutor";
  const totalSpeakingSeconds = speakingTotals.local + speakingTotals.remote;
  const localSpeakingShare =
    totalSpeakingSeconds > 0
      ? Math.round((speakingTotals.local / totalSpeakingSeconds) * 100)
      : 0;
  const remoteSpeakingShare =
    totalSpeakingSeconds > 0 ? 100 - localSpeakingShare : 0;
  const startRecordingDisabledReason = !hasJoined
    ? "Join the classroom first"
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
    setRoomStatus(initialRoomStatus);
  }, [initialRoomStatus]);

  useEffect(() => {
    setRecordingStatus(initialRecordingStatus);
  }, [initialRecordingStatus]);

  useEffect(() => {
    setRecordingConsentStatus(initialRecordingConsentStatus);
  }, [initialRecordingConsentStatus]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    setPictureInPictureSupported(Boolean(document.pictureInPictureEnabled));
    setPictureInPictureActive(
      document.pictureInPictureElement instanceof HTMLVideoElement,
    );
  }, []);

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
    async (
      action: "participant-connected" | "participant-disconnected",
      speakingSummary?: ClassroomSpeakingSummaryPayload,
    ) => {
      setIsSyncingSession(true);

      try {
        const payload = await postJson<ClassroomSessionPayload>(
          `/api/classroom/${connectionId}/session`,
          {
            action,
            speakingSummary,
          },
        );

        setRoomStatus(payload.session.room_status);
        setRecordingStatus(payload.session.recording_status);
        setRecordingConsentStatus(payload.session.recording_consent_status);
        refreshRoute();
      } finally {
        setIsSyncingSession(false);
      }
    },
    [connectionId, postJson, refreshRoute],
  );

  const buildSpeakingSummaryPayload = useCallback(() => {
    const nextTotals = speakingTotalsRef.current;

    return role === "tutor"
      ? {
          tutorSpeakingSeconds: nextTotals.local,
          studentSpeakingSeconds: nextTotals.remote,
        }
      : {
          tutorSpeakingSeconds: nextTotals.remote,
          studentSpeakingSeconds: nextTotals.local,
        };
  }, [role]);

  const updateConsent = useCallback(
    async (consentStatus: "granted" | "declined") => {
      setIsSyncingSession(true);

      try {
        const payload = await postJson<ClassroomSessionPayload>(
          `/api/classroom/${connectionId}/session`,
          {
            action: "set-consent",
            consentStatus,
          },
        );

        setRoomStatus(payload.session.room_status);
        setRecordingStatus(payload.session.recording_status);
        setRecordingConsentStatus(payload.session.recording_consent_status);
        toast.success(
          consentStatus === "granted"
            ? "Classroom recording consent confirmed"
            : "Classroom recording consent marked as declined",
        );
        refreshRoute();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update classroom recording consent",
        );
      } finally {
        setIsSyncingSession(false);
      }
    },
    [connectionId, postJson, refreshRoute],
  );

  const updateRecording = useCallback(
    async (action: "start" | "stop") => {
      setIsRecordingActionPending(true);

      try {
        const payload = await postJson<ClassroomRecordingPayload>(
          `/api/classroom/${connectionId}/recording`,
          { action },
        );

        setRoomStatus(payload.session.room_status);
        setRecordingStatus(payload.session.recording_status);
        setRecordingConsentStatus(payload.session.recording_consent_status);
        toast.success(
          action === "start"
            ? "Classroom recording started"
            : "Classroom recording stopped and is now processing",
        );
        refreshRoute();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Failed to ${action} classroom recording`,
        );
      } finally {
        setIsRecordingActionPending(false);
      }
    },
    [connectionId, postJson, refreshRoute],
  );

  const resetSpeakingTimer = useCallback(() => {
    if (speakingTimerRef.current !== null) {
      window.clearInterval(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }

    const nextTotals = { local: 0, remote: 0 };
    speakingTotalsRef.current = nextTotals;
    setSpeakingTotals(nextTotals);
  }, []);

  const stopPictureInPictureRenderer = useCallback(() => {
    if (pictureInPictureFrameRef.current !== null) {
      window.cancelAnimationFrame(pictureInPictureFrameRef.current);
      pictureInPictureFrameRef.current = null;
    }

    pictureInPictureCanvasRef.current = null;

    if (pictureInPictureStreamRef.current) {
      for (const track of pictureInPictureStreamRef.current.getTracks()) {
        track.stop();
      }

      pictureInPictureStreamRef.current = null;
    }

    if (pictureInPictureVideoRef.current) {
      pictureInPictureVideoRef.current.srcObject = null;
      pictureInPictureVideoRef.current.remove();
      pictureInPictureVideoRef.current = null;
    }

    setPictureInPictureActive(false);
  }, []);

  const closePictureInPicture = useCallback(async () => {
    if (
      typeof document !== "undefined" &&
      pictureInPictureVideoRef.current &&
      document.pictureInPictureElement === pictureInPictureVideoRef.current
    ) {
      try {
        await document.exitPictureInPicture();
      } catch {
        // Ignore exit failures and continue local cleanup.
      }
    }

    stopPictureInPictureRenderer();
  }, [stopPictureInPictureRenderer]);

  const getPictureInPictureTiles = useCallback(() => {
    const trackElements = getPiPTrackElements(meetStageRef.current);
    const localCameraTrack = getPiPTrackElement(
      trackElements,
      "local",
      "camera",
    );
    const remoteCameraTrack = getPiPTrackElement(
      trackElements,
      "remote",
      "camera",
    );
    const screenShareTracks = trackElements.filter(
      (element) => element.dataset.pipTrackKind === "screen",
    );
    const remoteParticipantLabel = role === "tutor" ? "Student" : "Tutor";

    return [
      {
        label: localCameraTrack?.dataset.pipLabel || "You",
        video: getPiPTrackVideo(localCameraTrack),
        placeholder: "Your camera is off",
      },
      {
        label: remoteCameraTrack?.dataset.pipLabel || remoteParticipantLabel,
        video: getPiPTrackVideo(remoteCameraTrack),
        placeholder:
          remoteParticipantCount > 0
            ? `${remoteParticipantLabel} camera is off`
            : `Waiting for ${remoteParticipantLabel.toLowerCase()}`,
      },
      ...screenShareTracks.map((element) => ({
        label: element.dataset.pipLabel || "Screen share",
        video: getPiPTrackVideo(element),
        placeholder: "Screen share is unavailable",
      })),
    ] satisfies PiPVideoTile[];
  }, [remoteParticipantCount, role]);

  const renderPictureInPictureFrame = useCallback(() => {
    const canvas = pictureInPictureCanvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const tiles = getPictureInPictureTiles();
    const tileWidth = 960;
    const tileHeight = 540;
    const gap = 16;
    const padding = 16;
    const canvasWidth = tileWidth + padding * 2;
    const canvasHeight =
      padding * 2 + tiles.length * tileHeight + (tiles.length - 1) * gap;

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }

    context.fillStyle = "#0b0b0c";
    context.fillRect(0, 0, canvas.width, canvas.height);

    tiles.forEach((tile, index) => {
      const y = padding + index * (tileHeight + gap);
      drawPiPTile(context, tile, padding, y, tileWidth, tileHeight);
    });

    pictureInPictureFrameRef.current = window.requestAnimationFrame(
      renderPictureInPictureFrame,
    );
  }, [getPictureInPictureTiles]);

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

    setCameraEnabled(room.localParticipant.isCameraEnabled);
    setMicrophoneEnabled(room.localParticipant.isMicrophoneEnabled);
    setRemoteParticipantCount(room.remoteParticipants.size);
    setRemoteMicrophoneTrackCount(nextRemoteMicrophoneTrackCount);
    setRemoteVideoTrackCount(nextRemoteVideoTrackCount);
    setScreenShareEnabled(room.localParticipant.isScreenShareEnabled);
    setHasPausedRemoteVideo(nextHasPausedRemoteVideo);
    setIsVideoPlaybackBlocked(!room.canPlaybackVideo);
    if (typeof document !== "undefined") {
      setPictureInPictureActive(
        document.pictureInPictureElement instanceof HTMLVideoElement,
      );
    }
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    if (typeof document === "undefined") {
      return;
    }

    try {
      if (document.pictureInPictureElement instanceof HTMLVideoElement) {
        await closePictureInPicture();
        return;
      }

      const tiles = getPictureInPictureTiles();

      if (!tiles.some((tile) => tile.video)) {
        toast.error(
          "Join the classroom and publish a camera or screen share first",
        );
        return;
      }

      const canvas = document.createElement("canvas");
      const stream = canvas.captureStream(12);
      const video = document.createElement("video");
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      video.style.position = "fixed";
      video.style.left = "-9999px";
      video.style.top = "-9999px";
      document.body.appendChild(video);

      pictureInPictureCanvasRef.current = canvas;
      pictureInPictureStreamRef.current = stream;
      pictureInPictureVideoRef.current = video;

      renderPictureInPictureFrame();
      await video.play();
      video.addEventListener(
        "leavepictureinpicture",
        stopPictureInPictureRenderer,
        {
          once: true,
        },
      );
      await video.requestPictureInPicture();
      setPictureInPictureActive(true);
    } catch (error) {
      stopPictureInPictureRenderer();
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to toggle picture-in-picture",
      );
    }
  }, [
    closePictureInPicture,
    getPictureInPictureTiles,
    renderPictureInPictureFrame,
    stopPictureInPictureRenderer,
  ]);

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
      // Only play sound for remote participants (not ourselves)
      if (participant.identity !== room.localParticipant.identity) {
        playJoinSound();
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      syncState();
      // Only play sound for remote participants (not ourselves)
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
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      setScreenShareEnabled(false);
      void closePictureInPicture();
      resetSpeakingTimer();
      setRemoteParticipantCount(0);
      setRemoteMicrophoneTrackCount(0);
      setRemoteVideoTrackCount(0);
      setHasPausedRemoteVideo(false);
      setIsVideoPlaybackBlocked(false);
      setConnectionState(ConnectionState.Disconnected);
    });

    try {
      const response = await fetch(
        `/api/classroom/${connectionId}/room-token`,
        {
          method: "POST",
          cache: "no-store",
        },
      );

      const data = (await response.json().catch(() => null)) as
        | ClassroomJoinPayload
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && "error" in data
            ? data.error || "Failed to create classroom token"
            : "Failed to create classroom token",
        );
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("serverUrl" in data) ||
        !("token" in data)
      ) {
        throw new Error("Failed to create classroom token");
      }

      await room.connect(data.serverUrl, data.token);
      setHasJoined(true);

      try {
        await room.localParticipant.enableCameraAndMicrophone();
      } catch {
        setJoinError(
          "Connected to the classroom, but camera or microphone access was denied. Use the LiveKit controls below to retry.",
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
            : "Joined the classroom, but failed to sync room state",
        );
      }
    } catch (error) {
      if (roomRef.current === room) {
        roomRef.current = null;
      }

      setHasJoined(false);
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      setScreenShareEnabled(false);
      void closePictureInPicture();
      resetSpeakingTimer();
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
        error instanceof Error ? error.message : "Failed to join the classroom",
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
      setJoinError("Stop the recording before leaving the classroom.");
      return;
    }

    roomRef.current = null;
    setIsJoining(false);
    setJoinError(null);
    const speakingSummary = buildSpeakingSummaryPayload();

    try {
      await room.disconnect(true);
    } finally {
      setHasJoined(false);
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      setScreenShareEnabled(false);
      void closePictureInPicture();
      resetSpeakingTimer();
      setRemoteParticipantCount(0);
      setRemoteMicrophoneTrackCount(0);
      setRemoteVideoTrackCount(0);
      setHasPausedRemoteVideo(false);
      setIsVideoPlaybackBlocked(false);
      setConnectionState(ConnectionState.Disconnected);

      try {
        await syncSessionState("participant-disconnected", speakingSummary);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Left the classroom, but failed to sync room state",
        );
      }
    }
  }

  useEffect(() => {
    if (!hasJoined || !isConnected) {
      if (speakingTimerRef.current !== null) {
        window.clearInterval(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }

      return;
    }

    speakingTimerRef.current = window.setInterval(() => {
      const room = roomRef.current;

      if (!room) {
        return;
      }

      const nextTotals = { ...speakingTotalsRef.current };

      if (room.localParticipant.isSpeaking) {
        nextTotals.local += 1;
      }

      if (
        Array.from(room.remoteParticipants.values()).some(
          (participant) => participant.isSpeaking,
        )
      ) {
        nextTotals.remote += 1;
      }

      speakingTotalsRef.current = nextTotals;
      setSpeakingTotals(nextTotals);
    }, 1000);

    return () => {
      if (speakingTimerRef.current !== null) {
        window.clearInterval(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
    };
  }, [hasJoined, isConnected]);

  useEffect(() => {
    return () => {
      const room = roomRef.current;
      roomRef.current = null;

      if (room) {
        void room.disconnect(true);
      }

      void closePictureInPicture();
      resetSpeakingTimer();
    };
  }, [closePictureInPicture, resetSpeakingTimer]);

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
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="h-5 w-5 text-primary" />
                Connection Classroom
              </CardTitle>
              <CardDescription>
                {isConfigured
                  ? "Join the persistent classroom for this tutor-student connection. Recording consent and server-side classroom recordings are managed directly here now."
                  : "LiveKit is not configured yet, so the classroom cannot connect to realtime media yet."}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusTone}>
                {getConnectionStateLabel(connectionState)}
              </Badge>
              <Badge variant="outline">{getRoomStatusLabel(roomStatus)}</Badge>
            </div>
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
                classroom calls.
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
              allowScreenShare
              stageRef={meetStageRef}
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
                    Meet-style classroom stage
                  </p>
                  <p className="text-sm text-white/65">
                    Join the classroom to launch the new LiveKit meeting layout
                    with built-in device controls, screen sharing, and the
                    existing classroom recording workflow.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Your devices</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span>Camera</span>
                  <Badge variant="outline">
                    {cameraEnabled ? "On" : "Off"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Microphone</span>
                  <Badge variant="outline">
                    {microphoneEnabled ? "On" : "Off"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Remote presence</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Participants
                  </span>
                  <Badge variant="outline">{remoteParticipantCount}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Camera tracks</span>
                  <Badge variant="outline">{remoteVideoTrackCount}</Badge>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Recording input</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    Student mic tracks
                  </span>
                  <Badge variant="outline">{remoteMicrophoneTrackCount}</Badge>
                </div>
                <p className="text-muted-foreground">
                  Classroom recording becomes available only when the student
                  publishes a microphone track.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Screen share</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Share status
                  </span>
                  <Badge variant="outline">
                    {screenShareEnabled ? "Live" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Picture-in-picture</span>
                  <Badge variant="outline">
                    {pictureInPictureSupported ? "Supported" : "Unavailable"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

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

          {isVideoPlaybackBlocked ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Your browser blocked remote video playback. Resume it to see
                  the other camera.
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
              this tab visible and reconnecting the classroom should restore it.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {!hasJoined ? (
              <Button
                onClick={handleJoin}
                disabled={!isConfigured || isJoining || isSyncingSession}
              >
                {isJoining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining classroom...
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    Join classroom
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => void togglePictureInPicture()}
                  disabled={!pictureInPictureSupported || !hasJoined}
                >
                  <PictureInPicture2 className="mr-2 h-4 w-4" />
                  {pictureInPictureActive ? "Exit PiP" : "Open PiP"}
                </Button>
                {role === "tutor" ? (
                  recordingStatus === "recording" ? (
                    <Button
                      variant="destructive"
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
                      variant="outline"
                      onClick={() => void updateRecording("start")}
                      disabled={
                        isRecordingActionPending ||
                        startRecordingDisabledReason !== null
                      }
                      title={startRecordingDisabledReason ?? "Start recording"}
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
                <Button
                  variant="destructive"
                  onClick={() => void handleDisconnect()}
                  disabled={isSyncingSession || isRecordingActionPending}
                >
                  <PhoneOff className="mr-2 h-4 w-4" />
                  Leave classroom
                </Button>
              </>
            )}
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Speaking timer
              </p>
              <p className="text-sm text-muted-foreground">
                Live classroom speaking balance is tracked locally while the
                room stays connected.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">
                  {localSpeakingLabel}
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {localSpeakingShare}%
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatSpeakingDuration(speakingTotals.local)}
                </p>
              </div>
              <div className="rounded-2xl border bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">
                  {remoteSpeakingLabel}
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {remoteSpeakingShare}%
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatSpeakingDuration(speakingTotals.remote)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Recording controls
                </p>
                <p className="text-sm text-muted-foreground">
                  Classroom recording is tutor-controlled. Only student speech
                  in the saved transcript syncs into active vocabulary evidence.
                </p>
                {screenShareEnabled ? (
                  <p className="text-sm text-muted-foreground">
                    Screen sharing is live in this classroom session.
                  </p>
                ) : null}
                {role === "tutor" &&
                recordingStatus !== "recording" &&
                startRecordingDisabledReason ? (
                  <p className="text-sm text-muted-foreground">
                    {startRecordingDisabledReason}.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={
                    recordingStatus === "recording" ? "secondary" : "outline"
                  }
                >
                  <Radio className="mr-1 h-3.5 w-3.5" />
                  Recording {getRecordingStatusLabel(recordingStatus)}
                </Badge>
              </div>
            </div>

            {role === "tutor" && !recordingConfigured ? (
              <div className="mt-4 rounded-2xl border border-dashed bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  Recording storage setup required
                </p>
                <p className="mt-1">
                  {recordingConfigurationError ||
                    "Add the LiveKit egress storage variables to enable server-side classroom recordings."}
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
              Turn this on after the student confirms consent for classroom
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
