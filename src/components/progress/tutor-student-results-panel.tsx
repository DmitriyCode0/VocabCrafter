import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentOverallProgressSections } from "@/components/progress/student-overall-progress-sections";
import { getAppMessages } from "@/lib/i18n/messages";
import type { StudentProgressSnapshot } from "@/lib/progress/profile-metrics";

interface TutorStudentResultsPanelProps {
  studentId: string;
  studentName: string;
  snapshot: StudentProgressSnapshot;
  initialTimeAdjustmentHours: number;
  appLanguage: string;
}

export function TutorStudentResultsPanel({
  studentId,
  studentName,
  snapshot,
  initialTimeAdjustmentHours,
  appLanguage,
}: TutorStudentResultsPanelProps) {
  const messages = getAppMessages(appLanguage as "en" | "uk");
  const hasAnyData =
    snapshot.overview.totalAttempts > 0 ||
    snapshot.overview.totalWords > 0 ||
    snapshot.passiveSignals.uniqueItems > 0 ||
    snapshot.learningSignals.uniqueItems > 0 ||
    snapshot.learningSignals.pendingReviewCount > 0 ||
    snapshot.timeMetrics.completedLessons > 0 ||
    snapshot.timeMetrics.timeAdjustmentHours !== 0;

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
          Progress view combining timed app learning, lessons, vocabulary
          growth, grammar coverage, and optional tutor time corrections.
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
        <StudentOverallProgressSections
          snapshot={snapshot}
          showTimeAdjustmentCard
          studentId={studentId}
          initialTimeAdjustmentHours={initialTimeAdjustmentHours}
          showCefrGuidedHoursCard={false}
        />
      )}
    </div>
  );
}
