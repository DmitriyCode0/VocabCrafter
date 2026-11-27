import { CheckCircle2, GraduationCap, Target } from "lucide-react";
import { formatDateForAppLanguage } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/messages";
import type { AppLanguage } from "@/lib/i18n/app-language";
import {
  formatMonthlyReportMonthLabel,
  getTutorStudentMonthlyReportMetrics,
  resolveMonthlyReportMetricsReferenceDate,
} from "@/lib/progress/monthly-reports";
import {
  hasConfiguredTutorStudentPlan,
  listStudentTutorPlans,
} from "@/lib/progress/tutor-student-plan";
import { MonthlyReportPentagramCard } from "@/components/progress/monthly-report-pentagram-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const APP_LANGUAGE_LOCALES = {
  en: "en-GB",
  uk: "uk-UA",
} as const;

interface StudentPlansTabContentProps {
  userId: string;
  selectedMonth: string;
  selectedTutorId?: string | null;
  appLanguage: AppLanguage;
}

export async function StudentPlansTabContent({
  userId,
  selectedMonth,
  selectedTutorId = null,
  appLanguage,
}: StudentPlansTabContentProps) {
  const messages = getAppMessages(appLanguage);
  const locale = APP_LANGUAGE_LOCALES[appLanguage];
  const selectedMonthDate =
    resolveMonthlyReportMetricsReferenceDate(selectedMonth);
  const selectedMonthLabel = formatMonthlyReportMonthLabel(
    selectedMonth,
    locale,
  );

  const plans = await listStudentTutorPlans(userId, {
    planMonth: selectedMonth,
  });
  const visiblePlans = selectedTutorId
    ? plans.filter((plan) => plan.tutorId === selectedTutorId)
    : plans;

  if (visiblePlans.length === 0) {
    return (
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
    );
  }

  const allMetrics = await Promise.all(
    visiblePlans.map((entry) =>
      getTutorStudentMonthlyReportMetrics(userId, selectedMonthDate, {
        tutorId: entry.tutorId,
      }).catch(() => null),
    ),
  );

  const hubPlanCopy = messages.progressHub.studentPlan;
  const targetLabels = messages.progressHub.planContext.metricLabels;

  return (
    <div className="grid gap-6">
      {visiblePlans.map((entry, index) => {
        const tutorName =
          entry.tutorProfile.fullName || entry.tutorProfile.email;
        const metrics = allMetrics[index];
        const plan = entry.plan;
        const hasPlanDetails = hasConfiguredTutorStudentPlan(plan);

        const targetBadges = [
          plan.monthlyCompletedLessonsTarget != null
            ? `${targetLabels.completedLessons}: ${plan.monthlyCompletedLessonsTarget}`
            : null,
          plan.monthlySentenceTranslationTarget != null
            ? `${targetLabels.sentenceTranslations}: ${plan.monthlySentenceTranslationTarget}`
            : null,
          plan.monthlyGapFillTarget != null
            ? `${targetLabels.gapFills}: ${plan.monthlyGapFillTarget}`
            : null,
          plan.monthlyWordsAddedTarget != null
            ? `${targetLabels.wordsAdded}: ${plan.monthlyWordsAddedTarget}`
            : null,
          plan.monthlyMasteredWordsTarget != null
            ? `${targetLabels.masteredWords}: ${plan.monthlyMasteredWordsTarget}`
            : null,
          plan.monthlyStudentSpeakingShareTarget != null
            ? `${targetLabels.speakingShare}: ${plan.monthlyStudentSpeakingShareTarget}%`
            : null,
          plan.monthlyAverageScoreTarget != null
            ? `${targetLabels.averageScore}: ${plan.monthlyAverageScoreTarget}%`
            : null,
        ].filter((item): item is string => item !== null);

        return (
          <Card key={entry.connectionId}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {plan.planTitle || tutorName}
                  </CardTitle>
                  <CardDescription>
                    {plan.planTitle ? `${tutorName} · ` : ""}
                    {selectedMonthLabel} · Updated{" "}
                    {formatDateForAppLanguage(appLanguage, entry.updatedAt)}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {hasPlanDetails ? (
                <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 md:grid-cols-2">
                  <div className="space-y-3">
                    {plan.goalSummary ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {hubPlanCopy.planGoalsHeading}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {plan.goalSummary}
                        </p>
                      </div>
                    ) : null}

                    {plan.objectives.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {hubPlanCopy.objectivesHeading}
                        </p>
                        <ul className="space-y-1.5">
                          {plan.objectives.map((objective, idx) => (
                            <li
                              key={`${entry.connectionId}-obj-${idx}`}
                              className="flex items-start gap-2 text-sm text-foreground"
                            >
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                              <span>{objective}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {plan.grammarTopicKeys.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {hubPlanCopy.grammarFocusHeading}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {plan.grammarTopicKeys.map((topicKey) => (
                            <Badge key={topicKey} variant="secondary">
                              <GraduationCap className="mr-1 h-3 w-3" />
                              {topicKey}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {targetBadges.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {hubPlanCopy.monthlyTargetsHeading}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {targetBadges.map((label) => (
                            <Badge key={label} variant="outline">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

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
  );
}
