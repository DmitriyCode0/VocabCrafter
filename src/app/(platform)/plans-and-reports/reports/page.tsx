import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PlansAndReportsReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; month?: string }>;
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

  const params = new URLSearchParams({ tab: "reports" });
  if (resolved.month) {
    params.set("month", resolved.month);
  }

  if (profile.role === "student") {
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
