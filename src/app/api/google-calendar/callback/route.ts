import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleCalendarCode,
  getAuthenticatedTutorContext,
  getGoogleCalendarConnection,
  isGoogleCalendarSyncConfigured,
  sanitizeNextPath,
  upsertGoogleCalendarConnection,
} from "@/lib/google-calendar";

const GOOGLE_CALENDAR_STATE_COOKIE = "google-calendar-oauth-state";
const GOOGLE_CALENDAR_NEXT_COOKIE = "google-calendar-oauth-next";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_CALENDAR_STATE_COOKIE)?.value;
  const nextPath = sanitizeNextPath(
    cookieStore.get(GOOGLE_CALENDAR_NEXT_COOKIE)?.value,
  );

  cookieStore.delete(GOOGLE_CALENDAR_STATE_COOKIE);
  cookieStore.delete(GOOGLE_CALENDAR_NEXT_COOKIE);

  if (!isGoogleCalendarSyncConfigured()) {
    return NextResponse.redirect(`${origin}${nextPath}`);
  }

  if (
    !code ||
    !returnedState ||
    !expectedState ||
    returnedState !== expectedState
  ) {
    return NextResponse.redirect(`${origin}${nextPath}`);
  }

  const tutorContext = await getAuthenticatedTutorContext();

  if (!tutorContext) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const existingConnection = await getGoogleCalendarConnection(
      tutorContext.userId,
      tutorContext.supabaseAdmin,
    );
    const exchanged = await exchangeGoogleCalendarCode({
      code,
      origin,
      existingRefreshToken: existingConnection?.refresh_token ?? null,
    });

    await upsertGoogleCalendarConnection(
      tutorContext.userId,
      exchanged,
      tutorContext.supabaseAdmin,
    );
  } catch (error) {
    console.error("Google Calendar connect error:", error);
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
