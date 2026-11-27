import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getGoogleCalendarConnection,
  getLessonGoogleCalendarEvent,
  getValidGoogleCalendarAccessToken,
  hasGoogleDriveScope,
} from "@/lib/google-calendar";
import type { Database } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

const GOOGLE_CALENDAR_API_BASE_URL = "https://www.googleapis.com/calendar/v3";
const GOOGLE_DRIVE_API_BASE_URL = "https://www.googleapis.com/drive/v3";

export type GoogleMeetTranscriptErrorCode =
  | "NO_CONNECTION"
  | "NEEDS_DRIVE_SCOPE"
  | "NOT_FOUND"
  | "API_ERROR";

export class GoogleMeetTranscriptError extends Error {
  code: GoogleMeetTranscriptErrorCode;
  statusCode?: number;

  constructor(
    code: GoogleMeetTranscriptErrorCode,
    message: string,
    statusCode?: number,
  ) {
    super(message);
    this.name = "GoogleMeetTranscriptError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface MeetTranscriptTurn {
  speakerName: string;
  speakerRole: "tutor" | "student" | "unknown";
  timestamp: string | null;
  text: string;
}

export interface ParsedMeetTranscript {
  normalizedText: string;
  turns: MeetTranscriptTurn[];
  studentTurnsText: string;
  tutorTurnsText: string;
  speakers: Array<{
    name: string;
    role: "tutor" | "student" | "unknown";
    turnCount: number;
  }>;
}

export interface FetchedGoogleMeetTranscript {
  rawText: string;
  driveFileId: string;
  driveFileName: string;
  driveWebViewLink: string | null;
  sourceMethod: "calendar_attachment" | "drive_search";
}

interface CalendarAttachment {
  fileId?: string;
  fileUrl?: string;
  mimeType?: string;
  title?: string;
}

interface DriveFileCandidate {
  id: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export function extractGoogleMeetCode(
  meetUrl: string | null | undefined,
): string | null {
  if (!meetUrl) {
    return null;
  }
  const match = meetUrl.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeSpeakerComparison(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreNameMatch(speakerNorm: string, referenceNorm: string): number {
  if (!speakerNorm || !referenceNorm) {
    return 0;
  }
  if (speakerNorm === referenceNorm) {
    return 100;
  }
  if (speakerNorm.includes(referenceNorm) || referenceNorm.includes(speakerNorm)) {
    return 70;
  }

  const speakerTokens = speakerNorm.split(" ").filter((t) => t.length >= 2);
  const referenceTokens = new Set(
    referenceNorm.split(" ").filter((t) => t.length >= 2),
  );
  let overlap = 0;
  for (const token of speakerTokens) {
    if (referenceTokens.has(token)) {
      overlap += 1;
    }
  }
  if (overlap === 0) {
    return 0;
  }
  return overlap * 25;
}

export function inferMeetSpeakerRole(
  speakerName: string,
  names: {
    tutorName?: string | null;
    studentName?: string | null;
  },
): "tutor" | "student" | "unknown" {
  const speakerNorm = normalizeSpeakerComparison(speakerName);
  if (!speakerNorm || speakerNorm === "unknown") {
    return "unknown";
  }

  const tutorScore = scoreNameMatch(
    speakerNorm,
    normalizeSpeakerComparison(names.tutorName),
  );
  const studentScore = scoreNameMatch(
    speakerNorm,
    normalizeSpeakerComparison(names.studentName),
  );

  if (tutorScore === 0 && studentScore === 0) {
    return "unknown";
  }
  if (studentScore > tutorScore) {
    return "student";
  }
  if (tutorScore > studentScore) {
    return "tutor";
  }
  return "unknown";
}

function isTimestampToken(line: string): string | null {
  const match = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?$/);
  return match?.[1] ?? null;
}

function parseTimestampSpeakerPrefix(line: string): {
  timestamp: string | null;
  speakerName: string;
  text: string;
} | null {
  // Format: [00:01:23] Speaker Name: utterance OR 00:01:23 Speaker Name: utterance
  const timedColonMatch = line.match(
    /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+([^:\n]{1,60}):\s*(.+)$/,
  );
  if (timedColonMatch) {
    return {
      timestamp: timedColonMatch[1],
      speakerName: timedColonMatch[2].trim(),
      text: timedColonMatch[3].trim(),
    };
  }

  // Format: <v Speaker Name>utterance</v>
  const vttVoiceMatch = line.match(/^<v\s+([^>]+)>(.+?)(?:<\/v>)?$/i);
  if (vttVoiceMatch) {
    return {
      timestamp: null,
      speakerName: vttVoiceMatch[1].trim(),
      text: vttVoiceMatch[2].trim(),
    };
  }

  // Format: Speaker Name: utterance (avoid matching URLs like https: or time strings like 12:30:)
  const speakerColonMatch = line.match(/^([\p{L}][\p{L}\p{N}.' -]{0,50}):\s+(.+)$/u);
  if (speakerColonMatch) {
    const candidateSpeaker = speakerColonMatch[1].trim();
    const lower = candidateSpeaker.toLowerCase();
    if (
      lower !== "http" &&
      lower !== "https" &&
      lower !== "date" &&
      lower !== "meeting" &&
      lower !== "attendees" &&
      lower !== "transcript"
    ) {
      return {
        timestamp: null,
        speakerName: candidateSpeaker,
        text: speakerColonMatch[2].trim(),
      };
    }
  }

  return null;
}

export function parseGoogleMeetTranscriptText(
  rawText: string,
  names: {
    tutorName?: string | null;
    studentName?: string | null;
  },
): ParsedMeetTranscript {
  const normalizedText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\uFEFF/g, "")
    .trim();

  if (!normalizedText) {
    return {
      normalizedText: "",
      turns: [],
      studentTurnsText: "",
      tutorTurnsText: "",
      speakers: [],
    };
  }

  const lines = normalizedText.split("\n").map((line) => line.trim());
  const turns: MeetTranscriptTurn[] = [];
  let pendingTimestamp: string | null = null;
  let pendingSpeakerOnly: string | null = null;
  let inHeaderMetadata = false;

  const pushTurn = (
    speakerName: string,
    timestamp: string | null,
    text: string,
  ) => {
    const cleanText = text.trim();
    if (!cleanText) {
      return;
    }
    const cleanSpeaker = speakerName.trim() || "Unknown";
    const last = turns[turns.length - 1];
    if (
      last &&
      last.speakerName === cleanSpeaker &&
      last.timestamp === timestamp
    ) {
      last.text = `${last.text} ${cleanText}`.trim();
      return;
    }
    turns.push({
      speakerName: cleanSpeaker,
      speakerRole: inferMeetSpeakerRole(cleanSpeaker, names),
      timestamp,
      text: cleanText,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      pendingSpeakerOnly = null;
      inHeaderMetadata = false;
      continue;
    }

    if (line === "WEBVTT" || /^\d+$/.test(line)) {
      continue;
    }

    // Skip VTT time ranges e.g. 00:00:01.000 --> 00:00:04.500
    const vttRangeMatch = line.match(
      /^(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})(?:\.\d{3})?\s*-->/,
    );
    if (vttRangeMatch) {
      pendingTimestamp = vttRangeMatch[1];
      continue;
    }

    if (
      /^transcript$/i.test(line) ||
      /^attendees$/i.test(line) ||
      /^notes$/i.test(line) ||
      /^meeting records?$/i.test(line)
    ) {
      if (/^attendees$/i.test(line)) {
        inHeaderMetadata = true;
      }
      continue;
    }

    if (inHeaderMetadata && turns.length === 0) {
      continue;
    }

    const standaloneTs = isTimestampToken(line);
    if (standaloneTs) {
      pendingTimestamp = standaloneTs;
      continue;
    }

    const prefixed = parseTimestampSpeakerPrefix(line);
    if (prefixed) {
      pushTurn(
        prefixed.speakerName,
        prefixed.timestamp ?? pendingTimestamp,
        prefixed.text,
      );
      pendingTimestamp = null;
      pendingSpeakerOnly = null;
      continue;
    }

    // Google Meet Docs often formats speaker name on its own line (optionally followed by timestamp)
    const speakerWithTrailingTs = line.match(
      /^([\p{L}][\p{L}\p{N}.' -]{1,48})\s+(\d{1,2}:\d{2}(?::\d{2})?)$/u,
    );
    if (speakerWithTrailingTs) {
      pendingSpeakerOnly = speakerWithTrailingTs[1].trim();
      pendingTimestamp = speakerWithTrailingTs[2];
      continue;
    }

    const nextLine = lines[i + 1] ?? "";
    const looksLikeSpeakerHeading =
      line.length <= 45 &&
      /^[\p{L}][\p{L}\p{N}.' -]+$/u.test(line) &&
      (Boolean(isTimestampToken(nextLine)) ||
        (Boolean(nextLine) && nextLine.length > 0 && turns.length > 0)) &&
      !line.endsWith(".") &&
      !line.endsWith("?") &&
      !line.endsWith("!");

    if (looksLikeSpeakerHeading && !pendingSpeakerOnly) {
      pendingSpeakerOnly = line;
      continue;
    }

    if (pendingSpeakerOnly) {
      pushTurn(pendingSpeakerOnly, pendingTimestamp, line);
      pendingTimestamp = null;
      continue;
    }

    if (turns.length > 0) {
      const prev = turns[turns.length - 1];
      prev.text = `${prev.text} ${line}`.trim();
    } else {
      pushTurn("Unknown", pendingTimestamp, line);
      pendingTimestamp = null;
    }
  }

  const speakerCounts = new Map<
    string,
    { name: string; role: "tutor" | "student" | "unknown"; turnCount: number }
  >();

  for (const turn of turns) {
    const key = turn.speakerName.toLowerCase();
    const existing = speakerCounts.get(key);
    if (existing) {
      existing.turnCount += 1;
    } else {
      speakerCounts.set(key, {
        name: turn.speakerName,
        role: turn.speakerRole,
        turnCount: 1,
      });
    }
  }

  const formatTurns = (filtered: MeetTranscriptTurn[]) =>
    filtered
      .map((turn) => {
        const prefix = turn.timestamp
          ? `[${turn.timestamp}] ${turn.speakerName}`
          : turn.speakerName;
        return `${prefix}: ${turn.text}`;
      })
      .join("\n");

  const studentTurnsText = formatTurns(
    turns.filter((turn) => turn.speakerRole === "student"),
  );
  const tutorTurnsText = formatTurns(
    turns.filter((turn) => turn.speakerRole === "tutor"),
  );

  return {
    normalizedText,
    turns,
    studentTurnsText,
    tutorTurnsText,
    speakers: Array.from(speakerCounts.values()),
  };
}

async function fetchGoogleApi(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    const errorText = await response.text().catch(() => "");
    if (
      errorText.includes("insufficientPermissions") ||
      errorText.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT") ||
      errorText.includes("Insufficient Permission")
    ) {
      throw new GoogleMeetTranscriptError(
        "NEEDS_DRIVE_SCOPE",
        "Google Drive read permission is required to read Meet transcripts. Please reconnect Google Calendar on the Lessons page.",
        response.status,
      );
    }
  }

  return response;
}

async function downloadDriveFileText(
  accessToken: string,
  fileId: string,
  mimeType: string | undefined,
): Promise<string | null> {
  const isGoogleDoc = mimeType === "application/vnd.google-apps.document";
  const url = isGoogleDoc
    ? `${GOOGLE_DRIVE_API_BASE_URL}/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`
    : `${GOOGLE_DRIVE_API_BASE_URL}/files/${encodeURIComponent(fileId)}?alt=media`;

  const response = await fetchGoogleApi(url, accessToken);
  if (!response.ok) {
    if (response.status === 404 || response.status === 403) {
      return null;
    }
    const text = await response.text().catch(() => "");
    throw new GoogleMeetTranscriptError(
      "API_ERROR",
      `Google Drive export error (${response.status}): ${text}`,
      response.status,
    );
  }

  const content = await response.text();
  return content.trim().length > 0 ? content : null;
}

function isReadableTranscriptCandidate(
  mimeType: string | undefined,
  titleOrName: string | undefined,
): boolean {
  const lowerName = (titleOrName ?? "").toLowerCase();
  const isSupportedMime =
    mimeType === "application/vnd.google-apps.document" ||
    mimeType === "text/plain" ||
    mimeType === "text/vtt" ||
    mimeType === "application/x-subrip";

  if (!isSupportedMime) {
    return false;
  }

  if (
    lowerName.includes(".mp4") ||
    lowerName.includes(".webm") ||
    lowerName.includes("recording")
  ) {
    return lowerName.includes("transcript");
  }

  return true;
}

function scoreDriveCandidate(
  file: DriveFileCandidate,
  context: {
    meetCode: string | null;
    lessonTitle: string | null;
    studentName: string | null;
  },
): number {
  const nameLower = (file.name ?? "").toLowerCase();
  let score = 0;
  if (nameLower.includes("transcript")) {
    score += 50;
  }
  if (context.meetCode && nameLower.includes(context.meetCode)) {
    score += 100;
  }
  if (context.lessonTitle) {
    const titleLower = context.lessonTitle.toLowerCase().trim();
    if (titleLower && nameLower.includes(titleLower)) {
      score += 40;
    }
  }
  if (context.studentName) {
    const studentLower = context.studentName.toLowerCase().trim();
    if (studentLower && nameLower.includes(studentLower)) {
      score += 35;
    }
  }
  if (file.mimeType === "application/vnd.google-apps.document") {
    score += 15;
  }
  return score;
}

export async function fetchGoogleMeetTranscriptForLesson({
  lessonId,
  tutorId,
  supabaseAdmin,
  lessonTitle,
  lessonDate,
  meetUrl,
  studentName,
}: {
  lessonId: string;
  tutorId: string;
  supabaseAdmin: SupabaseAdminClient;
  lessonTitle: string | null;
  lessonDate: string;
  meetUrl: string | null;
  studentName: string | null;
}): Promise<FetchedGoogleMeetTranscript> {
  const connection = await getGoogleCalendarConnection(tutorId, supabaseAdmin);
  if (!connection) {
    throw new GoogleMeetTranscriptError(
      "NO_CONNECTION",
      "Connect Google Calendar on the Lessons page first to sync Google Meet transcripts automatically.",
    );
  }

  if (!hasGoogleDriveScope(connection.scope)) {
    throw new GoogleMeetTranscriptError(
      "NEEDS_DRIVE_SCOPE",
      "Please click Reconnect in Google Calendar Sync to grant Google Drive read access for Meet transcripts.",
    );
  }

  const { accessToken } = await getValidGoogleCalendarAccessToken(
    connection,
    supabaseAdmin,
  );
  const meetCode = extractGoogleMeetCode(meetUrl);

  // Strategy 1: Inspect Google Calendar event attachments directly
  const calendarEventRow = await getLessonGoogleCalendarEvent(
    lessonId,
    tutorId,
    supabaseAdmin,
  );

  if (calendarEventRow) {
    const eventUrl =
      `${GOOGLE_CALENDAR_API_BASE_URL}/calendars/${encodeURIComponent(calendarEventRow.google_calendar_id)}` +
      `/events/${encodeURIComponent(calendarEventRow.google_event_id)}` +
      `?fields=id,summary,attachments(fileId,fileUrl,mimeType,title)`;

    const eventResponse = await fetchGoogleApi(eventUrl, accessToken);
    if (eventResponse.ok) {
      const eventPayload = (await eventResponse.json()) as {
        attachments?: CalendarAttachment[];
      };

      const attachments = (eventPayload.attachments ?? [])
        .filter((att) => Boolean(att.fileId))
        .filter((att) => isReadableTranscriptCandidate(att.mimeType, att.title))
        .sort((a, b) => {
          const aHasTranscript = (a.title ?? "").toLowerCase().includes("transcript") ? 1 : 0;
          const bHasTranscript = (b.title ?? "").toLowerCase().includes("transcript") ? 1 : 0;
          return bHasTranscript - aHasTranscript;
        });

      for (const att of attachments) {
        if (!att.fileId) continue;
        const text = await downloadDriveFileText(accessToken, att.fileId, att.mimeType);
        if (text) {
          return {
            rawText: text,
            driveFileId: att.fileId,
            driveFileName: att.title || "Google Meet Transcript",
            driveWebViewLink: att.fileUrl ?? null,
            sourceMethod: "calendar_attachment",
          };
        }
      }
    }
  }

  // Strategy 2: Search Google Drive for Meet transcript docs near the lesson date
  const baseDate = new Date(`${lessonDate}T00:00:00Z`);
  const windowStart = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(baseDate.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const nameClauses = ["name contains 'Transcript'"];
  if (meetCode) {
    nameClauses.push(`name contains '${escapeDriveQueryValue(meetCode)}'`);
  }
  if (lessonTitle && lessonTitle.trim().length >= 3) {
    nameClauses.push(`name contains '${escapeDriveQueryValue(lessonTitle.trim())}'`);
  }
  if (studentName && studentName.trim().length >= 3) {
    nameClauses.push(`name contains '${escapeDriveQueryValue(studentName.trim())}'`);
  }

  const driveQuery = [
    "trashed = false",
    "(mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'text/vtt')",
    `(${nameClauses.join(" or ")})`,
    `createdTime >= '${windowStart}'`,
    `createdTime <= '${windowEnd}'`,
  ].join(" and ");

  const driveParams = new URLSearchParams({
    q: driveQuery,
    orderBy: "createdTime desc",
    pageSize: "15",
    fields: "files(id,name,mimeType,webViewLink,createdTime,modifiedTime)",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });

  const driveResponse = await fetchGoogleApi(
    `${GOOGLE_DRIVE_API_BASE_URL}/files?${driveParams.toString()}`,
    accessToken,
  );

  if (!driveResponse.ok) {
    const errorText = await driveResponse.text().catch(() => "");
    throw new GoogleMeetTranscriptError(
      "API_ERROR",
      `Failed to search Google Drive (${driveResponse.status}): ${errorText}`,
      driveResponse.status,
    );
  }

  const drivePayload = (await driveResponse.json()) as {
    files?: DriveFileCandidate[];
  };

  const candidates = (drivePayload.files ?? [])
    .filter((file) => isReadableTranscriptCandidate(file.mimeType, file.name))
    .sort(
      (a, b) =>
        scoreDriveCandidate(b, { meetCode, lessonTitle, studentName }) -
        scoreDriveCandidate(a, { meetCode, lessonTitle, studentName }),
    );

  for (const candidate of candidates) {
    const text = await downloadDriveFileText(
      accessToken,
      candidate.id,
      candidate.mimeType,
    );
    if (text) {
      return {
        rawText: text,
        driveFileId: candidate.id,
        driveFileName: candidate.name || "Google Meet Transcript",
        driveWebViewLink: candidate.webViewLink ?? null,
        sourceMethod: "drive_search",
      };
    }
  }

  throw new GoogleMeetTranscriptError(
    "NOT_FOUND",
    "No Google Meet transcript was found in your Calendar event or Google Drive for this lesson date. Ensure Meet Transcription was enabled, or paste the transcript below.",
  );
}
