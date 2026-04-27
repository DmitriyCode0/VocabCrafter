import { redirect } from "next/navigation";

import { BillingPageHeader } from "@/components/billing/billing-page-header";
import { PlansPageContent } from "@/components/plans/plans-page-content";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import { listPlans } from "@/lib/plans-server";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/roles";

export const dynamic = "force-dynamic";

export default async function BillingPlansPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, plan, app_language")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const plans = await listPlans();
  const appLanguage = normalizeAppLanguage(profile.app_language);
  const messages = getAppMessages(appLanguage);

  return (
    <div className="space-y-8">
      <BillingPageHeader
        currentSection="plans"
        title={messages.billing.title}
        description={messages.plans.description}
      />

      <PlansPageContent
        currentPlanKey={profile.plan}
        plans={plans}
        role={profile.role as Role}
        showHeader={false}
      />
    </div>
  );
}