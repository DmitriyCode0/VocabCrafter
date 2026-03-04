import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { Role } from "@/types/roles";
import { HistoryClient } from "@/components/history/history-client";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student: studentFilter } = await searchParams;
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

  if (!profile) redirect("/login");

  const role = profile.role as Role;
  const supabaseAdmin = createAdminClient();

  if (role === "student") {
    // Student: show own attempts
    const { data: attempts } = await supabaseAdmin
      .from("quiz_attempts")
      .select(
        "*, quizzes(title, type, cefr_level, vocabulary_terms, config, generated_content)",
      )
      .eq("student_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(100);

    return (
      <HistoryClient
        role={role}
        attempts={(attempts ?? []) as Record<string, unknown>[]}
        students={[]}
        initialStudentFilter={studentFilter}
      />
    );
  }

  // Tutor / Superadmin: show connected students' attempts
  const { data: connections } = await supabaseAdmin
    .from("tutor_students")
    .select(
      "student_id, profiles!tutor_students_student_id_fkey(id, full_name, email, avatar_url, cefr_level)",
    )
    .eq("tutor_id", user.id)
    .eq("status", "active");

  const students = (connections ?? []).map((c) => c.profiles).filter(Boolean) as Record<string, unknown>[];
  const studentIds = (connections ?? []).map((c) => c.student_id);

  let attempts: Record<string, unknown>[] = [];

  if (studentIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("quiz_attempts")
      .select(
        "*, quizzes(title, type, cefr_level, vocabulary_terms, config, generated_content), profiles(full_name, email, avatar_url)",
      )
      .in("student_id", studentIds)
      .order("completed_at", { ascending: false })
      .limit(200);

    attempts = (data ?? []) as Record<string, unknown>[];
  }

  // Also include tutor's own attempts
  const { data: ownAttempts } = await supabaseAdmin
    .from("quiz_attempts")
    .select(
      "*, quizzes(title, type, cefr_level, vocabulary_terms, config, generated_content)",
    )
    .eq("student_id", user.id)
    .order("completed_at", { ascending: false })
    .limit(50);

  const allAttempts = [...(ownAttempts ?? []), ...attempts] as Record<string, unknown>[];
  // Sort by date descending
  allAttempts.sort(
    (a, b) =>
      new Date(b.completed_at as string).getTime() -
      new Date(a.completed_at as string).getTime(),
  );

  return (
    <HistoryClient
      role={role}
      attempts={allAttempts}
      students={students}
      userId={user.id}
      initialStudentFilter={studentFilter}
    />
  );
}
