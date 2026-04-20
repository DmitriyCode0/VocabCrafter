import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { StudentSkillRadar } from "@/components/progress/student-skill-radar";
import { StudentProgressInsights } from "@/components/progress/student-progress-insights";
import {
  TrendingUp,
  Target,
  BookOpen,
  Flame,
  PlusCircle,
  Trophy,
} from "lucide-react";
import { getStudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import {
  applyTutorAxisOverrides,
  buildChartDataFromAxes,
  parseProgressInsightsValue,
} from "@/lib/progress/contracts";
import { getPublishedTutorProgressOverride } from "@/lib/progress/published-tutor-override";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [snapshot, savedInsightsResult, publishedTutorOverride] =
    await Promise.all([
      getStudentProgressSnapshot(user.id),
      supabase
        .from("student_progress_insights")
        .select("insights")
        .eq("user_id", user.id)
        .maybeSingle(),
      getPublishedTutorProgressOverride(user.id),
    ]);
  const savedInsights = parseProgressInsightsValue(
    savedInsightsResult.data?.insights,
  );
  const effectiveAxes = publishedTutorOverride
    ? applyTutorAxisOverrides(
        snapshot.axes,
        publishedTutorOverride.override.axisOverrides,
      )
    : snapshot.axes;
  const effectiveChartData = buildChartDataFromAxes(effectiveAxes);
  const displayedInsights =
    publishedTutorOverride?.override.insightsOverride ?? savedInsights;
  const hasAnyData =
    snapshot.overview.totalAttempts > 0 ||
    snapshot.overview.totalWords > 0 ||
    snapshot.passiveSignals.uniqueItems > 0 ||
    Boolean(publishedTutorOverride);

  if (!hasAnyData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
          <p className="text-muted-foreground">
            Track your learning profile, vocabulary growth, and quiz
            performance.
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
          </CardHeader>
          <CardFooter className="flex-col justify-center gap-3 pb-12 sm:flex-row">
            <Button asChild className="w-full max-w-xs">
              <Link href="/quizzes/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create a Quiz
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full max-w-xs">
              <Link href="/vocabulary">
                <BookOpen className="mr-2 h-4 w-4" />
                Open Vocab Mastery
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground">
          Track your learning profile, vocabulary growth, and quiz performance.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <StudentSkillRadar
          axes={effectiveAxes}
          chartData={effectiveChartData}
          cefrLevel={snapshot.profile.cefrLevel}
          grammarNotice={snapshot.grammar.betaNotice}
          grammarTopics={snapshot.grammarTopicMastery}
        />
        <StudentProgressInsights
          hasData={hasAnyData}
          initialInsights={displayedInsights}
          isTutorVersion={Boolean(
            publishedTutorOverride?.override.insightsOverride,
          )}
          sourceLabel={publishedTutorOverride?.tutorName}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.overview.avgScore}%
            </div>
            <Progress value={snapshot.overview.avgScore} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Mastery</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.overview.avgMasteryLevel.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              out of 5 mastery levels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Day Streak</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.overview.streakDays}
            </div>
            <p className="text-xs text-muted-foreground">
              consecutive day{snapshot.overview.streakDays !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unique Words</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.overview.totalWords}
            </div>
            <p className="text-xs text-muted-foreground">
              {snapshot.overview.masteredWords} mastered words
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Grammar Topics
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {snapshot.overview.grammarMasteredCount}/
                {snapshot.overview.grammarAvailableCount}
              </div>
            </div>
            <Progress
              value={
                snapshot.overview.grammarAvailableCount > 0
                  ? (snapshot.overview.grammarMasteredCount /
                      snapshot.overview.grammarAvailableCount) *
                    100
                  : 0
              }
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
