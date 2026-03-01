import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  TrendingUp,
  Trophy,
  Target,
  BookOpen,
  Flame,
  PlusCircle,
} from "lucide-react";
import { ACTIVITY_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get all attempts with quiz info
  const { data: attempts, error: attemptsError } = await supabase
    .from("quiz_attempts")
    .select("*, quizzes(title, type, cefr_level, vocabulary_terms)")
    .eq("student_id", user.id)
    .order("completed_at", { ascending: false });

  if (attemptsError) {
    console.error("Failed to load progress:", attemptsError);
  }

  const { count: quizCount } = await supabase
    .from("quizzes")
    .select("*", { count: "exact", head: true })
    .eq("creator_id", user.id);

  if (!attempts || attempts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
          <p className="text-muted-foreground">
            Track your vocabulary learning journey and quiz performance.
          </p>
        </div>

        <Card>
          <CardHeader className="items-center text-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No progress data yet</CardTitle>
            <CardDescription>
              Complete some quizzes to start tracking your learning progress and
              see your improvement over time.
            </CardDescription>
            <Button asChild className="mt-4">
              <Link href="/quizzes/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create a Quiz
              </Link>
            </Button>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Calculate stats
  const totalAttempts = attempts.length;
  const scoredAttempts = attempts.filter(
    (a) => a.score !== null && a.max_score !== null && a.max_score > 0,
  );
  const avgScore =
    scoredAttempts.length > 0
      ? Math.round(
          scoredAttempts.reduce(
            (sum, a) => sum + (a.score! / a.max_score!) * 100,
            0,
          ) / scoredAttempts.length,
        )
      : 0;

  // Best score
  const bestScore =
    scoredAttempts.length > 0
      ? Math.round(
          Math.max(
            ...scoredAttempts.map((a) => (a.score! / a.max_score!) * 100),
          ),
        )
      : 0;

  // Per type breakdown
  const typeStats = new Map<string, { count: number; totalPct: number }>();
  for (const a of scoredAttempts) {
    const quizData = a.quizzes as unknown as { type: string } | null;
    const type = quizData?.type || "unknown";
    const pct = (a.score! / a.max_score!) * 100;
    const existing = typeStats.get(type) || { count: 0, totalPct: 0 };
    typeStats.set(type, {
      count: existing.count + 1,
      totalPct: existing.totalPct + pct,
    });
  }

  // Streak: count consecutive days with attempts
  const uniqueDays = new Set(
    attempts.map((a) => new Date(a.completed_at).toISOString().split("T")[0]),
  );
  const today = new Date().toISOString().split("T")[0];
  let streak = 0;
  const checkDate = new Date();
  while (true) {
    const dateStr = checkDate.toISOString().split("T")[0];
    if (uniqueDays.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (dateStr === today) {
      // Today hasn't had an attempt yet, check yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Total unique terms practiced — from word_mastery table
  const supabaseAdmin = createAdminClient();
  const { data: masteryRows } = await supabaseAdmin
    .from("word_mastery")
    .select("mastery_level")
    .eq("student_id", user.id);
  const totalWords = masteryRows?.length ?? 0;
  const masteredWords = masteryRows?.filter((r) => r.mastery_level >= 4).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground">
          Track your vocabulary learning journey and quiz performance.
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgScore}%</div>
            <Progress value={avgScore} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Best Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bestScore}%</div>
            <Progress value={bestScore} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Day Streak</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{streak}</div>
            <p className="text-xs text-muted-foreground">
              consecutive day{streak !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Words Practiced
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWords}</div>
            <p className="text-xs text-muted-foreground">
              {masteredWords} mastered &middot; {quizCount ?? 0} quizzes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-type breakdown */}
      {typeStats.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance by Activity</CardTitle>
            <CardDescription>
              Your average scores broken down by activity type
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from(typeStats.entries()).map(([type, stats]) => {
              const avg = Math.round(stats.totalPct / stats.count);
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {ACTIVITY_LABELS[type] || type}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {stats.count} attempt{stats.count !== 1 ? "s" : ""}
                      </Badge>
                      <span
                        className={
                          avg >= 80
                            ? "text-green-600"
                            : avg >= 50
                              ? "text-orange-600"
                              : "text-red-600"
                        }
                      >
                        {avg}%
                      </span>
                    </div>
                  </div>
                  <Progress value={avg} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent attempts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Attempts</CardTitle>
          <CardDescription>
            Your last {Math.min(attempts.length, 10)} quiz attempts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {attempts.slice(0, 10).map((attempt, i) => {
            const quizData = attempt.quizzes as unknown as {
              title: string;
              type: string;
            } | null;
            const pct =
              attempt.score !== null &&
              attempt.max_score !== null &&
              attempt.max_score > 0
                ? Math.round((attempt.score / attempt.max_score) * 100)
                : null;
            return (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-md bg-muted"
              >
                <div>
                  <p className="text-sm font-medium">
                    {quizData?.title ?? "Untitled Quiz"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ACTIVITY_LABELS[quizData?.type || ""] || quizData?.type}{" "}
                    &middot;{" "}
                    {new Date(attempt.completed_at).toLocaleDateString("en-US")}
                  </p>
                </div>
                {pct !== null && (
                  <Badge
                    variant="outline"
                    className={
                      pct >= 80
                        ? "text-green-600"
                        : pct >= 50
                          ? "text-orange-600"
                          : "text-red-600"
                    }
                  >
                    {pct}%
                  </Badge>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
