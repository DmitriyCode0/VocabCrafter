"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  BookOpen,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  Flame,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { DeleteAssignmentButton } from "@/components/assignments/delete-assignment-button";
import { CreateAssignmentDialog } from "@/components/assignments/create-assignment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateForAppLanguage, formatDateTimeForAppLanguage } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export interface HomeworkAttemptItem {
  id: string;
  quizId: string;
  quizTitle: string;
  quizType: string;
  activityLabel: string;
  cefrLevel: string | null;
  grammarTopic: string | null;
  scorePercent: number | null;
  wordsCount: number;
  timeSpentSeconds: number | null;
  completedAt: string;
}

export interface RegularityDayItem {
  isoDate: string;
  shortWeekday: string;
  dayNumber: string;
  count: number;
}

export interface StudentHomeworkItem {
  studentId: string;
  studentName: string;
  cefrLevel: string | null;
  lastLessonDate: string | null;
  nextLessonDate: string | null;
  nextLessonTime: string | null;
  exercisesCount: number;
  avgScorePercent: number | null;
  uniqueWordsPracticed: number;
  totalTimeSeconds: number;
  activityCounts: Array<{ label: string; count: number }>;
  regularityDays: RegularityDayItem[];
  activeDaysCount: number;
  attempts: HomeworkAttemptItem[];
}

export interface FormalClassAssignmentItem {
  id: string;
  title: string;
  instructions: string | null;
  dueDate: string | null;
  createdAt: string;
  classId: string | null;
  className: string | null;
  quizTitle: string | null;
  quizActivityLabel: string | null;
}

interface TutorHomeworkClientProps {
  students: StudentHomeworkItem[];
  formalAssignments: FormalClassAssignmentItem[];
}

type FilterMode = "all" | "practiced" | "inactive";

