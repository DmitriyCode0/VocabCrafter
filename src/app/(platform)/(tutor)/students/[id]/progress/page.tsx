import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Flame,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";
import { getStudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import { parseTutorProgressOverride } from "@/lib/progress/contracts";
import { TutorStudentProgressWorkspace } from "@/components/progress/tutor-student-progress-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ACTIVITY_LABELS } from "@/lib/constants";
import { formatAppDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function TutorStudentProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const supabaseAdmin = createAdminClient();
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    (profile.role !== "tutor" && profile.role !== "superadmin")
  ) {
    redirect("/dashboard");
  }

  if (profile.role !== "superadmin") {
    const hasAccess = await tutorHasStudentAccess(
      supabaseAdmin,
      user.id,
      studentId,
    );

    if (!hasAccess) {
      redirect("/students");
    }
  }

  const [studentProfileResult, overrideResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", studentId)
      .single(),
    supabaseAdmin
      .from("tutor_student_progress_overrides")
      .select("axis_overrides, insights_override")
      .eq("tutor_id", user.id)
      .eq("student_id", studentId)
      .maybeSingle(),
  ]);

  if (studentProfileResult.error || !studentProfileResult.data) {
    redirect("/students");
  }

  const snapshot = await getStudentProgressSnapshot(studentId);
  const hasAnyRawData =
    snapshot.overview.totalAttempts > 0 || snapshot.overview.totalWords > 0;
  const initialOverride = parseTutorProgressOverride(overrideResult.data);
  const studentName =
    studentProfileResult.data.full_name ||
    studentProfileResult.data.email ||
    "Student";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Button
            asChild
            variant="ghost"
            className="w-fit px-0 text-muted-foreground"
          >
            <Link href="/students">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to My Students
            </Link>
          </Button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {studentName}
              </h1>
              <Badge variant="outline">Tutor Progress View</Badge>
              <Badge variant="secondary">
                Target {snapshot.profile.cefrLevel}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Review this student&apos;s computed learning profile, then curate
              your own coaching version of the radar metrics and AI suggestions.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {snapshot.profile.targetLanguageLabel}
          </Badge>
          <Badge variant="outline">
            Source {snapshot.profile.sourceLanguageLabel}
          </Badge>
        </div>
      </div>

      <TutorStudentProgressWorkspace
        studentId={studentId}
        studentName={studentName}
        baseAxes={snapshot.axes}
        cefrLevel={snapshot.profile.cefrLevel}
        grammarNotice={snapshot.grammar.betaNotice}
        hasData={hasAnyRawData}
        initialOverride={initialOverride}
      />

      {!hasAnyRawData ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              No raw progress data yet
            </CardTitle>
            <CardDescription>
              This student has not built enough quiz or vocabulary history to
              populate the raw overview cards yet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
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
                <Progress
                  value={snapshot.overview.avgScore}
                  className="mt-2 h-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Mastery
                </CardTitle>
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
                <CardTitle className="text-sm font-medium">
                  Day Streak
                </CardTitle>
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
                <CardTitle className="text-sm font-medium">
                  Unique Words
                </CardTitle>
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
                    {snapshot.overview.grammarCoveredCount}/
                    {snapshot.overview.grammarAvailableCount}
                  </div>
                  <Badge variant="secondary">Beta</Badge>
                </div>
                <Progress
                  value={
                    snapshot.overview.grammarAvailableCount > 0
                      ? (snapshot.overview.grammarCoveredCount /
                          snapshot.overview.grammarAvailableCount) *
                        100
                      : 0
                  }
                  className="mt-2 h-2"
                />
              </CardContent>
            </Card>
          </div>

          {snapshot.activityStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Raw Performance by Activity
                </CardTitle>
                <CardDescription>
                  The student&apos;s recorded scores broken down by activity
                  type.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {snapshot.activityStats.map((activity) => (
                  <div key={activity.type} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{activity.label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {activity.count} attempt
                          {activity.count !== 1 ? "s" : ""}
                        </Badge>
                        <span
                          className={
                            activity.averageScore >= 80
                              ? "text-green-600"
                              : activity.averageScore >= 50
                                ? "text-orange-600"
                                : "text-red-600"
                          }
                        >
                          {activity.averageScore}%
                        </span>
                      </div>
                    </div>
                    <Progress value={activity.averageScore} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {snapshot.recentAttempts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Attempts</CardTitle>
                <CardDescription>
                  The last {snapshot.recentAttempts.length} recorded quiz
                  attempts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {snapshot.recentAttempts.map((attempt) => (
                  <div
                    key={`${attempt.title}-${attempt.completedAt}`}
                    className="flex items-center justify-between rounded-md bg-muted p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{attempt.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACTIVITY_LABELS[attempt.type] || attempt.type} &middot;{" "}
                        {formatAppDate(attempt.completedAt)}
                      </p>
                    </div>
                    {attempt.scorePercent !== null && (
                      <Badge
                        variant="outline"
                        className={
                          attempt.scorePercent >= 80
                            ? "text-green-600"
                            : attempt.scorePercent >= 50
                              ? "text-orange-600"
                              : "text-red-600"
                        }
                      >
                        {attempt.scorePercent}%
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
