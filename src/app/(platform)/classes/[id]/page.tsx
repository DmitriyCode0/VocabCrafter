import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import type { Role } from "@/types/roles";
import { ClassDetailClient } from "@/components/classes/class-detail-client";
import { fetchConnectedStudents } from "@/lib/history/fetch-history-page-data";
import {
  getBatchStudentThreeStateVocabularySummaries,
  type StudentThreeStateVocabularySummary,
} from "@/lib/progress/profile-metrics";

export const dynamic = "force-dynamic";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: classData, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !classData) notFound();

  const supabaseAdmin = createAdminClient();
  const [
    { data: rawMembers, error: membersError },
    { data: archivedConnections },
    { data: assignments, error: assignmentsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("class_members")
      .select("*, profiles(id, full_name, email, avatar_url, cefr_level)")
      .eq("class_id", id),
    supabaseAdmin
      .from("tutor_students")
      .select("student_id")
      .eq("tutor_id", classData.tutor_id)
      .not("archived_at", "is", null),
    supabaseAdmin
      .from("assignments")
      .select("*, quizzes(id, title, type, cefr_level, vocabulary_terms)")
      .eq("class_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (membersError) console.error("Failed to load members:", membersError);
  if (assignmentsError)
    console.error("Failed to load assignments:", assignmentsError);

  const archivedStudentIds = new Set(
    (archivedConnections ?? []).map((c) => c.student_id),
  );
  const members = (rawMembers ?? []).filter(
    (m) => !archivedStudentIds.has(m.student_id),
  );

  let quizzes: Record<string, unknown>[] = [];
  let availableTutorStudents: Array<{
    id: string;
    name: string;
    cefr_level: string | null;
  }> = [];
  let threeStateSummaries: Record<string, StudentThreeStateVocabularySummary> =
    {};

  if (role === "tutor" || role === "superadmin") {
    const memberIds = new Set(members.map((m) => m.student_id as string));

    const [quizzesResult, connectedStudents, summaryMap] = await Promise.all([
      supabase
        .from("quizzes")
        .select("id, title, type, cefr_level, vocabulary_terms")
        .eq("creator_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      fetchConnectedStudents(user.id),
      getBatchStudentThreeStateVocabularySummaries(
        members.map((m) => {
          const p = m.profiles as Record<string, unknown> | null;
          return {
            id: m.student_id as string,
            cefr_level: (p?.cefr_level as string) || null,
          };
        }),
      ),
    ]);

    quizzes = (quizzesResult.data || []) as unknown as Record<
      string,
      unknown
    >[];
    availableTutorStudents = connectedStudents
      .filter((s) => !memberIds.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.full_name || s.email || "Student",
        cefr_level: s.cefr_level,
      }));
    threeStateSummaries = Object.fromEntries(summaryMap.entries());
  }

  return (
    <ClassDetailClient
      classData={classData as unknown as Record<string, unknown>}
      members={members as unknown as Record<string, unknown>[]}
      assignments={(assignments || []) as unknown as Record<string, unknown>[]}
      quizzes={quizzes}
      availableTutorStudents={availableTutorStudents}
      threeStateSummaries={threeStateSummaries}
      role={role}
      userId={user.id}
    />
  );
}
