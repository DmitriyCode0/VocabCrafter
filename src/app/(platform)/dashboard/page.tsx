import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  normalizeAppLanguage,
  type AppLanguage,
} from "@/lib/i18n/app-language";
import { formatMonthNameForAppLanguage } from "@/lib/i18n/format";
import { getAppMessages, type AppMessages } from "@/lib/i18n/messages";
import type { Role } from "@/types/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BookOpen,
  BookMarked,
  Flame,
  GraduationCap,
  Users,
  MessageSquare,
  BarChart3,
  PlusCircle,
  Target,
  Cpu,
  Zap,
  CreditCard,
} from "lucide-react";
import { fmtLimit } from "@/lib/plans";
import { getPlan } from "@/lib/plans-server";
import {
  AnimatedDashboard,
  AnimatedCard,
} from "@/components/ui/animated-dashboard";
import { calculateDayStreak } from "@/lib/history/calculate-day-streak";
import { calculateTextCostUsd, calculateTtsCostUsd } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

function pct(used: number, total: number) {
  if (!isFinite(total) || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function formatApproxUsd(value: number) {
  const digits = value > 0 && value < 0.01 ? 4 : 2;
  return `$${value.toFixed(digits)}`;
}

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
        <StudentDashboard
          userId={user.id}
          planKey={profile.plan}
          messages={messages}
        />
      )}
      {role === "tutor" && (
        <TutorDashboard
          userId={user.id}
          planKey={profile.plan}
          messages={messages}
        />
      )}
      {role === "superadmin" && (
        <AdminDashboard appLanguage={appLanguage} messages={messages} />
      )}
    </div>
  );
}

async function StudentDashboard({
  userId,
  planKey,
  messages,
}: {
  userId: string;
  planKey?: string | null;
  messages: AppMessages;
}) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const plan = await getPlan(planKey);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    { count: monthlyQuizCount },
    { data: attemptRows },
    { count: totalWordsTracked },
  ] = await Promise.all([
    supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", userId)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("quiz_attempts")
      .select("completed_at")
      .eq("student_id", userId)
      .order("completed_at", { ascending: false }),
    supabaseAdmin
      .from("word_mastery")
      .select("id", { count: "exact", head: true })
      .eq("student_id", userId),
  ]);

  const quizLimit = plan.quizzesPerMonth;
  const quizPercentage = pct(monthlyQuizCount ?? 0, quizLimit);
  const isQuizWarning = quizPercentage >= 80;
  const isQuizOver = quizPercentage >= 100;
  const dayStreak = calculateDayStreak(
    (attemptRows ?? []).map((attempt) => attempt.completed_at),
  );

  return (
    <div className="space-y-6">
      <AnimatedDashboard className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <AnimatedCard>
          <Card data-tour-id="student-new-quiz">
            <CardHeader className="flex flex-row items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">
                  {messages.dashboard.student.newQuizTitle}
                </CardTitle>
                <CardDescription>
                  {messages.dashboard.student.newQuizDescription}
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild className="w-full">
                <Link href="/quizzes/new">
                  {messages.dashboard.student.createQuizButton}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="student-review-activity">
            <CardHeader className="flex flex-row items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">
                  {messages.dashboard.student.reviewTitle}
                </CardTitle>
                <CardDescription>
                  {messages.dashboard.student.reviewDescription}
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild variant="outline" className="w-full">
                <Link href="/quizzes/review">
                  {messages.dashboard.student.startReviewButton}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="student-passive-recognition">
            <CardHeader className="flex flex-row items-center gap-2">
              <BookMarked className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">
                  {messages.dashboard.student.passiveTitle}
                </CardTitle>
                <CardDescription>
                  {messages.dashboard.student.passiveDescription}
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild variant="outline" className="w-full">
                <Link href="/passive-vocabulary">
                  {messages.dashboard.student.passiveButton}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="student-quizzes-created">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.student.quizzesCreatedTitle}
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold">
                {(monthlyQuizCount ?? 0).toLocaleString()}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {fmtLimit(quizLimit)}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${isQuizOver ? "bg-red-500" : isQuizWarning ? "bg-amber-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(quizPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isFinite(quizLimit)
                  ? messages.dashboard.student.remainingThisMonth(
                      Math.max(0, quizLimit - (monthlyQuizCount ?? 0)),
                    )
                  : messages.dashboard.student.unlimited}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="student-day-streak">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.student.dayStreakTitle}
              </CardTitle>
              <Flame className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dayStreak}</div>
              <p className="text-xs text-muted-foreground">
                {messages.dashboard.student.consecutiveDays(dayStreak)}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="student-total-words">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.student.totalWordsTitle}
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWordsTracked ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                {messages.dashboard.student.totalWordsDescription}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>
      </AnimatedDashboard>
    </div>
  );
}

