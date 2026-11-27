import dynamicImport from "next/dynamic";
import { FileText, Flame, Target, Trophy, Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGrammarTopicPromptCatalogUpToLevel } from "@/lib/grammar/prompt-overrides";
import { getAppMessages } from "@/lib/i18n/messages";
import {
  getLearningLanguageLabel,
  normalizeLearningLanguage,
} from "@/lib/languages";
import {
  formatMonthlyReportMonthLabel,
  getCurrentMonthlyReportWindow,
  getTutorMonthlyReportQuota,
  getTutorStudentMonthlyReportMetrics,
  listTutorStudentMonthlyReports,
  resolveMonthlyReportMetricsReferenceDate,
} from "@/lib/progress/monthly-reports";
import {
  applyTutorTimeAdjustmentToSnapshot,
  getBatchStudentThreeStateVocabularySummaries,
  getStudentProgressSnapshot,
} from "@/lib/progress/profile-metrics";
import { getStudentMonthlyActivity } from "@/lib/progress/tutor-progress-monthly";
import { getTutorProgressPageData } from "@/lib/progress/tutor-progress-page-data";
import {
  getTutorStudentPlan,
  normalizeTutorStudentPlanMonth,
} from "@/lib/progress/tutor-student-plan";
import { StudentMasteryCards } from "@/components/mastery/student-mastery-cards";
import type { TutorStudentThreeStateSummary } from "@/components/mastery/tutor-unified-mastery-client";
import { ProgressHubHeader } from "@/components/progress/progress-hub-header";
import type { ProgressHubTabItem } from "@/components/progress/progress-hub-tabs";
import { ReportMonthFilter } from "@/components/progress/report-month-filter";
import { ResultsStudentFilter } from "@/components/progress/results-student-filter";
import { StudentResultsSummary } from "@/components/progress/student-results-summary";
import { TutorAllStudentsMatrix } from "@/components/progress/tutor-all-students-matrix";
import { TutorLessonLibrary } from "@/components/progress/tutor-lesson-library";
import { TutorStudentMonthlyReportsWorkspace } from "@/components/progress/tutor-student-monthly-reports-workspace";
import { TutorStudentPlanWorkspace } from "@/components/progress/tutor-student-plan-workspace";
import { TutorStudentRecommendationsCard } from "@/components/progress/tutor-student-recommendations-card";
import { TutorStudentVocabularyFunnel } from "@/components/progress/tutor-student-vocabulary-funnel";
import { TutorTimeAdjustmentCard } from "@/components/progress/tutor-time-adjustment-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const TutorEditableStudentSkillRadar = dynamicImport(
  () =>
    import("@/components/progress/tutor-editable-student-skill-radar").then(
      (module) => module.TutorEditableStudentSkillRadar,
    ),
  {
    loading: () => (
      <div className="h-[28rem] w-full animate-pulse rounded-xl bg-muted" />
    ),
  },
);

const TutorStudentVocabularyDistribution = dynamicImport(
  () =>
    import("@/components/progress/tutor-student-vocabulary-distribution").then(
      (module) => module.TutorStudentVocabularyDistribution,
    ),
  {
    loading: () => (
      <div className="h-[20rem] w-full animate-pulse rounded-xl bg-muted" />
    ),
  },
);

const StudentMonthlyProgressPanel = dynamicImport(
  () =>
    import("@/components/progress/tutor-student-monthly-performance").then(
      (module) => module.StudentMonthlyProgressPanel,
    ),
  {
    loading: () => (
      <div className="h-[24rem] w-full animate-pulse rounded-xl bg-muted" />
    ),
  },
);

export const dynamic = "force-dynamic";

type TutorProgressTab =
  | "overview"
  | "students"
  | "vocabulary"
  | "plan"
  | "reports";

const APP_LANGUAGE_LOCALES = {
  en: "en-GB",
  uk: "uk-UA",
} as const;

function resolveTutorTab(
  requestedTab: string | undefined,
  role: "tutor" | "superadmin",
): TutorProgressTab {
  if (role === "tutor") {
    if (
      requestedTab === "overview" ||
      requestedTab === "students" ||
      requestedTab === "vocabulary" ||
      requestedTab === "plan" ||
      requestedTab === "reports"
    ) {
      return requestedTab;
    }
    return "overview";
  }

  return requestedTab === "vocabulary" ? "vocabulary" : "overview";
}

