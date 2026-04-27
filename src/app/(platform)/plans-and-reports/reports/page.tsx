import { redirect } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
  getCurrentMonthlyReportWindow,
  getTutorMonthlyReportQuota,
  getTutorStudentMonthlyReportMetrics,
  listStudentPublishedMonthlyReports,
  listTutorStudentMonthlyReports,
} from "@/lib/progress/monthly-reports";
import { TutorPlansReportsPageHeader } from "@/components/progress/tutor-plans-reports-page-header";
import { ResultsStudentFilter } from "@/components/progress/results-student-filter";
import { TutorStudentMonthlyReportsWorkspace } from "@/components/progress/tutor-student-monthly-reports-workspace";
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
import { getTutorStudentPlan } from "@/lib/progress/tutor-student-plan";

export const dynamic = "force-dynamic";

const APP_LANGUAGE_LOCALES = {
  en: "en-GB",
  uk: "uk-UA",
} as const;

function formatNumber(value: number, maximumFractionDigits = 1) {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value
    .toFixed(maximumFractionDigits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatPercentage(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${formatNumber(value)}%`;
}

function formatProgressValue(actual: number, target: number | null) {
  if (target == null) {
    return formatNumber(actual, 0);
  }

  return `${formatNumber(actual, 0)} / ${formatNumber(target, 0)}`;
}

function formatPercentageProgressValue(
  actual: number | null,
  target: number | null,
) {
  if (target == null) {
    return formatPercentage(actual);
  }

  return `${formatPercentage(actual)} / ${formatPercentage(target)}`;
}

function formatHours(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours} h ${minutes} min`;
}

function formatStarRating(value: number | null) {
  if (value == null || !Number.isFinite(value) || value < 1) {
    return "No rating";
  }

  const rating = Math.max(1, Math.min(5, Math.round(value)));
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

export default async function PlansAndReportsReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
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

  if (role === "student") {
    const locale = APP_LANGUAGE_LOCALES[appLanguage];
    const admin = createAdminClient();
    const reports = await listStudentPublishedMonthlyReports(user.id);
    const tutorIds = [...new Set(reports.map((report) => report.tutorId))];
    const { data: tutorProfiles } = tutorIds.length
      ? await admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", tutorIds)
      : {
          data: [] as Array<{
            id: string;
            full_name: string | null;
            email: string;
          }>,
        };
    const tutorMap = new Map(
      (tutorProfiles ?? []).map((item) => [item.id, item]),
    );

    return (
      <div className="space-y-6">
        <TutorPlansReportsPageHeader
          currentSection="reports"
          basePath="/plans-and-reports"
          title={messages.studentPlansReportsPage.title}
          description={messages.studentPlansReportsPage.reportsDescription}
        />

        {reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">
                {messages.studentPlansReportsPage.noReportsTitle}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.studentPlansReportsPage.noReportsDescription}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const tutor = tutorMap.get(report.tutorId);
              const tutorName =
                tutor?.full_name ||
                tutor?.email ||
                messages.studentFeedback.tutorFallback;

              return (
                <Card key={report.id}>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          {report.title}
                        </CardTitle>
                        <CardDescription>
                          {formatMonthlyReportMonthLabel(
                            report.reportMonth,
                            locale,
                          )}{" "}
                          · {tutorName}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          Report:{" "}
                          {getReportLanguageLabel(
                            report.goalsSnapshot.reportLanguage,
                          )}
                        </Badge>
                        <Badge variant="outline">
                          Quizzes: {report.metricsSnapshot.completedQuizzes}
                        </Badge>
                        <Badge variant="outline">
                          Sentence translations:{" "}
                          {report.metricsSnapshot.completedSentenceTranslations}
                          {report.goalsSnapshot
                            .monthlySentenceTranslationTarget != null
                            ? ` / ${report.goalsSnapshot.monthlySentenceTranslationTarget}`
                            : ""}
                        </Badge>
                        <Badge variant="outline">
                          Gap fill:{" "}
                          {report.metricsSnapshot.completedGapFillExercises}
                          {report.goalsSnapshot.monthlyGapFillTarget != null
                            ? ` / ${report.goalsSnapshot.monthlyGapFillTarget}`
                            : ""}
                        </Badge>
                        <Badge variant="outline">
                          Lessons: {report.metricsSnapshot.completedLessons}
                          {report.goalsSnapshot.monthlyCompletedLessonsTarget !=
                          null
                            ? ` / ${report.goalsSnapshot.monthlyCompletedLessonsTarget}`
                            : ""}
                        </Badge>
                        <Badge variant="outline">
                          Classroom sessions: {report.metricsSnapshot.classroomSessions}
                        </Badge>
                        <Badge variant="outline">
                          New words: {report.metricsSnapshot.newMasteryWords}
                          {report.goalsSnapshot.monthlyNewMasteryWordsTarget !=
                          null
                            ? ` / ${report.goalsSnapshot.monthlyNewMasteryWordsTarget}`
                            : ""}
                        </Badge>
                        <Badge variant="outline">
                          Student speaking share: {formatPercentage(report.metricsSnapshot.studentSpeakingShare)}
                        </Badge>
                        <Badge variant="outline">
                          Active days in application:{" "}
                          {report.metricsSnapshot.activeDays}
                        </Badge>
                        {report.goalsSnapshot.grammarTopicKeys.length > 0 ? (
                          <Badge variant="outline">
                            Grammar topics:{" "}
                            {report.goalsSnapshot.grammarTopicKeys.length}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Published{" "}
                      {formatDateForAppLanguage(
                        appLanguage,
                        report.publishedAt || report.generatedAt,
                      )}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Sentence translation exercises
                        </p>
                        <p className="text-xl font-semibold">
                          {formatProgressValue(
                            report.metricsSnapshot
                              .completedSentenceTranslations,
                            report.goalsSnapshot
                              .monthlySentenceTranslationTarget,
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg border px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Gap fill exercises
                        </p>
                        <p className="text-xl font-semibold">
                          {formatProgressValue(
                            report.metricsSnapshot.completedGapFillExercises,
                            report.goalsSnapshot.monthlyGapFillTarget,
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg border px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Completed lessons
                        </p>
                        <p className="text-xl font-semibold">
                          {formatProgressValue(
                            report.metricsSnapshot.completedLessons,
                            report.goalsSnapshot.monthlyCompletedLessonsTarget,
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg border px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Classroom sessions
                        </p>
                        <p className="text-xl font-semibold">
                          {formatNumber(report.metricsSnapshot.classroomSessions, 0)}
                        </p>
                      </div>
                      <div className="rounded-lg border px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Classroom time
                        </p>
                        <p className="text-xl font-semibold">
                          {formatHours(report.metricsSnapshot.classroomHours)}
                        </p>
                      </div>
                      <div className="rounded-lg border px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          App learning time
                        </p>
                        <p className="text-xl font-semibold">
                          {formatHours(report.metricsSnapshot.appLearningHours)}
                        </p>
                      </div>
                      <div className="rounded-lg border px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Student speaking time
                        </p>
                        <p className="text-xl font-semibold">
                          {formatHours(report.metricsSnapshot.studentSpeakingHours)}
                        </p>
                      </div>
                      <div className="rounded-lg border px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Student speaking share
                        </p>
                        <p className="text-xl font-semibold">
                          {formatPercentage(report.metricsSnapshot.studentSpeakingShare)}
                        </p>
                      </div>
                      <div className="rounded-lg border px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Words reviewed this month
                        </p>
                        <p className="text-xl font-semibold">
                          {report.metricsSnapshot.practicedWords}
                        </p>
                      </div>
                      <div className="rounded-lg border px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Words in vocabulary tracker
                        </p>
                        <p className="text-xl font-semibold">
                          {report.metricsSnapshot.trackedWordsTotal}
                        </p>
                      </div>
                      <div className="rounded-lg border px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Average quiz score
                        </p>
                        <p className="text-xl font-semibold">
                          {formatPercentageProgressValue(
                            report.metricsSnapshot.averageScore,
                            report.goalsSnapshot.monthlyAverageScoreTarget,
                          )}
                        </p>
                      </div>
                    </div>

                    {report.metricsSnapshot.monthlyPentagram ? (
                      <MonthlyReportPentagramCard
                        pentagram={report.metricsSnapshot.monthlyPentagram}
                        locale={locale}
                        title={
                          appLanguage === "uk"
                            ? "Місячна пентаграма"
                            : "Monthly Pentagram"
                        }
                        description={
                          appLanguage === "uk"
                            ? "Поточний місяць порівняно з попереднім за тими самими цілями, які були зафіксовані у звіті."
                            : "Current month compared with the previous month using the same targets snapped into the report."
                        }
                      />
                    ) : null}

                    {report.goalsSnapshot.grammarTopicKeys.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Grammar focus topics
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {report.goalsSnapshot.grammarTopicKeys.map(
                            (topic) => (
                              <Badge key={topic} variant="outline">
                                {topic}
                              </Badge>
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}

                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {report.publishedContent}
                    </p>

                    {report.reviewRating != null ? (
                      <div className="rounded-lg border bg-muted/40 px-4 py-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Tutor review
                        </p>
                        <p className="text-lg tracking-[0.2em] text-foreground">
                          {formatStarRating(report.reviewRating)}
                        </p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={`/api/monthly-reports/${report.id}/pdf`}>
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </a>
                      </Button>
                    </div>
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
    studentProfile,
  } = await getTutorProgressPageData(requestedStudentId);

  if (tutorRole !== "tutor") {
    redirect("/dashboard");
  }

  const header = (
    <TutorPlansReportsPageHeader
      currentSection="reports"
      basePath="/plans-and-reports"
      title={messages.tutorPlansReportsPage.title}
      description={messages.tutorPlansReportsPage.reportsDescription}
      actions={
        students.length > 0 ? (
          <ResultsStudentFilter
            students={students.map((student) => ({
              id: student.id,
              label: student.full_name || student.email || "Unknown",
            }))}
            activeStudentId={activeStudentId ?? students[0].id}
          />
        ) : null
      }
    />
  );

  if (!activeStudentId || !studentProfile) {
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
              <FileText className="h-4 w-4" />
              {messages.tutorPlansReportsPage.studentSpecificNotice}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const locale = APP_LANGUAGE_LOCALES[appLanguage];
  const currentWindow = getCurrentMonthlyReportWindow();
  const currentMonthLabel = formatMonthlyReportMonthLabel(
    currentWindow.reportMonth,
    locale,
  );
  const admin = createAdminClient();

  const [studentLanguageResult, planRecord, metrics, quota, reports] =
    await Promise.all([
      admin
        .from("profiles")
        .select("preferred_language")
        .eq("id", activeStudentId)
        .single(),
      getTutorStudentPlan(userId, activeStudentId),
      getTutorStudentMonthlyReportMetrics(activeStudentId, undefined, {
        tutorId: userId,
      }),
      getTutorMonthlyReportQuota(userId),
      listTutorStudentMonthlyReports(userId, activeStudentId),
    ]);

  const studentName =
    studentProfile.full_name ||
    studentProfile.email ||
    messages.tutorProgressPage.studentFallback;
  const targetLanguageLabel = getLearningLanguageLabel(
    normalizeLearningLanguage(studentLanguageResult.data?.preferred_language),
  );

  return (
    <div className="space-y-6">
      {header}

      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{studentName}</h2>
            <Badge variant="outline">{targetLanguageLabel}</Badge>
            {studentProfile.cefr_level ? (
              <Badge variant="secondary">
                {messages.tutorProgressPage.targetLabel(
                  studentProfile.cefr_level,
                )}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground">
            {messages.tutorPlansReportsPage.reportsPanelDescription(
              studentName,
            )}
          </p>
        </div>

        <TutorStudentMonthlyReportsWorkspace
          key={activeStudentId}
          studentId={activeStudentId}
          studentName={studentName}
          currentReportMonth={currentWindow.reportMonth}
          currentMonthLabel={currentMonthLabel}
          plan={planRecord.plan}
          metrics={metrics}
          quota={quota}
          reports={reports.map((report) => ({
            id: report.id,
            reportMonth: report.reportMonth,
            status: report.status,
            title: report.title,
            generationSource: report.generationSource,
            publishedContent: report.publishedContent,
            reviewRating: report.reviewRating,
            generationError: report.generationError,
            generatedAt: report.generatedAt,
            publishedAt: report.publishedAt,
            goalsSnapshot: report.goalsSnapshot,
            metricsSnapshot: report.metricsSnapshot,
          }))}
        />
      </div>
    </div>
  );
}
