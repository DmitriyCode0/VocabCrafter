"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
} from "@/components/ui/dialog";
import { useAppI18n } from "@/components/providers/app-language-provider";
import {
  Trash2,
  Loader2,
  Link2,
  ArrowUpRight,
  Calendar,
  BookOpen,
} from "lucide-react";
import type { Quiz } from "@/types/database";
import { ACTIVITY_LABELS } from "@/lib/constants";
import {
  getGrammarTopicDisplayName,
  getPrimaryGrammarTopic,
} from "@/lib/utils";
import { formatDateForAppLanguage } from "@/lib/i18n/format";

export type QuizListItem = Omit<Quiz, "generated_content"> & {
  generated_content?: Quiz["generated_content"];
};

interface QuizCardProps {
  quiz: QuizListItem;
}

const PREVIEW_TERM_LIMIT = 5;

export function QuizCard({ quiz }: QuizCardProps) {
  const router = useRouter();
  const { messages, appLanguage } = useAppI18n();
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const terms = Array.isArray(quiz.vocabulary_terms)
    ? (quiz.vocabulary_terms as { term: string; definition?: string }[])
    : [];
  const previewTerms = terms
    .map((t) => t?.term?.trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, PREVIEW_TERM_LIMIT);
  const remainingTermCount = Math.max(0, terms.length - previewTerms.length);

  const grammarTopicKey = getPrimaryGrammarTopic(quiz.config);
  const grammarTopic = grammarTopicKey
    ? getGrammarTopicDisplayName(quiz.config, grammarTopicKey)
    : null;
  const typeLabel =
    messages.quizzes.typeLabels[
      quiz.type as keyof typeof messages.quizzes.typeLabels
    ] ||
    messages.createQuiz.quizWordPicker.typeLabels[
      quiz.type as keyof typeof messages.createQuiz.quizWordPicker.typeLabels
    ] ||
    ACTIVITY_LABELS[quiz.type] ||
    quiz.type;

  async function handleCopyLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/quizzes/${quiz.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(messages.quizzes.card.copiedLinkToast);
    } catch {
      toast.error("Failed to copy link");
    }
  }

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
    <>
      <Card className="group flex h-full flex-col justify-between transition-all hover:border-primary/60 hover:shadow-sm">
        <div>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  {typeLabel}
                </Badge>
                {quiz.cefr_level ? (
                  <Badge variant="outline" className="text-xs font-semibold">
                    {quiz.cefr_level}
                  </Badge>
                ) : null}
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Calendar className="h-3 w-3" />
                {formatDateForAppLanguage(appLanguage, quiz.created_at)}
              </span>
            </div>

            <Link
              href={`/quizzes/${quiz.id}`}
              className="mt-2 block group-hover:text-primary transition-colors"
            >
              <CardTitle className="line-clamp-2 text-base leading-snug">
                {quiz.title}
              </CardTitle>
            </Link>

            {grammarTopic ? (
              <div className="pt-1">
                <Badge
                  variant="outline"
                  className="h-auto max-w-full justify-start whitespace-normal break-words border-amber-400/40 bg-amber-500/10 px-2.5 py-0.5 text-left text-xs leading-tight text-amber-700 dark:text-amber-300"
                >
                  {grammarTopic}
                </Badge>
              </div>
            ) : null}

            <CardDescription className="flex items-center gap-1.5 pt-1 text-xs">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              {messages.quizzes.card.termCount(terms.length)}
            </CardDescription>
          </CardHeader>

          {previewTerms.length > 0 ? (
            <CardContent className="pb-3 pt-0">
              <div className="flex flex-wrap gap-1.5">
                {previewTerms.map((term, index) => (
                  <span
                    key={`${quiz.id}-term-${index}`}
                    className="inline-flex max-w-[140px] truncate rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {term}
                  </span>
                ))}
                {remainingTermCount > 0 ? (
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {messages.quizzes.card.moreTerms(remainingTermCount)}
                  </span>
                ) : null}
              </div>
            </CardContent>
          ) : null}
        </div>

        <CardFooter className="flex items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={handleCopyLink}
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              {messages.quizzes.card.copyLinkAction}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDialogOpen(true);
              }}
              aria-label={messages.quizzes.card.deleteAria}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button size="sm" variant="secondary" className="h-8 text-xs" asChild>
            <Link href={`/quizzes/${quiz.id}`}>
              {messages.quizzes.card.openQuizAction}
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{messages.quizzes.card.deleteTitle}</DialogTitle>
            <DialogDescription>
              {messages.quizzes.card.deleteDescription(quiz.title)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isDeleting}
            >
              {messages.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {messages.quizzes.card.deleting}
                </>
              ) : (
                messages.quizzes.card.deleteAction
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
