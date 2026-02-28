import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Student leaving a class
    if (body.action === "leave") {
      const { error } = await supabase
        .from("class_members")
        .delete()
        .eq("class_id", id)
        .eq("student_id", user.id);

      if (error) {
        return NextResponse.json(
          { error: "Failed to leave class" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    // Tutor removing a student
    if (body.action === "remove_student" && body.studentId) {
      // Verify tutor owns this class
      const { data: classData } = await supabase
        .from("classes")
        .select("tutor_id")
        .eq("id", id)
        .single();

      if (!classData || classData.tutor_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { error } = await supabase
        .from("class_members")
        .delete()
        .eq("class_id", id)
        .eq("student_id", body.studentId);

      if (error) {
        return NextResponse.json(
          { error: "Failed to remove student" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Class PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: classData, error } = await supabase
      .from("classes")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !classData) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Get members with profiles
    const { data: members } = await supabase
      .from("class_members")
      .select("*, profiles(id, full_name, email, avatar_url, cefr_level)")
      .eq("class_id", id);

    // Get assignments for this class
    const { data: assignments } = await supabase
      .from("assignments")
      .select("*, quizzes(title, type)")
      .eq("class_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      class: classData,
      members: members || [],
      assignments: assignments || [],
    });
  } catch (error) {
    console.error("Get class error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Remove members first
    await supabase.from("class_members").delete().eq("class_id", id);
    // Remove assignments
    await supabase.from("assignments").delete().eq("class_id", id);

    const { error } = await supabase
      .from("classes")
      .delete()
      .eq("id", id)
      .eq("tutor_id", user.id);

    if (error) {
      console.error("Class delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete class" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete class error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
