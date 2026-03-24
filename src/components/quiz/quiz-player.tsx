"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { FlashcardPlayer, type FlashcardResult } from "./flashcard-player";
import { GapFillPlayer, type GapFillResult } from "./gap-fill-player";
import {
  TranslationPlayer,
  type TranslationResult,
} from "./translation-player";
import {
  TextTranslationPlayer,
  type TextTranslationResult,
} from "./text-translation-player";
import { QuizResults } from "./quiz-results";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RotateCcw, Home } from "lucide-react";
import { saveAttempt } from "@/lib/save-attempt";
import type { Quiz } from "@/types/database";
import type {
  FlashcardItem,
  GapFillQuestion,
  TextTranslationContent,
  TranslationQuestion,
} from "@/types/quiz";

interface QuizPlayerProps {
  quiz: Quiz;
  isOwner?: boolean;
}

export function QuizPlayer({ quiz, isOwner = false }: QuizPlayerProps) {
  const [showResults, setShowResults] = useState(false);
  const [gapFillResults, setGapFillResults] = useState<GapFillResult[]>([]);
  const [translationResults, setTranslationResults] = useState<
    TranslationResult[]
  >([]);
  const [textTranslationResults, setTextTranslationResults] = useState<
    TextTranslationResult[]
  >([]);
  const [flashcardKnown, setFlashcardKnown] = useState(0);
  const [flashcardTotal, setFlashcardTotal] = useState(0);

  const content = quiz.generated_content as Record<string, unknown>;
  const quizConfig = quiz.config as
    | import("@/types/quiz").QuizConfig
    | null
    | undefined;

  function handleRestart() {
    setShowResults(false);
    setGapFillResults([]);
    setTranslationResults([]);
    setTextTranslationResults([]);
    setFlashcardKnown(0);
    setFlashcardTotal(0);
  }

  const handleFlashcardComplete = useCallback(
    (results: FlashcardResult[], known: number, total: number) => {
      saveAttempt(
        quiz.id,
        {
          type: "flashcards",
          known,
          total,
          results: results.map((r) => ({ term: r.term, known: r.known })),
        },
        known,
        total,
      );
      setFlashcardKnown(known);
      setFlashcardTotal(total);
      setShowResults(true);
    },
    [quiz.id],
  );

  if (quiz.type === "flashcards") {
    if (showResults) {
      const percentage =
        flashcardTotal > 0
          ? Math.round((flashcardKnown / flashcardTotal) * 100)
          : 0;
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Flashcards Complete!</CardTitle>
              <CardDescription>
                You knew {flashcardKnown} of {flashcardTotal} terms (
                {percentage}%)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={percentage} className="h-3" />
              <p className="text-center text-sm text-muted-foreground">
                {percentage >= 80
                  ? "Great job! You know most of these terms."
                  : percentage >= 50
                    ? "Good progress! Keep practicing to improve."
                    : "Keep studying! Practice makes perfect."}
              </p>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleRestart}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button asChild className="flex-1">
                  <Link href="/quizzes">
                    <Home className="mr-2 h-4 w-4" />
                    My Quizzes
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    const cards = (content.cards || []) as FlashcardItem[];
    return (
      <FlashcardPlayer
        cards={cards}
        quizConfig={quizConfig ?? undefined}
        onComplete={handleFlashcardComplete}
      />
    );
  }

  if (quiz.type === "gap_fill") {
    if (showResults) {
      return (
        <QuizResults
          type="gap_fill"
          quizId={quiz.id}
          gapFillResults={gapFillResults}
          onRestart={handleRestart}
        />
      );
    }

    const questions = (content.questions || []) as GapFillQuestion[];
    return (
      <GapFillPlayer
        questions={questions}
        quizConfig={quizConfig ?? undefined}
        onComplete={(results) => {
          setGapFillResults(results);
          setShowResults(true);
        }}
      />
    );
  }

  if (quiz.type === "translation") {
    if (showResults) {
      return (
        <QuizResults
          type="translation"
          quizId={quiz.id}
          translationResults={translationResults}
          quizConfig={quizConfig ?? undefined}
          onRestart={handleRestart}
        />
      );
    }

    const questions = (content.questions || []) as TranslationQuestion[];
    return (
      <TranslationPlayer
        questions={questions}
        cefrLevel={quiz.cefr_level}
        quizConfig={quizConfig ?? undefined}
        canPreviewQuestions={isOwner}
        onComplete={(results) => {
          setTranslationResults(results);
          setShowResults(true);
        }}
      />
    );
  }

  if (quiz.type === "text_translation") {
    if (showResults) {
      return (
        <QuizResults
          type="text_translation"
          quizId={quiz.id}
          textTranslationResults={textTranslationResults}
          quizConfig={quizConfig ?? undefined}
          onRestart={handleRestart}
        />
      );
    }

    const textTranslationContent = content.content as TextTranslationContent;

    return (
      <TextTranslationPlayer
        content={textTranslationContent}
        cefrLevel={quiz.cefr_level}
        quizConfig={quizConfig ?? undefined}
        onComplete={(result) => {
          setTextTranslationResults([result]);
          setShowResults(true);
        }}
      />
    );
  }

  return (
    <p className="text-muted-foreground">Unsupported quiz type: {quiz.type}</p>
  );
}