async function TutorDashboard({
  userId,
  planKey,
  messages,
}: {
  userId: string;
  planKey?: string | null;
  messages: AppMessages;
}) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const plan = await getPlan(planKey);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    { data: classes },
    { count: monthlyQuizCount },
    { data: connections },
  ] = await Promise.all([
    supabase.from("classes").select("id").eq("tutor_id", userId),
    supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", userId)
      .gte("created_at", monthStart.toISOString()),
    supabaseAdmin
      .from("tutor_students")
      .select("student_id")
      .eq("tutor_id", userId)
      .eq("status", "active"),
  ]);

  const classIds = classes?.map((classItem) => classItem.id) ?? [];
  const connectedStudentIds = Array.from(
    new Set(
      (connections ?? [])
        .map((connection) => connection.student_id)
        .filter((studentId) => studentId !== userId),
    ),
  );
  let totalStudents = 0;

  if (classIds.length > 0) {
    const { data: members } = await supabaseAdmin
      .from("class_members")
      .select("student_id")
      .in("class_id", classIds);

    totalStudents = new Set((members ?? []).map((member) => member.student_id))
      .size;
  }

  const quizLimit = plan.quizzesPerMonth;
  const quizPercentage = pct(monthlyQuizCount ?? 0, quizLimit);
  const isQuizWarning = quizPercentage >= 80;
  const isQuizOver = quizPercentage >= 100;
  const passiveImportHref =
    connectedStudentIds.length === 1
      ? `/passive-vocabulary?student=${connectedStudentIds[0]}`
      : "/passive-vocabulary";
  const passiveImportDescription =
    connectedStudentIds.length === 0
      ? messages.dashboard.tutor.passiveDescriptionNone
      : connectedStudentIds.length === 1
        ? messages.dashboard.tutor.passiveDescriptionSingle
        : messages.dashboard.tutor.passiveDescriptionMultiple;
  const passiveImportButtonLabel =
    connectedStudentIds.length === 0
      ? messages.dashboard.tutor.passiveButtonNone
      : connectedStudentIds.length === 1
        ? messages.dashboard.tutor.passiveButtonSingle
        : messages.dashboard.tutor.passiveButtonMultiple;

  return (
    <div className="space-y-6">
      <AnimatedDashboard className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AnimatedCard>
          <Card data-tour-id="tutor-new-quiz">
            <CardHeader className="flex flex-row items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">
                  {messages.dashboard.tutor.newQuizTitle}
                </CardTitle>
                <CardDescription>
                  {messages.dashboard.tutor.newQuizDescription}
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild className="w-full">
                <Link href="/quizzes/new">
                  {messages.dashboard.tutor.createQuizButton}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="tutor-review">
            <CardHeader className="flex flex-row items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">
                  {messages.dashboard.tutor.reviewTitle}
                </CardTitle>
                <CardDescription>
                  {messages.dashboard.tutor.reviewDescription}
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild variant="outline" className="w-full">
                <Link href="/review">
                  {messages.dashboard.tutor.reviewButton}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="tutor-passive-recognition">
            <CardHeader className="flex flex-row items-center gap-2">
              <BookMarked className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">
                  {messages.dashboard.tutor.passiveTitle}
                </CardTitle>
                <CardDescription>{passiveImportDescription}</CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              {connectedStudentIds.length > 0 ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={passiveImportHref}>
                    {passiveImportButtonLabel}
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  {passiveImportButtonLabel}
                </Button>
              )}
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="tutor-students">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.tutor.studentsTitle}
              </CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents}</div>
              <p className="text-xs text-muted-foreground">
                {messages.dashboard.tutor.enrolledStudents}
              </p>
            </CardContent>
            <CardFooter className="mt-auto justify-center">
              <Button asChild variant="outline" className="w-full">
                <Link href="/students">
                  {messages.dashboard.tutor.viewStudentsButton}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.tutor.quizzesCreatedTitle}
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold">
                {(monthlyQuizCount ?? 0).toLocaleString()}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {fmtLimit(quizLimit)}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${isQuizOver ? "bg-red-500" : isQuizWarning ? "bg-amber-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(quizPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isFinite(quizLimit)
                  ? messages.dashboard.tutor.remainingThisMonth(
                      Math.max(0, quizLimit - (monthlyQuizCount ?? 0)),
                    )
                  : messages.dashboard.tutor.unlimited}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>
      </AnimatedDashboard>
    </div>
  );
}

