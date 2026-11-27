import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  MessageSquare,
  PlusCircle,
  Wallet,
} from "lucide-react";
import { fmtLimit } from "@/lib/plans";
import { getPlan } from "@/lib/plans-server";
import {
  formatLessonCurrency,
  getLessonDisplayTitle,
  toLocalIsoDate,
} from "@/lib/lessons";
import {
  autoCompleteOverduePlannedLessons,
  getTutorLessonBalanceSummaries,
} from "@/lib/lessons-server";
import {
  TutorHomeworkActivityCard,
  type StudentHomeworkSnapshotItem,
} from "@/components/dashboard/tutor-homework-activity-card";
import {
  TutorNextUpCard,
  TutorUpcomingScheduleCard,
  type TutorDashboardLessonItem,
} from "@/components/dashboard/tutor-next-up-cards";
import { cn } from "@/lib/utils";
import type { AppMessages } from "@/lib/i18n/messages";

function pct(used: number, total: number) {
  if (!isFinite(total) || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function formatShortLessonDate(isoDate: string) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(parsed);
}

interface UpcomingLessonRow {
  id: string;
  student_id: string | null;
  title: string | null;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  status: "planned" | "completed" | "cancelled";
  price_cents: number;
  meet_url?: string | null;
  student_profile: {
    full_name: string | null;
    email: string;
  } | null;
}

interface PastCompletedLessonRow {
  student_id: string | null;
  lesson_date: string;
  end_time: string | null;
  updated_at: string;
}

interface StudentQuizAttemptRow {
  student_id: string;
  score: number | null;
  max_score: number | null;
  completed_at: string;
}

export async function TutorDashboard({
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

  const now = new Date();
  const yesterdayDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  const yesterdayIso = toLocalIsoDate(yesterdayDate);
  const nextWeekDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 8,
  );
  const nextWeekIso = toLocalIsoDate(nextWeekDate);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  await autoCompleteOverduePlannedLessons({
    tutorId: userId,
    supabaseAdmin,
  }).catch((error) => {
    console.error("Failed to auto-complete overdue planned lessons:", error);
  });

  const [
    { count: monthlyQuizCount },
    { data: connections },
    allBalanceSummaries,
    { data: upcomingLessonsData },
    { data: completedLessonsData },
  ] = await Promise.all([
    supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", userId)
      .is("deleted_at", null)
      .gte("created_at", monthStart.toISOString()),
    supabaseAdmin
      .from("tutor_students")
      .select(
        "student_id, student_profile:profiles!tutor_students_student_id_fkey(full_name, email)",
      )
      .eq("tutor_id", userId)
      .eq("status", "active")
      .is("archived_at", null),
    getTutorLessonBalanceSummaries(userId, supabaseAdmin),
    supabaseAdmin
      .from("tutor_student_lessons")
      .select(
        "id, student_id, title, lesson_date, start_time, end_time, status, price_cents, meet_url, student_profile:profiles!tutor_student_lessons_student_id_fkey(full_name, email)",
      )
      .eq("tutor_id", userId)
      .eq("status", "planned")
      .gte("lesson_date", yesterdayIso)
      .lte("lesson_date", nextWeekIso)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(40),
    supabaseAdmin
      .from("tutor_student_lessons")
      .select("student_id, lesson_date, end_time, updated_at")
      .eq("tutor_id", userId)
      .eq("status", "completed")
      .not("student_id", "is", null)
      .order("lesson_date", { ascending: false })
      .order("end_time", { ascending: false }),
  ]);

  const activeConnections = (connections ?? []).filter(
    (connection) => connection.student_id !== userId,
  );
  const connectedStudentIds = Array.from(
    new Set(activeConnections.map((connection) => connection.student_id)),
  );
  const totalStudents = connectedStudentIds.length;

  const { data: recentAttemptsData } =
    connectedStudentIds.length > 0
      ? await supabaseAdmin
          .from("quiz_attempts")
          .select("student_id, score, max_score, completed_at")
          .in("student_id", connectedStudentIds)
          .gte("completed_at", thirtyDaysAgo.toISOString())
          .order("completed_at", { ascending: false })
      : { data: [] as StudentQuizAttemptRow[] };

  const activeBalanceSummaries = allBalanceSummaries.filter(
    (summary) => !summary.archivedAt && summary.participantId !== userId,
  );
  const balanceByStudentId = new Map(
    activeBalanceSummaries.map((summary) => [summary.participantId, summary]),
  );

  const lowBalanceStudents = activeBalanceSummaries.filter(
    (summary) =>
      summary.balanceCents < 0 ||
      (summary.lessonPriceCents > 0 && (summary.lessonsLeft ?? 0) <= 0),
  );

  const serializedUpcomingLessons: TutorDashboardLessonItem[] = (
    (upcomingLessonsData ?? []) as UpcomingLessonRow[]
  ).map((lesson) => {
    const studentName =
      lesson.student_profile?.full_name ||
      lesson.student_profile?.email ||
      getLessonDisplayTitle(lesson.title);
    const balanceSummary = lesson.student_id
      ? balanceByStudentId.get(lesson.student_id)
      : undefined;
    const lessonsLeft = balanceSummary?.lessonsLeft ?? null;
    const isLowBalance = Boolean(
      balanceSummary &&
        (balanceSummary.balanceCents < 0 ||
          (balanceSummary.lessonPriceCents > 0 && (lessonsLeft ?? 0) <= 0)),
    );

    return {
      id: lesson.id,
      studentId: lesson.student_id,
      studentName,
      lessonDate: lesson.lesson_date,
      startTime: lesson.start_time,
      endTime: lesson.end_time,
      status: lesson.status,
      meetUrl: lesson.meet_url ?? null,
      lessonsLeft,
      isLowBalance,
    };
  });

  const lastLessonByStudentId = new Map<
    string,
    { lessonDate: string; cutoffMs: number }
  >();
  for (const row of (completedLessonsData ?? []) as PastCompletedLessonRow[]) {
    if (!row.student_id || lastLessonByStudentId.has(row.student_id)) {
      continue;
    }
    const endTimeStr = row.end_time ? `${row.end_time}:00` : "23:59:59";
    const parsedCutoff = new Date(`${row.lesson_date}T${endTimeStr}`).getTime();
    const cutoffMs = Number.isFinite(parsedCutoff)
      ? parsedCutoff
      : new Date(`${row.lesson_date}T23:59:59`).getTime();

    lastLessonByStudentId.set(row.student_id, {
      lessonDate: row.lesson_date,
      cutoffMs,
    });
  }

  const attemptsByStudentId = new Map<string, StudentQuizAttemptRow[]>();
  for (const attempt of (recentAttemptsData ?? []) as StudentQuizAttemptRow[]) {
    const existing = attemptsByStudentId.get(attempt.student_id) ?? [];
    existing.push(attempt);
    attemptsByStudentId.set(attempt.student_id, existing);
  }

  const cc = messages.dashboard.tutor.commandCenter;

  const studentHomeworkMetrics = activeConnections
    .map((connection) => {
      const profile = connection.student_profile as {
        full_name: string | null;
        email: string;
      } | null;
      const studentName = profile?.full_name || profile?.email || "Student";
      const lastLesson = lastLessonByStudentId.get(connection.student_id);
      const cutoffMs = lastLesson
        ? lastLesson.cutoffMs
        : sevenDaysAgo.getTime();
      const studentAttempts = (
        attemptsByStudentId.get(connection.student_id) ?? []
      ).filter(
        (attempt) => new Date(attempt.completed_at).getTime() > cutoffMs,
      );

      const scoredAttempts = studentAttempts.filter(
        (attempt) =>
          attempt.score !== null &&
          attempt.max_score !== null &&
          attempt.max_score > 0,
      );
      const weightedScoreSum = scoredAttempts.reduce(
        (acc, item) => acc + ((item.score ?? 0) / (item.max_score ?? 1)) * 100,
        0,
      );
      const avgScore =
        scoredAttempts.length > 0
          ? Math.round(weightedScoreSum / scoredAttempts.length)
          : null;

      return {
        snapshot: {
          studentId: connection.student_id,
          studentName,
          lastLessonLabel: lastLesson
            ? cc.lastLessonLabel(formatShortLessonDate(lastLesson.lessonDate))
            : cc.noPastLessonLabel,
          exercisesCount: studentAttempts.length,
          avgScore,
        } satisfies StudentHomeworkSnapshotItem,
        weightedScoreSum,
        scoredAttemptsCount: scoredAttempts.length,
      };
    })
    .sort(
      (left, right) =>
        right.snapshot.exercisesCount - left.snapshot.exercisesCount ||
        left.snapshot.studentName.localeCompare(
          right.snapshot.studentName,
          undefined,
          { sensitivity: "base" },
        ),
    );

  const studentHomeworkSnapshots = studentHomeworkMetrics.map(
    (entry) => entry.snapshot,
  );
  const studentsWithRecentPractice = studentHomeworkSnapshots.filter(
    (item) => item.exercisesCount > 0,
  ).length;
  const totalHomeworkExercises = studentHomeworkSnapshots.reduce(
    (sum, item) => sum + item.exercisesCount,
    0,
  );
  const totalWeightedScore = studentHomeworkMetrics.reduce(
    (sum, entry) => sum + entry.weightedScoreSum,
    0,
  );
  const totalScoredAttempts = studentHomeworkMetrics.reduce(
    (sum, entry) => sum + entry.scoredAttemptsCount,
    0,
  );

  const overallHomeworkAvg =
    totalScoredAttempts > 0
      ? Math.round(totalWeightedScore / totalScoredAttempts)
      : null;

  const quizLimit = plan.quizzesPerMonth;
  const quizPercentage = pct(monthlyQuizCount ?? 0, quizLimit);
  const isQuizWarning = quizPercentage >= 80;
  const isQuizOver = quizPercentage >= 100;
  const passiveImportHref =
    connectedStudentIds.length === 1
      ? `/vocabulary?student=${connectedStudentIds[0]}`
      : "/vocabulary";
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

  const tutorI18n = messages.dashboard.tutor;
  const kpi = tutorI18n.kpi;
  const initialNowMs = now.getTime();

  return (
    <div className="space-y-5">
      {/* Row 1: 4-Card Bento KPI Strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1: Today & Next Up */}
        <TutorNextUpCard
          lessons={serializedUpcomingLessons}
          initialNowMs={initialNowMs}
        />

        {/* KPI 2: Active Students */}
        <Card
          data-tour-id="tutor-students"
          className="border-border/70 bg-card/70 shadow-xs"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {kpi.activeStudentsTitle}
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/10 text-sky-400">
              <GraduationCap className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-bold tabular-nums">
                {totalStudents}
              </div>
              <Link
                href="/students"
                prefetch={false}
                className="text-xs font-medium text-primary hover:underline"
              >
                {tutorI18n.viewStudentsButton}
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpi.practicedCount(studentsWithRecentPractice, totalStudents)}
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Homework Activity */}
        <Card className="border-border/70 bg-card/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {kpi.homeworkActivityTitle}
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
              <Activity className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {totalHomeworkExercises}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpi.homeworkAvgSummary(
                overallHomeworkAvg,
                studentsWithRecentPractice,
              )}
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Monthly Quizzes */}
        <Card className="border-border/70 bg-card/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {kpi.monthlyQuizzesTitle}
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
              <BookOpen className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-bold tabular-nums">
                {(monthlyQuizCount ?? 0).toLocaleString()}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {fmtLimit(quizLimit)}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {isFinite(quizLimit)
                  ? tutorI18n.remainingThisMonth(
                      Math.max(0, quizLimit - (monthlyQuizCount ?? 0)),
                    )
                  : tutorI18n.unlimited}
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isQuizOver
                    ? "bg-destructive"
                    : isQuizWarning
                      ? "bg-amber-500"
                      : "bg-primary",
                )}
                style={{ width: `${Math.min(quizPercentage, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Compact Balance Status Strip */}
      <div
        className={cn(
          "rounded-xl border px-4 py-3 shadow-xs transition-colors",
          lowBalanceStudents.length > 0
            ? "border-amber-500/35 bg-amber-500/[0.06]"
            : "border-border/70 bg-card/60",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                lowBalanceStudents.length > 0
                  ? "border-amber-500/30 bg-amber-500/15 text-amber-500"
                  : "border-emerald-500/30 bg-emerald-500/15 text-emerald-500",
              )}
            >
              {lowBalanceStudents.length > 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  {cc.balanceAlertsTitle}
                </h2>
                {lowBalanceStudents.length > 0 ? (
                  <Badge
                    variant="destructive"
                    className="gap-1.5 text-[11px]"
                  >
                    {tutorI18n.balanceBanner.alertBadge(
                      lowBalanceStudents.length,
                    )}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-500"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {tutorI18n.balanceBanner.healthyBadge}
                  </Badge>
                )}
              </div>

              {lowBalanceStudents.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {cc.allBalancesHealthy}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {lowBalanceStudents.map((student) => (
                    <Badge
                      key={student.participantId}
                      variant="outline"
                      className="border-amber-500/30 bg-background/60 text-xs font-medium"
                    >
                      <span>{student.participantName}</span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span className="text-amber-500 tabular-nums">
                        {formatLessonCurrency(student.balanceCents)} (
                        {cc.lessonsLeftBadge(student.lessonsLeft ?? 0)})
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            <Link href="/lessons/balance" prefetch={false}>
              {cc.manageBalancesButton}
            </Link>
          </Button>
        </div>
      </div>

      {/* Row 3: 2-Column Main Workspace */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left (5 cols): Today & Upcoming Lessons */}
        <TutorUpcomingScheduleCard
          lessons={serializedUpcomingLessons}
          initialNowMs={initialNowMs}
        />

        {/* Right (7 cols): Activity Since Last Lesson with Filter Tabs */}
        <div className="lg:col-span-7">
          <TutorHomeworkActivityCard items={studentHomeworkSnapshots} />
        </div>
      </div>

      {/* Row 4: 4 Compact Quick-Action Tiles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          data-tour-id="tutor-new-quiz"
          className="flex flex-col justify-between border-border/70 bg-card/70 shadow-xs"
        >
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PlusCircle className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold">
                  {tutorI18n.newQuizTitle}
                </CardTitle>
                <CardDescription className="text-xs">
                  {tutorI18n.newQuizDescription}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-2">
            <Button asChild size="sm" className="w-full">
              <Link href="/quizzes/new" prefetch={false}>
                {tutorI18n.createQuizButton}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card
          data-tour-id="tutor-review"
          className="flex flex-col justify-between border-border/70 bg-card/70 shadow-xs"
        >
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold">
                  {tutorI18n.reviewTitle}
                </CardTitle>
                <CardDescription className="text-xs">
                  {tutorI18n.reviewDescription}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-2">
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/assignments/review" prefetch={false}>
                {tutorI18n.reviewButton}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card
          data-tour-id="tutor-passive-recognition"
          className="flex flex-col justify-between border-border/70 bg-card/70 shadow-xs"
        >
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <BookMarked className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold">
                  {tutorI18n.passiveTitle}
                </CardTitle>
                <CardDescription className="text-xs">
                  {passiveImportDescription}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-2">
            {connectedStudentIds.length > 0 ? (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={passiveImportHref} prefetch={false}>
                  {passiveImportButtonLabel}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="w-full" disabled>
                {passiveImportButtonLabel}
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card className="flex flex-col justify-between border-border/70 bg-card/70 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold">
                  {tutorI18n.plansReportsTitle}
                </CardTitle>
                <CardDescription className="text-xs">
                  {tutorI18n.plansReportsDescription}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-2">
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/results?tab=plan" prefetch={false}>
                {tutorI18n.plansReportsButton}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
