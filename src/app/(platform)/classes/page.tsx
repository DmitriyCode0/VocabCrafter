import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Role } from "@/types/roles";
import { ClassesClient } from "@/components/classes/classes-client";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
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

  if (role === "tutor" || role === "superadmin") {
    const { data: classes } = await supabase
      .from("classes")
      .select("*, class_members(id)")
      .eq("tutor_id", user.id)
      .order("created_at", { ascending: false });

    const formatted = (classes || []).map((c) => ({
      ...c,
      student_count: Array.isArray(c.class_members)
        ? c.class_members.length
        : 0,
      class_members: undefined,
    }));

    return <ClassesClient role={role} classes={formatted} />;
  }

  // Student: get joined classes
  const { data: memberships } = await supabase
    .from("class_members")
    .select("classes(*)")
    .eq("student_id", user.id)
    .order("joined_at", { ascending: false });

  const classes = (memberships || []).map((m) => m.classes).filter(Boolean);

  return (
    <ClassesClient role={role} classes={classes as Record<string, unknown>[]} />
  );
}
