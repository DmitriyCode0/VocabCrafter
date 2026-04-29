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

interface DeleteRecordingButtonProps {
  deleteUrl: string;
  recordingLabel: string;
  appLanguage: "en" | "uk";
  scope: "lesson" | "classroom";
}

export function DeleteRecordingButton({
  deleteUrl,
  recordingLabel,
  appLanguage,
  scope,
}: DeleteRecordingButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const scopeLabel =
    scope === "classroom"
      ? appLanguage === "uk"
        ? "classroom-запис"
        : "classroom recording"
      : appLanguage === "uk"
        ? "запис уроку"
        : "lesson recording";

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const response = await fetch(deleteUrl, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            (appLanguage === "uk"
              ? "Не вдалося видалити запис"
              : "Failed to delete the recording"),
        );
      }

      toast.success(
        appLanguage === "uk"
          ? `Видалено ${scopeLabel} ${recordingLabel}`
          : `Deleted ${scopeLabel} ${recordingLabel}`,
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : appLanguage === "uk"
            ? "Не вдалося видалити запис"
            : "Failed to delete the recording",
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
              ? `Видалити ${scopeLabel} ${recordingLabel}`
              : `Delete ${scopeLabel} ${recordingLabel}`}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {appLanguage === "uk"
              ? `Видалити ${scopeLabel}`
              : `Delete ${scopeLabel}`}
          </DialogTitle>
          <DialogDescription>
            {appLanguage === "uk"
              ? `${scopeLabel} ${recordingLabel} буде видалено з історії та приватного сховища.`
              : `${scopeLabel} ${recordingLabel} will be removed from history and private storage.`}
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