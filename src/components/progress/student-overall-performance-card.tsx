import Link from "next/link";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { StudentProgressSnapshot } from "@/lib/progress/profile-metrics";

interface StudentOverallPerformanceCardProps {
  snapshot: StudentProgressSnapshot;
  id?: string;
  href?: string;
  ctaLabel?: string;
}

const PERFORMANCE_BAND_COPY: Record<
  StudentProgressSnapshot["overallPerformance"]["band"],
  {
    label: string;
    description: string;
    badgeClassName: string;
  }
> = {
  strong: {
    label: "Strong",
    description:
      "Your logged study time, grammar coverage, and vocabulary growth are lining up well with your current CEFR target.",
    badgeClassName:
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  on_track: {
    label: "On Track",
    description:
      "You are building solid momentum. Keep converting learning hours into mastered words and completed grammar topics.",
    badgeClassName:
      "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300",
  },
  building: {
    label: "Building",
    description:
      "The foundation is there, but more consistent app time, lesson time, or mastery work is still needed to match your target level.",
    badgeClassName:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  },
  needs_focus: {
    label: "Needs Focus",
    description:
      "You have started the journey, but the current mix of study time, mastered words, and grammar coverage is still below the pace usually associated with this CEFR target.",
    badgeClassName:
      "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300",
  },
};

export function StudentOverallPerformanceCard({
  snapshot,
  id,
  href,
  ctaLabel,
}: StudentOverallPerformanceCardProps) {
  const performanceBand = PERFORMANCE_BAND_COPY[snapshot.overallPerformance.band];

  return (
    <Card id={id} className={id ? "scroll-mt-24" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Overall Performance</CardTitle>
        <Trophy className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-2xl font-bold">
            {snapshot.overallPerformance.score}/100
          </div>
          <Badge variant="outline" className={performanceBand.badgeClassName}>
            {performanceBand.label}
          </Badge>
        </div>
        <Progress value={snapshot.overallPerformance.score} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {performanceBand.description}
        </p>
      </CardContent>
      {href && ctaLabel ? (
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link href={href}>{ctaLabel}</Link>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}