import { Suspense } from "react";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, PlusCircle, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { normalizeAppLanguage, type AppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import { parseProgressInsightsValue } from "@/lib/progress/contracts";
import {
  applyTutorTimeAdjustmentToSnapshot,
  getStudentMonthlyComparisonSnapshot,
  getStudentProgressSnapshot,
} from "@/lib/progress/profile-metrics";
import { getPublishedTutorTimeAdjustment } from "@/lib/progress/published-tutor-time-adjustment";
import { getStudentMonthlyActivity } from "@/lib/progress/tutor-progress-monthly";
import { normalizeTutorStudentPlanMonth } from "@/lib/progress/tutor-student-plan";
import { ProgressHubHeader } from "@/components/progress/progress-hub-header";
import type { ProgressHubTabItem } from "@/components/progress/progress-hub-tabs";
import { ReportMonthFilter } from "@/components/progress/report-month-filter";
import { StudentMonthlyReportsTabContent } from "@/components/progress/student-monthly-reports-tab-content";
import { StudentOverallProgressSections } from "@/components/progress/student-overall-progress-sections";
import { StudentPlansTabContent } from "@/components/progress/student-plans-tab-content";
import { StudentProgressInsights } from "@/components/progress/student-progress-insights";
import { StudentResultsSummary } from "@/components/progress/student-results-summary";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

const StudentSkillRadar = dynamicImport(
  () =>
    import("@/components/progress/student-skill-radar").then(
      (module) => module.StudentSkillRadar,
    ),
  {
    loading: () => <Skeleton className="h-[28rem] w-full rounded-xl" />,
  },
);

const StudentMonthlyProgressPanel = dynamicImport(
  () =>
    import("@/components/progress/tutor-student-monthly-performance").then(
      (module) => module.StudentMonthlyProgressPanel,
    ),
  {
    loading: () => <Skeleton className="h-[24rem] w-full rounded-xl" />,
  },
);

const APP_LANGUAGE_LOCALES = {
  en: "en-GB",
  uk: "uk-UA",
} as const;

type StudentProgressTab = "overview" | "monthly" | "plan" | "reports";

function resolveStudentTab(
  requestedTab?: string,
  legacyView?: string,
): StudentProgressTab {
  if (
    requestedTab === "overview" ||
    requestedTab === "monthly" ||
    requestedTab === "plan" ||
    requestedTab === "reports"
  ) {
    return requestedTab;
  }

  if (legacyView === "monthly") {
    return "monthly";
  }

  return "overview";
}

function formatMonthLabel(reportMonth: string, appLanguage: AppLanguage) {
  return new Intl.DateTimeFormat(APP_LANGUAGE_LOCALES[appLanguage], {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${reportMonth}T00:00:00.000Z`));
}

function ProgressBodySkeleton() {
  return (
    <div className="space-y-6">
      <div className="max-w-md">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <div className="px-6 pb-6">
            <Skeleton className="mb-1 h-8 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <div className="px-6 pb-6">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-1 h-4 w-48" />
          </CardHeader>
          <div className="space-y-3 px-6 pb-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </Card>
      </div>
    </div>
  );
}

async function StudentProgressMetricsBody({
  userId,
  activeTab,
  appLanguage,
}: {
  userId: string;
  activeTab: "overview" | "monthly";
  appLanguage: AppLanguage;
}) {
  const supabase = await createClient();
  const messages = getAppMessages(appLanguage);

  const [
    snapshot,
    savedInsightsResult,
    publishedTutorTimeAdjustment,
    monthlyComparison,
    monthlyTrend,
  ] = await Promise.all([
    getStudentProgressSnapshot(userId),
    supabase
      .from("student_progress_insights")
      .select("insights")
      .eq("user_id", userId)
      .maybeSingle(),
    getPublishedTutorTimeAdjustment(userId),
    activeTab === "monthly"
      ? getStudentMonthlyComparisonSnapshot(userId)
      : Promise.resolve(null),
    activeTab === "monthly"
      ? getStudentMonthlyActivity(userId, appLanguage)
      : Promise.resolve(null),
  ]);

  const savedInsights = parseProgressInsightsValue(
    savedInsightsResult.data?.insights,
  );
  const effectiveSnapshot =
    publishedTutorTimeAdjustment != null
      ? applyTutorTimeAdjustmentToSnapshot(
          snapshot,
          publishedTutorTimeAdjustment,
        )
      : snapshot;
  const hasAnyData =
    effectiveSnapshot.overview.totalAttempts > 0 ||
    effectiveSnapshot.timeMetrics.completedLessons > 0 ||
    effectiveSnapshot.overview.totalWords > 0 ||
    effectiveSnapshot.passiveSignals.uniqueItems > 0 ||
    effectiveSnapshot.timeMetrics.timeAdjustmentHours !== 0;

  if (!hasAnyData) {
    return (
      <Card>
        <CardHeader className="items-center py-12 text-center">
          <TrendingUp className="mb-2 h-12 w-12 text-muted-foreground/50" />
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
    );
  }

  if (activeTab === "overview") {
    return (
      <StudentOverallProgressSections
        snapshot={effectiveSnapshot}
        radarAside={
          <StudentProgressInsights
            hasData={hasAnyData}
            initialInsights={savedInsights}
          />
        }
        showCefrGuidedHoursCard={false}
        overviewCardsVariant="streak-only"
        showActivityStrengths={false}
      />
    );
  }

  return (
    <div className="space-y-6">
      {monthlyComparison ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <StudentSkillRadar
            axes={monthlyComparison.currentMonth.axes}
            chartData={monthlyComparison.currentMonth.chartData}
            cefrLevel={effectiveSnapshot.profile.cefrLevel}
            grammarNotice={effectiveSnapshot.grammar.betaNotice}
            grammarTopics={effectiveSnapshot.grammarTopicMastery}
            title={
              appLanguage === "uk"
                ? "Профіль прогресу за місяць"
                : "Monthly Progress Profile"
            }
            description={
              appLanguage === "uk"
                ? "Порівняння поточного місяця з попереднім за тими самими п'ятьма осями."
                : "Compare the current month with the previous month across the same five axes."
            }
            comparison={{
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
            }}
          />
          <StudentProgressInsights
            hasData={hasAnyData}
            initialInsights={savedInsights}
          />
        </div>
      ) : null}

      {monthlyTrend ? <StudentMonthlyProgressPanel trend={monthlyTrend} /> : null}

      <StudentResultsSummary
        snapshot={effectiveSnapshot}
        showCefrGuidedHoursCard={false}
      />
    </div>
  );
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    view?: string;
    month?: string;
    tutor?: string;
  }>;
}) {
  const { tab, view, month, tutor } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profileResult = await supabase
    .from("profiles")
    .select("app_language")
    .eq("id", user.id)
    .single();

  const appLanguage = normalizeAppLanguage(profileResult.data?.app_language);
  const messages = getAppMessages(appLanguage);
  const hub = messages.progressHub;
  const locale = APP_LANGUAGE_LOCALES[appLanguage];
  const activeTab = resolveStudentTab(tab, view);
  const selectedMonth = normalizeTutorStudentPlanMonth(month);

  const tabs: ProgressHubTabItem[] = [
    { value: "overview", label: hub.studentTabs.overview, icon: "overview" },
    { value: "monthly", label: hub.studentTabs.monthly, icon: "monthly" },
    { value: "plan", label: hub.studentTabs.plan, icon: "plan" },
    { value: "reports", label: hub.studentTabs.reports, icon: "reports" },
  ];

  const headerActions =
    activeTab === "plan" || activeTab === "reports" ? (
      <ReportMonthFilter activeMonth={selectedMonth} locale={locale} />
    ) : null;

  return (
    <div className="space-y-6">
      <ProgressHubHeader
        title={hub.title}
        description={hub.studentDescriptions[activeTab]}
        actions={headerActions}
        activeTab={activeTab}
        basePath="/progress"
        tabs={tabs}
        preserveParams={["month", "tutor"]}
      />

      <Suspense fallback={<ProgressBodySkeleton />}>
        {activeTab === "plan" ? (
          <StudentPlansTabContent
            userId={user.id}
            selectedMonth={selectedMonth}
            selectedTutorId={tutor ?? null}
            appLanguage={appLanguage}
          />
        ) : activeTab === "reports" ? (
          <StudentMonthlyReportsTabContent
            userId={user.id}
            selectedMonth={selectedMonth}
            appLanguage={appLanguage}
          />
        ) : (
          <StudentProgressMetricsBody
            userId={user.id}
            activeTab={activeTab}
            appLanguage={appLanguage}
          />
        )}
      </Suspense>
    </div>
  );
}
