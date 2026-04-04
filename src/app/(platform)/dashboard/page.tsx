import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
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
import { formatAppMonthName } from "@/lib/dates";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {profile.full_name || profile.email}
        </h1>
        <p className="text-muted-foreground">
          {role === "student" &&
            "Practice vocabulary, take quizzes, and track your progress."}
          {role === "tutor" &&
            "Manage your classes, assign quizzes, and review student work."}
          {role === "superadmin" &&
            "Monitor platform analytics and manage users."}
        </p>
      </div>

      {role === "student" && (
        <StudentDashboard userId={user.id} planKey={profile.plan} />
      )}
      {role === "tutor" && (
        <TutorDashboard userId={user.id} planKey={profile.plan} />
      )}
      {role === "superadmin" && <AdminDashboard />}
    </div>
  );
}

async function StudentDashboard({
  userId,
  planKey,
}: {
  userId: string;
  planKey?: string | null;
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
      <AnimatedDashboard className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AnimatedCard>
          <Card data-tour-id="student-new-quiz">
            <CardHeader className="flex flex-row items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">New Quiz</CardTitle>
                <CardDescription>
                  Generate a new AI-powered quiz
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild className="w-full">
                <Link href="/quizzes/new">Create Quiz</Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="student-review-activity">
            <CardHeader className="flex flex-row items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Review Activity</CardTitle>
                <CardDescription>
                  Practice due and least known words
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild variant="outline" className="w-full">
                <Link href="/quizzes/review">Start Review</Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="student-quizzes-created">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Quizzes Created
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
                  ? `${Math.max(0, quizLimit - (monthlyQuizCount ?? 0)).toLocaleString()} remaining this month`
                  : "Unlimited"}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="student-day-streak">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Day Streak</CardTitle>
              <Flame className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dayStreak}</div>
              <p className="text-xs text-muted-foreground">
                consecutive day{dayStreak !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="student-total-words">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Words Tracked
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWordsTracked ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                vocabulary terms in your library
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
}: {
  userId: string;
  planKey?: string | null;
}) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const plan = await getPlan(planKey);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: classes }, { count: monthlyQuizCount }] = await Promise.all([
    supabase.from("classes").select("id").eq("tutor_id", userId),
    supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", userId)
      .gte("created_at", monthStart.toISOString()),
  ]);

  const classIds = classes?.map((classItem) => classItem.id) ?? [];
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

  return (
    <div className="space-y-6">
      <AnimatedDashboard className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnimatedCard>
          <Card data-tour-id="tutor-new-quiz">
            <CardHeader className="flex flex-row items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">New Quiz</CardTitle>
                <CardDescription>
                  Generate a new AI-powered quiz
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild className="w-full">
                <Link href="/quizzes/new">Create Quiz</Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="tutor-review">
            <CardHeader className="flex flex-row items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Review</CardTitle>
                <CardDescription>Review student submissions</CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild variant="outline" className="w-full">
                <Link href="/review">Review Work</Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="tutor-students">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Students</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents}</div>
              <p className="text-xs text-muted-foreground">enrolled students</p>
            </CardContent>
            <CardFooter className="mt-auto justify-center">
              <Button asChild variant="outline" className="w-full">
                <Link href="/students">View Students</Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Quizzes Created
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
                  ? `${Math.max(0, quizLimit - (monthlyQuizCount ?? 0)).toLocaleString()} remaining this month`
                  : "Unlimited"}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>
      </AnimatedDashboard>
    </div>
  );
}

async function AdminDashboard() {
  const supabaseAdmin = createAdminClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthISO = monthStart.toISOString();
  const monthLabel = formatAppMonthName(new Date());

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
                Quizzes Created
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(totalQuizCount ?? 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {(monthlyQuizCount ?? 0).toLocaleString()} created this month
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-text-requests">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Text Requests
              </CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {textRequestCount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatApproxUsd(textCost)} tracked in {monthLabel}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-tts-requests">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                TTS Requests
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {ttsRequestCount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatApproxUsd(ttsCost)} tracked in {monthLabel}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-tracked-cost">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Tracked Cost
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatApproxUsd(totalTrackedCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {trackedRequestCount.toLocaleString()} tracked AI requests in{" "}
                {monthLabel}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-total-users">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">registered users</p>
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
                <CardTitle className="text-base">Analytics</CardTitle>
                <CardDescription>Platform usage and metrics</CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild className="w-full">
                <Link href="/analytics">View Analytics</Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-users">
            <CardHeader className="flex flex-row items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Users</CardTitle>
                <CardDescription>Manage platform users</CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild variant="outline" className="w-full">
                <Link href="/users">Manage Users</Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>
      </AnimatedDashboard>
    </div>
  );
}
