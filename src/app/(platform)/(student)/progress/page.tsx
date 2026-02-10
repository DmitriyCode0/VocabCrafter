import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground">
          Track your vocabulary learning journey and quiz performance.
        </p>
      </div>

      <Card>
        <CardHeader className="items-center text-center py-12">
          <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <CardTitle className="text-lg">No progress data yet</CardTitle>
          <CardDescription>
            Complete some quizzes to start tracking your learning progress and
            see your improvement over time.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
