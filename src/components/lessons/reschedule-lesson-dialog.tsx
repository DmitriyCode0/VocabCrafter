"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatLessonDayLabel,
  getLessonDisplayTitle,
  getLessonStatusLabel,
  LESSON_STATUSES,
  type LessonStatus,
  type MonthlyLessonItem,
} from "@/lib/lessons";

interface RescheduleLessonDialogProps {
  lesson: MonthlyLessonItem | null;
  targetDate: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescheduled: (updatedLesson: MonthlyLessonItem) => void;
}

interface LessonMutationResponse {
  error?: string;
  calendarSync?: {
    status: "synced" | "skipped" | "failed";
    message?: string;
  };
}

const TIME_PATTERN = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

function parseTimeToMinutes(value?: string | null) {
  if (!value || !TIME_PATTERN.test(value)) {
    return null;
  }

  const [hourText, minuteText] = value.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

function formatMinutesToTime(totalMinutes: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isFutureSchedule(dateIso: string, startTimeValue: string) {
  if (!dateIso) {
    return false;
  }

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  if (dateIso > todayIso) {
    return true;
  }

  if (dateIso < todayIso) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(startTimeValue);
  if (startMinutes === null) {
    return false;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return startMinutes > nowMinutes;
}

export function RescheduleLessonDialog({
  lesson,
  targetDate,
  open,
  onOpenChange,
  onRescheduled,
}: RescheduleLessonDialogProps) {
  const router = useRouter();
  const initialDate = targetDate ?? lesson?.lessonDate ?? "";
  const initialStartTime = lesson?.startTime ?? "";
  const initialEndTime = lesson?.endTime ?? "";

  const originalDurationMinutes = useMemo(() => {
    const startMinutes = parseTimeToMinutes(lesson?.startTime);
    const endMinutes = parseTimeToMinutes(lesson?.endTime);
    if (
      startMinutes !== null &&
      endMinutes !== null &&
      endMinutes > startMinutes
    ) {
      return endMinutes - startMinutes;
    }
    return 60;
  }, [lesson?.endTime, lesson?.startTime]);

  const initialAutoPlanned = Boolean(
    lesson && isFutureSchedule(initialDate, initialStartTime),
  );

  const [nextDate, setNextDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [autoAdjustEndTime, setAutoAdjustEndTime] = useState(true);
  const [status, setStatus] = useState<LessonStatus>(
    initialAutoPlanned ? "planned" : (lesson?.status ?? "planned"),
  );
  const [hasCustomStatus, setHasCustomStatus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!lesson) {
    return null;
  }

  const displayTitle = getLessonDisplayTitle(lesson.title);
  const autoSwitchedToPlanned =
    !hasCustomStatus &&
    isFutureSchedule(nextDate, startTime) &&
    lesson.status !== "planned" &&
    status === "planned";

  function handleDateChange(value: string) {
    setNextDate(value);
    if (!hasCustomStatus && lesson) {
      setStatus(
        isFutureSchedule(value, startTime) ? "planned" : lesson.status,
      );
    }
  }

  function handleStartTimeChange(value: string) {
    setStartTime(value);

    const parsedStart = parseTimeToMinutes(value);
    if (parsedStart !== null && (autoAdjustEndTime || !endTime || endTime <= value)) {
      const shiftedEnd = formatMinutesToTime(
        parsedStart + originalDurationMinutes,
      );
      setEndTime(shiftedEnd > value ? shiftedEnd : "");
    } else if (!value && autoAdjustEndTime) {
      setEndTime("");
    }

    if (!hasCustomStatus && lesson) {
      setStatus(
        isFutureSchedule(nextDate, value) ? "planned" : lesson.status,
      );
    }
  }

  function handleEndTimeChange(value: string) {
    setEndTime(value);
    setAutoAdjustEndTime(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lesson) return;

    if (!nextDate) {
      toast.error("Please choose a target date");
      return;
    }

    if (startTime && endTime && endTime <= startTime) {
      toast.error("End time must be after start time");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: lesson.studentId ?? null,
          title: lesson.title,
          lessonDate: nextDate,
          startTime: startTime || null,
          endTime: endTime || null,
          notes: lesson.notes,
          status,
          priceCents: lesson.priceCents,
        }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as LessonMutationResponse | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to reschedule lesson");
      }

      onRescheduled({
        ...lesson,
        lessonDate: nextDate,
        startTime: startTime || null,
        endTime: endTime || null,
        status,
      });

      toast.success(
        `Moved ${lesson.participantName}'s lesson to ${formatLessonDayLabel(nextDate)}`,
      );

      if (
        data?.calendarSync?.status === "failed" &&
        data.calendarSync.message
      ) {
        toast.error(data.calendarSync.message);
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reschedule lesson",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Reschedule Lesson
          </DialogTitle>
          <DialogDescription>
            Confirm the new date, adjust the time if needed, and save.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground">
                {lesson.participantName}
              </p>
              <Badge variant="outline" className="text-[11px]">
                {displayTitle}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{formatLessonDayLabel(lesson.lessonDate)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">
                {nextDate ? formatLessonDayLabel(nextDate) : "Select date"}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reschedule-date">New Date</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={nextDate}
              onChange={(event) => handleDateChange(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="reschedule-start">Start Time</Label>
              <Input
                id="reschedule-start"
                type="time"
                value={startTime}
                onChange={(event) => handleStartTimeChange(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-end">End Time</Label>
              <Input
                id="reschedule-end"
                type="time"
                value={endTime}
                onChange={(event) => handleEndTimeChange(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reschedule-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => {
                setHasCustomStatus(true);
                setStatus(value as LessonStatus);
              }}
            >
              <SelectTrigger id="reschedule-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LESSON_STATUSES.map((lessonStatus) => (
                  <SelectItem key={lessonStatus} value={lessonStatus}>
                    {getLessonStatusLabel(lessonStatus)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {autoSwitchedToPlanned ? (
              <p className="text-[11px] text-sky-400">
                Status automatically set to Planned for this future date.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Confirm Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
