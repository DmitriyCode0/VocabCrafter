import Link from "next/link";
import { BookMarked, History, Trophy } from "lucide-react";
import { ACTIVITY_LABELS } from "@/lib/constants";
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
import { StudentSkillRadar } from "@/components/progress/student-skill-radar";
import { StudentProgressOverviewCards } from "@/components/progress/student-progress-overview-cards";
import { StudentResultsSummary } from "@/components/progress/student-results-summary";
import { formatDateForAppLanguage } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/messages";
import type { StudentProgressSnapshot } from "@/lib/progress/profile-metrics";

interface TutorStudentResultsPanelProps {
  studentId: string;
  studentName: string;
  snapshot: StudentProgressSnapshot;
  appLanguage: string;
}

export function TutorStudentResultsPanel({
  studentId,
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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{studentName}</h2>
            <Badge variant="outline">{messages.tutorProgressPage.overallTab}</Badge>
            <Badge variant="secondary">
              {messages.tutorProgressPage.targetLabel(snapshot.profile.cefrLevel)}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Read-only progress view combining timed app learning, lessons, vocabulary growth, grammar coverage, and recent results.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{snapshot.profile.targetLanguageLabel}</Badge>
          <Badge variant="outline">
            {messages.tutorProgressPage.sourceLabel(
              snapshot.profile.sourceLanguageLabel,
            )}
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={`/students/${studentId}/progress`}>
              <BookMarked className="mr-2 h-4 w-4" />
              {messages.tutorProgressPage.openCoachingWorkspace}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/history?student=${studentId}`}>
              <History className="mr-2 h-4 w-4" />
              {messages.tutorProgressPage.openHistory}
            </Link>
          </Button>
        </div>
      </div>

      {!hasAnyData ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No progress yet</CardTitle>
            <CardDescription>
              This student has not built enough saved activity or lesson history to populate the progress view.
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

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Results</CardTitle>
                <CardDescription>
                  Latest saved attempts for {studentName}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {snapshot.recentAttempts.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    No recent attempts yet.
                  </div>
                ) : (
                  snapshot.recentAttempts.map((attempt, index) => (
                    <div
                      key={`${attempt.completedAt}-${attempt.title}-${index}`}
                      className="rounded-xl border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {attempt.title}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                              {ACTIVITY_LABELS[attempt.type] || attempt.type}
                            </Badge>
                            <Badge variant="secondary">
                              {formatDateForAppLanguage(
                                appLanguage,
                                attempt.completedAt,
                              )}
                            </Badge>
                          </div>
                        </div>
                        {attempt.scorePercent !== null ? (
                          <Badge
                            variant="outline"
                            className={
                              attempt.scorePercent >= 80
                                ? "text-green-600"
                                : attempt.scorePercent >= 50
                                  ? "text-orange-600"
                                  : "text-red-600"
                            }
                          >
                            <Trophy className="mr-1 h-3.5 w-3.5" />
                            {attempt.scorePercent}%
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

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
          </div>
        </>
      )}
    </div>
  );
}