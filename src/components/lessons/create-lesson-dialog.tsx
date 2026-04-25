"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
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
  getSuggestedLessonEndTime,
  isOneTimeLessonStudentValue,
  ONE_TIME_LESSON_OPTION_LABEL,
  ONE_TIME_LESSON_OPTION_VALUE,
  parseLessonCurrencyInput,
  type LessonStatus,
  type LessonStudentOption,
} from "@/lib/lessons";

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
  calendarSync?: {
    status: "synced" | "skipped" | "failed";
    message?: string;
  };
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  const isDisabled = false;
  const selectedStudentName = useMemo(
    () =>
      isOneTimeLessonStudentValue(studentId)
        ? ONE_TIME_LESSON_OPTION_LABEL
        : students.find((student) => student.id === studentId)?.name,
    [studentId, students],
  );

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
          lessonDate,
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

      toast.success(
        `Added lesson${selectedStudentName ? ` for ${selectedStudentName}` : ""}`,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Lesson</DialogTitle>
          <DialogDescription>
            Tutors can add one-time lessons for themselves or lessons for
            connected students. Connected-student lessons appear on the
            student&apos;s monthly calendar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="lesson-date">Date</Label>
              <Input
                id="lesson-date"
                type="date"
                value={lessonDate}
                onChange={(event) => setLessonDate(event.target.value)}
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
            </div>
          </div>

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
              rows={4}
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
            <Button type="submit" disabled={isSaving || isDisabled}>
              {isSaving ? "Saving..." : "Save Lesson"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
