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
} from "@/components/ui/dialog";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Trash2, Loader2 } from "lucide-react";
import type { Quiz } from "@/types/database";
import { ACTIVITY_LABELS } from "@/lib/constants";
import {
  getGrammarTopicDisplayName,
  getPrimaryGrammarTopic,
} from "@/lib/utils";
import { formatDateForAppLanguage } from "@/lib/i18n/format";

interface QuizCardProps {
  quiz: Quiz;
}

export function QuizCard({ quiz }: QuizCardProps) {
  const router = useRouter();
  const { messages, appLanguage } = useAppI18n();
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const terms = quiz.vocabulary_terms as {
    term: string;
    definition: string;
  }[];
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
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <CardTitle className="min-w-0 text-base">
                  {quiz.title}
                </CardTitle>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {typeLabel}
                </Badge>
              </div>
              <div className="flex min-w-0 flex-wrap items-start gap-2">
                {quiz.cefr_level && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {quiz.cefr_level}
                  </Badge>
                )}
                {quiz.type === "translation" && grammarTopic && (
                  <Badge
                    variant="outline"
                    className="h-auto max-w-full justify-start whitespace-normal break-words border-amber-300 bg-amber-50 px-3 py-1 text-left text-xs leading-tight text-amber-900"
                  >
                    {grammarTopic}
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription>
              {messages.quizzes.card.termCount(
                Array.isArray(terms) ? terms.length : 0,
              )}
            </CardDescription>
            <p className="text-xs text-muted-foreground">
              {formatDateForAppLanguage(appLanguage, quiz.created_at)}
            </p>
          </CardHeader>
        </Card>
      </Link>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDialogOpen(true);
          }}
          aria-label={messages.quizzes.card.deleteAria}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
    </div>
  );
}
