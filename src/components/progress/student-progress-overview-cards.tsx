import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { StudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import { BookOpen, Flame, Target, TrendingUp, Trophy } from "lucide-react";

interface StudentProgressOverviewCardsProps {
  snapshot: StudentProgressSnapshot;
}

export function StudentProgressOverviewCards({
  snapshot,
}: StudentProgressOverviewCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{snapshot.overview.avgScore}%</div>
          <Progress value={snapshot.overview.avgScore} className="mt-2 h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Avg Mastery</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {snapshot.overview.avgMasteryLevel.toFixed(1)}
          </div>
          <p className="text-xs text-muted-foreground">
            out of 5 mastery levels
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Day Streak</CardTitle>
          <Flame className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{snapshot.overview.streakDays}</div>
          <p className="text-xs text-muted-foreground">
            consecutive day{snapshot.overview.streakDays !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Unique Words</CardTitle>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{snapshot.overview.totalWords}</div>
          <p className="text-xs text-muted-foreground">
            {snapshot.overview.masteredWords} mastered words
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Grammar Topics</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">
              {snapshot.overview.grammarMasteredCount}/
              {snapshot.overview.grammarAvailableCount}
            </div>
          </div>
          <Progress
            value={
              snapshot.overview.grammarAvailableCount > 0
                ? (snapshot.overview.grammarMasteredCount /
                    snapshot.overview.grammarAvailableCount) *
                  100
                : 0
            }
            className="mt-2 h-2"
          />
        </CardContent>
      </Card>
    </div>
  );
}