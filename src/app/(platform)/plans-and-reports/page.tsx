import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PlansAndReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; tutor?: string; month?: string }>;
}) {
  const resolved = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const params = new URLSearchParams({ tab: "plan" });
  if (resolved.month) {
    params.set("month", resolved.month);
  }

  if (profile.role === "student") {
    if (resolved.tutor) {
      params.set("tutor", resolved.tutor);
    }
    redirect(`/progress?${params.toString()}`);
  }

  if (profile.role === "tutor") {
    if (resolved.student) {
      params.set("student", resolved.student);
    }
    redirect(`/results?${params.toString()}`);
  }

  redirect("/dashboard");
}
