"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, PlusCircle, Repeat, X } from "lucide-react";
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
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import {
  LESSON_STATUSES,
  formatLessonCurrencyInput,
  getLessonStatusLabel,
  getLessonWeekdayLabels,
  getSuggestedLessonEndTime,
  isOneTimeLessonStudentValue,
  ONE_TIME_LESSON_OPTION_LABEL,
  ONE_TIME_LESSON_OPTION_VALUE,
  parseLessonCurrencyInput,
  type LessonStatus,
  type LessonStudentOption,
} from "@/lib/lessons";
import { cn } from "@/lib/utils";

interface CreateLessonDialogProps {
  students: LessonStudentOption[];
  defaultLessonDate?: string;
  defaultStudentId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

interface LessonMutationResponse {
  error?: string;
  createdCount?: number;
  calendarSync?: {
    status: "synced" | "skipped" | "failed";
    message?: string;
  };
}

type RecurringDurationPreset =
  | "end_of_month"
  | "4_weeks"
  | "8_weeks"
  | "12_weeks"
  | "custom_date";

const RECURRING_DURATION_OPTIONS: Array<{
  value: RecurringDurationPreset;
  label: string;
}> = [
  { value: "end_of_month", label: "End of month" },
  { value: "4_weeks", label: "4 weeks" },
  { value: "8_weeks", label: "8 weeks" },
  { value: "12_weeks", label: "12 weeks" },
  { value: "custom_date", label: "Until date" },
];

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayIsoDate() {
  return toIsoDate(new Date());
}

function parseLocalIsoDate(isoDate: string) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getMondayFirstWeekday(isoDate: string): number {
  const parsed = parseLocalIsoDate(isoDate);
  if (!parsed) return 0;
  return (parsed.getDay() + 6) % 7;
}

function getDefaultCustomEndDate(startIsoDate: string) {
  const start = parseLocalIsoDate(startIsoDate) ?? new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + 27);
  return toIsoDate(end);
}

