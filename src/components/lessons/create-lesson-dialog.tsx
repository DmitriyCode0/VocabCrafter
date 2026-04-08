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
  getLessonStatusLabel,
  type LessonStatus,
  type LessonStudentOption,
} from "@/lib/lessons";

interface CreateLessonDialogProps {
  students: LessonStudentOption[];
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CreateLessonDialog({ students }: CreateLessonDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [lessonDate, setLessonDate] = useState(getTodayIsoDate());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<LessonStatus>("planned");
  const [isSaving, setIsSaving] = useState(false);

  const isDisabled = students.length === 0;
  const selectedStudentName = useMemo(
    () => students.find((student) => student.id === studentId)?.name,
    [studentId, students],
  );

  function resetForm() {
    setStudentId("");
    setTitle("");
    setLessonDate(getTodayIsoDate());
    setStartTime("");
    setEndTime("");
    setNotes("");
    setStatus("planned");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!studentId || !title.trim() || !lessonDate) {
      toast.error("Please choose a student, title, and lesson date");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          title: title.trim(),
          lessonDate,
          startTime: startTime || null,
          endTime: endTime || null,
          notes: notes.trim() || null,
          status,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create lesson");
      }

      toast.success(
        `Added lesson${selectedStudentName ? ` for ${selectedStudentName}` : ""}`,
      );
      setOpen(false);
      resetForm();
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
        <Button disabled={isDisabled}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Lesson
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Lesson</DialogTitle>
          <DialogDescription>
            Tutors can add lessons for connected students. Students will see the
            lesson on their monthly calendar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a student" />
              </SelectTrigger>
              <SelectContent>
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
              placeholder="Speaking practice, grammar review, lesson 12..."
            />
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
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-end-time">End time</Label>
              <Input
                id="lesson-end-time"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
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