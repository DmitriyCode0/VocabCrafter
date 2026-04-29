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
import {
  applyTutorTimeAdjustmentToSnapshot,
  getStudentMonthlyComparisonSnapshot,
  getStudentProgressSnapshot,
} from "@/lib/progress/profile-metrics";
import {
  applyTutorAxisOverrides,
  buildChartDataFromAxes,
  parseProgressInsightsValue,
} from "@/lib/progress/contracts";
import { getPublishedTutorProgressOverride } from "@/lib/progress/published-tutor-override";

export const dynamic = "force-dynamic";

const APP_LANGUAGE_LOCALES = {
  en: "en-GB",
  uk: "uk-UA",
} as const;

function formatMonthLabel(reportMonth: string, appLanguage: "en" | "uk") {
  return new Intl.DateTimeFormat(APP_LANGUAGE_LOCALES[appLanguage], {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${reportMonth}T00:00:00.000Z`));
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
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
  const appLanguage = normalizeAppLanguage(profileResult.data?.app_language);
  const messages = getAppMessages(appLanguage);
  const chartView = view === "monthly" ? "monthly" : "overall";
  const monthlyComparison =
    chartView === "monthly"
      ? await getStudentMonthlyComparisonSnapshot(
          user.id,
          undefined,
          publishedTutorOverride?.override.monthlyTargetOverrides,
        )
      : null;
  const savedInsights = parseProgressInsightsValue(
    savedInsightsResult.data?.insights,
  );
  const effectiveAxes = publishedTutorOverride
    ? applyTutorAxisOverrides(
        snapshot.axes,
        publishedTutorOverride.override.axisOverrides,
      )
    : snapshot.axes;
  const effectiveSnapshot = publishedTutorOverride
    ? applyTutorTimeAdjustmentToSnapshot(
        snapshot,
        publishedTutorOverride.override.timeAdjustmentHours,
      )
    : snapshot;
  const effectiveChartData = buildChartDataFromAxes(effectiveAxes);
  const displayedInsights =
    publishedTutorOverride?.override.insightsOverride ?? savedInsights;
  const hasAnyData =
    effectiveSnapshot.overview.totalAttempts > 0 ||
    effectiveSnapshot.timeMetrics.completedLessons > 0 ||
    effectiveSnapshot.overview.totalWords > 0 ||
    effectiveSnapshot.passiveSignals.uniqueItems > 0 ||
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
              <Link href="/mastery">
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

      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          size="sm"
          variant={chartView === "overall" ? "default" : "outline"}
        >
          <Link href="/progress">{appLanguage === "uk" ? "Загалом" : "Overall"}</Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant={chartView === "monthly" ? "default" : "outline"}
        >
          <Link href="/progress?view=monthly">
            {appLanguage === "uk" ? "Порівняння місяців" : "Monthly Comparison"}
          </Link>
        </Button>
      </div>

      {chartView === "overall" ? (
        <StudentResultsSummary snapshot={effectiveSnapshot} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <StudentSkillRadar
          axes={
            chartView === "monthly" && monthlyComparison
              ? monthlyComparison.currentMonth.axes
              : effectiveAxes
          }
          chartData={
            chartView === "monthly" && monthlyComparison
              ? monthlyComparison.currentMonth.chartData
              : effectiveChartData
          }
          cefrLevel={effectiveSnapshot.profile.cefrLevel}
          grammarNotice={effectiveSnapshot.grammar.betaNotice}
          grammarTopics={effectiveSnapshot.grammarTopicMastery}
          title={
            chartView === "monthly"
              ? appLanguage === "uk"
                ? "Профіль прогресу за місяць"
                : "Monthly Progress Profile"
              : undefined
          }
          description={
            chartView === "monthly"
              ? appLanguage === "uk"
                ? "Порівняння поточного місяця з попереднім за тими самими п’ятьма осями."
                : "Compare the current month with the previous month across the same five axes."
              : undefined
          }
          comparison={
            chartView === "monthly" && monthlyComparison
              ? {
                  currentLabel: formatMonthLabel(
                    monthlyComparison.currentMonth.window.reportMonth,
                    appLanguage,
                  ),
                  previousLabel: formatMonthLabel(
                    monthlyComparison.previousMonth.window.reportMonth,
                    appLanguage,
                  ),
                  previousAxes: monthlyComparison.previousMonth.axes,
                  previousChartData: monthlyComparison.previousMonth.chartData,
                }
              : undefined
          }
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

      {chartView === "monthly" ? (
        <StudentResultsSummary snapshot={effectiveSnapshot} />
      ) : null}

      <StudentProgressOverviewCards snapshot={effectiveSnapshot} />
    </div>
  );
}
