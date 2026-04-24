import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  FileText,
  Flame,
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
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { formatDateForAppLanguage } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/messages";
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
    .select("role, app_language")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    (profile.role !== "tutor" && profile.role !== "superadmin")
  ) {
    redirect("/dashboard");
  }

  const appLanguage = normalizeAppLanguage(profile.app_language);
  const messages = getAppMessages(appLanguage);

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

  const [studentProfileResult, overrideResult, progressReviewsResult] =
    await Promise.all([
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
    messages.tutorProgressPage.studentFallback;

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
              {messages.tutorProgressPage.backToStudents}
            </Link>
          </Button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {studentName}
              </h1>
              <Badge variant="outline">
                {messages.tutorProgressPage.tutorView}
              </Badge>
              <Badge variant="secondary">
                {messages.tutorProgressPage.targetLabel(
                  snapshot.profile.cefrLevel,
                )}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {messages.tutorProgressPage.description(studentName)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/plans-and-reports?student=${studentId}`}>
              <Target className="mr-2 h-4 w-4" />
              Plan
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/plans-and-reports/reports?student=${studentId}`}>
              <FileText className="mr-2 h-4 w-4" />
              Monthly Reports
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/results?student=${studentId}`}>
              {messages.tutorProgressPage.viewProgress}
            </Link>
          </Button>
          <Badge variant="outline">
            {snapshot.profile.targetLanguageLabel}
          </Badge>
          <Badge variant="outline">
            {messages.tutorProgressPage.sourceLabel(
              snapshot.profile.sourceLanguageLabel,
            )}
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
              {messages.tutorProgressPage.progressReviewsTitle}
            </CardTitle>
            <CardDescription>
              {messages.tutorProgressPage.progressReviewsDescription(
                studentName,
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {progressReviews.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {messages.tutorProgressPage.noProgressReviews}
              </div>
            ) : (
              progressReviews.map((review) => {
                const authorName =
                  review.profiles?.full_name ||
                  review.profiles?.email ||
                  messages.tutorProgressPage.tutorFallback;

                return (
                  <div
                    key={review.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{authorName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateForAppLanguage(
                            appLanguage,
                            review.created_at,
                          )}
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
              {messages.tutorProgressPage.noRawDataTitle}
            </CardTitle>
            <CardDescription>
              {messages.tutorProgressPage.noRawDataDescription}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.tutorProgressPage.avgScore}
              </CardTitle>
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
                {messages.tutorProgressPage.avgMastery}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {snapshot.overview.avgMasteryLevel.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">
                {messages.tutorProgressPage.outOfFive}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.tutorProgressPage.dayStreak}
              </CardTitle>
              <Flame className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {snapshot.overview.streakDays}
              </div>
              <p className="text-xs text-muted-foreground">
                {messages.tutorProgressPage.consecutiveDays(
                  snapshot.overview.streakDays,
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.tutorProgressPage.uniqueWords}
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {snapshot.overview.totalWords}
              </div>
              <p className="text-xs text-muted-foreground">
                {messages.tutorProgressPage.masteredWords(
                  snapshot.overview.masteredWords,
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.tutorProgressPage.grammarTopics}
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
              {messages.tutorProgressPage.passiveEvidence}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.passiveSignals.uniqueItems}
            </div>
            <p className="text-xs text-muted-foreground">
              {messages.tutorProgressPage.passiveEvidenceDescription}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.tutorProgressPage.equivalentWords}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.passiveSignals.equivalentWordCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {messages.tutorProgressPage.equivalentWordsDescription}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.tutorProgressPage.whatItMeans}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {messages.tutorProgressPage.passiveExplanation}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookMarked className="h-5 w-5 text-primary" />
            {messages.tutorProgressPage.passiveVocabularyTitle}
          </CardTitle>
          <CardDescription>
            {messages.tutorProgressPage.passiveVocabularyDescription(
              studentName,
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {messages.tutorProgressPage.passiveItems(
                    snapshot.passiveSignals.uniqueItems,
                  )}
                </Badge>
                <Badge variant="outline">
                  {messages.tutorProgressPage.equivalentWordsBadge(
                    snapshot.passiveSignals.equivalentWordCount,
                  )}
                </Badge>
                <Badge variant="secondary">
                  {messages.tutorProgressPage.targetLabel(
                    snapshot.profile.cefrLevel,
                  )}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {messages.tutorProgressPage.passiveExplanation}
              </p>
            </div>

            <Button asChild variant="outline" id="passive-recognition">
              <Link href={`/passive-vocabulary?student=${studentId}`}>
                {messages.tutorProgressPage.openPassiveVocabulary}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
