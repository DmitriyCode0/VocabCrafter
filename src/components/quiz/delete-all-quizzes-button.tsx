"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
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

interface DeleteAllQuizzesButtonProps {
  totalCount: number;
}

export function DeleteAllQuizzesButton({
  totalCount,
}: DeleteAllQuizzesButtonProps) {
  const router = useRouter();
  const { messages } = useAppI18n();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteAll() {
    setIsDeleting(true);

    try {
      const response = await fetch("/api/quizzes", {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        deletedCount?: number;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || messages.quizzes.deleteAll.failed);
      }

      const deletedCount = data?.deletedCount ?? 0;
      toast.success(
        deletedCount > 0
          ? messages.quizzes.deleteAll.success(deletedCount)
          : messages.quizzes.deleteAll.emptySuccess,
      );
      setOpen(false);
      router.push("/quizzes");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : messages.quizzes.deleteAll.failed,
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={totalCount === 0}
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {messages.quizzes.deleteAllButton}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.quizzes.deleteAll.title}</DialogTitle>
          <DialogDescription>
            {totalCount > 0
              ? messages.quizzes.deleteAll.description(totalCount)
              : messages.quizzes.deleteAll.emptyDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            {messages.common.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAll}
            disabled={isDeleting || totalCount === 0}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {messages.quizzes.card.deleting}
              </>
            ) : (
              messages.quizzes.deleteAllButton
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

