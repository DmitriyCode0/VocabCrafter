import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import type { Role } from "@/types/roles";
import { ClassDetailClient } from "@/components/classes/class-detail-client";

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

  // Use admin client to bypass profiles RLS (tutor already verified above)
  const supabaseAdmin = createAdminClient();
  const { data: members, error: membersError } = await supabaseAdmin
    .from("class_members")
    .select("*, profiles(id, full_name, email, avatar_url, cefr_level)")
    .eq("class_id", id);

  if (membersError) console.error("Failed to load members:", membersError);

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from("assignments")
    .select("*, quizzes(title, type)")
    .eq("class_id", id)
    .order("created_at", { ascending: false });

  if (assignmentsError)
    console.error("Failed to load assignments:", assignmentsError);

  // If tutor, get their quizzes for assignment creation
  let quizzes: Record<string, unknown>[] = [];
  let wordMastery: Record<string, unknown>[] = [];
  if (role === "tutor" || role === "superadmin") {
    const { data } = await supabase
      .from("quizzes")
      .select("id, title, type, cefr_level")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });
    quizzes = (data || []) as unknown as Record<string, unknown>[];

    // Fetch word mastery for all students in the class
    const studentIds = (members ?? []).map(
      (m: Record<string, unknown>) => m.student_id as string,
    );
    if (studentIds.length > 0) {
      const { data: masteryData } = await supabaseAdmin
        .from("word_mastery")
        .select(
          "student_id, term, definition, mastery_level, correct_count, incorrect_count, streak",
        )
        .in("student_id", studentIds);
      wordMastery = (masteryData ?? []) as unknown as Record<
        string,
        unknown
      >[];
    }
  }

  return (
    <ClassDetailClient
      classData={classData as unknown as Record<string, unknown>}
      members={(members || []) as unknown as Record<string, unknown>[]}
      assignments={(assignments || []) as unknown as Record<string, unknown>[]}
      quizzes={quizzes}
      wordMastery={wordMastery}
      role={role}
      userId={user.id}
    />
  );
}
