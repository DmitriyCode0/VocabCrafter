"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { ArrowRight, CalendarClock, Clock3, Video } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
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
import {
  formatLessonTimeRange,
  getLessonTimingInfo,
  isLessonUpcomingOrLive,
  toLocalIsoDate,
  type LessonStatus,
} from "@/lib/lessons";
import { projectLessonToTimeZone } from "@/lib/lesson-timezone";
import { useClientTimeZone } from "@/components/providers/timezone-cookie-sync";
import { cn } from "@/lib/utils";

export interface TutorDashboardLessonItem {
  id: string;
  studentId: string | null;
  studentName: string;
  lessonDate: string;
  startTime: string | null;
  endTime: string | null;
  timeZone?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  status: LessonStatus;
  meetUrl: string | null;
  lessonsLeft: number | null;
  isLowBalance: boolean;
}

const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
let sharedNowMs = 0;

function subscribeClock(listener: () => void) {
  if (clockListeners.size === 0) {
    sharedNowMs = Date.now();
    clockTimer = setInterval(() => {
      sharedNowMs = Date.now();
      clockListeners.forEach((cb) => cb());
    }, 30_000);
  }
  clockListeners.add(listener);

  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

function getClientClockSnapshot(): number {
  if (sharedNowMs === 0) {
    sharedNowMs = Date.now();
  }
  return sharedNowMs;
}

/**
 * Hydration-safe live local clock updating every 30s on the client.
 */
export function useLiveClock(initialNowMs: number): Date {
  const nowMs = useSyncExternalStore(
    subscribeClock,
    getClientClockSnapshot,
    () => initialNowMs,
  );
  return new Date(nowMs);
}

/**
 * Returns null on SSR/initial hydration and a live local Date once mounted.
 */
export function useClientNow(): Date | null {
  const nowMs = useSyncExternalStore(
    subscribeClock,
    getClientClockSnapshot,
    () => 0,
  );
  return nowMs > 0 ? new Date(nowMs) : null;
}

/**
 * Syncs browser IANA timezone cookie and auto-completes planned lessons on
 * the backend right after their scheduled local finish time passes.
 */
export function useAutoCompleteFinishedLessons(
  lessons: Array<{
    id: string;
    lessonDate: string;
    startTime: string | null;
    endTime: string | null;
    startAt?: string | null;
    endAt?: string | null;
    status: LessonStatus;
  }>,
  now: Date | null,
  onCompleted?: (completedIds: string[]) => void,
) {
  const router = useRouter();
  const submittedIdsRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);
  const onCompletedRef = useRef(onCompleted);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        document.cookie = `vc_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      }
    } catch {
      // Ignore cookie write failures
    }
  }, []);

  useEffect(() => {
    if (!now || inFlightRef.current) return;

    const overdueIds = lessons
      .filter(
        (lesson) =>
          lesson.status === "planned" &&
          !isLessonUpcomingOrLive(lesson, now) &&
          !submittedIdsRef.current.has(lesson.id),
      )
      .map((lesson) => lesson.id);

    if (overdueIds.length === 0) return;

    overdueIds.forEach((id) => submittedIdsRef.current.add(id));
    inFlightRef.current = true;

    let timeZone: string | undefined;
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      timeZone = undefined;
    }

    fetch("/api/lessons/auto-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone }),
    })
      .then(async (res) => {
        if (!res.ok) {
          overdueIds.forEach((id) => submittedIdsRef.current.delete(id));
          return;
        }
        const data = (await res.json().catch(() => null)) as {
          completedIds?: string[];
        } | null;
        if (data?.completedIds && data.completedIds.length > 0) {
          onCompletedRef.current?.(data.completedIds);
          router.refresh();
        }
      })
      .catch(() => {
        overdueIds.forEach((id) => submittedIdsRef.current.delete(id));
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [lessons, now, router]);
}

function formatShortLessonDate(isoDate: string) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(parsed);
}

function getRelativeDayLabel(
  isoDate: string,
  todayIso: string,
  tomorrowIso: string,
  todayLabel: string,
  tomorrowLabel: string,
) {
  if (isoDate === todayIso) return todayLabel;
  if (isoDate === tomorrowIso) return tomorrowLabel;
  return formatShortLessonDate(isoDate);
}

export function TutorNextUpCard({
  lessons,
  initialNowMs,
}: {
  lessons: TutorDashboardLessonItem[];
  initialNowMs: number;
}) {
  const { messages } = useAppI18n();
  const now = useLiveClock(initialNowMs);
  const clientTimeZone = useClientTimeZone();
  useAutoCompleteFinishedLessons(lessons, now);

  const todayIso = toLocalIsoDate(now);
  const tomorrowIso = toLocalIsoDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
  );

  const localizedLessons = lessons.map((lesson) => {
    if (!clientTimeZone || !lesson.startAt) return lesson;
    const projected = projectLessonToTimeZone(lesson, clientTimeZone);
    return {
      ...lesson,
      lessonDate: projected.lessonDate,
      startTime: projected.startTime,
      endTime: projected.endTime,
    };
  });

  const activeUpcoming = localizedLessons.filter((lesson) =>
    isLessonUpcomingOrLive(lesson, now),
  );
  const nextLesson = activeUpcoming[0] ?? null;
  const timing = nextLesson ? getLessonTimingInfo(nextLesson, now) : null;
  const remainingTodayCount = activeUpcoming.filter(
    (lesson) => lesson.lessonDate === todayIso,
  ).length;

  const kpi = messages.dashboard.tutor.kpi;
  const cc = messages.dashboard.tutor.commandCenter;
  const isLive = timing?.state === "live";
  const isImminent =
    isLive ||
    (timing?.state === "soon" &&
      timing.minutesUntilStart !== null &&
      timing.minutesUntilStart <= 15);

  return (
    <Card
      className={cn(
        "border-border/70 bg-card/70 shadow-xs transition-colors",
        isLive && "border-emerald-500/45 bg-emerald-500/[0.05]",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {kpi.nextLessonTitle}
          </CardTitle>
          {isLive ? (
            <Badge
              variant="outline"
              className="h-5 gap-1 border-emerald-500/40 bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              />
              {cc.liveNowBadge}
            </Badge>
          ) : timing?.state === "soon" && timing.minutesUntilStart !== null ? (
            <Badge
              variant="outline"
              className="h-5 border-amber-500/40 bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
            >
              {cc.startsInMinutes(timing.minutesUntilStart)}
            </Badge>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            isLive
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
              : "bg-primary/10 text-primary",
          )}
        >
          <Clock3 className="h-3.5 w-3.5" />
        </div>
      </CardHeader>
      <CardContent>
        {nextLesson ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-base font-semibold">
                {nextLesson.studentName}
              </span>
              {nextLesson.meetUrl ? (
                <Button
                  asChild
                  variant={isImminent ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 shrink-0 px-2.5 text-xs",
                    isImminent
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
                  )}
                >
                  <a
                    href={nextLesson.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Video className="mr-1 h-3.5 w-3.5" />
                    Meet
                  </a>
                </Button>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {getRelativeDayLabel(
                nextLesson.lessonDate,
                todayIso,
                tomorrowIso,
                cc.todayBadge,
                cc.tomorrowBadge,
              )}{" "}
              · {formatLessonTimeRange(nextLesson.startTime, nextLesson.endTime)}
              {remainingTodayCount > 1
                ? ` · ${cc.moreTodayLabel(remainingTodayCount - 1)}`
                : ""}
            </p>
          </>
        ) : (
          <>
            <div className="text-base font-semibold">{kpi.noUpcomingTitle}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpi.todayAndWeek(0, 0)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function TutorUpcomingScheduleCard({
  lessons,
  initialNowMs,
}: {
  lessons: TutorDashboardLessonItem[];
  initialNowMs: number;
}) {
  const { messages } = useAppI18n();
  const now = useLiveClock(initialNowMs);
  const clientTimeZone = useClientTimeZone();

  const todayIso = toLocalIsoDate(now);
  const tomorrowIso = toLocalIsoDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
  );
  const cc = messages.dashboard.tutor.commandCenter;

  const localizedLessons = lessons.map((lesson) => {
    if (!clientTimeZone || !lesson.startAt) return lesson;
    const projected = projectLessonToTimeZone(lesson, clientTimeZone);
    return {
      ...lesson,
      lessonDate: projected.lessonDate,
      startTime: projected.startTime,
      endTime: projected.endTime,
    };
  });

  const upcomingLessons = localizedLessons
    .filter((lesson) => isLessonUpcomingOrLive(lesson, now))
    .slice(0, 6);

  return (
    <Card className="flex flex-col border-border/70 bg-card/70 shadow-xs lg:col-span-5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CalendarClock className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">
              {cc.todayScheduleTitle}
            </CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs font-medium">
            {upcomingLessons.length}
          </Badge>
        </div>
        <CardDescription>{cc.todayScheduleDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {upcomingLessons.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {cc.noUpcomingLessons}
          </div>
        ) : (
          upcomingLessons.map((lesson, idx) => {
            const isToday = lesson.lessonDate === todayIso;
            const isTomorrow = lesson.lessonDate === tomorrowIso;
            const timing = getLessonTimingInfo(lesson, now);
            const isLive = timing.state === "live";
            const isNext = idx === 0;
            const isImminent =
              isLive ||
              (timing.state === "soon" &&
                timing.minutesUntilStart !== null &&
                timing.minutesUntilStart <= 15);

            return (
              <div
                key={lesson.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border border-border/70 border-l-[3px] px-3 py-2.5 text-sm transition-colors",
                  isLive
                    ? "border-emerald-500/45 border-l-emerald-500 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.12]"
                    : isToday
                      ? "border-l-primary bg-primary/[0.06] hover:bg-primary/[0.1]"
                      : "border-l-sky-500 bg-background/40 hover:bg-accent/20",
                )}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium">
                      {lesson.studentName}
                    </span>
                    {isLive ? (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 border-emerald-500/40 bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                      >
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                        />
                        {cc.liveNowBadge}
                      </Badge>
                    ) : isNext ? (
                      <Badge
                        variant="outline"
                        className="h-5 border-primary/40 bg-primary/10 px-1.5 text-[10px] font-semibold text-primary"
                      >
                        {cc.nextUpBadge}
                      </Badge>
                    ) : null}
                    {isToday ? (
                      <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                        {cc.todayBadge}
                      </Badge>
                    ) : isTomorrow ? (
                      <Badge
                        variant="secondary"
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {cc.tomorrowBadge}
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {formatShortLessonDate(lesson.lessonDate)}
                      </Badge>
                    )}
                    {!isLive &&
                    timing.state === "soon" &&
                    timing.minutesUntilStart !== null ? (
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-300">
                        {cc.startsInMinutes(timing.minutesUntilStart)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatLessonTimeRange(lesson.startTime, lesson.endTime)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {lesson.meetUrl ? (
                    <Button
                      asChild
                      variant={isImminent ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-7 px-2 text-xs",
                        isImminent
                          ? "bg-emerald-600 text-white hover:bg-emerald-500"
                          : "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
                      )}
                    >
                      <a
                        href={lesson.meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Video className="mr-1 h-3.5 w-3.5" />
                        Meet
                      </a>
                    </Button>
                  ) : null}
                  {lesson.lessonsLeft !== null ? (
                    <Badge
                      variant={lesson.isLowBalance ? "destructive" : "outline"}
                      className="text-[11px] tabular-nums"
                    >
                      {cc.lessonsLeftBadge(lesson.lessonsLeft)}
                    </Badge>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
      <CardFooter className="border-t border-border/40 pt-3">
        <Button asChild variant="ghost" size="sm" className="ml-auto text-xs">
          <Link href="/lessons" prefetch={false}>
            {cc.openScheduleButton}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
