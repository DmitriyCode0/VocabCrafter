"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";
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
  getLessonDisplayTitle,
  getLessonStatusLabel,
  getSuggestedLessonEndTime,
  isOneTimeLessonStudentValue,
  ONE_TIME_LESSON_OPTION_LABEL,
  ONE_TIME_LESSON_OPTION_VALUE,
  parseLessonCurrencyInput,
  type LessonStatus,
  type LessonStudentOption,
} from "@/lib/lessons";

interface EditLessonDialogProps {
  lesson: {
    id: string;
    studentId: string | null;
    title: string | null;
    lessonDate: string;
    startTime: string | null;
    endTime: string | null;
    notes: string | null;
    status: LessonStatus;
    priceCents: number;
  };
  students: LessonStudentOption[];
}

interface LessonMutationResponse {
  error?: string;
  calendarSync?: {
    status: "synced" | "skipped" | "failed";
    message?: string;
  };
}

function getEditableStudentValue(studentId: string | null) {
  return studentId ?? ONE_TIME_LESSON_OPTION_VALUE;
}

function normalizeSelectedStudentValue(value: string) {
  return isOneTimeLessonStudentValue(value) ? null : value;
}

export function EditLessonDialog({ lesson, students }: EditLessonDialogProps) {
  const initialSuggestedEndTime = getSuggestedLessonEndTime(lesson.startTime);
  const displayTitle = getLessonDisplayTitle(lesson.title);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [studentId, setStudentId] = useState(
    getEditableStudentValue(lesson.studentId),
  );
  const [title, setTitle] = useState(lesson.title ?? "");
  const [lessonDate, setLessonDate] = useState(lesson.lessonDate);
  const [startTime, setStartTime] = useState(lesson.startTime ?? "");
  const [endTime, setEndTime] = useState(lesson.endTime ?? "");
  const [notes, setNotes] = useState(lesson.notes ?? "");
  const [status, setStatus] = useState<LessonStatus>(lesson.status);
  const [priceInput, setPriceInput] = useState(
    formatLessonCurrencyInput(lesson.priceCents),
  );
  const [autoAdjustEndTime, setAutoAdjustEndTime] = useState(
    Boolean(initialSuggestedEndTime) &&
      lesson.endTime === initialSuggestedEndTime,
  );

  const selectedStudentName = useMemo(
    () =>
      isOneTimeLessonStudentValue(studentId)
        ? ONE_TIME_LESSON_OPTION_LABEL
        : students.find((student) => student.id === studentId)?.name,
    [studentId, students],
  );

  function resetForm() {
    setStudentId(getEditableStudentValue(lesson.studentId));
    setTitle(lesson.title ?? "");
    setLessonDate(lesson.lessonDate);
    setStartTime(lesson.startTime ?? "");
    setEndTime(lesson.endTime ?? "");
    setNotes(lesson.notes ?? "");
    setStatus(lesson.status);
    setPriceInput(formatLessonCurrencyInput(lesson.priceCents));
    setAutoAdjustEndTime(
      Boolean(initialSuggestedEndTime) &&
        lesson.endTime === initialSuggestedEndTime,
    );
  }

  function handleStudentChange(nextStudentId: string) {
    setStudentId(nextStudentId);

    if (isOneTimeLessonStudentValue(nextStudentId)) {
      setPriceInput(formatLessonCurrencyInput(0));
      return;
    }

    const nextStudent = students.find((student) => student.id === nextStudentId);

    if (nextStudent) {
      setPriceInput(formatLessonCurrencyInput(nextStudent.lessonPriceCents ?? 0));
    }
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

  async function handleSave() {
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
      const response = await fetch(`/api/lessons/${lesson.id}`, {
        method: "PATCH",
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
        throw new Error(data?.error || "Failed to update lesson");
      }

      toast.success(
        `Updated lesson${selectedStudentName ? ` for ${selectedStudentName}` : ""}`,
      );
      if (
        data?.calendarSync?.status === "failed" &&
        data.calendarSync.message
      ) {
        toast.error(data.calendarSync.message);
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update lesson",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
          <PencilLine className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Edit {displayTitle}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit lesson</DialogTitle>
          <DialogDescription>
            Update lesson details, timing, and status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            <Label htmlFor={`lesson-title-${lesson.id}`}>Lesson title</Label>
            <Input
              id={`lesson-title-${lesson.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optional lesson title"
            />
            <p className="text-xs text-muted-foreground">
              Optional. Leave blank to save it as a general lesson.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`lesson-date-${lesson.id}`}>Date</Label>
              <Input
                id={`lesson-date-${lesson.id}`}
                type="date"
                value={lessonDate}
                onChange={(event) => setLessonDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
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
              <Label htmlFor={`lesson-start-${lesson.id}`}>Start time</Label>
              <Input
                id={`lesson-start-${lesson.id}`}
                type="time"
                value={startTime}
                onChange={(event) => handleStartTimeChange(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`lesson-end-${lesson.id}`}>End time</Label>
              <Input
                id={`lesson-end-${lesson.id}`}
                type="time"
                value={endTime}
                onChange={(event) => handleEndTimeChange(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`lesson-notes-${lesson.id}`}>Notes</Label>
            <Textarea
              id={`lesson-notes-${lesson.id}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`lesson-price-${lesson.id}`}>Lesson price</Label>
            <Input
              id={`lesson-price-${lesson.id}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
