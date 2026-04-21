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

interface RemoveReviewQuizzesButtonProps {
  reviewCount: number;
}

export function RemoveReviewQuizzesButton({
  reviewCount,
}: RemoveReviewQuizzesButtonProps) {
  const router = useRouter();
  const { messages } = useAppI18n();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const response = await fetch("/api/review-activity", {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        deletedCount?: number;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || messages.quizzes.reviewRemoval.failed);
      }

      const deletedCount = data?.deletedCount ?? 0;
      toast.success(
        deletedCount > 0
          ? messages.quizzes.reviewRemoval.success(deletedCount)
          : messages.quizzes.reviewRemoval.emptySuccess,
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : messages.quizzes.reviewRemoval.failed,
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
          disabled={reviewCount === 0}
          className="w-full sm:w-auto"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {messages.quizzes.removeReviewsButton}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.quizzes.reviewRemoval.title}</DialogTitle>
          <DialogDescription>
            {reviewCount > 0
              ? messages.quizzes.reviewRemoval.description(reviewCount)
              : messages.quizzes.reviewRemoval.emptyDescription}
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
            onClick={handleDelete}
            disabled={isDeleting || reviewCount === 0}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {messages.common.removing}
              </>
            ) : (
              messages.common.remove
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
