"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface StudentHomeworkSnapshotItem {
  studentId: string;
  studentName: string;
  lastLessonLabel: string;
  exercisesCount: number;
  avgScore: number | null;
}

interface TutorHomeworkActivityCardProps {
  items: StudentHomeworkSnapshotItem[];
}

type ActivityFilter = "all" | "practiced" | "inactive";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ST";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getScoreBadgeClasses(score: number) {
  if (score >= 80) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (score >= 50) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400";
}

export function TutorHomeworkActivityCard({
  items,
}: TutorHomeworkActivityCardProps) {
  const { messages } = useAppI18n();
  const tutorI18n = messages.dashboard.tutor;
  const cc = tutorI18n.commandCenter;
  const filters = tutorI18n.activityFilters;
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const practicedCount = useMemo(
    () => items.filter((item) => item.exercisesCount > 0).length,
    [items],
  );
  const inactiveCount = items.length - practicedCount;

  const filteredItems = useMemo(() => {
    if (filter === "practiced") {
      return items.filter((item) => item.exercisesCount > 0);
    }
    if (filter === "inactive") {
      return items.filter((item) => item.exercisesCount === 0);
    }
    return items;
  }, [filter, items]);

  const emptyMessage =
    filter === "practiced"
      ? filters.emptyPracticed
      : filter === "inactive"
        ? filters.emptyInactive
        : cc.noActiveStudents;

  return (
    <Card className="flex flex-col border-border/70 bg-card/70 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Activity className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">
                {cc.homeworkSnapshotTitle}
              </CardTitle>
              <Badge variant="secondary" className="text-xs font-medium">
                {items.length}
              </Badge>
            </div>
            <CardDescription>{cc.homeworkSnapshotDescription}</CardDescription>
          </div>

          {items.length > 0 ? (
            <Tabs
              value={filter}
              onValueChange={(value) => setFilter(value as ActivityFilter)}
              className="shrink-0"
            >
              <TabsList className="h-8 border border-border/60 bg-background/60 p-0.5">
                <TabsTrigger value="all" className="h-7 px-2.5 text-xs">
                  {filters.all} ({items.length})
                </TabsTrigger>
                <TabsTrigger value="practiced" className="h-7 px-2.5 text-xs">
                  {filters.practiced} ({practicedCount})
                </TabsTrigger>
                <TabsTrigger value="inactive" className="h-7 px-2.5 text-xs">
                  {filters.inactive} ({inactiveCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {filteredItems.map((item) => {
              const hasActivity = item.exercisesCount > 0;

              return (
                <div
                  key={item.studentId}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border border-l-[3px] px-3 py-2.5 text-sm transition-colors",
                    hasActivity
                      ? "border-border/70 border-l-emerald-500 bg-background/40 hover:bg-accent/20"
                      : "border-border/60 border-l-muted-foreground/40 bg-background/25 hover:bg-accent/15",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="h-8 w-8 shrink-0 border border-border/60">
                      <AvatarFallback className="bg-muted/70 text-[11px] font-semibold">
                        {getInitials(item.studentName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-medium leading-tight">
                        {item.studentName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.lastLessonLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {hasActivity ? (
                      <>
                        <Badge
                          variant="secondary"
                          className="text-[11px] tabular-nums"
                        >
                          {cc.quizzesDoneBadge(item.exercisesCount)}
                        </Badge>
                        {item.avgScore !== null ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px] tabular-nums",
                              getScoreBadgeClasses(item.avgScore),
                            )}
                          >
                            {cc.avgScoreBadge(item.avgScore)}
                          </Badge>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {cc.noActivitySinceLesson}
                      </span>
                    )}

                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Link
                        href={`/history?student=${item.studentId}`}
                        prefetch={false}
                      >
                        {cc.historyButton}
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t border-border/40 pt-3">
        <Button asChild variant="ghost" size="sm" className="ml-auto text-xs">
          <Link href="/history" prefetch={false}>
            {cc.openHistoryButton}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
