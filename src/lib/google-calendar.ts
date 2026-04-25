import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getLessonDisplayTitle,
  getLessonStatusLabel,
  getSuggestedLessonEndTime,
  type LessonStatus,
} from "@/lib/lessons";
import type { Database } from "@/types/database";

const GOOGLE_CALENDAR_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_CALENDAR_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_USERINFO_URL =
  "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_CALENDAR_API_BASE_URL = "https://www.googleapis.com/calendar/v3";

export const GOOGLE_CALENDAR_SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type GoogleCalendarConnectionRow =
  Database["public"]["Tables"]["google_calendar_connections"]["Row"];
type GoogleCalendarEventRow =
  Database["public"]["Tables"]["lesson_google_calendar_events"]["Row"];

interface GoogleCalendarUserInfo {
  email?: string;
}

interface GoogleCalendarTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

interface GoogleCalendarEventResponse {
  id?: string;
}

interface LessonGoogleCalendarSyncRow {
  id: string;
  tutor_id: string;
  student_id: string | null;
  title: string | null;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  status: LessonStatus;
  tutor_profile: {
    full_name: string | null;
    email: string;
  } | null;
  student_profile: {
    full_name: string | null;
    email: string;
  } | null;
}

export interface GoogleCalendarConnectionSummary {
  googleEmail: string | null;
  calendarId: string;
  connectedAt: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

export interface CalendarSyncResult {
  status: "synced" | "skipped" | "failed";
  message?: string;
}

export function isGoogleCalendarSyncConfigured() {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  );
}

export function sanitizeNextPath(
  nextPath: string | null | undefined,
  fallback = "/lessons",
) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return fallback;
  }

  return nextPath;
}

export function getGoogleCalendarRedirectUri(origin: string) {
  return `${origin}/api/google-calendar/callback`;
}

export function buildGoogleCalendarAuthorizationUrl({
  origin,
  state,
}: {
  origin: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
    redirect_uri: getGoogleCalendarRedirectUri(origin),
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPE,
    state,
  });

  return `${GOOGLE_CALENDAR_AUTH_URL}?${params.toString()}`;
}

export async function getAuthenticatedTutorContext() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || profile.role !== "tutor") {
    return null;
  }

  return {
    userId: user.id,
    supabaseAdmin,
  };
}

