import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const feedbackSchema = z.object({
  attemptId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  rating: z.number().int().min(1).max(5).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify user is a tutor or superadmin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "tutor" && profile.role !== "superadmin"))
      return NextResponse.json({ error: "Only tutors can submit feedback" }, { status: 403 });

    const body = await req.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );

    const { attemptId, content, rating } = parsed.data;

    const { data, error } = await supabase
      .from("feedback")
      .insert({
        attempt_id: attemptId,
        tutor_id: user.id,
        content,
        rating: rating ?? null,
      })
      .select()
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const attemptId = req.nextUrl.searchParams.get("attemptId");

    let query = supabase
      .from("feedback")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false });

    if (attemptId) {
      query = query.eq("attempt_id", attemptId);
    } else {
      query = query.eq("tutor_id", user.id);
    }

    const { data, error } = await query;

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
