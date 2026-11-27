import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StudentPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ tutor?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = new URLSearchParams({ tab: "plan" });
  if (resolvedSearchParams.tutor) {
    params.set("tutor", resolvedSearchParams.tutor);
  }
  redirect(`/progress?${params.toString()}`);
}
