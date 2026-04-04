import { redirect } from "next/navigation";

import { PlansPageContent } from "@/components/plans/plans-page-content";
import { listPlans } from "@/lib/plans-server";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/roles";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, plan")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const plans = await listPlans();

  return (
    <PlansPageContent
      currentPlanKey={profile.plan}
      plans={plans}
      role={profile.role as Role}
    />
  );
}