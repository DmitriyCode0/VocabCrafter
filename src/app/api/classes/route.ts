import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { randomBytes } from "crypto";

const createClassSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  cefrLevel: z.string().default("B1"),
});

const joinClassSchema = z.object({
  joinCode: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json();

    // Student joining by code
    if (body.joinCode !== undefined) {
      const parsed = joinClassSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid join code" },
          { status: 400 },
        );
      }

      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("*")
        .eq("join_code", parsed.data.joinCode)
        .eq("is_active", true)
        .single();

      if (classError || !classData) {
        return NextResponse.json(
          { error: "Class not found or inactive" },
          { status: 404 },
        );
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from("class_members")
        .select("id")
        .eq("class_id", classData.id)
        .eq("student_id", user.id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: "You are already a member of this class" },
          { status: 409 },
        );
      }

      const { error: joinError } = await supabase.from("class_members").insert({
        class_id: classData.id,
        student_id: user.id,
      });

      if (joinError) {
        console.error("Join class error:", joinError);
        return NextResponse.json(
          { error: "Failed to join class" },
          { status: 500 },
        );
      }

      return NextResponse.json({ class: classData });
    }

    // Tutor creating a class
    if (profile.role !== "tutor" && profile.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = createClassSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const joinCode = randomBytes(4).toString("hex").toUpperCase();

    const { data: newClass, error: insertError } = await supabase
      .from("classes")
      .insert({
        tutor_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        join_code: joinCode,
        cefr_level: parsed.data.cefrLevel,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Class insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create class" },
        { status: 500 },
      );
    }

    return NextResponse.json({ class: newClass });
  } catch (error) {
    console.error("Classes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.role === "tutor" || profile.role === "superadmin") {
      // Tutor sees their own classes
      const { data: classes, error } = await supabase
        .from("classes")
        .select("*, class_members(id)")
        .eq("tutor_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch classes" },
          { status: 500 },
        );
      }

      const formatted = (classes || []).map((c) => ({
        ...c,
        student_count: Array.isArray(c.class_members)
          ? c.class_members.length
          : 0,
        class_members: undefined,
      }));

      return NextResponse.json({ classes: formatted });
    }

    // Student sees classes they've joined
    const { data: memberships, error } = await supabase
      .from("class_members")
      .select("classes(*)")
      .eq("student_id", user.id)
      .order("joined_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch classes" },
        { status: 500 },
      );
    }

    const classes = (memberships || []).map((m) => m.classes).filter(Boolean);

    return NextResponse.json({ classes });
  } catch (error) {
    console.error("Fetch classes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
