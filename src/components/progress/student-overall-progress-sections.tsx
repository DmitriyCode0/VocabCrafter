import type { ReactNode } from "react";
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
import { TutorTimeAdjustmentCard } from "@/components/progress/tutor-time-adjustment-card";
import { TutorStudentVocabularyDistribution } from "@/components/progress/tutor-student-vocabulary-distribution";
import type { StudentProgressSnapshot } from "@/lib/progress/profile-metrics";

interface StudentOverallProgressSectionsProps {
  snapshot: StudentProgressSnapshot;
  radarAside?: ReactNode;
  showRadar?: boolean;
  showTimeAdjustmentCard?: boolean;
  studentId?: string;
  initialTimeAdjustmentHours?: number;
  showCefrGuidedHoursCard?: boolean;
}

function ActivityStrengthsCard({
  snapshot,
}: {
  snapshot: StudentProgressSnapshot;
}) {
  return (
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
                <div className="font-medium text-foreground">{stat.label}</div>
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
  );
}

export function StudentOverallProgressSections({
  snapshot,
  radarAside,
  showRadar = true,
  showTimeAdjustmentCard = false,
  studentId,
  initialTimeAdjustmentHours = 0,
  showCefrGuidedHoursCard = false,
}: StudentOverallProgressSectionsProps) {
  const radar = (
    <StudentSkillRadar
      axes={snapshot.axes}
      chartData={snapshot.chartData}
      cefrLevel={snapshot.profile.cefrLevel}
      grammarNotice={snapshot.grammar.betaNotice}
      grammarTopics={snapshot.grammarTopicMastery}
    />
  );

  return (
    <div className="space-y-6">
      <StudentResultsSummary
        snapshot={snapshot}
        showCefrGuidedHoursCard={showCefrGuidedHoursCard}
      />

      {showTimeAdjustmentCard && studentId ? (
        <TutorTimeAdjustmentCard
          studentId={studentId}
          initialTimeAdjustmentHours={initialTimeAdjustmentHours}
          currentTotalLearningHours={snapshot.timeMetrics.totalLearningHours}
        />
      ) : null}

      {showRadar ? (
        radarAside ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            {radar}
            {radarAside}
          </div>
        ) : (
          radar
        )
      ) : null}

      <TutorStudentVocabularyDistribution
        activeSignals={snapshot.activeSignals}
        passiveSignals={snapshot.passiveSignals}
        learningSignals={snapshot.learningSignals}
      />

      <StudentProgressOverviewCards snapshot={snapshot} />

      <ActivityStrengthsCard snapshot={snapshot} />
    </div>
  );
}