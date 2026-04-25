import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StudentSkillRadar } from "@/components/progress/student-skill-radar";
import { StudentProgressOverviewCards } from "@/components/progress/student-progress-overview-cards";
import { StudentResultsSummary } from "@/components/progress/student-results-summary";
import { getAppMessages } from "@/lib/i18n/messages";
import type { StudentProgressSnapshot } from "@/lib/progress/profile-metrics";

interface TutorStudentResultsPanelProps {
  studentName: string;
  snapshot: StudentProgressSnapshot;
  appLanguage: string;
}

export function TutorStudentResultsPanel({
  studentName,
  snapshot,
  appLanguage,
}: TutorStudentResultsPanelProps) {
  const messages = getAppMessages(appLanguage as "en" | "uk");
  const hasAnyData =
    snapshot.overview.totalAttempts > 0 ||
    snapshot.overview.totalWords > 0 ||
    snapshot.passiveSignals.uniqueItems > 0 ||
    snapshot.timeMetrics.completedLessons > 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{studentName}</h2>
          <Badge variant="outline">
            {snapshot.profile.targetLanguageLabel}
          </Badge>
          <Badge variant="secondary">
            {messages.tutorProgressPage.targetLabel(snapshot.profile.cefrLevel)}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Read-only progress view combining timed app learning, lessons,
          vocabulary growth, and grammar coverage.
        </p>
      </div>

      {!hasAnyData ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No progress yet</CardTitle>
            <CardDescription>
              This student has not built enough saved activity or lesson history
              to populate the progress view.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <StudentSkillRadar
            axes={snapshot.axes}
            chartData={snapshot.chartData}
            cefrLevel={snapshot.profile.cefrLevel}
            grammarNotice={snapshot.grammar.betaNotice}
            grammarTopics={snapshot.grammarTopicMastery}
          />

          <StudentResultsSummary snapshot={snapshot} />

          <StudentProgressOverviewCards snapshot={snapshot} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Strengths</CardTitle>
              <CardDescription>
                Average score by activity type from saved attempts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {snapshot.activityStats.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  No activity score breakdown yet.
                </div>
              ) : (
                snapshot.activityStats.slice(0, 5).map((stat) => (
                  <div key={stat.type} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="font-medium text-foreground">
                        {stat.label}
                      </div>
                      <div className="text-muted-foreground">
                        {stat.averageScore}%
                      </div>
                    </div>
                    <Progress value={stat.averageScore} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {stat.count} saved attempt{stat.count === 1 ? "" : "s"}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
