"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Globe,
  TrendingUp,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import { CreateLessonDialog } from "@/components/lessons/create-lesson-dialog";
import { GoogleCalendarSyncCard } from "@/components/lessons/google-calendar-sync-card";
import { LessonBalanceManager } from "@/components/lessons/lesson-balance-manager";
import { LessonsPageHeader } from "@/components/lessons/lessons-page-header";
import { MonthlyLessonsCalendar } from "@/components/lessons/monthly-lessons-calendar";
import { useClientTimeZone } from "@/components/providers/timezone-cookie-sync";
import {
  getShortTimeZoneLabel,
  projectLessonToTimeZone,
} from "@/lib/lesson-timezone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatLessonCurrency,
  formatLessonMonthParam,
  formatLessonTimeRange,
  getLessonMonthRange,
  getLessonTimingInfo,
  isLessonUpcomingOrLive,
  normalizeLessonMonthParam,
  toLocalIsoDate,
  type LessonBalanceSummaryItem,
  type LessonStudentOption,
  type MonthlyLessonItem,
} from "@/lib/lessons";
import {
  useAutoCompleteFinishedLessons,
  useClientNow,
} from "@/components/dashboard/tutor-next-up-cards";
import type { Role } from "@/types/roles";

function formatShortDate(isoDate: string) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(parsed);
}

interface GoogleCalendarConnectionStatus {
  googleEmail: string | null;
  calendarId: string;
  connectedAt: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  hasTranscriptScope?: boolean;
}

interface LessonsScheduleClientProps {
  role: Role;
  initialMonthParam: string;
  title: string;
  description: string;
  previousLabel: string;
  nextLabel: string;
  allLessons: MonthlyLessonItem[];
  connectedStudents?: LessonStudentOption[];
  googleCalendarAvailable?: boolean;
  googleCalendarConnection?: GoogleCalendarConnectionStatus | null;
  studentTutorCount?: number;
  studentBalanceSummaries?: LessonBalanceSummaryItem[];
}

