import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, FileText, Target } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getGrammarTopicPromptCatalogUpToLevel } from "@/lib/grammar/prompt-overrides";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { formatDateForAppLanguage } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/messages";
import {
  getLearningLanguageLabel,
  normalizeLearningLanguage,
} from "@/lib/languages";
import { getReportLanguageLabel } from "@/lib/progress/monthly-report-language";
import {
  formatMonthlyReportMonthLabel,
  getTutorStudentMonthlyReportMetrics,
} from "@/lib/progress/monthly-reports";
import { ReportMonthFilter } from "@/components/progress/report-month-filter";
import { TutorPlansReportsPageHeader } from "@/components/progress/tutor-plans-reports-page-header";
import { ResultsStudentFilter } from "@/components/progress/results-student-filter";
import { TutorStudentPlanWorkspace } from "@/components/progress/tutor-student-plan-workspace";
import { MonthlyReportPentagramCard } from "@/components/progress/monthly-report-pentagram-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTutorProgressPageData } from "@/lib/progress/tutor-progress-page-data";
import {
  getTutorStudentPlan,
  hasConfiguredTutorStudentPlan,
  isTutorStudentMonthlyPlansTableAvailable,
  listStudentTutorPlans,
  normalizeTutorStudentPlanMonth,
} from "@/lib/progress/tutor-student-plan";

export const dynamic = "force-dynamic";

const APP_LANGUAGE_LOCALES = {
  en: "en-GB",
  uk: "uk-UA",
} as const;

/** Returns today for the current calendar month, last day of month for past months. */
function resolveMetricsReferenceDate(planMonth: string): Date {
  const now = new Date();
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  if (planMonth === currentMonthKey) {
    return now;
  }
  const [year, month] = planMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of requested month
}