async function AdminDashboard({
  appLanguage,
  messages,
}: {
  appLanguage: AppLanguage;
  messages: AppMessages;
}) {
  const supabaseAdmin = createAdminClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthISO = monthStart.toISOString();
  const monthLabel = formatMonthNameForAppLanguage(appLanguage, new Date());

  const [
    { count: userCount },
    { count: totalQuizCount },
    { count: monthlyQuizCount },
    monthlyUsageEventsResult,
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("quizzes").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthISO),
    supabaseAdmin
      .from("ai_usage_events")
      .select(
        "request_type, prompt_tokens, response_tokens, audio_output_tokens",
      )
      .gte("created_at", monthISO),
  ]);

  if (monthlyUsageEventsResult.error) {
    console.error("Failed to load admin dashboard AI usage summary:", {
      message: monthlyUsageEventsResult.error.message,
    });
  }

  const monthlyUsageEvents = monthlyUsageEventsResult.data ?? [];
  const textEvents = monthlyUsageEvents.filter(
    (event) => event.request_type === "text",
  );
  const ttsEvents = monthlyUsageEvents.filter(
    (event) => event.request_type === "tts",
  );
  const textRequestCount = textEvents.length;
  const ttsRequestCount = ttsEvents.length;
  const trackedRequestCount = monthlyUsageEvents.length;
  const textCost = calculateTextCostUsd(
    textEvents.reduce((sum, event) => sum + (event.prompt_tokens ?? 0), 0),
    textEvents.reduce((sum, event) => sum + (event.response_tokens ?? 0), 0),
  );
  const ttsCost = calculateTtsCostUsd(
    ttsEvents.reduce((sum, event) => sum + (event.prompt_tokens ?? 0), 0),
    ttsEvents.reduce((sum, event) => sum + (event.audio_output_tokens ?? 0), 0),
  );
  const totalTrackedCost = textCost + ttsCost;

  return (
    <div className="space-y-6">
      <AnimatedDashboard className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AnimatedCard>
          <Card data-tour-id="admin-quizzes-created">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.admin.quizzesCreatedTitle}
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(totalQuizCount ?? 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {messages.dashboard.admin.createdThisMonth(
                  monthlyQuizCount ?? 0,
                )}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-text-requests">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.admin.textRequestsTitle}
              </CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {textRequestCount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatApproxUsd(textCost)} {messages.dashboard.admin.trackedInMonth(monthLabel)}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-tts-requests">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.admin.ttsRequestsTitle}
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {ttsRequestCount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatApproxUsd(ttsCost)} {messages.dashboard.admin.trackedInMonth(monthLabel)}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-tracked-cost">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.admin.trackedCostTitle}
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatApproxUsd(totalTrackedCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {messages.dashboard.admin.trackedRequestsInMonth(
                  trackedRequestCount,
                  monthLabel,
                )}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-total-users">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.admin.totalUsersTitle}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                {messages.dashboard.admin.registeredUsers}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>
      </AnimatedDashboard>

      <AnimatedDashboard className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatedCard>
          <Card data-tour-id="admin-analytics">
            <CardHeader className="flex flex-row items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">
                  {messages.dashboard.admin.analyticsTitle}
                </CardTitle>
                <CardDescription>
                  {messages.dashboard.admin.analyticsDescription}
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild className="w-full">
                <Link href="/analytics">
                  {messages.dashboard.admin.viewAnalyticsButton}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-users">
            <CardHeader className="flex flex-row items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">
                  {messages.dashboard.admin.usersTitle}
                </CardTitle>
                <CardDescription>
                  {messages.dashboard.admin.usersDescription}
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild variant="outline" className="w-full">
                <Link href="/users">
                  {messages.dashboard.admin.manageUsersButton}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>
      </AnimatedDashboard>
    </div>
  );
}
