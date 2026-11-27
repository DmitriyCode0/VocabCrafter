"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { CreateLessonDialog } from "@/components/lessons/create-lesson-dialog";
import { DeleteLessonButton } from "@/components/lessons/delete-lesson-button";
import { EditLessonDialog } from "@/components/lessons/edit-lesson-dialog";
import { LessonMeetTranscriptDialog } from "@/components/lessons/lesson-meet-transcript-dialog";
import { RescheduleLessonDialog } from "@/components/lessons/reschedule-lesson-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  buildLessonMonthCells,
  formatLessonCurrency,
  formatLessonDayLabel,
  formatLessonMonthLabel,
  formatLessonTimeRange,
  getLessonDisplayTitle,
  getLessonStatusBadgeClassName,
  getLessonStatusLabel,
  getLessonStatusSurfaceClassName,
  getLessonWeekdayLabels,
  groupLessonsByDate,
  LESSON_STATUSES,
  ONE_TIME_LESSON_OPTION_VALUE,
  type LessonStatus,
  type LessonStudentOption,
  type LessonTranscriptSummary,
  type MonthlyLessonItem,
} from "@/lib/lessons";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  PlusCircle,
  RotateCcw,
  Video,
} from "lucide-react";

interface MonthlyLessonsCalendarProps {
  month: Date;
  lessons: MonthlyLessonItem[];
  emptyMessage: string;
  showDailyEarnings?: boolean;
  canManageLessons?: boolean;
  studentOptions?: LessonStudentOption[];
  onStepMonth?: (offset: number) => void;
  onJumpToToday?: () => void;
  previousLabel?: string;
  nextLabel?: string;
  onLessonUpdated?: (lesson: MonthlyLessonItem) => void;
  hasTranscriptScope?: boolean;
  googleConnectHref?: string;
}

function getCompactChipClasses(status: LessonStatus) {
  switch (status) {
    case "completed":
      return "border-emerald-500/20 border-l-emerald-500 bg-emerald-500/10 text-foreground hover:bg-emerald-500/15";
    case "cancelled":
      return "border-rose-500/20 border-l-rose-500 bg-rose-500/10 text-muted-foreground opacity-75 line-through hover:bg-rose-500/15";
    default:
      return "border-sky-500/20 border-l-sky-500 bg-sky-500/10 text-foreground hover:bg-sky-500/15";
  }
}

