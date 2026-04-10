import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { StudentsClient } from "@/components/students/students-client";

export const dynamic = "force-dynamic";

interface StudentsPageSearchParams {
  intent?: string;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<StudentsPageSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "tutor" && profile.role !== "superadmin")) {
    redirect("/dashboard");
  }

  const supabaseAdmin = createAdminClient();

  // Get all connections (both pending and active)
  const { data: connections } = await supabaseAdmin
    .from("tutor_students")
    .select(
      "id, student_id, connect_code, status, created_at, connected_at, profiles!tutor_students_student_id_fkey(id, full_name, email, avatar_url, cefr_level)",
    )
    .eq("tutor_id", user.id)
    .order("created_at", { ascending: false });

  // Get recent attempts for active students
  const activeStudentIds = (connections ?? [])
    .filter((c) => c.status === "active" && c.student_id !== user.id)
    .map((c) => c.student_id);

  let recentAttempts: Record<string, unknown>[] = [];
  if (activeStudentIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("quiz_attempts")
      .select(
        "id, student_id, score, max_score, completed_at, quizzes(title, type, cefr_level)",
      )
      .in("student_id", activeStudentIds)
      .order("completed_at", { ascending: false })
      .limit(20);

    recentAttempts = (data ?? []) as Record<string, unknown>[];
  }

  return (
    <StudentsClient
      connections={(connections ?? []) as Record<string, unknown>[]}
      recentAttempts={recentAttempts}
      tutorId={user.id}
      intent={resolvedSearchParams.intent}
    />
  );
}
