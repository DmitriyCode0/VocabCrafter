"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText } from "lucide-react";
import type { QuizTerm } from "@/types/quiz";

interface QuizWordPickerProps {
  onSelect: (terms: QuizTerm[]) => void;
}

interface QuizItem {
  id: string;
  title: string;
  type: string;
  cefr_level: string;
  vocabulary_terms: QuizTerm[];
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  flashcards: "Flashcards",
  gap_fill: "Gap Fill",
  translation: "Translation",
  mcq: "Multiple Choice",
  matching: "Matching",
  discussion: "Discussion",
  text_translation: "Text Translation",
  translation_list: "Translation List",
};

export function QuizWordPicker({ onSelect }: QuizWordPickerProps) {
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  async function fetchQuizzes() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/quizzes");
      if (!res.ok) throw new Error("Failed to fetch quizzes");

      const data = await res.json();
      setQuizzes(data.quizzes || []);
    } catch {
      setError("Failed to load quizzes.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (quizzes.length === 0) {
    return (
      <div className="py-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          No quizzes created yet. Create your first quiz to reuse its
          vocabulary.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select a quiz to reuse its vocabulary terms.
      </p>
      <div className="grid gap-3">
        {quizzes.map((quiz) => (
          <Card
            key={quiz.id}
            className="cursor-pointer transition-colors hover:border-primary"
            onClick={() => onSelect(quiz.vocabulary_terms)}
          >
            <CardHeader className="flex-row items-center justify-between p-4">
              <div>
                <CardTitle className="text-base">{quiz.title}</CardTitle>
                <CardDescription>
                  {quiz.vocabulary_terms.length} term
                  {quiz.vocabulary_terms.length !== 1 ? "s" : ""} &middot;{" "}
                  {new Date(quiz.created_at).toLocaleDateString("en-US")}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {TYPE_LABELS[quiz.type] || quiz.type}
                </Badge>
                <Badge variant="outline">{quiz.cefr_level}</Badge>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
