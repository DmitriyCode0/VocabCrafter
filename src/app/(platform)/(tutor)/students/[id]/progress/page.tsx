import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  Flame,
  Star,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TutorProgressReviewForm } from "@/components/progress/tutor-progress-review-form";
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
import { formatAppDate } from "@/lib/dates";
import { PASSIVE_EQUIVALENT_WORDS_EXPLANATION } from "@/lib/mastery/passive-vocabulary";
import { parseTutorProgressOverride } from "@/lib/progress/contracts";
import { getStudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";

export const dynamic = "force-dynamic";

interface StudentProgressReviewRow {
  id: string;
  tutor_id: string;
  content: string;
  rating: number | null;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string | null;
    email: string;
  } | null;
}

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

  const [
    studentProfileResult,
    overrideResult,
    progressReviewsResult,
  ] = await Promise.all([
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
    supabaseAdmin
      .from("student_progress_reviews")
      .select(
        "id, tutor_id, content, rating, created_at, updated_at, profiles!student_progress_reviews_tutor_id_fkey(full_name, email)",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
  ]);

  if (studentProfileResult.error || !studentProfileResult.data) {
    redirect("/students");
  }

  const snapshot = await getStudentProgressSnapshot(studentId);
  const hasAnyRawData =
    snapshot.overview.totalAttempts > 0 ||
    snapshot.overview.totalWords > 0 ||
    snapshot.passiveSignals.uniqueItems > 0;
  const initialOverride = parseTutorProgressOverride(overrideResult.data);
  const progressReviews = (progressReviewsResult.data ??
    []) as StudentProgressReviewRow[];
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
              your own coaching version of the radar metrics, AI suggestions,
              and progress comments.
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
        grammarTopicMastery={snapshot.grammarTopicMastery}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Progress Reviews & Comments
            </CardTitle>
            <CardDescription>
              Tutors can leave progress reviews, coaching notes, and comments
              about how {studentName} is developing over time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {progressReviews.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No progress reviews yet.
              </div>
            ) : (
              progressReviews.map((review) => {
                const authorName =
                  review.profiles?.full_name ||
                  review.profiles?.email ||
                  "Tutor";

                return (
                  <div
                    key={review.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{authorName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatAppDate(review.created_at)}
                        </p>
                      </div>
                      {review.rating ? (
                        <Badge variant="outline">
                          {"★".repeat(review.rating)}
                          {"☆".repeat(5 - review.rating)}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {review.content}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <TutorProgressReviewForm
          studentId={studentId}
          studentName={studentName}
        />
      </div>

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
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Passive Evidence
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.passiveSignals.uniqueItems}
            </div>
            <p className="text-xs text-muted-foreground">
              words and phrases tracked as recognition only
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Equivalent Words
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.passiveSignals.equivalentWordCount}
            </div>
            <p className="text-xs text-muted-foreground">
              level-adjusted recognition-weighted total used in passive-vocabulary estimates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">What It Means</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {PASSIVE_EQUIVALENT_WORDS_EXPLANATION}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookMarked className="h-5 w-5 text-primary" />
            Passive Vocabulary
          </CardTitle>
          <CardDescription>
            Import passive-recognition evidence and review the latest library-tagged passive words on the dedicated passive-vocabulary page for {studentName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {snapshot.passiveSignals.uniqueItems} passive items
                </Badge>
                <Badge variant="outline">
                  {snapshot.passiveSignals.equivalentWordCount} equivalent words
                </Badge>
                <Badge variant="secondary">Target {snapshot.profile.cefrLevel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {PASSIVE_EQUIVALENT_WORDS_EXPLANATION}
              </p>
            </div>

            <Button asChild variant="outline" id="passive-recognition">
              <Link href={`/passive-vocabulary?student=${studentId}`}>
                Open Passive Vocabulary
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
