"use client";

import { Video, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatLessonTimeRange,
  getLessonTimingInfo,
  isLessonUpcomingOrLive,
  toLocalIsoDate,
  type LessonStatus,
} from "@/lib/lessons";
import { projectLessonToTimeZone } from "@/lib/lesson-timezone";
import { useClientTimeZone } from "@/components/providers/timezone-cookie-sync";
import {
  useAutoCompleteFinishedLessons,
  useClientNow,
} from "@/components/dashboard/tutor-next-up-cards";
import { cn } from "@/lib/utils";

export interface StudentNextLesson {
  id: string;
  title: string | null;
  lessonDate: string;
  startTime: string | null;
  endTime: string | null;
  startAt?: string | null;
  endAt?: string | null;
  timeZone?: string | null;
  status?: LessonStatus;
  meetUrl: string | null;
  tutorName: string;
}

interface StudentGoogleMeetBannerProps {
  nextLesson: StudentNextLesson | null;
  upcomingLessons?: StudentNextLesson[];
  todayIso: string;
  className?: string;
}

function formatDayMonthLabel(isoDate: string) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(parsed);
}

export function StudentGoogleMeetBanner({
  nextLesson,
  upcomingLessons,
  todayIso: fallbackTodayIso,
  className,
}: StudentGoogleMeetBannerProps) {
  const clientNow = useClientNow();
  const clientTimeZone = useClientTimeZone();

  const candidateList =
    upcomingLessons && upcomingLessons.length > 0
      ? upcomingLessons
      : nextLesson
        ? [nextLesson]
        : [];

  useAutoCompleteFinishedLessons(
    candidateList.map((lesson) => ({
      id: lesson.id,
      lessonDate: lesson.lessonDate,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      startAt: lesson.startAt,
      endAt: lesson.endAt,
      status: lesson.status ?? "planned",
    })),
    clientNow,
  );

  const activeLesson = clientNow
    ? (candidateList.find((lesson) =>
        isLessonUpcomingOrLive(
          {
            lessonDate: lesson.lessonDate,
            startTime: lesson.startTime,
            endTime: lesson.endTime,
            startAt: lesson.startAt,
            endAt: lesson.endAt,
            status: lesson.status ?? "planned",
          },
          clientNow,
        ),
      ) ?? null)
    : (candidateList[0] ?? null);

  const effectiveTodayIso = clientNow
    ? toLocalIsoDate(clientNow)
    : fallbackTodayIso;

  const localized = activeLesson
    ? projectLessonToTimeZone(
        {
          lessonDate: activeLesson.lessonDate,
          startTime: activeLesson.startTime,
          endTime: activeLesson.endTime,
          startAt: activeLesson.startAt,
          endAt: activeLesson.endAt,
          timeZone: activeLesson.timeZone,
        },
        clientTimeZone ?? undefined,
      )
    : null;

  const displayDate = localized?.lessonDate ?? activeLesson?.lessonDate ?? "";
  const displayStartTime = localized?.startTime ?? activeLesson?.startTime ?? null;
  const displayEndTime = localized?.endTime ?? activeLesson?.endTime ?? null;
  const timeZoneLabel = clientTimeZone ? localized?.timeZoneLabel : null;

  const timing =
    activeLesson && clientNow
      ? getLessonTimingInfo(
          {
            lessonDate: displayDate,
            startTime: displayStartTime,
            endTime: displayEndTime,
            startAt: activeLesson.startAt,
            endAt: activeLesson.endAt,
            status: activeLesson.status ?? "planned",
          },
          clientNow,
        )
      : null;

  const isLessonToday = Boolean(activeLesson) && displayDate === effectiveTodayIso;
  const hasMeetUrl = Boolean(activeLesson?.meetUrl);
  const isButtonActive = isLessonToday && hasMeetUrl;

  const timeLabel = activeLesson
    ? formatLessonTimeRange(displayStartTime, displayEndTime)
    : "";

  return (
    <Card
      className={cn(
        "overflow-hidden border transition-all",
        isButtonActive
          ? "border-emerald-500/50 bg-emerald-950/20 shadow-md"
          : "border-border/60 bg-card/60",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              isButtonActive
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Video className="h-6 w-6" />
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                {isLessonToday
                  ? "Lesson Today!"
                  : activeLesson
                    ? `Next lesson on ${formatDayMonthLabel(displayDate)}`
                    : "No upcoming lessons scheduled"}
              </span>
              {timing?.state === "live" ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Live Now
                </span>
              ) : timing?.state === "soon" && timing.minutesUntilStart !== null ? (
                <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  In {timing.minutesUntilStart}m
                </span>
              ) : isLessonToday ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Live Today
                </span>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              {activeLesson
                ? `${activeLesson.tutorName ? `With ${activeLesson.tutorName} · ` : ""}${
                    timeLabel !== "Time not set"
                      ? `${timeLabel}${timeZoneLabel ? ` (${timeZoneLabel})` : ""}`
                      : "Time TBA"
                  }`
                : "Your tutor will schedule your next session soon."}
            </p>
          </div>
        </div>

        <div>
          {isButtonActive && activeLesson?.meetUrl ? (
            <Button
              asChild
              size="lg"
              className="h-11 w-full bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-500 sm:w-auto"
            >
              <a
                href={activeLesson.meetUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Video className="mr-2 h-5 w-5" />
                Join Google Meet
              </a>
            </Button>
          ) : (
            <Button
              disabled
              size="lg"
              variant="outline"
              className="h-11 w-full text-muted-foreground sm:w-auto opacity-70"
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              {activeLesson
                ? `Next lesson on ${formatDayMonthLabel(displayDate)}`
                : "No lesson today"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
