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
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Flame,
  PlusCircle,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { getPlan } from "@/lib/plans-server";
import { calculateDayStreak } from "@/lib/history/calculate-day-streak";
import {
  applyTutorTimeAdjustmentToSnapshot,
  getStudentProgressSnapshot,
  type StudentProgressSnapshot,
} from "@/lib/progress/profile-metrics";
import { getPublishedTutorTimeAdjustment } from "@/lib/progress/published-tutor-time-adjustment";
import {
  StudentGoogleMeetBanner,
  type StudentLessonBalanceItem,
  type StudentNextLesson,
} from "@/components/dashboard/student-google-meet-banner";
import type { AppMessages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

function pct(used: number, total: number) {
  if (!isFinite(total) || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

const PERFORMANCE_BAND_STYLES: Record<
  StudentProgressSnapshot["overallPerformance"]["band"],
  { label: string; badgeClassName: string } | null
> = {
  strong: {
    label: "Strong",
    badgeClassName:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  on_track: {
    label: "On Track",
    badgeClassName:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  building: {
    label: "Building",
    badgeClassName:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  needs_focus: null,
};

interface StudentWordMasterySummaryRow {
  id: string;
  term: string;
  mastery_level: number | null;
  next_review: string;
  source_lesson_id: string | null;
  created_at: string;
}

interface StudentPendingAssignmentRow {
  id: string;
  quiz_id: string;
  due_date: string | null;
  classes: { name: string } | null;
  quizzes: { id: string; title: string; type: string } | null;
}

function formatDueDateShort(isoDate: string | null) {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(parsed);
}

export async function StudentDashboard({
  userId,
  planKey,
  cefrLevel,
  messages,
  nextLesson,
  upcomingLessons,
  todayIso,
  lessonBalances,
}: {
  userId: string;
  planKey?: string | null;
  cefrLevel?: string | null;
  messages: AppMessages;
  nextLesson: StudentNextLesson | null;
  upcomingLessons: StudentNextLesson[];
  todayIso: string;
  lessonBalances: StudentLessonBalanceItem[];
}) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const plan = await getPlan(planKey);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const nowIso = new Date().toISOString();

  const [
    { count: monthlyQuizCount },
    { data: attemptRows },
    { data: wordMasteryRowsData, count: wordMasteryCount },
    { data: membershipRows },
    progressSnapshot,
    publishedTutorTimeAdjustment,
  ] = await Promise.all([
    supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", userId)
      .is("deleted_at", null)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("quiz_attempts")
      .select("quiz_id, completed_at")
      .eq("student_id", userId)
      .order("completed_at", { ascending: false }),
    supabaseAdmin
      .from("word_mastery")
      .select("id, term, mastery_level, next_review, source_lesson_id, created_at", {
        count: "exact",
      })
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabaseAdmin
      .from("class_members")
      .select("class_id")
      .eq("student_id", userId),
    getStudentProgressSnapshot(userId),
    getPublishedTutorTimeAdjustment(userId),
  ]);

  const completedQuizIds = new Set(
    ((attemptRows ?? []) as Array<{ quiz_id: string; completed_at: string }>)
      .map((row) => row.quiz_id)
      .filter(Boolean),
  );

  const classIds = (
    (membershipRows ?? []) as Array<{ class_id: string }>
  ).map((row) => row.class_id);

  let pendingAssignments: StudentPendingAssignmentRow[] = [];
  if (classIds.length > 0) {
    const { data: assignmentRows } = await supabaseAdmin
      .from("assignments")
      .select("id, quiz_id, due_date, classes(name), quizzes(id, title, type)")
      .in("class_id", classIds)
      .order("created_at", { ascending: false })
      .limit(20);

    pendingAssignments = (
      (assignmentRows ?? []) as StudentPendingAssignmentRow[]
    ).filter(
      (assignment) =>
        assignment.quizzes?.id && !completedQuizIds.has(assignment.quiz_id),
    );
  }

  const wordMasteryRows = (wordMasteryRowsData ??
    []) as StudentWordMasterySummaryRow[];
  const totalWordsTracked = wordMasteryCount ?? wordMasteryRows.length;

  let dueWordsCount = 0;
  let masteredWordsCount = 0;
  for (const row of wordMasteryRows) {
    if (row.next_review && row.next_review <= nowIso) {
      dueWordsCount += 1;
    }
    if ((row.mastery_level ?? 0) >= 5) {
      masteredWordsCount += 1;
    }
  }

  const latestLessonRow = wordMasteryRows.find((row) =>
    Boolean(row.source_lesson_id),
  );
  const latestLessonId = latestLessonRow?.source_lesson_id ?? null;
  const latestLessonWordsAll = latestLessonId
    ? wordMasteryRows.filter((row) => row.source_lesson_id === latestLessonId)
    : [];
  const latestLessonPreviewTerms = Array.from(
    new Set(latestLessonWordsAll.map((row) => row.term.trim()).filter(Boolean)),
  ).slice(0, 4);

  const effectiveProgressSnapshot =
    publishedTutorTimeAdjustment != null
      ? applyTutorTimeAdjustmentToSnapshot(
          progressSnapshot,
          publishedTutorTimeAdjustment,
        )
      : progressSnapshot;

  const quizLimit = plan.quizzesPerMonth;
  const usedQuizzes = monthlyQuizCount ?? 0;
  const quizPercentage = pct(usedQuizzes, quizLimit);
  const showQuotaWarning = isFinite(quizLimit) && quizPercentage >= 85;
  const remainingQuizzes = Math.max(0, quizLimit - usedQuizzes);

  const dayStreak = calculateDayStreak(
    (attemptRows ?? []).map((attempt) => attempt.completed_at),
  );

  const overallScore = effectiveProgressSnapshot.overallPerformance.score;
  const performanceBand =
    PERFORMANCE_BAND_STYLES[effectiveProgressSnapshot.overallPerformance.band];

  return (
    <div className="space-y-6">
      {/* Row 1: Hero Next Lesson & Remaining Balance */}
      <StudentGoogleMeetBanner
        nextLesson={nextLesson}
        upcomingLessons={upcomingLessons}
        todayIso={todayIso}
        lessonBalances={lessonBalances}
      />

      {/* Conditional Strip: Tutor-Assigned Homework (only when pending) */}
      {pendingAssignments.length > 0 ? (
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    Assigned by Tutor
                  </span>
                  <Badge
                    variant="secondary"
                    className="h-5 px-2 text-[11px] font-semibold tabular-nums"
                  >
                    {pendingAssignments.length} pending
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {pendingAssignments
                    .slice(0, 2)
                    .map((a) => {
                      const due = formatDueDateShort(a.due_date);
                      return `${a.quizzes?.title ?? "Quiz"}${due ? ` (due ${due})` : ""}`;
                    })
                    .join(" · ")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {pendingAssignments.slice(0, 2).map((assignment) => (
                <Button
                  key={assignment.id}
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-8 bg-background/80 text-xs"
                >
                  <Link href={`/quizzes/${assignment.quiz_id}`} prefetch={false}>
                    Start: {assignment.quizzes?.title ?? "Quiz"}
                  </Link>
                </Button>
              ))}
              {pendingAssignments.length > 2 ? (
                <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                  <Link href="/assignments" prefetch={false}>
                    View all
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Row 2: Two Clear Study Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Card A: Primary CTA — Daily Practice / Review */}
        <Card
          data-tour-id="student-review-activity"
          className="flex flex-col border-primary/30 bg-card shadow-xs"
        >
          <CardHeader className="flex flex-row items-start gap-3 pb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {messages.dashboard.student.reviewTitle}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "tabular-nums text-[11px] font-semibold",
                    dueWordsCount > 0
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  {dueWordsCount > 0
                    ? `${dueWordsCount} ${dueWordsCount === 1 ? "word" : "words"} due`
                    : totalWordsTracked > 0
                      ? "All caught up"
                      : "Ready to start"}
                </Badge>
              </div>
              <CardDescription>
                {messages.dashboard.student.reviewDescription}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="flex-1 pb-4">
            {latestLessonPreviewTerms.length > 0 ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>
                    From your last lesson ({latestLessonWordsAll.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {latestLessonPreviewTerms.map((term) => (
                    <span
                      key={term}
                      className="rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground ring-1 ring-border/60"
                    >
                      {term}
                    </span>
                  ))}
                  {latestLessonWordsAll.length > latestLessonPreviewTerms.length ? (
                    <span className="px-1 py-0.5 text-xs text-muted-foreground">
                      +{latestLessonWordsAll.length - latestLessonPreviewTerms.length} more
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="mt-auto pt-0">
            <Button asChild className="w-full">
              <Link href="/quizzes/review" prefetch={false}>
                {messages.dashboard.student.startReviewButton}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Card B: Secondary CTA — Create Custom Quiz */}
        <Card
          data-tour-id="student-new-quiz"
          className="flex flex-col border-border/70 bg-card shadow-xs"
        >
          <CardHeader className="flex flex-row items-start gap-3 pb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-base">
                {messages.dashboard.student.newQuizTitle}
              </CardTitle>
              <CardDescription>
                {messages.dashboard.student.newQuizDescription}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="flex-1 pb-4">
            {showQuotaWarning ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <Link
                  href="/billing"
                  prefetch={false}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {messages.dashboard.student.remainingThisMonth(remainingQuizzes)}
                </Link>
              </p>
            ) : null}
          </CardContent>

          <CardFooter className="mt-auto pt-0">
            <Button asChild variant="outline" className="w-full">
              <Link href="/quizzes/new" prefetch={false}>
                {messages.dashboard.student.createQuizButton}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Row 3: Compact 3-Tile Progress Strip */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Tile 1: Day Streak */}
        <Card
          data-tour-id="student-day-streak"
          className="border-border/70 bg-card/70 shadow-xs"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {messages.dashboard.student.dayStreakTitle}
            </CardTitle>
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md",
                dayStreak > 0
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Flame className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{dayStreak}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {dayStreak > 0
                ? messages.dashboard.student.consecutiveDays(dayStreak)
                : "Complete a quick practice to start"}
            </p>
          </CardContent>
        </Card>

        {/* Tile 2: Vocabulary Deck */}
        <Card
          data-tour-id="student-total-words"
          className="border-border/70 bg-card/70 shadow-xs"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {messages.dashboard.student.totalWordsTitle}
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/10 text-sky-500">
              <BookOpen className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-bold tabular-nums">
                {totalWordsTracked}
              </div>
              <Link
                href="/mastery"
                prefetch={false}
                className="text-xs font-medium text-primary hover:underline"
              >
                View deck
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {masteredWordsCount} mastered · {dueWordsCount} due
            </p>
          </CardContent>
        </Card>

        {/* Tile 3: Level & Progress */}
        <Card className="border-border/70 bg-card/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {messages.nav.progress}
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
              <Trophy className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {cefrLevel ? (
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {cefrLevel}
                  </Badge>
                ) : null}
                <span className="text-2xl font-bold tabular-nums">
                  {overallScore}
                  <span className="text-sm font-normal text-muted-foreground">
                    /100
                  </span>
                </span>
              </div>
              {performanceBand ? (
                <Badge
                  variant="outline"
                  className={cn("text-[11px]", performanceBand.badgeClassName)}
                >
                  {performanceBand.label}
                </Badge>
              ) : (
                <Link
                  href="/progress#overall-performance"
                  prefetch={false}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Details
                </Link>
              )}
            </div>
            <Progress value={overallScore} className="h-1.5" />
            {performanceBand ? (
              <div className="flex justify-end">
                <Link
                  href="/progress#overall-performance"
                  prefetch={false}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View progress
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
