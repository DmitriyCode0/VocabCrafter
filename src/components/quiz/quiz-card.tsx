"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Trash2, Loader2 } from "lucide-react";
import type { Quiz } from "@/types/database";
import { ACTIVITY_LABELS } from "@/lib/constants";

interface QuizCardProps {
  quiz: Quiz;
}

export function QuizCard({ quiz }: QuizCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const terms = quiz.vocabulary_terms as {
    term: string;
    definition: string;
  }[];

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDialogOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to delete quiz:", err);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="relative group">
      <Link href={`/quizzes/${quiz.id}`}>
        <Card className="h-full transition-colors hover:border-primary cursor-pointer">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base pr-6">{quiz.title}</CardTitle>
              <Badge variant="secondary" className="text-xs shrink-0">
                {ACTIVITY_LABELS[quiz.type] || quiz.type}
              </Badge>
            </div>
            <CardDescription>
              {Array.isArray(terms) ? terms.length : 0} terms &middot; CEFR{" "}
              {quiz.cefr_level}
            </CardDescription>
            <p className="text-xs text-muted-foreground">
              {new Date(quiz.created_at).toLocaleDateString("en-US")}
            </p>
          </CardHeader>
        </Card>
      </Link>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete Quiz</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{quiz.title}&rdquo;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
