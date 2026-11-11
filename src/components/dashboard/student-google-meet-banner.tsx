import { Video, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatLessonTimeRange } from "@/lib/lessons";
import { cn } from "@/lib/utils";

export interface StudentNextLesson {
  id: string;
  title: string | null;
  lessonDate: string;
  startTime: string | null;
  endTime: string | null;
  meetUrl: string | null;
  tutorName: string;
}

interface StudentGoogleMeetBannerProps {
  nextLesson: StudentNextLesson | null;
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
  todayIso,
  className,
}: StudentGoogleMeetBannerProps) {
  const isLessonToday = nextLesson?.lessonDate === todayIso;
  const hasMeetUrl = Boolean(nextLesson?.meetUrl);
  const isButtonActive = isLessonToday && hasMeetUrl;

  const timeLabel = nextLesson
    ? formatLessonTimeRange(nextLesson.startTime, nextLesson.endTime)
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                {isLessonToday
                  ? "Lesson Today!"
                  : nextLesson
                    ? `Next lesson on ${formatDayMonthLabel(nextLesson.lessonDate)}`
                    : "No upcoming lessons scheduled"}
              </span>
              {isLessonToday ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Live Today
                </span>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              {nextLesson
                ? `${nextLesson.tutorName ? `With ${nextLesson.tutorName} · ` : ""}${timeLabel !== "Time not set" ? timeLabel : "Time TBA"}`
                : "Your tutor will schedule your next session soon."}
            </p>
          </div>
        </div>

        <div>
          {isButtonActive ? (
            <Button
              asChild
              size="lg"
              className="h-11 w-full bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-500 sm:w-auto"
            >
              <a
                href={nextLesson.meetUrl!}
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
              {nextLesson
                ? `Next lesson on ${formatDayMonthLabel(nextLesson.lessonDate)}`
                : "No lesson today"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

