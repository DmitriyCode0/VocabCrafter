"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreateLessonDialog } from "@/components/lessons/create-lesson-dialog";
import { DeleteLessonButton } from "@/components/lessons/delete-lesson-button";
import { EditLessonDialog } from "@/components/lessons/edit-lesson-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  formatLessonDayLabel,
  formatLessonCurrency,
  formatLessonTimeRange,
  getLessonDisplayTitle,
  getLessonStatusBadgeClassName,
  getLessonStatusLabel,
  getLessonStatusSurfaceClassName,
  getLessonWeekdayLabels,
  groupLessonsByDate,
  isLessonJoinable,
  type LessonStudentOption,
  type MonthlyLessonItem,
} from "@/lib/lessons";
import { CalendarDays, ChevronDown, PlusCircle, Video } from "lucide-react";

interface MonthlyLessonsCalendarProps {
  month: Date;
  lessons: MonthlyLessonItem[];
  emptyMessage: string;
  canManageLessons?: boolean;
  studentOptions?: LessonStudentOption[];
}

export function MonthlyLessonsCalendar({
  month,
  lessons,
  emptyMessage,
  canManageLessons = false,
  studentOptions = [],
}: MonthlyLessonsCalendarProps) {
  const [isMonthlyListExpanded, setIsMonthlyListExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [quickCreateDate, setQuickCreateDate] = useState<string | null>(null);
  const [localLessons, setLocalLessons] = useState<MonthlyLessonItem[]>(lessons);
  useEffect(() => {
    setLocalLessons(lessons);
  }, [lessons]);

  const cells = buildLessonMonthCells(month);
  const weekdayLabels = getLessonWeekdayLabels();
  const lessonsByDate = groupLessonsByDate(localLessons);
  const selectedDateLessons = selectedDate
    ? (lessonsByDate.get(selectedDate) ?? [])
    : [];

  function handleLessonDeleted(id: string) {
    setLocalLessons((prev) => prev.filter((l) => l.id !== id));
    // Also clear the selected date panel if it becomes empty
    setSelectedDate((prev) => {
      if (!prev) return prev;
      const remaining = (lessonsByDate.get(prev) ?? []).filter((l) => l.id !== id);
      return remaining.length === 0 ? null : prev;
    });
  }
  const canQuickCreate = canManageLessons;
  const quickCreateDefaultStudentId = undefined;

  function openQuickCreate(date: string) {
    if (!canQuickCreate) {
      return;
    }

    setQuickCreateDate(date);
  }

  function renderLessonRow(
    lesson: MonthlyLessonItem,
    options?: {
      compact?: boolean;
      showParticipant?: boolean;
      showManageActions?: boolean;
    },
  ) {
    const compact = options?.compact ?? false;
    const showParticipant = options?.showParticipant ?? true;
    const showManageActions = options?.showManageActions ?? canManageLessons;

    return (
      <div
        key={lesson.id}
        className={cn(
          compact
            ? "rounded-md border px-2 py-1 text-[11px] leading-4"
            : "rounded-lg border px-3 py-3 text-sm",
          getLessonStatusSurfaceClassName(lesson.status),
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className={cn(compact ? "truncate font-medium" : "font-medium")}>
              {compact
                ? formatLessonTimeRange(lesson.startTime, lesson.endTime)
                : getLessonDisplayTitle(lesson.title)}
            </p>
            {showParticipant ? (
              <p
                className={cn(
                  compact ? "truncate font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {compact
                  ? lesson.participantName
                  : `${lesson.participantLabel}: ${lesson.participantName}`}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                compact ? "h-4 px-1 text-[9px]" : undefined,
                getLessonStatusBadgeClassName(lesson.status),
              )}
            >
              {getLessonStatusLabel(lesson.status)}
            </Badge>
            {!compact ? (
              <Badge variant="outline">
                {formatLessonTimeRange(lesson.startTime, lesson.endTime)}
              </Badge>
            ) : null}
            {!compact ? (
              <Badge variant="outline">
                {formatLessonCurrency(lesson.priceCents)}
              </Badge>
            ) : null}
            {!compact && isLessonJoinable(lesson) ? (
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/lessons/${lesson.id}/room`}>
                  <Video className="h-3.5 w-3.5" />
                  Join
                </Link>
              </Button>
            ) : null}
            {showManageActions ? (
              <div className="flex items-center gap-1">
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
        {compact ? (
          <>
            <p className="truncate text-muted-foreground">
              {formatLessonCurrency(lesson.priceCents)}
            </p>
          </>
        ) : null}
        {lesson.notes ? (
          <p
            className={cn(
              compact
                ? "mt-1 truncate text-muted-foreground"
                : "mt-2 whitespace-pre-wrap text-muted-foreground",
            )}
          >
            {lesson.notes}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle className="text-base">Monthly Calendar</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 border-y text-xs font-medium text-muted-foreground">
                {weekdayLabels.map((label) => (
                  <div
                    key={label}
                    className="border-r px-3 py-2 last:border-r-0"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {cells.map((cell) => {
                  const dayLessons = lessonsByDate.get(cell.isoDate) ?? [];
                  const isSelected = selectedDate === cell.isoDate;
                  const isClickable = dayLessons.length > 0 || canQuickCreate;

                  return (
                    <div
                      key={cell.isoDate}
                      className={cn(
                        "min-h-36 border-r border-b p-2 align-top",
                        isClickable &&
                          "cursor-pointer transition-colors hover:bg-accent/30",
                        isSelected && "bg-accent/40",
                        !cell.inCurrentMonth &&
                          "bg-muted/20 text-muted-foreground",
                      )}
                      onClick={() => {
                        if (dayLessons.length > 0) {
                          setSelectedDate(cell.isoDate);
                          return;
                        }

                        openQuickCreate(cell.isoDate);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex size-7 items-center justify-center rounded-full text-sm font-medium",
                            cell.isToday &&
                              "bg-primary text-primary-foreground",
                          )}
                        >
                          {cell.dayNumber}
                        </span>
                        {dayLessons.length > 0 ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {dayLessons.length}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-2 space-y-1.5">
                        {dayLessons.slice(0, 2).map((lesson) =>
                          renderLessonRow(lesson, {
                            compact: true,
                            showManageActions: false,
                          }),
                        )}

                        {dayLessons.length > 2 ? (
                          <p className="text-[11px] text-muted-foreground">
                            +{dayLessons.length - 2} more
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Lessons This Month</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lessons.length} lesson{lessons.length === 1 ? "" : "s"} in this
              month view.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsMonthlyListExpanded((current) => !current)}
          >
            {isMonthlyListExpanded ? "Collapse" : "Expand"}
            <ChevronDown
              className={cn(
                "ml-2 h-4 w-4 transition-transform",
                isMonthlyListExpanded && "rotate-180",
              )}
            />
          </Button>
        </CardHeader>
        {isMonthlyListExpanded ? (
          <CardContent>
            {lessons.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {emptyMessage}
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
        ) : null}
      </Card>

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
    </div>
  );
}
