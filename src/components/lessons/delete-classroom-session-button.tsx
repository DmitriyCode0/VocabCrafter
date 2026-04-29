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

interface DeleteClassroomSessionButtonProps {
  connectionId: string;
  sessionId: string;
  sessionLabel: string;
  appLanguage: "en" | "uk";
}

interface DeleteClassroomSessionResponse {
  error?: string;
}

export function DeleteClassroomSessionButton({
  connectionId,
  sessionId,
  sessionLabel,
  appLanguage,
}: DeleteClassroomSessionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/classroom/${connectionId}/sessions/${sessionId}`,
        {
          method: "DELETE",
        },
      );

      const data = (await response
        .json()
        .catch(() => null)) as DeleteClassroomSessionResponse | null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            (appLanguage === "uk"
              ? "Не вдалося видалити classroom-сесію"
              : "Failed to delete classroom session"),
        );
      }

      toast.success(
        appLanguage === "uk"
          ? `Сесію ${sessionLabel} видалено`
          : `Deleted session ${sessionLabel}`,
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : appLanguage === "uk"
            ? "Не вдалося видалити classroom-сесію"
            : "Failed to delete classroom session",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="shrink-0">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">
            {appLanguage === "uk"
              ? `Видалити сесію ${sessionLabel}`
              : `Delete session ${sessionLabel}`}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {appLanguage === "uk"
              ? "Видалити classroom-сесію"
              : "Delete classroom session"}
          </DialogTitle>
          <DialogDescription>
            {appLanguage === "uk"
              ? `Сесію ${sessionLabel} буде видалено з історії classroom.`
              : `Session ${sessionLabel} will be removed from the classroom history.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {appLanguage === "uk" ? "Скасувати" : "Cancel"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
          >
            {isDeleting
              ? appLanguage === "uk"
                ? "Видалення..."
                : "Deleting..."
              : appLanguage === "uk"
                ? "Видалити"
                : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}