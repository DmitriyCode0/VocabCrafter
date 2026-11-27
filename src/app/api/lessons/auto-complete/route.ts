import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCompleteOverduePlannedLessons } from "@/lib/lessons-server";

const requestSchema = z
  .object({
    timeZone: z.string().trim().max(100).optional(),
  })
  .optional();

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => undefined);
  const parsed = requestSchema.safeParse(rawBody);
  const timeZone = parsed.success ? parsed.data?.timeZone : undefined;

  const supabaseAdmin = createAdminClient();
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const completedIds = await autoCompleteOverduePlannedLessons({
      ...(profile.role === "student"
        ? { studentId: user.id }
        : { tutorId: user.id }),
      timeZone,
      supabaseAdmin,
    });

    return NextResponse.json({ completedIds });
  } catch (error) {
    console.error("Auto-complete lessons error:", error);
    return NextResponse.json(
      { error: "Failed to update completed lessons" },
      { status: 500 },
    );
  }
}