export function LessonsScheduleClient({
  role,
  initialMonthParam,
  title,
  description,
  previousLabel,
  nextLabel,
  allLessons,
  connectedStudents = [],
  googleCalendarAvailable = false,
  googleCalendarConnection = null,
  studentTutorCount = 0,
  studentBalanceSummaries = [],
}: LessonsScheduleClientProps) {
  const [monthParam, setMonthParam] = useState(initialMonthParam);
  const [lessonsState, setLessonsState] =
    useState<MonthlyLessonItem[]>(allLessons);
  const clientNow = useClientNow();
  const clientTimeZone = useClientTimeZone();

  const localizedLessons = useMemo(() => {
    if (!clientTimeZone) {
      return lessonsState;
    }

    return lessonsState.map((lesson) => {
      if (!lesson.startAt) return lesson;
      const projected = projectLessonToTimeZone(lesson, clientTimeZone);
      return {
        ...lesson,
        lessonDate: projected.lessonDate,
        startTime: projected.startTime,
        endTime: projected.endTime,
      };
    });
  }, [lessonsState, clientTimeZone]);

  useAutoCompleteFinishedLessons(
    role === "student" ? [] : localizedLessons,
    role === "student" ? null : clientNow,
    (completedIds) => {
      const completedSet = new Set(completedIds);
      setLessonsState((prev) =>
        prev.map((item) =>
          completedSet.has(item.id)
            ? { ...item, status: "completed" as const }
            : item,
        ),
      );
    },
  );

  useEffect(() => {
    setMonthParam(initialMonthParam);
  }, [initialMonthParam]);

  useEffect(() => {
    setLessonsState(allLessons);
  }, [allLessons]);

  const monthDate = useMemo(
    () => normalizeLessonMonthParam(monthParam),
    [monthParam],
  );

  const monthLessons = useMemo(() => {
    const { startIsoDate, endIsoDate } = getLessonMonthRange(monthDate);
    return localizedLessons.filter(
      (lesson) =>
        lesson.lessonDate >= startIsoDate && lesson.lessonDate <= endIsoDate,
    );
  }, [localizedLessons, monthDate]);

  const tutorMetrics = useMemo(() => {
    const refNow = clientNow;
    const refDate = refNow ?? new Date();
    const todayIso = toLocalIsoDate(refDate);
    const tomorrowIso = toLocalIsoDate(
      new Date(
        refDate.getFullYear(),
        refDate.getMonth(),
        refDate.getDate() + 1,
      ),
    );
    const completed = monthLessons.filter((l) => l.status === "completed");
    const planned = monthLessons.filter((l) => l.status === "planned");
    const cancelled = monthLessons.filter((l) => l.status === "cancelled");

    const earnedCents = completed.reduce((sum, l) => sum + l.priceCents, 0);
    const plannedCents = planned.reduce((sum, l) => sum + l.priceCents, 0);

    const todayCompletedCount = localizedLessons.filter(
      (l) => l.lessonDate === todayIso && l.status === "completed",
    ).length;

    const nextUpcoming = localizedLessons.find((l) =>
      refNow
        ? isLessonUpcomingOrLive(l, refNow)
        : l.lessonDate >= todayIso && l.status === "planned",
    );
    const nextUpcomingTiming =
      nextUpcoming && refNow
        ? getLessonTimingInfo(nextUpcoming, refNow)
        : null;

    const scheduledStudentIds = new Set(
      monthLessons
        .filter((l) => l.status !== "cancelled" && l.studentId)
        .map((l) => l.studentId as string),
    );

    return {
      todayIso,
      tomorrowIso,
      activeCount: completed.length + planned.length,
      completedCount: completed.length,
      plannedCount: planned.length,
      cancelledCount: cancelled.length,
      earnedCents,
      plannedCents,
      todayCompletedCount,
      nextUpcoming,
      nextUpcomingTiming,
      scheduledStudentsCount: scheduledStudentIds.size,
    };
  }, [localizedLessons, monthLessons, clientNow]);

  const timeZoneShortLabel = clientTimeZone
    ? getShortTimeZoneLabel(clientNow ?? new Date(), clientTimeZone)
    : null;

  function handleLessonUpdated(updatedLesson: MonthlyLessonItem) {
    setLessonsState((prev) =>
      prev.map((item) => (item.id === updatedLesson.id ? updatedLesson : item)),
    );
  }

  function handleStepMonth(offset: number) {
    const nextDate = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + offset,
      1,
    );
    const nextParam = formatLessonMonthParam(nextDate);
    setMonthParam(nextParam);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/lessons?month=${nextParam}`);
    }
  }

  function handleJumpToToday() {
    const nextParam = formatLessonMonthParam(new Date());
    setMonthParam(nextParam);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/lessons?month=${nextParam}`);
    }
  }

  const scheduleHref = `/lessons?month=${monthParam}`;
  const connectHref = `/api/google-calendar/connect?next=${encodeURIComponent(scheduleHref)}`;

  return (
    <div className="space-y-5">
      <LessonsPageHeader
        role={role}
        currentSection="schedule"
        title={title}
        description={description}
        scheduleHref={scheduleHref}
        actions={
          role !== "student" ? (
            <CreateLessonDialog students={connectedStudents} />
          ) : undefined
        }
      />

      {clientTimeZone ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span>
            Times shown in your local timezone: {clientTimeZone}
            {timeZoneShortLabel ? ` (${timeZoneShortLabel})` : ""}
          </span>
        </div>
      ) : null}

      {role === "student" ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="border-border/70 bg-card/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Lessons This Month
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDays className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {monthLessons.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  sessions visible in this month view
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Connected Tutors
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                  <UserCheck className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {studentTutorCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  tutors who can schedule lessons for you
                </p>
              </CardContent>
            </Card>
          </div>

          <MonthlyLessonsCalendar
            month={monthDate}
            lessons={monthLessons}
            emptyMessage="No lessons are scheduled in this month yet. Your tutor will add them here."
            onStepMonth={handleStepMonth}
            onJumpToToday={handleJumpToToday}
            previousLabel={previousLabel}
            nextLabel={nextLabel}
          />

          {studentBalanceSummaries.length > 0 ? (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Balances</h2>
                <p className="text-sm text-muted-foreground">
                  See your prepaid balance, lesson price, and how many lessons
                  each tutor balance currently covers.
                </p>
              </div>
              <LessonBalanceManager summaries={studentBalanceSummaries} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/70 bg-card/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Month Sessions
                </CardTitle>
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {tutorMetrics.activeCount}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tutorMetrics.completedCount} completed ·{" "}
                  {tutorMetrics.plannedCount} planned
                  {tutorMetrics.cancelledCount > 0
                    ? ` · ${tutorMetrics.cancelledCount} cancelled`
                    : ""}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Today &amp; Next Up
                  </CardTitle>
                  {tutorMetrics.nextUpcomingTiming?.state === "live" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                      />
                      Now
                    </span>
                  ) : tutorMetrics.nextUpcomingTiming?.state === "soon" &&
                    tutorMetrics.nextUpcomingTiming.minutesUntilStart !== null ? (
                    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      In {tutorMetrics.nextUpcomingTiming.minutesUntilStart}m
                    </span>
                  ) : null}
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/10 text-sky-400">
                  <Clock3 className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                {tutorMetrics.nextUpcoming ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-base font-semibold">
                        {tutorMetrics.nextUpcoming.participantName}
                      </span>
                      {tutorMetrics.nextUpcoming.meetUrl ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-6 shrink-0 border-emerald-500/30 bg-emerald-500/10 px-2 text-[11px] text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                        >
                          <a
                            href={tutorMetrics.nextUpcoming.meetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Video className="mr-1 h-3 w-3" />
                            Meet
                          </a>
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {tutorMetrics.nextUpcoming.lessonDate ===
                      tutorMetrics.todayIso
                        ? "Today"
                        : tutorMetrics.nextUpcoming.lessonDate ===
                            tutorMetrics.tomorrowIso
                          ? "Tomorrow"
                          : formatShortDate(
                              tutorMetrics.nextUpcoming.lessonDate,
                            )}{" "}
                      ·{" "}
                      {formatLessonTimeRange(
                        tutorMetrics.nextUpcoming.startTime,
                        tutorMetrics.nextUpcoming.endTime,
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-base font-semibold">All caught up</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tutorMetrics.todayCompletedCount} completed today · No
                      upcoming sessions
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Monthly Revenue
                </CardTitle>
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-emerald-400">
                  {formatLessonCurrency(tutorMetrics.earnedCents)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tutorMetrics.plannedCents > 0
                    ? `+ ${formatLessonCurrency(tutorMetrics.plannedCents)} scheduled`
                    : "From completed sessions"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Active Students
                </CardTitle>
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
                  <Users className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {connectedStudents.length}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tutorMetrics.scheduledStudentsCount} scheduled this month
                </p>
              </CardContent>
            </Card>
          </div>

          <GoogleCalendarSyncCard
            available={googleCalendarAvailable}
            connectHref={connectHref}
            connection={googleCalendarConnection}
          />

          <MonthlyLessonsCalendar
            month={monthDate}
            lessons={monthLessons}
            showDailyEarnings
            emptyMessage={
              connectedStudents.length > 0
                ? "No lessons scheduled in this month yet. Add a one-time lesson or one for a connected student."
                : "No lessons scheduled in this month yet. Add a one-time lesson or connect a student."
            }
            canManageLessons
            studentOptions={connectedStudents}
            onStepMonth={handleStepMonth}
            onJumpToToday={handleJumpToToday}
            previousLabel={previousLabel}
            nextLabel={nextLabel}
            onLessonUpdated={handleLessonUpdated}
            hasTranscriptScope={
              googleCalendarConnection?.hasTranscriptScope ?? false
            }
            googleConnectHref={connectHref}
          />
        </div>
      )}
    </div>
  );
}

