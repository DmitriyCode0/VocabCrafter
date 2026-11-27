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
import { Button } from "@/components/ui/button";
import {
  CustomizableDashboard,
  DashboardCustomizableItem,
} from "@/components/dashboard/customizable-dashboard";
import { StudentOverallPerformanceCard } from "@/components/progress/student-overall-performance-card";
import Link from "next/link";
import {
  BookOpen,
  BookMarked,
  Flame,
  PlusCircle,
  Target,
} from "lucide-react";
import { fmtLimit } from "@/lib/plans";
import { getPlan } from "@/lib/plans-server";
import {
  AnimatedCard,
} from "@/components/ui/animated-dashboard";
import { calculateDayStreak } from "@/lib/history/calculate-day-streak";
import {
  applyTutorTimeAdjustmentToSnapshot,
  getStudentProgressSnapshot,
} from "@/lib/progress/profile-metrics";
import { getPublishedTutorTimeAdjustment } from "@/lib/progress/published-tutor-time-adjustment";
import {
  StudentGoogleMeetBanner,
  type StudentNextLesson,
} from "@/components/dashboard/student-google-meet-banner";
import type { AppMessages } from "@/lib/i18n/messages";

function pct(used: number, total: number) {
  if (!isFinite(total) || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

export async function StudentDashboard({
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

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayIso = `${year}-${month}-${day}`;
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  const [
    { count: monthlyQuizCount },
    { data: attemptRows },
    { count: totalWordsTracked },
    progressSnapshot,
    publishedTutorTimeAdjustment,
    { data: upcomingLessonRows },
  ] = await Promise.all([
    supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", userId)
      .is("deleted_at", null)
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
    getStudentProgressSnapshot(userId),
    getPublishedTutorTimeAdjustment(userId),
    supabaseAdmin
      .from("tutor_student_lessons")
      .select(
        "id, title, lesson_date, start_time, end_time, time_zone, start_at, end_at, status, meet_url, tutor_profile:profiles!tutor_student_lessons_tutor_id_fkey(full_name, email)",
      )
      .eq("student_id", userId)
      .eq("status", "planned")
      .gte("lesson_date", yesterdayIso)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(8),
  ]);

  const upcomingLessons: StudentNextLesson[] = (
    (upcomingLessonRows ?? []) as Array<{
      id: string;
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
    }>
  ).map((row) => ({
    id: row.id,
    title: row.title,
    lessonDate: row.lesson_date,
    startTime: row.start_time,
    endTime: row.end_time,
    timeZone: row.time_zone ?? null,
    startAt: row.start_at ?? null,
    endAt: row.end_at ?? null,
    status: row.status,
    meetUrl: row.meet_url,
    tutorName: row.tutor_profile?.full_name || row.tutor_profile?.email || "Tutor",
  }));

  const nextLesson: StudentNextLesson | null = upcomingLessons[0] ?? null;

  const effectiveProgressSnapshot = publishedTutorTimeAdjustment != null
    ? applyTutorTimeAdjustmentToSnapshot(
        progressSnapshot,
        publishedTutorTimeAdjustment,
      )
    : progressSnapshot;

  const quizLimit = plan.quizzesPerMonth;
  const quizPercentage = pct(monthlyQuizCount ?? 0, quizLimit);
  const isQuizWarning = quizPercentage >= 80;
  const isQuizOver = quizPercentage >= 100;
  const dayStreak = calculateDayStreak(
    (attemptRows ?? []).map((attempt) => attempt.completed_at),
  );

  return (
    <div className="space-y-6">
      <StudentGoogleMeetBanner
        nextLesson={nextLesson}
        upcomingLessons={upcomingLessons}
        todayIso={todayIso}
      />

      <CustomizableDashboard
        storageKey={`vocab-crafter.dashboard-layout:student:${userId}`}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <DashboardCustomizableItem
          id="new-quiz"
          title={messages.dashboard.student.newQuizTitle}
        >
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
                  <Link href="/quizzes/new" prefetch={false}>
                    {messages.dashboard.student.createQuizButton}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="review-activity"
          title={messages.dashboard.student.reviewTitle}
        >
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
                  <Link href="/quizzes/review" prefetch={false}>
                    {messages.dashboard.student.startReviewButton}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="passive-recognition"
          title={messages.dashboard.student.passiveTitle}
        >
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
                  <Link href="/vocabulary" prefetch={false}>
                    {messages.dashboard.student.passiveButton}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="quizzes-created"
          title={messages.dashboard.student.quizzesCreatedTitle}
        >
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
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="day-streak"
          title={messages.dashboard.student.dayStreakTitle}
        >
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
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="overall-progress"
          title={messages.nav.progress}
        >
          <AnimatedCard>
            <StudentOverallPerformanceCard
              snapshot={effectiveProgressSnapshot}
              href="/progress#overall-performance"
              ctaLabel={messages.nav.progress}
            />
          </AnimatedCard>
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="total-words"
          title={messages.dashboard.student.totalWordsTitle}
        >
          <AnimatedCard>
            <Card data-tour-id="student-total-words">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {messages.dashboard.student.totalWordsTitle}
                </CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalWordsTracked ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {messages.dashboard.student.totalWordsDescription}
                </p>
              </CardContent>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>
      </CustomizableDashboard>
    </div>
  );
}