function generateRecurringLessonDates({
  startIsoDate,
  weekdays,
  intervalWeeks,
  durationPreset,
  customEndDate,
}: {
  startIsoDate: string;
  weekdays: number[];
  intervalWeeks: 1 | 2;
  durationPreset: RecurringDurationPreset;
  customEndDate: string;
}): string[] {
  const startDate = parseLocalIsoDate(startIsoDate);
  if (!startDate || weekdays.length === 0) {
    return [];
  }

  let endDate: Date;
  if (durationPreset === "end_of_month") {
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
  } else if (durationPreset === "4_weeks") {
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 4 * 7 - 1);
  } else if (durationPreset === "8_weeks") {
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 8 * 7 - 1);
  } else if (durationPreset === "12_weeks") {
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 12 * 7 - 1);
  } else {
    const parsedEnd = parseLocalIsoDate(customEndDate);
    if (!parsedEnd || parsedEnd < startDate) {
      return [];
    }
    endDate = parsedEnd;
  }

  const weekdaySet = new Set(weekdays);
  const startWeekday = (startDate.getDay() + 6) % 7;
  const startWeekMonday = new Date(startDate);
  startWeekMonday.setDate(startDate.getDate() - startWeekday);

  const results: string[] = [];
  const cursor = new Date(startDate);
  let safetyCounter = 0;

  while (cursor <= endDate && results.length < 60 && safetyCounter < 370) {
    safetyCounter += 1;
    const cursorWeekday = (cursor.getDay() + 6) % 7;
    const daysSinceStartMonday = Math.round(
      (cursor.getTime() - startWeekMonday.getTime()) / 86_400_000,
    );
    const weekIndex = Math.floor(daysSinceStartMonday / 7);

    if (weekIndex % intervalWeeks === 0 && weekdaySet.has(cursorWeekday)) {
      results.push(toIsoDate(cursor));
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
}

function formatShortPreviewDate(isoDate: string) {
  const parsed = parseLocalIsoDate(isoDate);
  if (!parsed) return isoDate;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(parsed);
}

function normalizeSelectedStudentValue(value: string) {
  return isOneTimeLessonStudentValue(value) ? null : value;
}

export function CreateLessonDialog({
  students,
  defaultLessonDate,
  defaultStudentId,
  open,
  onOpenChange,
  showTrigger = true,
}: CreateLessonDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const resolvedDefaultLessonDate = defaultLessonDate ?? getTodayIsoDate();
  const resolvedDefaultStudentId = useMemo(() => {
    if (defaultStudentId && isOneTimeLessonStudentValue(defaultStudentId)) {
      return ONE_TIME_LESSON_OPTION_VALUE;
    }

    if (
      defaultStudentId &&
      students.some((student) => student.id === defaultStudentId)
    ) {
      return defaultStudentId;
    }

    return ONE_TIME_LESSON_OPTION_VALUE;
  }, [defaultStudentId, students]);
  const resolvedDefaultPriceInput = useMemo(() => {
    if (isOneTimeLessonStudentValue(resolvedDefaultStudentId)) {
      return formatLessonCurrencyInput(0);
    }

    const selectedStudent = students.find(
      (student) => student.id === resolvedDefaultStudentId,
    );

    return formatLessonCurrencyInput(selectedStudent?.lessonPriceCents ?? 0);
  }, [resolvedDefaultStudentId, students]);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const [studentId, setStudentId] = useState(resolvedDefaultStudentId);
  const [title, setTitle] = useState("");
  const [lessonDate, setLessonDate] = useState(resolvedDefaultLessonDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<LessonStatus>("completed");
  const [priceInput, setPriceInput] = useState(resolvedDefaultPriceInput);
  const [autoAdjustEndTime, setAutoAdjustEndTime] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Recurring lesson state
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(() => [
    getMondayFirstWeekday(resolvedDefaultLessonDate),
  ]);
  const [hasCustomWeekdays, setHasCustomWeekdays] = useState(false);
  const [intervalWeeks, setIntervalWeeks] = useState<1 | 2>(1);
  const [durationPreset, setDurationPreset] =
    useState<RecurringDurationPreset>("4_weeks");
  const [customEndDate, setCustomEndDate] = useState(() =>
    getDefaultCustomEndDate(resolvedDefaultLessonDate),
  );
  const [excludedDates, setExcludedDates] = useState<string[]>([]);

  const weekdayLabels = getLessonWeekdayLabels();
  const isDisabled = false;
  const selectedStudentName = useMemo(
    () =>
      isOneTimeLessonStudentValue(studentId)
        ? ONE_TIME_LESSON_OPTION_LABEL
        : students.find((student) => student.id === studentId)?.name,
    [studentId, students],
  );

  const generatedRecurringDates = useMemo(
    () =>
      isRecurring
        ? generateRecurringLessonDates({
            startIsoDate: lessonDate,
            weekdays: selectedWeekdays,
            intervalWeeks,
            durationPreset,
            customEndDate,
          })
        : [],
    [
      isRecurring,
      lessonDate,
      selectedWeekdays,
      intervalWeeks,
      durationPreset,
      customEndDate,
    ],
  );

  const activeRecurringDates = useMemo(() => {
    const excludedSet = new Set(excludedDates);
    return generatedRecurringDates.filter((d) => !excludedSet.has(d));
  }, [generatedRecurringDates, excludedDates]);

  function resetForm() {
    setStudentId(resolvedDefaultStudentId);
    setTitle("");
    setLessonDate(resolvedDefaultLessonDate);
    setStartTime("");
    setEndTime("");
    setNotes("");
    setStatus("completed");
    setPriceInput(resolvedDefaultPriceInput);
    setAutoAdjustEndTime(true);
    setIsRecurring(false);
    setSelectedWeekdays([getMondayFirstWeekday(resolvedDefaultLessonDate)]);
    setHasCustomWeekdays(false);
    setIntervalWeeks(1);
    setDurationPreset("4_weeks");
    setCustomEndDate(getDefaultCustomEndDate(resolvedDefaultLessonDate));
    setExcludedDates([]);
  }

  function handleRecurringModeChange(nextIsRecurring: boolean) {
    setIsRecurring(nextIsRecurring);
    if (nextIsRecurring) {
      // Default recurring lessons to "planned" since overdue planned lessons auto-complete
      setStatus("planned");
      if (selectedWeekdays.length === 0) {
        setSelectedWeekdays([getMondayFirstWeekday(lessonDate)]);
      }
    } else {
      setStatus("completed");
    }
  }

  function handleLessonDateChange(nextDate: string) {
    setLessonDate(nextDate);
    setExcludedDates([]);
    if (!hasCustomWeekdays && nextDate) {
      setSelectedWeekdays([getMondayFirstWeekday(nextDate)]);
    }
    if (nextDate && customEndDate < nextDate) {
      setCustomEndDate(getDefaultCustomEndDate(nextDate));
    }
  }

  function handleToggleWeekday(dayIndex: number) {
    setHasCustomWeekdays(true);
    setExcludedDates([]);
    setSelectedWeekdays((prev) => {
      if (prev.includes(dayIndex)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((d) => d !== dayIndex);
      }
      return [...prev, dayIndex].sort((a, b) => a - b);
    });
  }

  function handleToggleExcludedDate(isoDate: string) {
    setExcludedDates((prev) =>
      prev.includes(isoDate)
        ? prev.filter((d) => d !== isoDate)
        : [...prev, isoDate],
    );
  }

  function handleStudentChange(nextStudentId: string) {
    setStudentId(nextStudentId);

    if (isOneTimeLessonStudentValue(nextStudentId)) {
      setPriceInput(formatLessonCurrencyInput(0));
      return;
    }

    const nextStudent = students.find(
      (student) => student.id === nextStudentId,
    );

    if (nextStudent) {
      setPriceInput(
        formatLessonCurrencyInput(nextStudent.lessonPriceCents ?? 0),
      );
    }
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      resetForm();
    }

    onOpenChange?.(nextOpen);
  }

  function handleStartTimeChange(nextStartTime: string) {
    const suggestedEndTime = getSuggestedLessonEndTime(nextStartTime);

    setStartTime(nextStartTime);

    if (
      autoAdjustEndTime ||
      (endTime && nextStartTime && endTime <= nextStartTime)
    ) {
      setEndTime(suggestedEndTime);
      setAutoAdjustEndTime(true);
    }
  }

  function handleEndTimeChange(nextEndTime: string) {
    setEndTime(nextEndTime);
    setAutoAdjustEndTime(nextEndTime === getSuggestedLessonEndTime(startTime));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!lessonDate) {
      toast.error("Please choose a lesson date");
      return;
    }

    if (isRecurring && activeRecurringDates.length === 0) {
      toast.error("Please select at least one recurring lesson date");
      return;
    }

    const priceCents = parseLessonCurrencyInput(priceInput);

    if (priceCents === null) {
      toast.error("Please enter a valid lesson price");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: normalizeSelectedStudentValue(studentId),
          title: title.trim() || null,
          lessonDate: isRecurring ? activeRecurringDates[0] : lessonDate,
          lessonDates: isRecurring ? activeRecurringDates : undefined,
          startTime: startTime || null,
          endTime: endTime || null,
          notes: notes.trim() || null,
          status,
          priceCents,
        }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as LessonMutationResponse | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create lesson");
      }

      const createdCount =
        data?.createdCount ?? (isRecurring ? activeRecurringDates.length : 1);
      toast.success(
        createdCount > 1
          ? `Added ${createdCount} ${getLessonStatusLabel(status).toLowerCase()} lessons${selectedStudentName ? ` for ${selectedStudentName}` : ""}`
          : `Added lesson${selectedStudentName ? ` for ${selectedStudentName}` : ""}`,
      );
      if (
        data?.calendarSync?.status === "failed" &&
        data.calendarSync.message
      ) {
        toast.error(data.calendarSync.message);
      }
      handleDialogOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create lesson",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button disabled={isDisabled}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Lesson
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Lesson</DialogTitle>
          <DialogDescription>
            Tutors can add one-time lessons for themselves or lessons for
            connected students. Connected-student lessons appear on the
            student&apos;s monthly calendar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => handleRecurringModeChange(false)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                !isRecurring
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarPlus className="h-4 w-4" />
              Single Lesson
            </button>
            <button
              type="button"
              onClick={() => handleRecurringModeChange(true)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isRecurring
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Repeat className="h-4 w-4" />
              Recurring Schedule
            </button>
          </div>

          <div className="space-y-2">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={handleStudentChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a student" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ONE_TIME_LESSON_OPTION_VALUE}>
                  {ONE_TIME_LESSON_OPTION_LABEL}
                </SelectItem>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-title">Lesson title</Label>
            <Input
              id="lesson-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optional: speaking practice, grammar review, lesson 12..."
            />
            <p className="text-xs text-muted-foreground">
              Optional. Leave blank to save it as a general lesson.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="lesson-date">
                {isRecurring ? "Start date" : "Date"}
              </Label>
              <Input
                id="lesson-date"
                type="date"
                value={lessonDate}
                onChange={(event) => handleLessonDateChange(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as LessonStatus)}
              >
                <SelectTrigger>
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
              {isRecurring ? (
                <p className="text-[11px] text-muted-foreground">
                  Defaults to Planned — past planned lessons are automatically
                  confirmed as Completed.
                </p>
              ) : null}
            </div>
          </div>

          {isRecurring ? (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Repeat on days
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {selectedWeekdays.length} day
                    {selectedWeekdays.length === 1 ? "" : "s"}/week
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {weekdayLabels.map((label, dayIndex) => {
                    const isSelected = selectedWeekdays.includes(dayIndex);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleToggleWeekday(dayIndex)}
                        className={cn(
                          "rounded-md border py-1.5 text-xs font-medium transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Frequency
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIntervalWeeks(1);
                        setExcludedDates([]);
                      }}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        intervalWeeks === 1
                          ? "border-primary bg-primary/15 text-foreground"
                          : "bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Every week
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIntervalWeeks(2);
                        setExcludedDates([]);
                      }}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        intervalWeeks === 2
                          ? "border-primary bg-primary/15 text-foreground"
                          : "bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Every 2 weeks
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Duration
                  </Label>
                  <Select
                    value={durationPreset}
                    onValueChange={(value) => {
                      setDurationPreset(value as RecurringDurationPreset);
                      setExcludedDates([]);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRING_DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {durationPreset === "custom_date" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="lesson-end-date" className="text-xs">
                    Repeat until date
                  </Label>
                  <Input
                    id="lesson-end-date"
                    type="date"
                    min={lessonDate}
                    value={customEndDate}
                    onChange={(event) => {
                      setCustomEndDate(event.target.value);
                      setExcludedDates([]);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              ) : null}

              <div className="space-y-2 rounded-md border bg-background/80 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium">
                    Generated schedule preview
                  </span>
                  <Badge variant="secondary" className="text-[11px]">
                    {activeRecurringDates.length}{" "}
                    {getLessonStatusLabel(status).toLowerCase()} lesson
                    {activeRecurringDates.length === 1 ? "" : "s"}
                  </Badge>
                </div>

                {generatedRecurringDates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No matching dates found in this range. Try adjusting the
                    days or end date.
                  </p>
                ) : (
                  <>
                    <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pt-0.5">
                      {generatedRecurringDates.map((isoDate) => {
                        const isExcluded = excludedDates.includes(isoDate);
                        return (
                          <button
                            key={isoDate}
                            type="button"
                            onClick={() => handleToggleExcludedDate(isoDate)}
                            title={
                              isExcluded
                                ? "Click to include this date"
                                : "Click to skip this date"
                            }
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                              isExcluded
                                ? "border-dashed bg-muted/40 text-muted-foreground line-through opacity-60"
                                : "border-primary/30 bg-primary/10 text-foreground hover:bg-primary/20",
                            )}
                          >
                            <span>{formatShortPreviewDate(isoDate)}</span>
                            <X className="h-2.5 w-2.5 opacity-70" />
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Tip: Click any date pill above to skip a holiday or
                      exception day.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lesson-start-time">Start time</Label>
              <Input
                id="lesson-start-time"
                type="time"
                value={startTime}
                onChange={(event) => handleStartTimeChange(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-end-time">End time</Label>
              <Input
                id="lesson-end-time"
                type="time"
                value={endTime}
                onChange={(event) => handleEndTimeChange(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-notes">Notes</Label>
            <Textarea
              id="lesson-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Optional lesson notes, focus areas, or what was covered..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-price">Lesson price</Label>
            <Input
              id="lesson-price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              placeholder="0.00"
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                isSaving ||
                isDisabled ||
                (isRecurring && activeRecurringDates.length === 0)
              }
            >
              {isSaving
                ? "Saving..."
                : isRecurring
                  ? `Save ${activeRecurringDates.length} ${getLessonStatusLabel(status)} Lesson${activeRecurringDates.length === 1 ? "" : "s"}`
                  : "Save Lesson"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