function formatDurationMinutes(totalSeconds: number) {
  if (!totalSeconds || totalSeconds <= 0) {
    return "0m";
  }
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

export function TutorHomeworkClient({
  students,
  formalAssignments,
}: TutorHomeworkClientProps) {
  const { messages, appLanguage } = useAppI18n();
  const ht = messages.assignments.homeworkTracker;
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedStudentIds, setExpandedStudentIds] = useState<
    Record<string, boolean>
  >({});
  const [showClassAssignments, setShowClassAssignments] = useState(false);

  const practicedCount = useMemo(
    () => students.filter((s) => s.exercisesCount > 0).length,
    [students],
  );
  const inactiveCount = students.length - practicedCount;

  const totalExercisesSinceLesson = useMemo(
    () => students.reduce((sum, s) => sum + s.exercisesCount, 0),
    [students],
  );

  const avgRegularityDays = useMemo(() => {
    if (students.length === 0) return "0.0";
    const sum = students.reduce((acc, s) => acc + s.activeDaysCount, 0);
    return (sum / students.length).toFixed(1);
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return students.filter((student) => {
      if (filterMode === "practiced" && student.exercisesCount === 0) {
        return false;
      }
      if (filterMode === "inactive" && student.exercisesCount > 0) {
        return false;
      }
      if (query && !student.studentName.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [filterMode, searchQuery, students]);

  function toggleStudentExpanded(studentId: string) {
    setExpandedStudentIds((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  }

  async function handleCopyReport(student: StudentHomeworkItem) {
    const lastLessonText = student.lastLessonDate
      ? formatDateForAppLanguage(appLanguage, student.lastLessonDate)
      : "N/A";
    const accuracyText =
      student.avgScorePercent !== null ? `${student.avgScorePercent}%` : "—";
    const breakdownText =
      student.activityCounts.length > 0
        ? student.activityCounts
            .map((item) => `${item.label} ×${item.count}`)
            .join(", ")
        : "None";

    const lines = [
      `📊 Homework Summary — ${student.studentName}`,
      `• Since last lesson (${lastLessonText}): ${student.exercisesCount} ${student.exercisesCount === 1 ? "exercise" : "exercises"} (${breakdownText})`,
      `• Average accuracy: ${accuracyText}`,
      `• Vocabulary practiced: ${student.uniqueWordsPracticed} words`,
      `• 7-day regularity: ${student.activeDaysCount}/7 days active (${formatDurationMinutes(student.totalTimeSeconds)} total)`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success(ht.copiedReportToast(student.studentName));
    } catch {
      toast.error("Failed to copy summary");
    }
  }

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {ht.studentsPracticedKpi}
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {practicedCount}{" "}
              <span className="text-base font-normal text-muted-foreground">
                / {students.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {ht.studentsPracticedHelper}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {ht.totalExercisesKpi}
            </CardTitle>
            <Sparkles className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExercisesSinceLesson}</div>
            <p className="text-xs text-muted-foreground">
              {ht.totalExercisesHelper}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {ht.avgRegularityKpi}
            </CardTitle>
            <Flame className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgRegularityDays}{" "}
              <span className="text-base font-normal text-muted-foreground">
                / 7
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {ht.avgRegularityHelper}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={filterMode === "all" ? "default" : "outline"}
            onClick={() => setFilterMode("all")}
          >
            {ht.filterAll} ({students.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterMode === "practiced" ? "default" : "outline"}
            onClick={() => setFilterMode("practiced")}
          >
            {ht.filterPracticed} ({practicedCount})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterMode === "inactive" ? "default" : "outline"}
            onClick={() => setFilterMode("inactive")}
          >
            {ht.filterNeedsAttention} ({inactiveCount})
          </Button>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={ht.searchPlaceholder}
            className="pl-9"
          />
        </div>
      </div>

      {/* Student Homework Matrix */}
      {students.length === 0 ? (
        <Card>
          <CardHeader className="items-center py-12 text-center">
            <Activity className="mb-2 h-12 w-12 text-muted-foreground/50" />
            <CardTitle className="text-lg">
              {ht.noStudentsConnectedTitle}
            </CardTitle>
            <CardDescription>
              {ht.noStudentsConnectedDescription}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {ht.noMatchingStudents}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredStudents.map((student) => {
            const hasPracticed = student.exercisesCount > 0;
            const isExpanded = Boolean(expandedStudentIds[student.studentId]);

            return (
              <Card
                key={student.studentId}
                className={cn(
                  "transition-colors",
                  hasPracticed
                    ? "border-emerald-500/25"
                    : "border-border/70 bg-card/60",
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">
                          {student.studentName}
                        </CardTitle>
                        {student.cefrLevel ? (
                          <Badge variant="outline" className="text-xs">
                            {student.cefrLevel}
                          </Badge>
                        ) : null}
                        {hasPracticed ? (
                          <Badge className="gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {ht.practicedBadge}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs text-muted-foreground">
                            {ht.noActivityBadge}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarCheck2 className="h-3.5 w-3.5" />
                          {student.lastLessonDate
                            ? ht.lastLessonLabel(
                                formatDateForAppLanguage(
                                  appLanguage,
                                  student.lastLessonDate,
                                ),
                              )
                            : ht.noCompletedLessonYet}
                        </span>
                        {student.nextLessonDate ? (
                          <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                            <CalendarClock className="h-3.5 w-3.5 text-primary" />
                            {ht.nextLessonLabel(
                              `${formatDateForAppLanguage(appLanguage, student.nextLessonDate)}${student.nextLessonTime ? `, ${student.nextLessonTime}` : ""}`,
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyReport(student)}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        {ht.copyReportSnippet}
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/history?student=${student.studentId}`}
                          prefetch={false}
                        >
                          {ht.openHistory}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/results?student=${student.studentId}`}
                          prefetch={false}
                        >
                          {ht.openProgress}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Metrics & 7-Day Regularity Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(220px,1.4fr)]">
                    <div className="rounded-xl border bg-background/60 px-3.5 py-2.5">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {ht.exercisesMetric}
                      </p>
                      <p className="mt-1 text-xl font-bold">
                        {student.exercisesCount}
                      </p>
                    </div>

                    <div className="rounded-xl border bg-background/60 px-3.5 py-2.5">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {ht.avgAccuracyMetric}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xl font-bold",
                          student.avgScorePercent !== null &&
                            student.avgScorePercent >= 80 &&
                            "text-emerald-600 dark:text-emerald-400",
                          student.avgScorePercent !== null &&
                            student.avgScorePercent < 60 &&
                            "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {student.avgScorePercent !== null
                          ? `${student.avgScorePercent}%`
                          : "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border bg-background/60 px-3.5 py-2.5">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {ht.wordsPracticedMetric}
                      </p>
                      <p className="mt-1 text-xl font-bold">
                        {student.uniqueWordsPracticed}
                      </p>
                    </div>

                    <div className="rounded-xl border bg-background/60 px-3.5 py-2.5">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {ht.timeSpentMetric}
                      </p>
                      <p className="mt-1 text-xl font-bold">
                        {formatDurationMinutes(student.totalTimeSeconds)}
                      </p>
                    </div>

                    {/* 7-Day Regularity Strip */}
                    <div className="rounded-xl border bg-background/60 px-3.5 py-2.5 sm:col-span-2 lg:col-span-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {ht.regularityLabel(student.activeDaysCount)}
                        </p>
                      </div>
                      <div className="mt-2 grid grid-cols-7 gap-1">
                        {student.regularityDays.map((day) => {
                          const isActive = day.count > 0;
                          return (
                            <div
                              key={day.isoDate}
                              title={`${day.isoDate}: ${day.count} ${day.count === 1 ? "exercise" : "exercises"}`}
                              className="flex flex-col items-center gap-1"
                            >
                              <div
                                className={cn(
                                  "flex h-6 w-full items-center justify-center rounded-md text-[10px] font-semibold transition-colors",
                                  isActive
                                    ? "bg-emerald-500/20 text-emerald-600 ring-1 ring-emerald-500/40 dark:text-emerald-400"
                                    : "bg-muted/50 text-muted-foreground/60",
                                )}
                              >
                                {day.count > 0 ? day.count : "·"}
                              </div>
                              <span className="text-[9px] text-muted-foreground">
                                {day.shortWeekday}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Activity Mix Pills + Expandable Attempts */}
                  {student.exercisesCount > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {student.activityCounts.map((item) => (
                            <Badge
                              key={item.label}
                              variant="secondary"
                              className="text-xs"
                            >
                              {item.label} ×{item.count}
                            </Badge>
                          ))}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleStudentExpanded(student.studentId)
                          }
                        >
                          {isExpanded
                            ? ht.hideExercises
                            : ht.showExercises(student.exercisesCount)}
                          <ChevronDown
                            className={cn(
                              "ml-1.5 h-4 w-4 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </Button>
                      </div>

                      {isExpanded ? (
                        <div className="space-y-2 rounded-xl border bg-background/40 p-3">
                          {student.attempts.map((attempt) => (
                            <div
                              key={attempt.id}
                              className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                                  <span className="truncate font-medium">
                                    {attempt.quizTitle}
                                  </span>
                                  <Badge variant="secondary" className="text-[11px]">
                                    {attempt.activityLabel}
                                  </Badge>
                                  {attempt.cefrLevel ? (
                                    <Badge variant="outline" className="text-[11px]">
                                      {attempt.cefrLevel}
                                    </Badge>
                                  ) : null}
                                  {attempt.grammarTopic ? (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-300 bg-amber-50 text-[11px] text-amber-900"
                                    >
                                      {attempt.grammarTopic}
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <span>
                                    {formatDateTimeForAppLanguage(
                                      appLanguage,
                                      attempt.completedAt,
                                    )}
                                  </span>
                                  {attempt.wordsCount > 0 ? (
                                    <span>
                                      {messages.quizzes.card.termCount(
                                        attempt.wordsCount,
                                      )}
                                    </span>
                                  ) : null}
                                  {attempt.timeSpentSeconds ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Clock3 className="h-3 w-3" />
                                      {formatDurationMinutes(
                                        attempt.timeSpentSeconds,
                                      )}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                {attempt.scorePercent !== null ? (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "font-semibold",
                                      attempt.scorePercent >= 80
                                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                                        : attempt.scorePercent < 60
                                          ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                                          : undefined,
                                    )}
                                  >
                                    {attempt.scorePercent}%
                                  </Badge>
                                ) : null}
                                <Button
                                  asChild
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs"
                                >
                                  <Link
                                    href={`/assignments/review/${attempt.id}`}
                                    prefetch={false}
                                  >
                                    {ht.reviewAttempt}
                                    <ExternalLink className="ml-1 h-3 w-3" />
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Optional Formal Class Assignments Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {ht.classAssignmentsSectionTitle(formalAssignments.length)}
            </CardTitle>
            <CardDescription>
              {ht.classAssignmentsSectionDescription}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <CreateAssignmentDialog />
            {formalAssignments.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowClassAssignments((prev) => !prev)}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    showClassAssignments && "rotate-180",
                  )}
                />
              </Button>
            ) : null}
          </div>
        </CardHeader>

        {showClassAssignments && formalAssignments.length > 0 ? (
          <CardContent className="space-y-3 pt-0">
            {formalAssignments.map((assignment) => {
              const isPastDue =
                assignment.dueDate &&
                new Date(assignment.dueDate) < new Date();

              return (
                <div
                  key={assignment.id}
                  className="flex flex-col gap-2 rounded-xl border bg-background/60 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{assignment.title}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {assignment.classId && assignment.className ? (
                        <Link
                          href={`/classes/${assignment.classId}`}
                          className="hover:text-primary"
                        >
                          {messages.assignments.classLabel}:{" "}
                          {assignment.className}
                        </Link>
                      ) : null}
                      {assignment.quizTitle ? (
                        <span>
                          {messages.assignments.quizLabel}:{" "}
                          {assignment.quizTitle}
                          {assignment.quizActivityLabel
                            ? ` (${assignment.quizActivityLabel})`
                            : ""}
                        </span>
                      ) : null}
                      <span>
                        {messages.assignments.created}{" "}
                        {formatDateForAppLanguage(
                          appLanguage,
                          assignment.createdAt,
                        )}
                      </span>
                    </div>
                    {assignment.instructions ? (
                      <p className="text-xs text-muted-foreground">
                        {assignment.instructions}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {assignment.dueDate ? (
                      <Badge
                        variant={isPastDue ? "destructive" : "outline"}
                        className="text-xs"
                      >
                        {isPastDue
                          ? messages.assignments.pastDue
                          : messages.assignments.due}{" "}
                        {formatDateForAppLanguage(
                          appLanguage,
                          assignment.dueDate,
                        )}
                      </Badge>
                    ) : null}
                    <DeleteAssignmentButton assignmentId={assignment.id} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}

