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
import {
  CustomizableDashboard,
  DashboardCustomizableItem,
} from "@/components/dashboard/customizable-dashboard";
import Link from "next/link";
import {
  AlertTriangle,
  Activity,
  BookOpen,
  BookMarked,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  MessageSquare,
  PlusCircle,
  Video,
  Wallet,
} from "lucide-react";
import { fmtLimit } from "@/lib/plans";
import { getPlan } from "@/lib/plans-server";
import {
  formatLessonCurrency,
  formatLessonTimeRange,
  getLessonDisplayTitle,
} from "@/lib/lessons";
import { getTutorLessonBalanceSummaries } from "@/lib/lessons-server";
import { AnimatedCard } from "@/components/ui/animated-dashboard";
import type { AppMessages } from "@/lib/i18n/messages";

function pct(used: number, total: number) {
  if (!isFinite(total) || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const todayIso = toLocalIsoDate(now);
  const nextWeekDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 7,
  );
  const nextWeekIso = toLocalIsoDate(nextWeekDate);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
      .neq("status", "cancelled")
      .gte("lesson_date", todayIso)
      .lte("lesson_date", nextWeekIso)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(8),
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

  const upcomingLessons = (
    (upcomingLessonsData ?? []) as UpcomingLessonRow[]
  ).slice(0, 5);

  // Map each active student's latest completed lesson date & cutoff timestamp
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

  const studentHomeworkSnapshots = activeConnections
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
      const avgScore =
        scoredAttempts.length > 0
          ? Math.round(
              scoredAttempts.reduce(
                (acc, item) =>
                  acc + ((item.score ?? 0) / (item.max_score ?? 1)) * 100,
                0,
              ) / scoredAttempts.length,
            )
          : null;

      return {
        studentId: connection.student_id,
        studentName,
        lastLessonDate: lastLesson?.lessonDate ?? null,
        exercisesCount: studentAttempts.length,
        avgScore,
      };
    })
    .sort(
      (left, right) =>
        right.exercisesCount - left.exercisesCount ||
        left.studentName.localeCompare(right.studentName, undefined, {
          sensitivity: "base",
        }),
    );

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

  const cc = messages.dashboard.tutor.commandCenter;

  return (
    <div className="space-y-6">
      {/* Tutor Command Center: Schedule, Homework Since Last Lesson, Balance Alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 1. Today & Upcoming Lessons */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {cc.todayScheduleTitle}
                </CardTitle>
              </div>
              <Badge variant="outline">{upcomingLessons.length}</Badge>
            </div>
            <CardDescription>{cc.todayScheduleDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-2.5">
            {upcomingLessons.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {cc.noUpcomingLessons}
              </div>
            ) : (
              upcomingLessons.map((lesson) => {
                const isToday = lesson.lesson_date === todayIso;
                const studentName =
                  lesson.student_profile?.full_name ||
                  lesson.student_profile?.email ||
                  getLessonDisplayTitle(lesson.title);
                const balanceSummary = lesson.student_id
                  ? balanceByStudentId.get(lesson.student_id)
                  : undefined;
                const lessonsLeft = balanceSummary?.lessonsLeft ?? null;
                const isLowBalance =
                  balanceSummary &&
                  (balanceSummary.balanceCents < 0 ||
                    (balanceSummary.lessonPriceCents > 0 &&
                      (lessonsLeft ?? 0) <= 0));

                return (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card/60 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-medium">
                          {studentName}
                        </span>
                        {isToday ? (
                          <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                            {cc.todayBadge}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                            {formatShortLessonDate(lesson.lesson_date)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatLessonTimeRange(
                          lesson.start_time,
                          lesson.end_time,
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {lesson.meet_url ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 border-emerald-500/30 bg-emerald-500/10 px-2 text-xs text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                        >
                          <a
                            href={lesson.meet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Video className="mr-1 h-3.5 w-3.5" />
                            Meet
                          </a>
                        </Button>
                      ) : null}
                      {lessonsLeft !== null ? (
                        <Badge
                          variant={isLowBalance ? "destructive" : "outline"}
                          className="text-[11px]"
                        >
                          {cc.lessonsLeftBadge(lessonsLeft)}
                        </Badge>
                      ) : null}
                      {lesson.student_id ? (
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <Link
                            href={`/results?student=${lesson.student_id}`}
                            prefetch={false}
                          >
                            {cc.studentHubButton}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
          <CardFooter className="pt-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/lessons" prefetch={false}>
                {cc.openScheduleButton}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* 2. Activity Since Last Lesson (Homework Snapshot) */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {cc.homeworkSnapshotTitle}
                </CardTitle>
              </div>
              <Badge variant="outline">{studentHomeworkSnapshots.length}</Badge>
            </div>
            <CardDescription>{cc.homeworkSnapshotDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-2.5">
            {studentHomeworkSnapshots.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {cc.noActiveStudents}
              </div>
            ) : (
              <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                {studentHomeworkSnapshots.map((item) => (
                  <div
                    key={item.studentId}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card/60 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-medium">{item.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.lastLessonDate
                          ? cc.lastLessonLabel(
                              formatShortLessonDate(item.lastLessonDate),
                            )
                          : cc.noPastLessonLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {item.exercisesCount > 0 ? (
                        <>
                          <Badge variant="secondary" className="text-[11px]">
                            {cc.quizzesDoneBadge(item.exercisesCount)}
                          </Badge>
                          {item.avgScore !== null ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/40 text-[11px] text-emerald-600 dark:text-emerald-400"
                            >
                              {cc.avgScoreBadge(item.avgScore)}
                            </Badge>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {cc.noActivitySinceLesson}
                        </span>
                      )}
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                      >
                        <Link
                          href={`/history?student=${item.studentId}`}
                          prefetch={false}
                        >
                          {cc.historyButton}
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/history" prefetch={false}>
                {cc.openHistoryButton}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* 3. Low Balance Alerts */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {cc.balanceAlertsTitle}
                </CardTitle>
              </div>
              <Badge
                variant={
                  lowBalanceStudents.length > 0 ? "destructive" : "outline"
                }
              >
                {lowBalanceStudents.length}
              </Badge>
            </div>
            <CardDescription>{cc.balanceAlertsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-2.5">
            {lowBalanceStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <p>{cc.allBalancesHealthy}</p>
              </div>
            ) : (
              <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                {lowBalanceStudents.map((student) => (
                  <div
                    key={student.participantId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span className="truncate font-medium">
                          {student.participantName}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatLessonCurrency(student.balanceCents)} ·{" "}
                        {formatLessonCurrency(student.lessonPriceCents)} / lesson
                      </p>
                    </div>
                    <Badge variant="destructive" className="shrink-0 text-[11px]">
                      {cc.lessonsLeftBadge(student.lessonsLeft ?? 0)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/lessons/balance" prefetch={false}>
                {cc.manageBalancesButton}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Quick Actions & Customizable Cards */}
      <CustomizableDashboard
        storageKey={`vocab-crafter.dashboard-layout:tutor:${userId}`}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <DashboardCustomizableItem
          id="new-quiz"
          title={messages.dashboard.tutor.newQuizTitle}
        >
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
                  <Link href="/quizzes/new" prefetch={false}>
                    {messages.dashboard.tutor.createQuizButton}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="review"
          title={messages.dashboard.tutor.reviewTitle}
        >
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
                  <Link href="/assignments/review" prefetch={false}>
                    {messages.dashboard.tutor.reviewButton}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="passive-vocabulary"
          title={messages.dashboard.tutor.passiveTitle}
        >
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
                    <Link href={passiveImportHref} prefetch={false}>
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
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="students"
          title={messages.dashboard.tutor.studentsTitle}
        >
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
                  <Link href="/students" prefetch={false}>
                    {messages.dashboard.tutor.viewStudentsButton}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="quizzes-created"
          title={messages.dashboard.tutor.quizzesCreatedTitle}
        >
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
        </DashboardCustomizableItem>
      </CustomizableDashboard>
    </div>
  );
}
