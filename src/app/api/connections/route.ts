import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { randomBytes } from "crypto";

const connectSchema = z.object({
  connectCode: z.string().min(1),
});

// GET — list connections with profile info
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

    const supabaseAdmin = createAdminClient();

    if (profile.role === "tutor" || profile.role === "superadmin") {
      // Tutor: list students connected to them
      const { data: connections, error } = await supabaseAdmin
        .from("tutor_students")
        .select(
          "id, student_id, connect_code, status, created_at, connected_at, profiles!tutor_students_student_id_fkey(id, full_name, email, avatar_url, cefr_level)",
        )
        .eq("tutor_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch connections error:", error);
        return NextResponse.json(
          { error: "Failed to fetch connections" },
          { status: 500 },
        );
      }

      return NextResponse.json({ connections });
    }

    // Student: list tutors connected to them
    const { data: connections, error } = await supabaseAdmin
      .from("tutor_students")
      .select(
        "id, tutor_id, status, created_at, connected_at, profiles!tutor_students_tutor_id_fkey(id, full_name, email, avatar_url)",
      )
      .eq("student_id", user.id)
      .eq("status", "active")
      .order("connected_at", { ascending: false });

    if (error) {
      console.error("Fetch connections error:", error);
      return NextResponse.json(
        { error: "Failed to fetch connections" },
        { status: 500 },
      );
    }

    return NextResponse.json({ connections });
  } catch (error) {
    console.error("Connections GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST — tutor generates code OR student connects with code
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

    // Student connecting with a code
    if (body.connectCode !== undefined) {
      const parsed = connectSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid connect code" },
          { status: 400 },
        );
      }

      const code = parsed.data.connectCode.trim().toUpperCase();

      const supabaseAdmin = createAdminClient();

      // Find the pending connection with this code
      const { data: connection, error: findError } = await supabaseAdmin
        .from("tutor_students")
        .select("*")
        .eq("connect_code", code)
        .eq("status", "pending")
        .single();

      if (findError || !connection) {
        return NextResponse.json(
          { error: "Invalid or expired connect code" },
          { status: 404 },
        );
      }

      // Can't connect to yourself
      if (connection.tutor_id === user.id) {
        return NextResponse.json(
          { error: "You cannot connect to yourself" },
          { status: 400 },
        );
      }

      // Check if already connected to this tutor
      const { data: existing } = await supabaseAdmin
        .from("tutor_students")
        .select("id")
        .eq("tutor_id", connection.tutor_id)
        .eq("student_id", user.id)
        .eq("status", "active")
        .single();

      if (existing) {
        return NextResponse.json(
          { error: "You are already connected to this tutor" },
          { status: 409 },
        );
      }

      // Activate the connection
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("tutor_students")
        .update({
          student_id: user.id,
          status: "active",
          connected_at: new Date().toISOString(),
          connect_code: null, // Clear the code after use
        })
        .eq("id", connection.id)
        .select(
          "*, profiles!tutor_students_tutor_id_fkey(full_name, email)",
        )
        .single();

      if (updateError) {
        console.error("Activate connection error:", updateError);
        return NextResponse.json(
          { error: "Failed to activate connection" },
          { status: 500 },
        );
      }

      return NextResponse.json({ connection: updated });
    }

    // Tutor generating a connect code
    if (profile.role !== "tutor" && profile.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const connectCode = randomBytes(4).toString("hex").toUpperCase();

    // Create a pending connection row (student_id is the tutor themselves temporarily)
    // We'll update student_id when a student activates
    const { data: newConnection, error: insertError } = await supabase
      .from("tutor_students")
      .insert({
        tutor_id: user.id,
        student_id: user.id, // placeholder until student connects
        connect_code: connectCode,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Create connection error:", insertError);
      return NextResponse.json(
        { error: "Failed to generate connect code" },
        { status: 500 },
      );
    }

    return NextResponse.json({ connection: newConnection, connectCode });
  } catch (error) {
    console.error("Connections POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE — remove a connection
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get("id");

    if (!connectionId) {
      return NextResponse.json(
        { error: "Connection ID required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("tutor_students")
      .delete()
      .eq("id", connectionId);

    if (error) {
      console.error("Delete connection error:", error);
      return NextResponse.json(
        { error: "Failed to delete connection" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Connections DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
