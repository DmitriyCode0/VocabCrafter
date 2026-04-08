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
  getLessonStatusLabel,
  type LessonStatus,
  type LessonStudentOption,
} from "@/lib/lessons";

interface EditLessonDialogProps {
  lesson: {
    id: string;
    studentId: string;
    title: string;
    lessonDate: string;
    startTime: string | null;
    endTime: string | null;
    notes: string | null;
    status: LessonStatus;
  };
  students: LessonStudentOption[];
}

export function EditLessonDialog({ lesson, students }: EditLessonDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [studentId, setStudentId] = useState(lesson.studentId);
  const [title, setTitle] = useState(lesson.title);
  const [lessonDate, setLessonDate] = useState(lesson.lessonDate);
  const [startTime, setStartTime] = useState(lesson.startTime ?? "");
  const [endTime, setEndTime] = useState(lesson.endTime ?? "");
  const [notes, setNotes] = useState(lesson.notes ?? "");
  const [status, setStatus] = useState<LessonStatus>(lesson.status);

  const selectedStudentName = useMemo(
    () => students.find((student) => student.id === studentId)?.name,
    [studentId, students],
  );

  function resetForm() {
    setStudentId(lesson.studentId);
    setTitle(lesson.title);
    setLessonDate(lesson.lessonDate);
    setStartTime(lesson.startTime ?? "");
    setEndTime(lesson.endTime ?? "");
    setNotes(lesson.notes ?? "");
    setStatus(lesson.status);
  }

  async function handleSave() {
    if (!studentId || !title.trim() || !lessonDate) {
      toast.error("Please choose a student, title, and lesson date");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/lessons/${lesson.id}`, {
        method: "PATCH",
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
        throw new Error(data?.error || "Failed to update lesson");
      }

      toast.success(
        `Updated lesson${selectedStudentName ? ` for ${selectedStudentName}` : ""}`,
      );
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
          <span className="sr-only">Edit {lesson.title}</span>
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
            <Label htmlFor={`lesson-title-${lesson.id}`}>Lesson title</Label>
            <Input
              id={`lesson-title-${lesson.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
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
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`lesson-end-${lesson.id}`}>End time</Label>
              <Input
                id={`lesson-end-${lesson.id}`}
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
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