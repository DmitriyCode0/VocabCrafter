import Link from "next/link";
import {
  BookMarked,
  BookOpen,
  Flame,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppMessages } from "@/lib/i18n/messages";
import { parseTutorProgressOverride } from "@/lib/progress/contracts";
import { getStudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import { getTutorProgressPageData } from "@/lib/progress/tutor-progress-page-data";
import { ResultsStudentFilter } from "@/components/progress/results-student-filter";
import { TutorProgressPageHeader } from "@/components/progress/tutor-progress-page-header";
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

export const dynamic = "force-dynamic";

export default async function CoachingResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student: requestedStudentId } = await searchParams;
  const { userId, role, appLanguage, students, activeStudentId, studentProfile } =
    await getTutorProgressPageData(requestedStudentId);
  const messages = getAppMessages(appLanguage);
  const headerActions =
    role === "tutor" && students.length > 0 ? (
      <ResultsStudentFilter
        students={students.map((student) => ({
          id: student.id,
          label: student.full_name || student.email || "Unknown",
        }))}
        activeStudentId={activeStudentId ?? students[0].id}
      />
    ) : null;

  if (!activeStudentId || !studentProfile) {
    return (
      <div className="space-y-6">
        <TutorProgressPageHeader
          currentSection="coaching"
          basePath="/results"
          title={messages.progress.title}
          description={messages.tutorProgressPage.coachingDescription}
          actions={headerActions}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">No student selected</CardTitle>
            <CardDescription>
              {role === "tutor"
                ? "Connect a student first, then choose them here to open their progress view."
                : "Open this page with a student id to review a specific learner's progress."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Coaching is student-specific, so this page always shows one learner
            at a time.
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabaseAdmin = createAdminClient();
  const [overrideResult, snapshot] = await Promise.all([
    supabaseAdmin
      .from("tutor_student_progress_overrides")
      .select("axis_overrides, insights_override")
      .eq("tutor_id", userId)
      .eq("student_id", activeStudentId)
      .maybeSingle(),
    getStudentProgressSnapshot(activeStudentId),
  ]);

  const hasAnyRawData =
    snapshot.overview.totalAttempts > 0 ||
    snapshot.overview.totalWords > 0 ||
    snapshot.passiveSignals.uniqueItems > 0;
  const initialOverride = parseTutorProgressOverride(overrideResult.data);
  const studentName =
    studentProfile.full_name ||
    studentProfile.email ||
    messages.tutorProgressPage.studentFallback;

  return (
    <div className="space-y-6">
      <TutorProgressPageHeader
        currentSection="coaching"
        basePath="/results"
        title={messages.progress.title}
        description={messages.tutorProgressPage.coachingDescription}
        actions={headerActions}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{studentName}</h2>
            <Badge variant="outline">{snapshot.profile.targetLanguageLabel}</Badge>
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

      <TutorStudentProgressWorkspace
        studentId={activeStudentId}
        studentName={studentName}
        baseAxes={snapshot.axes}
        cefrLevel={snapshot.profile.cefrLevel}
        grammarNotice={snapshot.grammar.betaNotice}
        hasData={hasAnyRawData}
        initialOverride={initialOverride}
        grammarTopicMastery={snapshot.grammarTopicMastery}
      />

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
              <Progress value={snapshot.overview.avgScore} className="mt-2 h-2" />
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
              <Link href={`/passive-vocabulary?student=${activeStudentId}`}>
                {messages.tutorProgressPage.openPassiveVocabulary}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}