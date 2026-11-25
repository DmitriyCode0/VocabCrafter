import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Crown, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getPlanBadgeClassName,
  getPlanDisplayName,
  normalizePlanKey,
} from "@/lib/plans";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import type { Role } from "@/types/roles";
import { Suspense, type ReactNode } from "react";
import {
  DashboardSkeleton,
  AdminDashboardSkeleton,
} from "@/components/dashboard/skeletons";
import { StudentMobileGapFillLauncher } from "@/components/dashboard/student-mobile-gap-fill-launcher";
import { getGrammarTopicPromptCatalog } from "@/lib/grammar/prompt-overrides";
import {
  listStudentTutorPlans,
  type StudentTutorPlanCard,
} from "@/lib/progress/tutor-student-plan";
import { PendingApprovalCard } from "@/components/dashboard/pending-approval-card";
import { getAuthenticatedUser, isProfileApproved } from "@/lib/rbac/require-role";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) redirect("/login");

  const { user, profile } = authenticatedUser;
  const appLanguage = normalizeAppLanguage(profile.app_language);

  if (!isProfileApproved(profile)) {
    return <PendingApprovalCard profile={profile} appLanguage={appLanguage} />;
  }

  const role = profile.role as Role;
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

    const [
      { data: upcomingLessonRows },
      englishCatalog,
      studentPlans,
      grammarMasteryData,
    ] = await Promise.all([
      supabaseAdmin
        .from("tutor_student_lessons")
        .select(
          "id, title, lesson_date, start_time, end_time, meet_url, tutor_profile:profiles!tutor_student_lessons_tutor_id_fkey(full_name, email)",
        )
        .eq("student_id", user.id)
        .neq("status", "cancelled")
        .gte("lesson_date", todayIso)
        .order("lesson_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(1),
      getGrammarTopicPromptCatalog("english"),
      listStudentTutorPlans(user.id).catch((): StudentTutorPlanCard[] => []),
      supabaseAdmin
        .from("student_grammar_topic_mastery")
        .select("topic_key")
        .eq("student_id", user.id),
    ]);

    const planGrammarTopicKeys = Array.from(
      new Set(
        studentPlans.flatMap((plan) =>
          (plan.plan.grammarTopicKeys ?? []).filter(
            (k): k is string => typeof k === "string",
          ),
        ),
      ),
    );
    const masteredGrammarTopicKeys = (
      (grammarMasteryData.data ?? []) as Array<{ topic_key: string }>
    ).map((row) => row.topic_key);

    const grammarTopicCatalog = {
      english: englishCatalog.map(({ level, topics }) => ({
        level,
        topics: topics.map(
          ({ topicKey, displayName, hasUniqueInstructions }) => ({
            topicKey,
            displayName,
            hasUniqueInstructions,
          }),
        ),
      })),
    };

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
          userId={user.id}
          displayName={displayName}
          cefrLevel={profile.cefr_level}
          preferredLanguage={profile.preferred_language}
          sourceLanguage={profile.source_language}
          nextLesson={nextLesson}
          todayIso={todayIso}
          grammarTopicCatalog={grammarTopicCatalog}
          planGrammarTopicKeys={planGrammarTopicKeys}
          masteredGrammarTopicKeys={masteredGrammarTopicKeys}
        />

        {/* Desktop / PC Student View: Full Dashboard */}
        <div className="hidden space-y-6 md:block">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">
                {messages.dashboard.welcomeBack(displayName)}
              </h1>
              <Link href="/billing" prefetch={false}>
                <Badge
                  variant="outline"
                  className={`gap-1 text-xs font-semibold ${getPlanBadgeClassName(profile.plan)}`}
                >
                  {normalizePlanKey(profile.plan) === "premium" ? (
                    <Crown className="h-3 w-3 shrink-0" />
                  ) : null}
                  {getPlanDisplayName(profile.plan)}
                </Badge>
              </Link>
            </div>
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
      <div
        className={
          role === "tutor"
            ? "flex flex-col gap-4 border-b border-border/50 pb-4 lg:flex-row lg:items-center lg:justify-between"
            : undefined
        }
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">
              {messages.dashboard.welcomeBack(displayName)}
            </h1>
            <Link href="/billing" prefetch={false}>
              <Badge
                variant="outline"
                className={`gap-1 text-xs font-semibold ${getPlanBadgeClassName(profile.plan)}`}
              >
                {normalizePlanKey(profile.plan) === "premium" ? (
                  <Crown className="h-3 w-3 shrink-0" />
                ) : null}
                {getPlanDisplayName(profile.plan)}
              </Badge>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            {role === "tutor" && messages.dashboard.roleDescriptions.tutor}
            {role === "superadmin" &&
              messages.dashboard.roleDescriptions.superadmin}
          </p>
        </div>

        {role === "tutor" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/tense-detector" prefetch={false}>
                {messages.nav.tenseDetector}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/lessons" prefetch={false}>
                <CalendarDays className="mr-2 h-4 w-4" />
                {messages.dashboard.tutor.commandCenter.openScheduleButton}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/quizzes/new" prefetch={false}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {messages.dashboard.tutor.createQuizButton}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {dashboardContent}
    </div>
  );
}
