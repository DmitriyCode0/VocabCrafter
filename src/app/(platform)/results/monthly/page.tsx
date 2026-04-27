import { Trophy } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppMessages } from "@/lib/i18n/messages";
import { StudentSkillRadar } from "@/components/progress/student-skill-radar";
import {
  getStudentMonthlyComparisonSnapshot,
  getStudentProgressSnapshot,
} from "@/lib/progress/profile-metrics";
import { parseTutorProgressOverride } from "@/lib/progress/contracts";
import { getTutorProgressPageData } from "@/lib/progress/tutor-progress-page-data";
import { getStudentMonthlyActivity } from "@/lib/progress/tutor-progress-monthly";
import { ResultsStudentFilter } from "@/components/progress/results-student-filter";
import { TutorProgressPageHeader } from "@/components/progress/tutor-progress-page-header";
import { TutorStudentMonthlyPerformance } from "@/components/progress/tutor-student-monthly-performance";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export default async function MonthlyResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student: requestedStudentId } = await searchParams;
  const { userId, role, appLanguage, students, activeStudentId, studentProfile } =
    await getTutorProgressPageData(requestedStudentId);
  const messages = getAppMessages(appLanguage);
  const supabaseAdmin = createAdminClient();
  const [trend, snapshot, overrideResult] = activeStudentId
    ? await Promise.all([
        getStudentMonthlyActivity(activeStudentId, appLanguage),
        getStudentProgressSnapshot(activeStudentId),
        supabaseAdmin
          .from("tutor_student_progress_overrides")
          .select("monthly_target_overrides")
          .eq("tutor_id", userId)
          .eq("student_id", activeStudentId)
          .maybeSingle(),
      ])
    : [null, null, null];

  if (overrideResult?.error) {
    throw overrideResult.error;
  }

  const currentOverride = parseTutorProgressOverride(overrideResult?.data);
  const monthlyComparison = activeStudentId
    ? await getStudentMonthlyComparisonSnapshot(
        activeStudentId,
        undefined,
        currentOverride.monthlyTargetOverrides,
      )
    : null;

  return (
    <div className="space-y-6">
      <TutorProgressPageHeader
        currentSection="monthly"
        basePath="/results"
        title={messages.progress.title}
        description={messages.tutorProgressPage.monthlyDescription}
        actions={
          role === "tutor" && students.length > 0 ? (
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

      {!activeStudentId || !studentProfile || !trend ? (
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
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Progress is student-specific, so this page always shows one
              learner at a time.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {monthlyComparison ? (
            <StudentSkillRadar
              axes={monthlyComparison.currentMonth.axes}
              chartData={monthlyComparison.currentMonth.chartData}
              cefrLevel={snapshot.profile.cefrLevel}
              grammarNotice={snapshot.grammar.betaNotice}
              grammarTopics={snapshot.grammarTopicMastery}
              title={
                appLanguage === "uk"
                  ? "Порівняння прогресу за місяцями"
                  : "Monthly Progress Comparison"
              }
              description={
                appLanguage === "uk"
                  ? "Поточний місяць порівняно з попереднім за тими самими п’ятьма осями."
                  : "Current month compared with the previous month across the same five axes."
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
          ) : null}

          <TutorStudentMonthlyPerformance
            studentName={
              studentProfile.full_name ||
              studentProfile.email ||
              messages.tutorProgressPage.studentFallback
            }
            studentLevel={studentProfile.cefr_level}
            targetLanguageLabel={snapshot.profile.targetLanguageLabel}
            trend={trend}
          />
        </div>
      )}
    </div>
  );
}
