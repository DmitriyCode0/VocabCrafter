"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
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
        throw new Error(data?.error || "Failed to remove review sessions");
      }

      const deletedCount = data?.deletedCount ?? 0;
      toast.success(
        deletedCount > 0
          ? `Removed ${deletedCount} review session${deletedCount === 1 ? "" : "s"}.`
          : "No review sessions to remove.",
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove review sessions",
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
          Remove Reviews
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Review Sessions</DialogTitle>
          <DialogDescription>
            {reviewCount > 0
              ? `This will permanently delete ${reviewCount} saved review session${reviewCount === 1 ? "" : "s"} from My Quizzes, along with any attempts tied to them. This cannot be undone.`
              : "There are no saved review sessions to remove."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || reviewCount === 0}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Removing...
              </>
            ) : (
              "Remove"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
