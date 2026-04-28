import "server-only";

import {
  AccessToken,
  EncodedFileOutput,
  EgressClient,
  EncodedFileType,
  EncodingOptionsPreset,
  RoomServiceClient,
  S3Upload,
  TrackSource,
  type EncodedOutputs,
} from "livekit-server-sdk";
import type { Role } from "@/types/roles";

interface LiveKitJoinTokenOptions {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  role: Role;
  metadata: Record<string, string>;
}

interface LiveKitRecordingOutputOptions {
  lessonId: string;
  sessionId: string;
}

interface LiveKitClassroomRecordingOutputOptions {
  connectionId: string;
  classroomId: string;
}

interface LiveKitParticipantTrackLookupOptions {
  roomName: string;
  participantIdentity: string;
  source?: TrackSource;
}

interface LiveKitRecordingTargetConfig {
  bucket: string;
  region: string;
  endpoint: string | null;
  accessKey: string;
  secret: string;
  forcePathStyle: boolean;
  filePrefix: string | null;
}

function normalizeEnvValue(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeBooleanEnvValue(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

export function getLiveKitServerUrl() {
  return normalizeEnvValue(process.env.LIVEKIT_URL);
}

function getLiveKitServiceUrl() {
  const serverUrl = getLiveKitServerUrl();

  if (!serverUrl) {
    return null;
  }

  if (serverUrl.startsWith("wss://")) {
    return `https://${serverUrl.slice(6)}`;
  }

  if (serverUrl.startsWith("ws://")) {
    return `http://${serverUrl.slice(5)}`;
  }

  return serverUrl;
}

function getLiveKitApiKey() {
  return normalizeEnvValue(process.env.LIVEKIT_API_KEY);
}

function getLiveKitApiSecret() {
  return normalizeEnvValue(process.env.LIVEKIT_API_SECRET);
}

function getLiveKitRecordingTargetConfig(): LiveKitRecordingTargetConfig | null {
  const bucket = normalizeEnvValue(process.env.LIVEKIT_EGRESS_S3_BUCKET);
  const accessKey = normalizeEnvValue(process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY);
  const secret = normalizeEnvValue(process.env.LIVEKIT_EGRESS_S3_SECRET);

  if (!bucket || !accessKey || !secret) {
    return null;
  }

  return {
    bucket,
    region: normalizeEnvValue(process.env.LIVEKIT_EGRESS_S3_REGION) ?? "",
    endpoint: normalizeEnvValue(process.env.LIVEKIT_EGRESS_S3_ENDPOINT),
    accessKey,
    secret,
    forcePathStyle: normalizeBooleanEnvValue(
      process.env.LIVEKIT_EGRESS_S3_FORCE_PATH_STYLE,
    ),
    filePrefix: normalizeEnvValue(process.env.LIVEKIT_EGRESS_FILE_PREFIX),
  };
}

export function isLiveKitConfigured() {
  return Boolean(
    getLiveKitServiceUrl() && getLiveKitApiKey() && getLiveKitApiSecret(),
  );
}

export function isLiveKitRecordingConfigured() {
  return Boolean(isLiveKitConfigured() && getLiveKitRecordingTargetConfig());
}

export function getLiveKitRecordingConfigurationError() {
  const missing = [
    !normalizeEnvValue(process.env.LIVEKIT_EGRESS_S3_BUCKET)
      ? "LIVEKIT_EGRESS_S3_BUCKET"
      : null,
    !normalizeEnvValue(process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY)
      ? "LIVEKIT_EGRESS_S3_ACCESS_KEY"
      : null,
    !normalizeEnvValue(process.env.LIVEKIT_EGRESS_S3_SECRET)
      ? "LIVEKIT_EGRESS_S3_SECRET"
      : null,
  ].filter(Boolean);

  if (missing.length === 0) {
    return null;
  }

  return `Recording requires ${missing.join(", ")}. Optional helpers: LIVEKIT_EGRESS_S3_REGION, LIVEKIT_EGRESS_S3_ENDPOINT, LIVEKIT_EGRESS_S3_FORCE_PATH_STYLE, LIVEKIT_EGRESS_FILE_PREFIX.`;
}

export function createLiveKitRoomServiceClient() {
  const serviceUrl = getLiveKitServiceUrl();
  const apiKey = getLiveKitApiKey();
  const apiSecret = getLiveKitApiSecret();

  if (!serviceUrl || !apiKey || !apiSecret) {
    throw new Error("LiveKit service credentials are not configured");
  }

  return new RoomServiceClient(serviceUrl, apiKey, apiSecret);
}

export function createLiveKitEgressClient() {
  const serviceUrl = getLiveKitServiceUrl();
  const apiKey = getLiveKitApiKey();
  const apiSecret = getLiveKitApiSecret();

  if (!serviceUrl || !apiKey || !apiSecret) {
    throw new Error("LiveKit service credentials are not configured");
  }

  return new EgressClient(serviceUrl, apiKey, apiSecret);
}

export function createLiveKitRecordingOutput({
  lessonId,
  sessionId,
}: LiveKitRecordingOutputOptions): EncodedOutputs {
  const config = getLiveKitRecordingTargetConfig();

  if (!config) {
    throw new Error(
      getLiveKitRecordingConfigurationError() ||
        "LiveKit recording storage is not configured",
    );
  }

  const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
  const prefix = config.filePrefix
    ? `${config.filePrefix.replace(/^\/+|\/+$/g, "")}/`
    : "";
  const filepath = `${prefix}lessons/${lessonId}/sessions/${sessionId}/recordings/${timestamp}.mp3`;

  return {
    file: new EncodedFileOutput({
      fileType: EncodedFileType.MP3,
      filepath,
      output: {
        case: "s3",
        value: new S3Upload({
          bucket: config.bucket,
          region: config.region,
          endpoint: config.endpoint ?? "",
          accessKey: config.accessKey,
          secret: config.secret,
          forcePathStyle: config.forcePathStyle,
          metadata: {
            lessonId,
            sessionId,
          },
        }),
      },
    }),
  };
}

export function createLiveKitClassroomRecordingOutput({
  connectionId,
  classroomId,
}: LiveKitClassroomRecordingOutputOptions): EncodedOutputs {
  const config = getLiveKitRecordingTargetConfig();

  if (!config) {
    throw new Error(
      getLiveKitRecordingConfigurationError() ||
        "LiveKit recording storage is not configured",
    );
  }

  const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
  const prefix = config.filePrefix
    ? `${config.filePrefix.replace(/^\/+|\/+$/g, "")}/`
    : "";
  const filepath = `${prefix}classrooms/${connectionId}/rooms/${classroomId}/recordings/${timestamp}.mp3`;

  return {
    file: new EncodedFileOutput({
      fileType: EncodedFileType.MP3,
      filepath,
      output: {
        case: "s3",
        value: new S3Upload({
          bucket: config.bucket,
          region: config.region,
          endpoint: config.endpoint ?? "",
          accessKey: config.accessKey,
          secret: config.secret,
          forcePathStyle: config.forcePathStyle,
          metadata: {
            connectionId,
            classroomId,
          },
        }),
      },
    }),
  };
}

export async function getLiveKitPublishedParticipantTrack({
  roomName,
  participantIdentity,
  source = TrackSource.MICROPHONE,
}: LiveKitParticipantTrackLookupOptions) {
  const roomServiceClient = createLiveKitRoomServiceClient();
  const participants = await roomServiceClient.listParticipants(roomName);
  const participant =
    participants.find((item) => item.identity === participantIdentity) ?? null;

  if (!participant) {
    return null;
  }

  const track =
    participant.tracks.find(
      (publishedTrack) =>
        publishedTrack.source === source && publishedTrack.sid.length > 0,
    ) ?? null;

  return {
    participant,
    track,
  };
}

export function getDefaultLiveKitRecordingOptions() {
  return {
    layout: "grid",
    encodingOptions: EncodingOptionsPreset.H264_720P_30,
  };
}

export async function createLiveKitJoinToken({
  roomName,
  participantIdentity,
  participantName,
  role,
  metadata,
}: LiveKitJoinTokenOptions) {
  const apiKey = getLiveKitApiKey();
  const apiSecret = getLiveKitApiSecret();

  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit credentials are not configured");
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: "10m",
    metadata: JSON.stringify(metadata),
    attributes: {
      role,
      lessonId: metadata.lessonId,
      userId: metadata.userId,
    },
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    roomAdmin: role === "tutor",
    roomRecord: role === "tutor",
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    canUpdateOwnMetadata: false,
    canPublishSources: [
      TrackSource.CAMERA,
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ],
  });

  return token.toJwt();
}