export function MonthlyLessonsCalendar({
  month,
  lessons,
  emptyMessage,
  showDailyEarnings = false,
  canManageLessons = false,
  studentOptions = [],
  onStepMonth,
  onJumpToToday,
  previousLabel = "Previous",
  nextLabel = "Next",
  onLessonUpdated,
  hasTranscriptScope = false,
  googleConnectHref,
}: MonthlyLessonsCalendarProps) {
  const [isMonthlyListExpanded, setIsMonthlyListExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [quickCreateDate, setQuickCreateDate] = useState<string | null>(null);
  const [studentFilter, setStudentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [pendingReschedule, setPendingReschedule] = useState<{
    lesson: MonthlyLessonItem;
    targetDate: string;
  } | null>(null);
  const [localLessons, setLocalLessons] =
    useState<MonthlyLessonItem[]>(lessons);

  useEffect(() => {
    setLocalLessons(lessons);
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    return localLessons.filter((lesson) => {
      if (statusFilter !== "all" && lesson.status !== statusFilter) {
        return false;
      }

      if (studentFilter === "all") {
        return true;
      }

      if (studentFilter === ONE_TIME_LESSON_OPTION_VALUE) {
        return !lesson.studentId;
      }

      return lesson.studentId === studentFilter;
    });
  }, [localLessons, statusFilter, studentFilter]);

  const hasActiveFilters = studentFilter !== "all" || statusFilter !== "all";

  const cells = buildLessonMonthCells(month);
  const weekdayLabels = getLessonWeekdayLabels();
  const lessonsByDate = groupLessonsByDate(filteredLessons);
  const selectedDateLessons = selectedDate
    ? (lessonsByDate.get(selectedDate) ?? [])
    : [];
  const draggedLesson = draggedLessonId
    ? (localLessons.find((l) => l.id === draggedLessonId) ?? null)
    : null;

  function handleLessonDeleted(id: string) {
    setLocalLessons((prev) => prev.filter((l) => l.id !== id));
    setSelectedDate((prev) => {
      if (!prev) return prev;
      const remaining = (lessonsByDate.get(prev) ?? []).filter(
        (l) => l.id !== id,
      );
      return remaining.length === 0 ? null : prev;
    });
  }

  function handleLessonRescheduled(updatedLesson: MonthlyLessonItem) {
    setLocalLessons((prev) =>
      prev.map((item) =>
        item.id === updatedLesson.id ? updatedLesson : item,
      ),
    );
    onLessonUpdated?.(updatedLesson);
  }

  const canQuickCreate = canManageLessons;
  const quickCreateDefaultStudentId =
    studentFilter !== "all" && studentFilter !== ONE_TIME_LESSON_OPTION_VALUE
      ? studentFilter
      : undefined;

  function openQuickCreate(date: string) {
    if (!canQuickCreate) {
      return;
    }

    setQuickCreateDate(date);
  }

  function handleChipDragStart(
    event: DragEvent<HTMLDivElement>,
    lesson: MonthlyLessonItem,
  ) {
    if (!canManageLessons) {
      return;
    }

    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", lesson.id);
    setDraggedLessonId(lesson.id);
  }

  function handleChipDragEnd() {
    setDraggedLessonId(null);
    setDragOverDate(null);
  }

  function handleCellDragOver(
    event: DragEvent<HTMLDivElement>,
    targetIsoDate: string,
  ) {
    if (!canManageLessons) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (dragOverDate !== targetIsoDate) {
      setDragOverDate(targetIsoDate);
    }
  }

  function handleCellDragLeave(
    event: DragEvent<HTMLDivElement>,
    targetIsoDate: string,
  ) {
    if (!canManageLessons) {
      return;
    }

    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) {
      return;
    }

    if (dragOverDate === targetIsoDate) {
      setDragOverDate(null);
    }
  }

  function handleCellDrop(
    event: DragEvent<HTMLDivElement>,
    targetIsoDate: string,
  ) {
    if (!canManageLessons) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const droppedId =
      draggedLessonId || event.dataTransfer.getData("text/plain");
    const droppedLesson = localLessons.find((item) => item.id === droppedId);

    setDraggedLessonId(null);
    setDragOverDate(null);

    if (!droppedLesson || droppedLesson.lessonDate === targetIsoDate) {
      return;
    }

    setPendingReschedule({
      lesson: droppedLesson,
      targetDate: targetIsoDate,
    });
  }

  function renderCompactChip(lesson: MonthlyLessonItem) {
    const isBeingDragged = draggedLessonId === lesson.id;

    return (
      <div
        key={lesson.id}
        draggable={canManageLessons}
        onDragStart={(event) => handleChipDragStart(event, lesson)}
        onDragEnd={handleChipDragEnd}
        className={cn(
          "group/chip rounded-md border border-l-[3px] px-2 py-1 transition-all",
          getCompactChipClasses(lesson.status),
          canManageLessons && "cursor-grab active:cursor-grabbing",
          isBeingDragged && "opacity-45 ring-1 ring-primary/50",
        )}
      >
        <div className="flex items-center justify-between gap-1 text-[10px] leading-3.5 text-muted-foreground">
          <span className="flex min-w-0 items-center gap-0.5 truncate font-medium tabular-nums">
            {canManageLessons ? (
              <GripVertical className="h-2.5 w-2.5 shrink-0 opacity-45 transition-opacity group-hover/chip:opacity-100" />
            ) : null}
            <span className="truncate">
              {formatLessonTimeRange(lesson.startTime, lesson.endTime)}
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {lesson.meetUrl ? (
              <Video
                className="h-2.5 w-2.5 text-emerald-400"
                aria-label="Google Meet linked"
              />
            ) : null}
            <span className="tabular-nums">
              {formatLessonCurrency(lesson.priceCents)}
            </span>
          </div>
        </div>
        <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight">
          {lesson.participantName}
        </p>
      </div>
    );
  }

  function renderLessonRow(
    lesson: MonthlyLessonItem,
    options?: {
      showParticipant?: boolean;
      showManageActions?: boolean;
    },
  ) {
    const showParticipant = options?.showParticipant ?? true;
    const showManageActions = options?.showManageActions ?? canManageLessons;

    return (
      <div
        key={lesson.id}
        className={cn(
          "rounded-lg border px-3 py-3 text-sm",
          getLessonStatusSurfaceClassName(lesson.status),
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{getLessonDisplayTitle(lesson.title)}</p>
            {showParticipant ? (
              <p className="text-muted-foreground">
                {lesson.participantLabel}: {lesson.participantName}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={getLessonStatusBadgeClassName(lesson.status)}
            >
              {getLessonStatusLabel(lesson.status)}
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              {formatLessonTimeRange(lesson.startTime, lesson.endTime)}
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              {formatLessonCurrency(lesson.priceCents)}
            </Badge>
            {lesson.meetUrl ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-7 border-emerald-500/30 bg-emerald-500/10 px-2 text-xs text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
              >
                <a
                  href={lesson.meetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Video className="mr-1.5 h-3.5 w-3.5" />
                  Google Meet
                </a>
              </Button>
            ) : null}
            {showManageActions ? (
              <div className="flex items-center gap-1">
                <LessonMeetTranscriptDialog
                  lessonId={lesson.id}
                  lessonTitle={getLessonDisplayTitle(lesson.title)}
                  lessonDate={lesson.lessonDate}
                  studentId={lesson.studentId}
                  studentName={lesson.participantName}
                  hasTranscriptScope={hasTranscriptScope}
                  connectHref={googleConnectHref}
                  summary={lesson.transcriptSummary}
                  onSummaryUpdated={(
                    targetLessonId: string,
                    nextSummary: LessonTranscriptSummary,
                  ) => {
                    setLocalLessons((prev) =>
                      prev.map((item) =>
                        item.id === targetLessonId
                          ? { ...item, transcriptSummary: nextSummary }
                          : item,
                      ),
                    );
                    const matched = localLessons.find(
                      (item) => item.id === targetLessonId,
                    );
                    if (matched) {
                      onLessonUpdated?.({
                        ...matched,
                        transcriptSummary: nextSummary,
                      });
                    }
                  }}
                />
                <EditLessonDialog
                  lesson={{
                    id: lesson.id,
                    studentId: lesson.studentId ?? null,
                    title: lesson.title,
                    lessonDate: lesson.lessonDate,
                    startTime: lesson.startTime,
                    endTime: lesson.endTime,
                    notes: lesson.notes,
                    status: lesson.status,
                    priceCents: lesson.priceCents,
                  }}
                  students={studentOptions}
                />
                <DeleteLessonButton
                  lessonId={lesson.id}
                  title={lesson.title}
                  onDeleted={() => handleLessonDeleted(lesson.id)}
                />
              </div>
            ) : null}
          </div>
        </div>
        {lesson.notes ? (
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {lesson.notes}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/70 bg-card/60 shadow-sm">
        {/* Integrated Calendar Toolbar */}
        <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-card/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <CardTitle className="text-lg font-semibold tracking-tight">
              {formatLessonMonthLabel(month)}
            </CardTitle>
            <Badge variant="secondary" className="text-xs font-medium">
              {filteredLessons.length} session
              {filteredLessons.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManageLessons ? (
              <>
                <Select value={studentFilter} onValueChange={setStudentFilter}>
                  <SelectTrigger className="h-8 w-[155px] bg-background/60 text-xs">
                    <SelectValue placeholder="All students" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All students</SelectItem>
                    <SelectItem value={ONE_TIME_LESSON_OPTION_VALUE}>
                      One-time only
                    </SelectItem>
                    {studentOptions.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-[130px] bg-background/60 text-xs">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {LESSON_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {getLessonStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setStudentFilter("all");
                      setStatusFilter("all");
                    }}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Reset
                  </Button>
                ) : null}
              </>
            ) : null}

            {onStepMonth ? (
              <div className="inline-flex items-center overflow-hidden rounded-lg border border-border/70 bg-background/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-none border-r border-border/60 px-2.5 text-xs"
                  onClick={() => onStepMonth(-1)}
                  aria-label={previousLabel}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-1">
                    {previousLabel}
                  </span>
                </Button>
                {onJumpToToday ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-none border-r border-border/60 px-3 text-xs font-medium"
                    onClick={onJumpToToday}
                  >
                    Today
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-none px-2.5 text-xs"
                  onClick={() => onStepMonth(1)}
                  aria-label={nextLabel}
                >
                  <span className="sr-only sm:not-sr-only sm:mr-1">
                    {nextLabel}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>

        {/* Desktop 7-Column Calendar Grid */}
        <CardContent className="hidden px-0 pb-0 md:block">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {weekdayLabels.map((label) => (
                  <div
                    key={label}
                    className="border-r border-border/50 px-3 py-2.5 last:border-r-0"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {cells.map((cell) => {
                  const dayLessons = lessonsByDate.get(cell.isoDate) ?? [];
                  const earnedCents = dayLessons
                    .filter((lesson) => lesson.status === "completed")
                    .reduce((total, lesson) => total + lesson.priceCents, 0);
                  const isSelected = selectedDate === cell.isoDate;
                  const isClickable = dayLessons.length > 0 || canQuickCreate;
                  const isDropTarget = Boolean(
                    canManageLessons &&
                      dragOverDate === cell.isoDate &&
                      draggedLesson &&
                      draggedLesson.lessonDate !== cell.isoDate,
                  );

                  return (
                    <div
                      key={cell.isoDate}
                      onDragOver={(event) =>
                        handleCellDragOver(event, cell.isoDate)
                      }
                      onDragLeave={(event) =>
                        handleCellDragLeave(event, cell.isoDate)
                      }
                      onDrop={(event) => handleCellDrop(event, cell.isoDate)}
                      className={cn(
                        "group relative min-h-[138px] border-r border-b border-border/50 p-2 align-top last:border-r-0",
                        isClickable &&
                          "cursor-pointer transition-colors hover:bg-accent/25",
                        isSelected && "bg-accent/35",
                        cell.isToday &&
                          "bg-primary/[0.06] ring-1 ring-inset ring-primary/40",
                        !cell.inCurrentMonth &&
                          "bg-background/35 opacity-50 hover:opacity-80",
                        isDropTarget &&
                          "bg-primary/15 opacity-100 ring-2 ring-inset ring-primary",
                      )}
                      onClick={() => {
                        if (dayLessons.length > 0) {
                          setSelectedDate(cell.isoDate);
                          return;
                        }

                        openQuickCreate(cell.isoDate);
                      }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                              cell.isToday
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-foreground/90",
                            )}
                          >
                            {cell.dayNumber}
                          </span>
                          {cell.isToday ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                              Today
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1">
                          {showDailyEarnings && earnedCents > 0 ? (
                            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-emerald-400">
                              {formatLessonCurrency(earnedCents)}
                            </span>
                          ) : null}
                          {dayLessons.length > 0 ? (
                            <span className="rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                              {dayLessons.length}
                            </span>
                          ) : null}
                          {canQuickCreate ? (
                            <button
                              type="button"
                              title={`Add lesson on ${cell.isoDate}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                openQuickCreate(cell.isoDate);
                              }}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-primary/15 hover:text-primary group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-1.5 space-y-1">
                        {dayLessons.slice(0, 3).map((lesson) => renderCompactChip(lesson))}

                        {dayLessons.length > 3 ? (
                          <p className="px-1 text-[10px] font-medium text-muted-foreground">
                            +{dayLessons.length - 3} more
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Calendar Legend & Agenda Toggle Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-card/40 px-4 py-2.5 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                Planned
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Completed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Cancelled
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Video className="h-3 w-3 text-emerald-400" />
                Google Meet
              </span>
              {canManageLessons ? (
                <span className="inline-flex items-center gap-1">
                  <GripVertical className="h-3 w-3" />
                  Drag lesson to reschedule
                </span>
              ) : null}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsMonthlyListExpanded((current) => !current)}
            >
              {isMonthlyListExpanded
                ? "Hide Monthly Agenda"
                : `Monthly Agenda (${filteredLessons.length})`}
              <ChevronDown
                className={cn(
                  "ml-1.5 h-3.5 w-3.5 transition-transform",
                  isMonthlyListExpanded && "rotate-180",
                )}
              />
            </Button>
          </div>
        </CardContent>

        {/* Mobile Agenda View */}
        <CardContent className="space-y-4 p-4 md:hidden">
          {filteredLessons.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {hasActiveFilters
                ? "No lessons match the current filter."
                : emptyMessage}
            </div>
          ) : (
            Array.from(lessonsByDate.entries()).map(([isoDate, dayLessons]) => (
              <div key={isoDate} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {formatLessonDayLabel(isoDate)}
                  </p>
                  <Badge variant="outline">
                    {dayLessons.length} lesson
                    {dayLessons.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {dayLessons.map((lesson) => renderLessonRow(lesson))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Expandable Desktop Monthly Agenda List */}
      {isMonthlyListExpanded ? (
        <Card className="hidden border-border/70 bg-card/60 md:block">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly Agenda</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredLessons.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "No lessons match the current filter."
                  : emptyMessage}
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from(lessonsByDate.entries()).map(
                  ([isoDate, dayLessons]) => (
                    <div key={isoDate} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {formatLessonDayLabel(isoDate)}
                        </p>
                        <Badge variant="outline">
                          {dayLessons.length} lesson
                          {dayLessons.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {dayLessons.map((lesson) => renderLessonRow(lesson))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Sheet
        open={Boolean(selectedDate)}
        onOpenChange={(open) => !open && setSelectedDate(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {selectedDate
                ? formatLessonDayLabel(selectedDate)
                : "Day lessons"}
            </SheetTitle>
            <SheetDescription>
              {selectedDateLessons.length} lesson
              {selectedDateLessons.length === 1 ? "" : "s"} on this day.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {canQuickCreate && selectedDate ? (
              <div className="mb-4 flex justify-end">
                <Button
                  type="button"
                  onClick={() => openQuickCreate(selectedDate)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add lesson on this day
                </Button>
              </div>
            ) : null}

            {selectedDateLessons.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No lessons found for this day.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateLessons.map((lesson) => renderLessonRow(lesson))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CreateLessonDialog
        key={`${quickCreateDate ?? "none"}-${quickCreateDefaultStudentId ?? "none"}`}
        students={studentOptions}
        defaultLessonDate={quickCreateDate ?? undefined}
        defaultStudentId={quickCreateDefaultStudentId}
        open={Boolean(quickCreateDate)}
        onOpenChange={(open) => {
          if (!open) {
            setQuickCreateDate(null);
          }
        }}
        showTrigger={false}
      />

      <RescheduleLessonDialog
        key={`${pendingReschedule?.lesson.id ?? "none"}-${pendingReschedule?.targetDate ?? "none"}`}
        lesson={pendingReschedule?.lesson ?? null}
        targetDate={pendingReschedule?.targetDate ?? null}
        open={Boolean(pendingReschedule)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingReschedule(null);
          }
        }}
        onRescheduled={handleLessonRescheduled}
      />
    </div>
  );
}
