import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CalendarDays, Crown, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getPlanBadgeClassName,
  getPlanDisplayName,
  normalizePlanKey,
} from "@/lib/plans";
import { getLessonsLeft } from "@/lib/lessons";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import type { Role } from "@/types/roles";
import { Suspense, type ReactNode } from "react";
import {
  DashboardSkeleton,
  AdminDashboardSkeleton,
  StudentDashboardSkeleton,
} from "@/components/dashboard/skeletons";
import type { StudentLessonBalanceItem } from "@/components/dashboard/student-google-meet-banner";
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
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    );
    const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    const [
      { data: upcomingLessonRows },
      { data: tutorConnectionRows },
      { data: balanceTransactionRows },
      { data: completedLessonRows },
      englishCatalog,
      studentPlans,
      grammarMasteryData,
    ] = await Promise.all([
      supabaseAdmin
        .from("tutor_student_lessons")
        .select(
          "id, tutor_id, title, lesson_date, start_time, end_time, time_zone, start_at, end_at, status, meet_url, tutor_profile:profiles!tutor_student_lessons_tutor_id_fkey(full_name, email)",
        )
        .eq("student_id", user.id)
        .eq("status", "planned")
        .gte("lesson_date", yesterdayIso)
        .order("lesson_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(8),
      supabaseAdmin
        .from("tutor_students")
        .select(
          "tutor_id, lesson_price_cents, tutor_profile:profiles!tutor_students_tutor_id_fkey(full_name, email)",
        )
        .eq("student_id", user.id)
        .eq("status", "active"),
      supabaseAdmin
        .from("tutor_student_balance_transactions")
        .select("tutor_id, amount_cents")
        .eq("student_id", user.id),
      supabaseAdmin
        .from("tutor_student_lessons")
        .select("tutor_id, price_cents")
        .eq("student_id", user.id)
        .eq("status", "completed"),
      getGrammarTopicPromptCatalog("english"),
      listStudentTutorPlans(user.id).catch((): StudentTutorPlanCard[] => []),
      supabaseAdmin
        .from("student_grammar_topic_mastery")
        .select("topic_key")
        .eq("student_id", user.id),
    ]);

    const paidByTutor = new Map<string, number>();
    for (const tx of (balanceTransactionRows ?? []) as Array<{
      tutor_id: string;
      amount_cents: number;
    }>) {
      paidByTutor.set(
        tx.tutor_id,
        (paidByTutor.get(tx.tutor_id) ?? 0) + tx.amount_cents,
      );
    }

    const spentByTutor = new Map<string, number>();
    for (const completed of (completedLessonRows ?? []) as Array<{
      tutor_id: string;
      price_cents: number;
    }>) {
      spentByTutor.set(
        completed.tutor_id,
        (spentByTutor.get(completed.tutor_id) ?? 0) + completed.price_cents,
      );
    }

    const lessonBalances: StudentLessonBalanceItem[] = (
      (tutorConnectionRows ?? []) as Array<{
        tutor_id: string;
        lesson_price_cents: number;
        tutor_profile: { full_name: string | null; email: string } | null;
      }>
    )
      .map((connection) => {
        const paidCents = paidByTutor.get(connection.tutor_id) ?? 0;
        const spentCents = spentByTutor.get(connection.tutor_id) ?? 0;
        const balanceCents = paidCents - spentCents;

        return {
          tutorId: connection.tutor_id,
          tutorName:
            connection.tutor_profile?.full_name ||
            connection.tutor_profile?.email ||
            "Tutor",
          balanceCents,
          lessonPriceCents: connection.lesson_price_cents,
          lessonsLeft: getLessonsLeft(balanceCents, connection.lesson_price_cents),
        };
      })
      .sort((left, right) =>
        left.tutorName.localeCompare(right.tutorName, undefined, {
          sensitivity: "base",
        }),
      );

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

    const upcomingLessons = ((upcomingLessonRows ?? []) as Array<{
      id: string;
      tutor_id?: string | null;
      title: string | null;
      lesson_date: string;
      start_time: string | null;
      end_time: string | null;
      time_zone?: string | null;
      start_at?: string | null;
      end_at?: string | null;
      status: "planned" | "completed" | "cancelled";
      meet_url: string | null;
      tutor_profile: { full_name: string | null; email: string } | null;
    }>).map((row) => ({
      id: row.id,
      tutorId: row.tutor_id ?? null,
      title: row.title,
      lessonDate: row.lesson_date,
      startTime: row.start_time,
      endTime: row.end_time,
      timeZone: row.time_zone ?? null,
      startAt: row.start_at ?? null,
      endAt: row.end_at ?? null,
      status: row.status,
      meetUrl: row.meet_url,
      tutorName:
        row.tutor_profile?.full_name || row.tutor_profile?.email || "Tutor",
    }));

    const nextLesson = upcomingLessons[0] ?? null;

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
          upcomingLessons={upcomingLessons}
          todayIso={todayIso}
          lessonBalances={lessonBalances}
          grammarTopicCatalog={grammarTopicCatalog}
          planGrammarTopicKeys={planGrammarTopicKeys}
          masteredGrammarTopicKeys={masteredGrammarTopicKeys}
        />

        {/* Desktop / PC Student View: Calm 3-Row Dashboard */}
        <div className="hidden space-y-6 md:block">
          <div className="flex flex-col gap-4 border-b border-border/50 pb-4 lg:flex-row lg:items-center lg:justify-between">
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
                {messages.dashboard.roleDescriptions.student}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/lessons" prefetch={false}>
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  {messages.nav.lessons}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/vocabulary" prefetch={false}>
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  {messages.nav.passiveVocabulary}
                </Link>
              </Button>
            </div>
          </div>

          <Suspense fallback={<StudentDashboardSkeleton />}>
            <StudentDashboard
              userId={user.id}
              planKey={profile.plan}
              cefrLevel={profile.cefr_level}
              messages={messages}
              nextLesson={nextLesson}
              upcomingLessons={upcomingLessons}
              todayIso={todayIso}
              lessonBalances={lessonBalances}
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
