import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { TutorsClient } from "@/components/tutors/tutors-client";

export const dynamic = "force-dynamic";

export default async function TutorsPage() {
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

  // Both students and tutors can see their connected tutors
  const supabaseAdmin = createAdminClient();

  const { data: connections } = await supabaseAdmin
    .from("tutor_students")
    .select(
      "id, tutor_id, status, created_at, connected_at, profiles!tutor_students_tutor_id_fkey(id, full_name, email, avatar_url)",
    )
    .eq("student_id", user.id)
    .eq("status", "active")
    .order("connected_at", { ascending: false });

  return (
    <TutorsClient
      connections={(connections ?? []) as Record<string, unknown>[]}
    />
  );
}