function formatPercentage(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, "")}%`;
}

export default async function PlansAndReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; tutor?: string; month?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, app_language")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const role = profile.role;
  const appLanguage = normalizeAppLanguage(profile.app_language);
  const messages = getAppMessages(appLanguage);
  const locale = APP_LANGUAGE_LOCALES[appLanguage];
  const selectedMonth = normalizeTutorStudentPlanMonth(
    resolvedSearchParams.month,
  );
  const selectedMonthDate = resolveMetricsReferenceDate(selectedMonth);
  const selectedMonthLabel = formatMonthlyReportMonthLabel(
    selectedMonth,
    locale,
  );
  const monthlyPlansTableAvailable =
    await isTutorStudentMonthlyPlansTableAvailable();

  const fallbackBanner = monthlyPlansTableAvailable ? null : (
    <Card className="border-amber-300 bg-amber-50/60">
      <CardHeader className="py-4">
        <CardTitle className="text-base text-amber-900">
          Monthly plans migration is pending
        </CardTitle>
        <CardDescription className="text-amber-800">
          The app is running in compatibility mode with legacy tutor plans.
          Apply the latest Supabase migrations to enable full month-scoped plan
          storage.
        </CardDescription>
      </CardHeader>
    </Card>
  );

  if (role === "student") {
    const plans = await listStudentTutorPlans(user.id, {
      planMonth: selectedMonth,
    });
    const selectedTutorId = resolvedSearchParams.tutor ?? null;
    const visiblePlans = selectedTutorId
      ? plans.filter((plan) => plan.tutorId === selectedTutorId)
      : plans;

    // Fetch metrics for all visible plans in parallel
    const metricsPromises = visiblePlans.map((entry) =>
      getTutorStudentMonthlyReportMetrics(user.id, selectedMonthDate, {
        tutorId: entry.tutorId,
      }).catch(() => null),
    );
    const allMetrics = await Promise.all(metricsPromises);

    return (
      <div className="space-y-6">
        <TutorPlansReportsPageHeader
          currentSection="plans"
          basePath="/plans-and-reports"
          title={messages.studentPlansReportsPage.title}
          description={messages.studentPlansReportsPage.plansDescription}
          actions={
            <ReportMonthFilter activeMonth={selectedMonth} locale={locale} />
          }
        />

        {fallbackBanner}

        {visiblePlans.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">
                {messages.studentPlansReportsPage.noPlansTitle}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.studentPlansReportsPage.noPlansDescription}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {visiblePlans.map((entry, index) => {
              const tutorName =
                entry.tutorProfile.fullName || entry.tutorProfile.email;
              const metrics = allMetrics[index];

              return (
                <Card key={entry.connectionId}>
                  <CardHeader>
                    <CardTitle className="text-base">{tutorName}</CardTitle>
                    <CardDescription>
                      Updated{" "}
                      {formatDateForAppLanguage(
                        appLanguage,
                        entry.updatedAt,
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metrics?.monthlyPentagram ? (
                      <MonthlyReportPentagramCard
                        pentagram={metrics.monthlyPentagram}
                        locale={locale}
                        title="Performance Overview"
                        description={`Your progress for ${selectedMonthLabel}`}
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        <p>No performance data available for this period.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const { student: requestedStudentId } = resolvedSearchParams;
  const {
    userId,
    role: tutorRole,
    students,
    activeStudentId,
  } = await getTutorProgressPageData(requestedStudentId);

  if (tutorRole !== "tutor") {
    redirect("/dashboard");
  }

  const header = (
    <TutorPlansReportsPageHeader
      currentSection="plans"
      basePath="/plans-and-reports"
      title={messages.tutorPlansReportsPage.title}
      description={messages.tutorPlansReportsPage.plansDescription}
      actions={
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          {students.length > 0 ? (
            <ResultsStudentFilter
              students={students.map((student) => ({
                id: student.id,
                label: student.full_name || student.email || "Unknown",
              }))}
              activeStudentId={activeStudentId ?? students[0].id}
            />
          ) : null}
          <ReportMonthFilter activeMonth={selectedMonth} locale={locale} />
        </div>
      }
    />
  );

  if (!activeStudentId) {
    return (
      <div className="space-y-6">
        {header}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {messages.tutorPlansReportsPage.noStudentTitle}
            </CardTitle>
            <CardDescription>
              {messages.tutorPlansReportsPage.noStudentDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              {messages.tutorPlansReportsPage.studentSpecificNotice}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const admin = createAdminClient();
  const [studentProfileResult, planRecord, metrics] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name, email, preferred_language, cefr_level")
      .eq("id", activeStudentId)
      .single(),
    getTutorStudentPlan(userId, activeStudentId, {
      planMonth: selectedMonth,
    }),
    getTutorStudentMonthlyReportMetrics(activeStudentId, selectedMonthDate, {
      tutorId: userId,
    }),
  ]);

  if (studentProfileResult.error || !studentProfileResult.data) {
    return (
      <div className="space-y-6">
        {header}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {messages.tutorPlansReportsPage.noStudentTitle}
            </CardTitle>
            <CardDescription>
              {messages.tutorPlansReportsPage.noStudentDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              {messages.tutorPlansReportsPage.studentSpecificNotice}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const studentName =
    studentProfileResult.data.full_name ||
    studentProfileResult.data.email ||
    messages.tutorProgressPage.studentFallback;
  const targetLanguage = normalizeLearningLanguage(
    studentProfileResult.data.preferred_language,
  );
  const availableGrammarTopics = (
    await getGrammarTopicPromptCatalogUpToLevel(
      targetLanguage,
      studentProfileResult.data.cefr_level ?? "",
    )
  ).flatMap(({ level, topics }) =>
    topics.map((topic) => ({
      topicKey: topic.topicKey,
      displayName: topic.displayName,
      level,
    })),
  );

  return (
    <div className="space-y-6">
      {header}

      {fallbackBanner}

      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{studentName}</h2>
            <Badge variant="outline">
              {getLearningLanguageLabel(targetLanguage)}
            </Badge>
            {studentProfileResult.data.cefr_level ? (
              <Badge variant="secondary">
                {messages.tutorProgressPage.targetLabel(
                  studentProfileResult.data.cefr_level,
                )}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground">
            {messages.tutorPlansReportsPage.planPanelDescription(studentName)} (
            {selectedMonthLabel})
          </p>
        </div>

        <TutorStudentPlanWorkspace
          key={`${activeStudentId}-${selectedMonth}`}
          studentId={activeStudentId}
          studentName={studentName}
          planMonth={selectedMonth}
          currentMonthLabel={selectedMonthLabel}
          plan={planRecord.plan}
          metrics={metrics}
          availableGrammarTopics={availableGrammarTopics}
          targetLanguageLabel={getLearningLanguageLabel(targetLanguage)}
        />
      </div>
    </div>
  );
}
