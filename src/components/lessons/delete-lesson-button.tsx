"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { getLessonDisplayTitle } from "@/lib/lessons";

interface DeleteLessonButtonProps {
  lessonId: string;
  title?: string | null;
}

export function DeleteLessonButton({
  lessonId,
  title,
}: DeleteLessonButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const displayTitle = getLessonDisplayTitle(title);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete lesson");
      }

      toast.success(`Deleted ${displayTitle}`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete lesson",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Delete {displayTitle}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete lesson</DialogTitle>
          <DialogDescription>
            {displayTitle} will be removed from both the tutor and student
            calendars.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
