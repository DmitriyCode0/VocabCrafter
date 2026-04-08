import { DeleteLessonButton } from "@/components/lessons/delete-lesson-button";
import { EditLessonDialog } from "@/components/lessons/edit-lesson-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  buildLessonMonthCells,
  formatLessonDayLabel,
  formatLessonTimeRange,
  getLessonStatusBadgeClassName,
  getLessonStatusLabel,
  getLessonStatusSurfaceClassName,
  getLessonWeekdayLabels,
  groupLessonsByDate,
  type LessonStudentOption,
  type MonthlyLessonItem,
} from "@/lib/lessons";

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
  const cells = buildLessonMonthCells(month);
  const weekdayLabels = getLessonWeekdayLabels();
  const lessonsByDate = groupLessonsByDate(lessons);

  return (
    <div className="space-y-4">
      <Card>
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

                  return (
                    <div
                      key={cell.isoDate}
                      className={cn(
                        "min-h-36 border-r border-b p-2 align-top",
                        !cell.inCurrentMonth &&
                          "bg-muted/20 text-muted-foreground",
                      )}
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
                        {dayLessons.slice(0, 2).map((lesson) => (
                          <div
                            key={lesson.id}
                            className={cn(
                              "rounded-md border px-2 py-1 text-[11px] leading-4",
                              getLessonStatusSurfaceClassName(lesson.status),
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <p className="truncate font-medium">
                                {formatLessonTimeRange(
                                  lesson.startTime,
                                  lesson.endTime,
                                )}
                              </p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-4 px-1 text-[9px]",
                                  getLessonStatusBadgeClassName(lesson.status),
                                )}
                              >
                                {getLessonStatusLabel(lesson.status)}
                              </Badge>
                            </div>
                            <p className="truncate">{lesson.title}</p>
                            <p className="truncate text-muted-foreground">
                              {lesson.participantName}
                            </p>
                          </div>
                        ))}

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
        <CardHeader>
          <CardTitle className="text-base">Lessons This Month</CardTitle>
        </CardHeader>
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
                    <p className="text-sm font-medium">
                      {formatLessonDayLabel(isoDate)}
                    </p>
                    <div className="space-y-2">
                      {dayLessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className={cn(
                            "rounded-lg border px-3 py-3 text-sm",
                            getLessonStatusSurfaceClassName(lesson.status),
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{lesson.title}</p>
                              <p className="text-muted-foreground">
                                {lesson.participantLabel}:{" "}
                                {lesson.participantName}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={getLessonStatusBadgeClassName(
                                  lesson.status,
                                )}
                              >
                                {getLessonStatusLabel(lesson.status)}
                              </Badge>
                              <Badge variant="outline">
                                {formatLessonTimeRange(
                                  lesson.startTime,
                                  lesson.endTime,
                                )}
                              </Badge>
                              {canManageLessons && lesson.studentId ? (
                                <div className="flex items-center gap-1">
                                  <EditLessonDialog
                                    lesson={{
                                      id: lesson.id,
                                      studentId: lesson.studentId,
                                      title: lesson.title,
                                      lessonDate: lesson.lessonDate,
                                      startTime: lesson.startTime,
                                      endTime: lesson.endTime,
                                      notes: lesson.notes,
                                      status: lesson.status,
                                    }}
                                    students={studentOptions}
                                  />
                                  <DeleteLessonButton
                                    lessonId={lesson.id}
                                    title={lesson.title}
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
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
