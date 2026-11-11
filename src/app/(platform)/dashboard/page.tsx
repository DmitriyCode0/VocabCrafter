import { redirect } from "next/navigation";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import type { Role } from "@/types/roles";
import { Suspense, type ReactNode } from "react";
import {
  DashboardSkeleton,
  AdminDashboardSkeleton,
} from "@/components/dashboard/skeletons";
import { StudentMobileGapFillLauncher } from "@/components/dashboard/student-mobile-gap-fill-launcher";
import { getAuthenticatedUser } from "@/lib/rbac/require-role";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) redirect("/login");

  const { user, profile } = authenticatedUser;

  const role = profile.role as Role;
  const appLanguage = normalizeAppLanguage(profile.app_language);
  const messages = getAppMessages(appLanguage);
  const displayName = profile.full_name || profile.email;
  let dashboardContent: ReactNode = null;

  if (role === "student") {
    const { StudentDashboard } = await import(
      "@/components/dashboard/student-dashboard"
    );
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabaseAdmin = createAdminClient();

    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const { data: upcomingLessonRows } = await supabaseAdmin
      .from("tutor_student_lessons")
      .select(
        "id, title, lesson_date, start_time, end_time, meet_url, tutor_profile:profiles!tutor_student_lessons_tutor_id_fkey(full_name, email)",
      )
      .eq("student_id", user.id)
      .neq("status", "cancelled")
      .gte("lesson_date", todayIso)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(1);

    const rawNextLesson = upcomingLessonRows?.[0] as
      | {
          id: string;
          title: string | null;
          lesson_date: string;
          start_time: string | null;
          end_time: string | null;
          meet_url: string | null;
          tutor_profile: { full_name: string | null; email: string } | null;
        }
      | undefined;

    const nextLesson = rawNextLesson
      ? {
          id: rawNextLesson.id,
          title: rawNextLesson.title,
          lessonDate: rawNextLesson.lesson_date,
          startTime: rawNextLesson.start_time,
          endTime: rawNextLesson.end_time,
          meetUrl: rawNextLesson.meet_url,
          tutorName:
            rawNextLesson.tutor_profile?.full_name ||
            rawNextLesson.tutor_profile?.email ||
            "Tutor",
        }
      : null;

    return (
      <>
        {/* Mobile Student View: Focused Launcher + Next Lesson Google Meet banner */}
        <StudentMobileGapFillLauncher
          displayName={displayName}
          cefrLevel={profile.cefr_level}
          preferredLanguage={profile.preferred_language}
          sourceLanguage={profile.source_language}
          nextLesson={nextLesson}
          todayIso={todayIso}
        />

        {/* Desktop / PC Student View: Full Dashboard */}
        <div className="hidden space-y-6 md:block">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {messages.dashboard.welcomeBack(displayName)}
            </h1>
            <p className="text-muted-foreground">
              {messages.dashboard.roleDescriptions.student}
            </p>
          </div>

          <Suspense fallback={<DashboardSkeleton />}>
            <StudentDashboard
              userId={user.id}
              planKey={profile.plan}
              messages={messages}
            />
          </Suspense>
        </div>
      </>
    );
  } else if (role === "tutor") {
    const { TutorDashboard } = await import(
      "@/components/dashboard/tutor-dashboard"
    );

    dashboardContent = (
      <Suspense fallback={<DashboardSkeleton />}>
        <TutorDashboard
          userId={user.id}
          planKey={profile.plan}
          messages={messages}
        />
      </Suspense>
    );
  } else if (role === "superadmin") {
    const { AdminDashboard } = await import(
      "@/components/dashboard/admin-dashboard"
    );

    dashboardContent = (
      <Suspense fallback={<AdminDashboardSkeleton />}>
        <AdminDashboard appLanguage={appLanguage} messages={messages} />
      </Suspense>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.dashboard.welcomeBack(displayName)}
        </h1>
        <p className="text-muted-foreground">
          {role === "tutor" && messages.dashboard.roleDescriptions.tutor}
          {role === "superadmin" &&
            messages.dashboard.roleDescriptions.superadmin}
        </p>
      </div>

      {dashboardContent}
    </div>
  );
}
