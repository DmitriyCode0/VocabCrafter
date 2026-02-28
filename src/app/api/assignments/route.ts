import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createAssignmentSchema = z.object({
  classId: z.string().uuid(),
  quizId: z.string().uuid(),
  title: z.string().min(1).max(200),
  instructions: z.string().max(500).optional(),
  dueDate: z.string().optional(),
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

    if (
      !profile ||
      (profile.role !== "tutor" && profile.role !== "superadmin")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { classId, quizId, title, instructions, dueDate } = parsed.data;

    // Verify class belongs to tutor
    const { data: classData } = await supabase
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("tutor_id", user.id)
      .single();

    if (!classData) {
      return NextResponse.json(
        { error: "Class not found or not yours" },
        { status: 404 },
      );
    }

    const { data: assignment, error: insertError } = await supabase
      .from("assignments")
      .insert({
        class_id: classId,
        tutor_id: user.id,
        quiz_id: quizId,
        title,
        instructions: instructions ?? null,
        due_date: dueDate ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Assignment insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create assignment" },
        { status: 500 },
      );
    }

    return NextResponse.json({ assignment });
  } catch (error) {
    console.error("Create assignment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
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
      const { data: assignments, error } = await supabase
        .from("assignments")
        .select("*, classes(name), quizzes(title, type)")
        .eq("tutor_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch assignments" },
          { status: 500 },
        );
      }

      return NextResponse.json({ assignments: assignments || [] });
    }

    // Student: get assignments for classes they belong to
    const { data: memberships } = await supabase
      .from("class_members")
      .select("class_id")
      .eq("student_id", user.id);

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ assignments: [] });
    }

    const classIds = memberships.map((m) => m.class_id);

    const { data: assignments, error } = await supabase
      .from("assignments")
      .select("*, classes(name), quizzes(title, type, id)")
      .in("class_id", classIds)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch assignments" },
        { status: 500 },
      );
    }

    return NextResponse.json({ assignments: assignments || [] });
  } catch (error) {
    console.error("Fetch assignments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
