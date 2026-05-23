import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";

export const dynamic = "force-dynamic";

export default async function TutorStudentProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const supabaseAdmin = createAdminClient();
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    (profile.role !== "tutor" && profile.role !== "superadmin")
  ) {
    redirect("/dashboard");
  }

  if (profile.role !== "superadmin") {
    const hasAccess = await tutorHasStudentAccess(
      supabaseAdmin,
      user.id,
      studentId,
    );

    if (!hasAccess) {
      redirect("/students");
    }
  }

  redirect(`/students/${studentId}/plan`);
}
