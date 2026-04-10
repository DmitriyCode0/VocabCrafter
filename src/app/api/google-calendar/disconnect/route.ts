import { NextResponse } from "next/server";
import {
  disconnectGoogleCalendarConnection,
  getAuthenticatedTutorContext,
} from "@/lib/google-calendar";

export async function POST() {
  const tutorContext = await getAuthenticatedTutorContext();

  if (!tutorContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await disconnectGoogleCalendarConnection(
      tutorContext.userId,
      tutorContext.supabaseAdmin,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Google Calendar disconnect error:", error);

    return NextResponse.json(
      { error: "Failed to disconnect Google Calendar" },
      { status: 500 },
    );
  }
}