function StudentContextBanner({
  studentName,
  targetLanguageLabel,
  cefrLevel,
  targetLabel,
  subtitle,
  streakLabel,
}: {
  studentName: string;
  targetLanguageLabel?: string | null;
  cefrLevel?: string | null;
  targetLabel?: string | null;
  subtitle: string;
  streakLabel?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{studentName}</h2>
          {targetLanguageLabel ? (
            <Badge variant="outline">{targetLanguageLabel}</Badge>
          ) : null}
          {cefrLevel && targetLabel ? (
            <Badge variant="secondary">{targetLabel}</Badge>
          ) : null}
          {streakLabel ? (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            >
              <Flame className="h-3.5 w-3.5" />
              {streakLabel}
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; student?: string; month?: string }>;
}) {
  const {
    tab: requestedTab,
    student: requestedStudentId,
    month: requestedMonth,
  } = await searchParams;
  const { userId, role, appLanguage, students, activeStudentId, studentProfile } =
    await getTutorProgressPageData(requestedStudentId);
  const messages = getAppMessages(appLanguage);
  const hub = messages.progressHub;
  const locale = APP_LANGUAGE_LOCALES[appLanguage];
  const resolvedRole = role === "superadmin" ? "superadmin" : "tutor";
  const activeTab = resolveTutorTab(requestedTab, resolvedRole);
  const selectedMonth = normalizeTutorStudentPlanMonth(requestedMonth);
  const selectedMonthDate =
    resolveMonthlyReportMetricsReferenceDate(selectedMonth);
  const selectedMonthLabel = formatMonthlyReportMonthLabel(
    selectedMonth,
    locale,
  );

  const tabs: ProgressHubTabItem[] =
    resolvedRole === "tutor"
      ? [
          { value: "overview", label: hub.tutorTabs.overview, icon: "overview" },
          { value: "students", label: hub.tutorTabs.students, icon: "students" },
          {
            value: "vocabulary",
            label: hub.tutorTabs.vocabulary,
            icon: "vocabulary",
          },
          { value: "plan", label: hub.tutorTabs.plan, icon: "plan" },
          { value: "reports", label: hub.tutorTabs.reports, icon: "reports" },
        ]
      : [
          { value: "overview", label: hub.tutorTabs.overview, icon: "overview" },
          {
            value: "vocabulary",
            label: hub.tutorTabs.vocabulary,
            icon: "vocabulary",
          },
        ];

  const headerDescription = hub.tutorDescriptions[activeTab];
  const headerActions =
    resolvedRole === "tutor" ? (
      <>
        {students.length > 0 && activeTab !== "students" ? (
          <ResultsStudentFilter
            students={students.map((student) => ({
              id: student.id,
              label: student.full_name || student.email || "Unknown",
            }))}
            activeStudentId={activeStudentId ?? students[0].id}
          />
        ) : null}
        {activeTab === "plan" || activeTab === "reports" ? (
          <ReportMonthFilter activeMonth={selectedMonth} locale={locale} />
        ) : null}
      </>
    ) : null;

  const header = (
    <ProgressHubHeader
      title={hub.title}
      description={headerDescription}
      actions={headerActions}
      activeTab={activeTab}
      basePath="/results"
      tabs={tabs}
      preserveParams={["student", "month"]}
    />
  );

  // Tab 1: All Active Students 3-State Matrix (Option A)
  if (activeTab === "students") {
    if (students.length === 0) {
      return (
        <div className="space-y-6">
          {header}
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">
                {messages.tutorMastery.noStudentsTitle}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.tutorMastery.noStudentsDescription}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    const summaryMap = await getBatchStudentThreeStateVocabularySummaries(
      students.map((student) => ({
        id: student.id,
        cefr_level: student.cefr_level,
      })),
    );
    const studentSummaries: TutorStudentThreeStateSummary[] = students.map(
      (student) => ({
        ...summaryMap.get(student.id)!,
        name:
          student.full_name ||
          student.email ||
          messages.tutorMastery.unknownStudent,
      }),
    );

    return (
      <div className="space-y-6">
        {header}
        <TutorAllStudentsMatrix
          students={studentSummaries}
          selectedStudentId={activeStudentId}
          preservedMonth={requestedMonth}
        />
      </div>
    );
  }

  // Remaining tabs require an active student
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
              {resolvedRole === "tutor"
                ? messages.tutorPlansReportsPage.noStudentDescription
                : "Open this page with a student id to review a specific learner's progress."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              {activeTab === "reports" ? (
                <FileText className="h-4 w-4" />
              ) : activeTab === "plan" ? (
                <Target className="h-4 w-4" />
              ) : (
                <Trophy className="h-4 w-4" />
              )}
              Progress is student-specific, so this hub shows one learner at a
              time.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const studentName =
    studentProfile.full_name ||
    studentProfile.email ||
    messages.tutorProgressPage.studentFallback;

  // Tab 2: Student Overview (Holistic Progress + Recommendations + 30-day Activity)
  if (activeTab === "overview") {
    const supabaseAdmin = createAdminClient();
    const [snapshot, timeAdjustmentResult, monthlyTrend] = await Promise.all([
      getStudentProgressSnapshot(activeStudentId),
      resolvedRole === "tutor"
        ? supabaseAdmin
            .from("tutor_student_progress_overrides")
            .select("time_adjustment_hours")
            .eq("tutor_id", userId)
            .eq("student_id", activeStudentId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      getStudentMonthlyActivity(activeStudentId, appLanguage),
    ]);

    if (timeAdjustmentResult.error) {
      throw timeAdjustmentResult.error;
    }

    const timeAdjustmentHours = Number.isFinite(
      timeAdjustmentResult.data?.time_adjustment_hours,
    )
      ? Number(timeAdjustmentResult.data?.time_adjustment_hours)
      : 0;
    const effectiveSnapshot = applyTutorTimeAdjustmentToSnapshot(
      snapshot,
      timeAdjustmentHours,
    );

    const hasAnyData =
      effectiveSnapshot.overview.totalAttempts > 0 ||
      effectiveSnapshot.overview.totalWords > 0 ||
      effectiveSnapshot.passiveSignals.uniqueItems > 0 ||
      effectiveSnapshot.learningSignals.uniqueItems > 0 ||
      effectiveSnapshot.learningSignals.pendingReviewCount > 0 ||
      effectiveSnapshot.timeMetrics.completedLessons > 0 ||
      effectiveSnapshot.timeMetrics.timeAdjustmentHours !== 0;

    return (
      <div className="space-y-6">
        {header}

        <StudentContextBanner
          studentName={studentName}
          targetLanguageLabel={effectiveSnapshot.profile.targetLanguageLabel}
          cefrLevel={effectiveSnapshot.profile.cefrLevel}
          targetLabel={messages.tutorProgressPage.targetLabel(
            effectiveSnapshot.profile.cefrLevel,
          )}
          subtitle={messages.tutorProgressPage.description(studentName)}
          streakLabel={
            hasAnyData
              ? hub.dayStreakBadge(effectiveSnapshot.overview.streakDays)
              : null
          }
        />

        {!hasAnyData ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No progress yet</CardTitle>
                <CardDescription>
                  {hub.studentOverviewEmptyDescription}
                </CardDescription>
              </CardHeader>
            </Card>
            {resolvedRole === "tutor" ? (
              <TutorTimeAdjustmentCard
                studentId={activeStudentId}
                initialTimeAdjustmentHours={timeAdjustmentHours}
                currentTotalLearningHours={
                  effectiveSnapshot.timeMetrics.totalLearningHours
                }
              />
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            <StudentResultsSummary
              snapshot={effectiveSnapshot}
              showCefrGuidedHoursCard={false}
            />

            {resolvedRole === "tutor" ? (
              <TutorTimeAdjustmentCard
                studentId={activeStudentId}
                initialTimeAdjustmentHours={timeAdjustmentHours}
                currentTotalLearningHours={
                  effectiveSnapshot.timeMetrics.totalLearningHours
                }
              />
            ) : null}

            <div className="grid gap-6 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <TutorEditableStudentSkillRadar
                  studentId={activeStudentId}
                  axes={effectiveSnapshot.axes}
                  chartData={effectiveSnapshot.chartData}
                  cefrLevel={effectiveSnapshot.profile.cefrLevel}
                  grammarNotice={effectiveSnapshot.grammar.betaNotice}
                  grammarTopics={effectiveSnapshot.grammarTopicMastery}
                />
              </div>

              <div className="xl:col-span-5">
                <TutorStudentRecommendationsCard
                  studentId={activeStudentId}
                  snapshot={effectiveSnapshot}
                />
              </div>
            </div>

            <StudentMonthlyProgressPanel trend={monthlyTrend} />
          </div>
        )}
      </div>
    );
  }

  // Tab 3: Vocabulary & SRS Mastery
  if (activeTab === "vocabulary") {
    const [snapshot, threeStateMap] = await Promise.all([
      getStudentProgressSnapshot(activeStudentId),
      getBatchStudentThreeStateVocabularySummaries([
        { id: activeStudentId, cefr_level: studentProfile.cefr_level },
      ]),
    ]);
    const rawSummary = threeStateMap.get(activeStudentId);
    const studentSummary: TutorStudentThreeStateSummary | null = rawSummary
      ? { ...rawSummary, name: studentName }
      : null;

    return (
      <div className="space-y-6">
        {header}

        <StudentContextBanner
          studentName={studentName}
          targetLanguageLabel={snapshot.profile.targetLanguageLabel}
          cefrLevel={snapshot.profile.cefrLevel}
          targetLabel={messages.tutorProgressPage.targetLabel(
            snapshot.profile.cefrLevel,
          )}
          subtitle={hub.tutorDescriptions.vocabulary}
        />

        <TutorStudentVocabularyFunnel
          studentId={activeStudentId}
          studentName={studentName}
          snapshot={snapshot}
          summary={studentSummary}
        />

        <TutorStudentVocabularyDistribution
          activeSignals={snapshot.activeSignals}
          passiveSignals={snapshot.passiveSignals}
          learningSignals={snapshot.learningSignals}
        />

        {studentSummary ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {messages.tutorMastery.studentOverviewTitle}
              </CardTitle>
              <CardDescription>
                {messages.tutorMastery.studentOverviewDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StudentMasteryCards
                students={[
                  {
                    studentId: studentSummary.studentId,
                    name: studentSummary.name,
                    totalWords: studentSummary.srsTotalWords,
                    mastered: studentSummary.srsMasteredWords,
                    avgLevel: studentSummary.srsAvgLevel,
                    levelCounts: studentSummary.srsLevelCounts,
                    passiveEvidenceCount: studentSummary.passiveRawCount,
                    equivalentWords: studentSummary.passiveEquivalentCount,
                  },
                ]}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  // Tab 4: Plan & Curriculum
  if (activeTab === "plan") {
    const admin = createAdminClient();
    const [studentProfileResult, planRecord, metrics, snapshot] =
      await Promise.all([
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
        getStudentProgressSnapshot(activeStudentId),
      ]);

    const resolvedCefrLevel =
      studentProfileResult.data?.cefr_level ?? studentProfile.cefr_level ?? "";
    const targetLanguage = normalizeLearningLanguage(
      studentProfileResult.data?.preferred_language,
    );
    const targetLanguageLabel = getLearningLanguageLabel(targetLanguage);
    const availableGrammarTopics = (
      await getGrammarTopicPromptCatalogUpToLevel(
        targetLanguage,
        resolvedCefrLevel,
      )
    ).flatMap(({ level, topics }) =>
      topics.map((topic) => ({
        topicKey: topic.topicKey,
        displayName: topic.displayName,
        level,
        hasUniqueInstructions: topic.hasUniqueInstructions,
      })),
    );

    const suggestedGrammarTopics = snapshot.grammarTopicMastery
      .filter((topic) => !topic.mastered)
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 6)
      .map((topic) => ({
        topicKey: topic.topicKey,
        label: topic.label,
        attempts: topic.attempts,
        averageScore: topic.averageScore,
      }));

    return (
      <div className="space-y-6">
        {header}

        <StudentContextBanner
          studentName={studentName}
          targetLanguageLabel={targetLanguageLabel}
          cefrLevel={resolvedCefrLevel || null}
          targetLabel={
            resolvedCefrLevel
              ? messages.tutorProgressPage.targetLabel(resolvedCefrLevel)
              : null
          }
          subtitle={`${messages.tutorPlansReportsPage.planPanelDescription(studentName)} (${selectedMonthLabel})`}
        />

        <TutorStudentPlanWorkspace
          key={`${activeStudentId}-${selectedMonth}`}
          studentId={activeStudentId}
          studentName={studentName}
          planMonth={selectedMonth}
          currentMonthLabel={selectedMonthLabel}
          plan={planRecord.plan}
          metrics={metrics}
          availableGrammarTopics={availableGrammarTopics}
          suggestedGrammarTopics={suggestedGrammarTopics}
          targetLanguageLabel={targetLanguageLabel}
        />

        <TutorLessonLibrary studentId={activeStudentId} />
      </div>
    );
  }

  // Tab 5: Monthly Reports
  const currentWindow = getCurrentMonthlyReportWindow(selectedMonthDate);
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
      getTutorStudentPlan(userId, activeStudentId, {
        planMonth: selectedMonth,
      }),
      getTutorStudentMonthlyReportMetrics(activeStudentId, selectedMonthDate, {
        tutorId: userId,
      }),
      getTutorMonthlyReportQuota(userId, selectedMonthDate),
      listTutorStudentMonthlyReports(userId, activeStudentId),
    ]);

  const targetLanguageLabel = getLearningLanguageLabel(
    normalizeLearningLanguage(studentLanguageResult.data?.preferred_language),
  );

  return (
    <div className="space-y-6">
      {header}

      <StudentContextBanner
        studentName={studentName}
        targetLanguageLabel={targetLanguageLabel}
        cefrLevel={studentProfile.cefr_level}
        targetLabel={
          studentProfile.cefr_level
            ? messages.tutorProgressPage.targetLabel(studentProfile.cefr_level)
            : null
        }
        subtitle={`${messages.tutorPlansReportsPage.reportsPanelDescription(studentName)} (${selectedMonthLabel})`}
      />

      <TutorStudentMonthlyReportsWorkspace
        key={`${activeStudentId}-${selectedMonth}`}
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
  );
}