export async function getGoogleCalendarConnection(
  userId: string,
  supabaseAdmin = createAdminClient(),
) {
  const { data, error } = await supabaseAdmin
    .from("google_calendar_connections")
    .select(
      "user_id, google_email, calendar_id, access_token, refresh_token, scope, access_token_expires_at, last_synced_at, last_sync_error, connected_at, created_at, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as GoogleCalendarConnectionRow | null;
}

export async function getGoogleCalendarConnectionSummary(
  userId: string,
  supabaseAdmin = createAdminClient(),
) {
  const { data, error } = await supabaseAdmin
    .from("google_calendar_connections")
    .select(
      "google_email, calendar_id, connected_at, last_synced_at, last_sync_error",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    googleEmail: data.google_email,
    calendarId: data.calendar_id,
    connectedAt: data.connected_at,
    lastSyncedAt: data.last_synced_at,
    lastSyncError: data.last_sync_error,
  } satisfies GoogleCalendarConnectionSummary;
}

export async function upsertGoogleCalendarConnection(
  userId: string,
  connection: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string | null;
    scope: string | null;
    googleEmail: string | null;
    calendarId?: string;
  },
  supabaseAdmin = createAdminClient(),
) {
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("google_calendar_connections")
    .upsert(
      {
        user_id: userId,
        google_email: connection.googleEmail,
        calendar_id: connection.calendarId ?? "primary",
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken,
        scope: connection.scope,
        access_token_expires_at: connection.accessTokenExpiresAt,
        last_synced_at: null,
        last_sync_error: null,
        connected_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    throw error;
  }
}

export async function disconnectGoogleCalendarConnection(
  userId: string,
  supabaseAdmin = createAdminClient(),
) {
  const { error } = await supabaseAdmin
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function exchangeGoogleCalendarCode({
  code,
  origin,
  existingRefreshToken,
}: {
  code: string;
  origin: string;
  existingRefreshToken?: string | null;
}) {
  if (!isGoogleCalendarSyncConfigured()) {
    throw new Error("Google Calendar sync is not configured.");
  }

  const tokenResponse = await fetch(GOOGLE_CALENDAR_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
      redirect_uri: getGoogleCalendarRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(await readGoogleResponseError(tokenResponse));
  }

  const tokenPayload =
    (await tokenResponse.json()) as GoogleCalendarTokenResponse;

  if (!tokenPayload.access_token) {
    throw new Error("Google did not return an access token.");
  }

  const refreshToken = tokenPayload.refresh_token ?? existingRefreshToken;

  if (!refreshToken) {
    throw new Error(
      "Google did not return a refresh token. Reconnect with consent again.",
    );
  }

  const googleEmail = await fetchGoogleUserEmail(tokenPayload.access_token);

  return {
    accessToken: tokenPayload.access_token,
    refreshToken,
    accessTokenExpiresAt: getAccessTokenExpiresAtIso(tokenPayload.expires_in),
    scope: tokenPayload.scope ?? null,
    googleEmail,
    calendarId: "primary",
  };
}

export async function syncLessonToGoogleCalendar({
  lessonId,
  tutorId,
  supabaseAdmin = createAdminClient(),
}: {
  lessonId: string;
  tutorId: string;
  supabaseAdmin?: SupabaseAdminClient;
}): Promise<CalendarSyncResult> {
  if (!isGoogleCalendarSyncConfigured()) {
    return { status: "skipped" };
  }

  let mapping: GoogleCalendarEventRow | null = null;

  try {
    const connection = await getGoogleCalendarConnection(
      tutorId,
      supabaseAdmin,
    );

    if (!connection) {
      return { status: "skipped" };
    }

    const lesson = await loadLessonForGoogleCalendarSync(
      lessonId,
      tutorId,
      supabaseAdmin,
    );

    if (!lesson) {
      return { status: "skipped" };
    }

    mapping = await getLessonGoogleCalendarEvent(
      lessonId,
      tutorId,
      supabaseAdmin,
    );
    const { accessToken } = await getValidGoogleCalendarAccessToken(
      connection,
      supabaseAdmin,
    );
    const payload = buildGoogleCalendarEventPayload(lesson);
    let googleEventId = mapping?.google_event_id ?? null;

    if (googleEventId) {
      const updateResponse = await fetch(
        `${GOOGLE_CALENDAR_API_BASE_URL}/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(googleEventId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (updateResponse.status === 404) {
        googleEventId = await createGoogleCalendarEvent(
          accessToken,
          connection.calendar_id,
          payload,
        );
      } else if (!updateResponse.ok) {
        throw new Error(await readGoogleResponseError(updateResponse));
      }
    } else {
      googleEventId = await createGoogleCalendarEvent(
        accessToken,
        connection.calendar_id,
        payload,
      );
    }

    const syncedAt = new Date().toISOString();

    const { error: mappingError } = await supabaseAdmin
      .from("lesson_google_calendar_events")
      .upsert(
        {
          lesson_id: lessonId,
          user_id: tutorId,
          google_calendar_id: connection.calendar_id,
          google_event_id: googleEventId,
          synced_at: syncedAt,
          last_error: null,
          updated_at: syncedAt,
        },
        { onConflict: "lesson_id" },
      );

    if (mappingError) {
      throw mappingError;
    }

    await clearGoogleCalendarSyncError(tutorId, supabaseAdmin, syncedAt);

    return { status: "synced" };
  } catch (error) {
    const message = toErrorMessage(error);
    const nowIso = new Date().toISOString();

    await setGoogleCalendarSyncError(tutorId, message, supabaseAdmin, nowIso);

    if (mapping) {
      await supabaseAdmin
        .from("lesson_google_calendar_events")
        .update({ last_error: message, updated_at: nowIso })
        .eq("lesson_id", lessonId)
        .eq("user_id", tutorId);
    }

    return {
      status: "failed",
      message: `Lesson saved, but Google Calendar sync failed. ${message}`,
    };
  }
}

export async function removeLessonFromGoogleCalendar({
  lessonId,
  tutorId,
  supabaseAdmin = createAdminClient(),
}: {
  lessonId: string;
  tutorId: string;
  supabaseAdmin?: SupabaseAdminClient;
}): Promise<CalendarSyncResult> {
  if (!isGoogleCalendarSyncConfigured()) {
    return { status: "skipped" };
  }

  let mapping: GoogleCalendarEventRow | null = null;

  try {
    const connection = await getGoogleCalendarConnection(
      tutorId,
      supabaseAdmin,
    );

    if (!connection) {
      return { status: "skipped" };
    }

    mapping = await getLessonGoogleCalendarEvent(
      lessonId,
      tutorId,
      supabaseAdmin,
    );

    if (!mapping) {
      return { status: "skipped" };
    }

    const { accessToken } = await getValidGoogleCalendarAccessToken(
      connection,
      supabaseAdmin,
    );
    const deleteResponse = await fetch(
      `${GOOGLE_CALENDAR_API_BASE_URL}/calendars/${encodeURIComponent(mapping.google_calendar_id)}/events/${encodeURIComponent(mapping.google_event_id)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      throw new Error(await readGoogleResponseError(deleteResponse));
    }

    await supabaseAdmin
      .from("lesson_google_calendar_events")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("user_id", tutorId);

    await clearGoogleCalendarSyncError(
      tutorId,
      supabaseAdmin,
      new Date().toISOString(),
    );

    return { status: "synced" };
  } catch (error) {
    const message = toErrorMessage(error);
    const nowIso = new Date().toISOString();

    await setGoogleCalendarSyncError(tutorId, message, supabaseAdmin, nowIso);
    await supabaseAdmin
      .from("lesson_google_calendar_events")
      .update({ last_error: message, updated_at: nowIso })
      .eq("lesson_id", lessonId)
      .eq("user_id", tutorId);

    return {
      status: "failed",
      message: `Lesson deleted, but Google Calendar cleanup failed. ${message}`,
    };
  }
}

async function fetchGoogleUserEmail(accessToken: string) {
  const response = await fetch(GOOGLE_CALENDAR_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response
    .json()
    .catch(() => null)) as GoogleCalendarUserInfo | null;

  return typeof payload?.email === "string" ? payload.email : null;
}

async function refreshGoogleCalendarAccessToken(
  connection: GoogleCalendarConnectionRow,
  supabaseAdmin: SupabaseAdminClient,
) {
  const response = await fetch(GOOGLE_CALENDAR_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(await readGoogleResponseError(response));
  }

  const payload = (await response.json()) as GoogleCalendarTokenResponse;

  if (!payload.access_token) {
    throw new Error("Google did not return a refreshed access token.");
  }

  const updates = {
    access_token: payload.access_token,
    access_token_expires_at: getAccessTokenExpiresAtIso(payload.expires_in),
    scope: payload.scope ?? connection.scope,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("google_calendar_connections")
    .update(updates)
    .eq("user_id", connection.user_id);

  if (error) {
    throw error;
  }

  return {
    ...connection,
    ...updates,
  } satisfies GoogleCalendarConnectionRow;
}

async function getValidGoogleCalendarAccessToken(
  connection: GoogleCalendarConnectionRow,
  supabaseAdmin: SupabaseAdminClient,
) {
  if (connection.access_token_expires_at) {
    const expiry = new Date(connection.access_token_expires_at).getTime();

    if (Number.isFinite(expiry) && expiry > Date.now() + 60_000) {
      return { accessToken: connection.access_token };
    }
  }

  const refreshed = await refreshGoogleCalendarAccessToken(
    connection,
    supabaseAdmin,
  );

  return { accessToken: refreshed.access_token };
}

async function loadLessonForGoogleCalendarSync(
  lessonId: string,
  tutorId: string,
  supabaseAdmin: SupabaseAdminClient,
) {
  const { data, error } = await supabaseAdmin
    .from("tutor_student_lessons")
    .select(
      "id, tutor_id, student_id, title, lesson_date, start_time, end_time, notes, status, tutor_profile:profiles!tutor_student_lessons_tutor_id_fkey(full_name, email), student_profile:profiles!tutor_student_lessons_student_id_fkey(full_name, email)",
    )
    .eq("id", lessonId)
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as LessonGoogleCalendarSyncRow | null;
}

async function getLessonGoogleCalendarEvent(
  lessonId: string,
  tutorId: string,
  supabaseAdmin: SupabaseAdminClient,
) {
  const { data, error } = await supabaseAdmin
    .from("lesson_google_calendar_events")
    .select(
      "lesson_id, user_id, google_calendar_id, google_event_id, synced_at, last_error, created_at, updated_at",
    )
    .eq("lesson_id", lessonId)
    .eq("user_id", tutorId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as GoogleCalendarEventRow | null;
}

async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API_BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(await readGoogleResponseError(response));
  }

  const event = (await response.json()) as GoogleCalendarEventResponse;

  if (!event.id) {
    throw new Error("Google Calendar did not return an event id.");
  }

  return event.id;
}

function buildGoogleCalendarEventPayload(lesson: LessonGoogleCalendarSyncRow) {
  const tutorName =
    lesson.tutor_profile?.full_name || lesson.tutor_profile?.email || "Tutor";
  const studentName =
    lesson.student_profile?.full_name ||
    lesson.student_profile?.email ||
    "One-time";
  const descriptionLines = [
    `Tutor: ${tutorName}`,
    lesson.student_id
      ? `Student: ${studentName}`
      : `Lesson type: ${studentName}`,
    `Status: ${getLessonStatusLabel(lesson.status)}`,
  ];

  const privateProperties: Record<string, string> = {
    vocabCrafterLessonId: lesson.id,
    vocabCrafterTutorId: lesson.tutor_id,
  };

  if (lesson.student_id) {
    privateProperties.vocabCrafterStudentId = lesson.student_id;
  }

  if (lesson.notes) {
    descriptionLines.push(`Notes: ${lesson.notes}`);
  }

  descriptionLines.push("Managed in Vocab Crafter.");

  return {
    summary: lesson.title?.trim()
      ? `${getLessonDisplayTitle(lesson.title)} · ${studentName}`
      : lesson.student_id
        ? `Lesson with ${studentName}`
        : "One-time lesson",
    description: descriptionLines.join("\n\n"),
    status: lesson.status === "cancelled" ? "cancelled" : "confirmed",
    extendedProperties: {
      private: privateProperties,
    },
    ...buildGoogleCalendarEventTiming(lesson),
  };
}

function buildGoogleCalendarEventTiming(lesson: LessonGoogleCalendarSyncRow) {
  if (lesson.start_time) {
    const endTime =
      lesson.end_time || getSuggestedLessonEndTime(lesson.start_time);

    if (endTime) {
      return {
        start: {
          dateTime: `${lesson.lesson_date}T${lesson.start_time}:00`,
          timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE ?? "UTC",
        },
        end: {
          dateTime: `${lesson.lesson_date}T${endTime}:00`,
          timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE ?? "UTC",
        },
      };
    }
  }

  return {
    start: {
      date: lesson.lesson_date,
    },
    end: {
      date: addOneDay(lesson.lesson_date),
    },
  };
}

function addOneDay(isoDate: string) {
  const nextDate = new Date(`${isoDate}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);

  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, "0");
  const day = String(nextDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getAccessTokenExpiresAtIso(expiresIn?: number) {
  if (!Number.isFinite(expiresIn)) {
    return null;
  }

  const safeExpiresIn = Math.max((expiresIn ?? 0) - 60, 0);
  return new Date(Date.now() + safeExpiresIn * 1000).toISOString();
}

async function clearGoogleCalendarSyncError(
  userId: string,
  supabaseAdmin: SupabaseAdminClient,
  syncedAt: string,
) {
  await supabaseAdmin
    .from("google_calendar_connections")
    .update({
      last_sync_error: null,
      last_synced_at: syncedAt,
      updated_at: syncedAt,
    })
    .eq("user_id", userId);
}

async function setGoogleCalendarSyncError(
  userId: string,
  message: string,
  supabaseAdmin: SupabaseAdminClient,
  updatedAt: string,
) {
  await supabaseAdmin
    .from("google_calendar_connections")
    .update({
      last_sync_error: message,
      updated_at: updatedAt,
    })
    .eq("user_id", userId);
}

async function readGoogleResponseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string } | string;
  } | null;

  if (typeof payload?.error === "string") {
    return payload.error;
  }

  if (payload?.error && typeof payload.error === "object") {
    if (typeof payload.error.message === "string") {
      return payload.error.message;
    }
  }

  return `Google Calendar request failed with status ${response.status}.`;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unexpected Google Calendar error.";
}
