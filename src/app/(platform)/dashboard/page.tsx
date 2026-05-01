import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  normalizeAppLanguage,
} from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import type { Role } from "@/types/roles";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { TutorDashboard } from "@/components/dashboard/tutor-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { Suspense } from "react";
import { DashboardSkeleton, AdminDashboardSkeleton } from "@/components/dashboard/skeletons";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role as Role;
  const appLanguage = normalizeAppLanguage(profile.app_language);
  const messages = getAppMessages(appLanguage);
  const displayName = profile.full_name || profile.email;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.dashboard.welcomeBack(displayName)}
        </h1>
        <p className="text-muted-foreground">
          {role === "student" && messages.dashboard.roleDescriptions.student}
          {role === "tutor" && messages.dashboard.roleDescriptions.tutor}
          {role === "superadmin" &&
            messages.dashboard.roleDescriptions.superadmin}
        </p>
      </div>

      {role === "student" && (
        <Suspense fallback={<DashboardSkeleton />}>
          <StudentDashboard
            userId={user.id}
            planKey={profile.plan}
            messages={messages}
          />
        </Suspense>
      )}
      {role === "tutor" && (
        <Suspense fallback={<DashboardSkeleton />}>
          <TutorDashboard
            userId={user.id}
            planKey={profile.plan}
            messages={messages}
          />
        </Suspense>
      )}
      {role === "superadmin" && (
        <Suspense fallback={<AdminDashboardSkeleton />}>
          <AdminDashboard appLanguage={appLanguage} messages={messages} />
        </Suspense>
      )}
    </div>
  );
}
