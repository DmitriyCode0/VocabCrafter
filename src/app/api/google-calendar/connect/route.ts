import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  buildGoogleCalendarAuthorizationUrl,
  getAuthenticatedTutorContext,
  isGoogleCalendarSyncConfigured,
  sanitizeNextPath,
} from "@/lib/google-calendar";

const GOOGLE_CALENDAR_STATE_COOKIE = "google-calendar-oauth-state";
const GOOGLE_CALENDAR_NEXT_COOKIE = "google-calendar-oauth-next";

export async function GET(request: NextRequest) {
  const tutorContext = await getAuthenticatedTutorContext();
  const { origin, searchParams } = new URL(request.url);
  const nextPath = sanitizeNextPath(searchParams.get("next"));

  if (!tutorContext) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (!isGoogleCalendarSyncConfigured()) {
    return NextResponse.redirect(`${origin}${nextPath}`);
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();

  cookieStore.set(GOOGLE_CALENDAR_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });
  cookieStore.set(GOOGLE_CALENDAR_NEXT_COOKIE, nextPath, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  return NextResponse.redirect(
    buildGoogleCalendarAuthorizationUrl({ origin, state }),
  );
}