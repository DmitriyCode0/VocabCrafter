import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { StudentSkillRadar } from "@/components/progress/student-skill-radar";
import { StudentProgressInsights } from "@/components/progress/student-progress-insights";
import { StudentResultsSummary } from "@/components/progress/student-results-summary";
import { StudentProgressOverviewCards } from "@/components/progress/student-progress-overview-cards";
import { TutorProgressPageHeader } from "@/components/progress/tutor-progress-page-header";
import { TrendingUp, BookOpen, PlusCircle } from "lucide-react";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
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

  const [profileResult, snapshot, savedInsightsResult, publishedTutorOverride] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("app_language")
        .eq("id", user.id)
        .single(),
      getStudentProgressSnapshot(user.id),
      supabase
        .from("student_progress_insights")
        .select("insights")
        .eq("user_id", user.id)
        .maybeSingle(),
      getPublishedTutorProgressOverride(user.id),
    ]);
  const messages = getAppMessages(
    normalizeAppLanguage(profileResult.data?.app_language),
  );
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
    snapshot.timeMetrics.completedLessons > 0 ||
    snapshot.overview.totalWords > 0 ||
    snapshot.passiveSignals.uniqueItems > 0 ||
    Boolean(publishedTutorOverride);

  if (!hasAnyData) {
    return (
      <div className="space-y-6">
        <TutorProgressPageHeader
          currentSection="overall"
          basePath="/progress"
          title={messages.progress.title}
          description={messages.progress.description}
        />

        <Card>
          <CardHeader className="items-center text-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">
              {messages.progress.noProgressTitle}
            </CardTitle>
            <CardDescription>
              {messages.progress.noProgressDescription}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col justify-center gap-3 pb-12 sm:flex-row">
            <Button asChild className="w-full max-w-xs">
              <Link href="/quizzes/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                {messages.progress.createQuiz}
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full max-w-xs">
              <Link href="/vocabulary">
                <BookOpen className="mr-2 h-4 w-4" />
                {messages.progress.openVocabMastery}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TutorProgressPageHeader
        currentSection="overall"
        basePath="/progress"
        title={messages.progress.title}
        description={messages.progress.description}
      />

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

      <StudentResultsSummary snapshot={snapshot} />

      <StudentProgressOverviewCards snapshot={snapshot} />
    </div>
  );
}
