import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StudentOverallPerformanceCard } from "@/components/progress/student-overall-performance-card";
import type { StudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import {
  CheckCircle2,
  Clock3,
  GraduationCap,
  Sparkles,
  Target,
} from "lucide-react";

interface StudentResultsSummaryProps {
  snapshot: StudentProgressSnapshot;
}

function formatHours(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)} h`;
}

function formatHourRange(minHours: number, maxHours: number) {
  return `${minHours}-${maxHours} h`;
}

export function StudentResultsSummary({
  snapshot,
}: StudentResultsSummaryProps) {
  const componentRows = [
    {
      key: "time",
      label: "Time Logged",
      value: snapshot.overallPerformance.components.time,
      helper: `${formatHours(snapshot.timeMetrics.totalLearningHours)} logged vs about ${snapshot.cefrGuidedHours.currentLevel.averageHours} h often associated with ${snapshot.profile.cefrLevel}`,
    },
    {
      key: "grammar",
      label: "Grammar Topics Learned",
      value: snapshot.overallPerformance.components.grammar,
      helper: `${snapshot.overview.grammarMasteredCount}/${snapshot.overview.grammarAvailableCount} current-level topics marked as mastered`,
    },
    {
      key: "knownWords",
      label: "Words Known",
      value: snapshot.overallPerformance.components.knownWords,
      helper: `${snapshot.overview.masteredWords} words at high mastery`,
    },
    {
      key: "addedWords",
      label: "Words Added",
      value: snapshot.overallPerformance.components.addedWords,
      helper: `${snapshot.overview.totalWords} total tracked words`,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              App Learning Time
            </CardTitle>
            <Clock3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatHours(snapshot.timeMetrics.appLearningHours)}
            </div>
            <p className="text-xs text-muted-foreground">
              {snapshot.overview.totalAttempts} timed activity attempt
              {snapshot.overview.totalAttempts === 1 ? "" : "s"} saved in the app
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              In-Lesson Time
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatHours(snapshot.timeMetrics.lessonHours)}
            </div>
            <p className="text-xs text-muted-foreground">
              {snapshot.timeMetrics.completedLessons} completed lesson
              {snapshot.timeMetrics.completedLessons === 1 ? "" : "s"} at 1 hour each
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Learning Time
            </CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatHours(snapshot.timeMetrics.totalLearningHours)}
            </div>
            <p className="text-xs text-muted-foreground">
              Combined app learning and tutor-led lesson time
            </p>
          </CardContent>
        </Card>

        <StudentOverallPerformanceCard
          snapshot={snapshot}
          id="overall-performance"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance Breakdown</CardTitle>
            <CardDescription>
              This score blends time, grammar coverage, mastered words, and total tracked vocabulary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {componentRows.map((row) => (
              <div key={row.key} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="font-medium text-foreground">{row.label}</div>
                  <div className="text-muted-foreground">{row.value}%</div>
                </div>
                <Progress value={row.value} className="h-2" />
                <p className="text-xs text-muted-foreground">{row.helper}</p>
              </div>
            ))}

            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-2 text-foreground">
                <Target className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    Current target: {snapshot.cefrGuidedHours.currentLevel.level}
                  </p>
                  <p>
                    Around {snapshot.cefrGuidedHours.currentLevel.averageHours} guided hours on average, with about {snapshot.cefrGuidedHours.currentLevel.remainingHours} h still to log from the tracked total.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">CEFR Guided Hours</CardTitle>
            <CardDescription>
              Approximate cumulative guided hours from beginner level based on Cambridge English guidance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {snapshot.cefrGuidedHours.levels.map((level) => {
                const isCurrent =
                  level.level === snapshot.cefrGuidedHours.currentLevel.level;

                return (
                  <div
                    key={level.level}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                      isCurrent
                        ? "border-primary/30 bg-primary/5"
                        : "bg-background"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {level.level}
                      </span>
                      {isCurrent ? (
                        <Badge variant="secondary">Current target</Badge>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">
                        {formatHourRange(level.minHours, level.maxHours)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        about {level.averageHours} h average
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p>{snapshot.cefrGuidedHours.source}</p>
                  <p>
                    Cambridge English also notes that moving from one CEFR band to the next often takes roughly 200 guided hours, but real progress depends on study intensity, previous exposure, and learning outside lessons.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}