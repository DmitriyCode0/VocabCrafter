"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlashcardPlayer } from "./flashcard-player";
import { GapFillPlayer, type GapFillResult } from "./gap-fill-player";
import {
  TranslationPlayer,
  type TranslationResult,
} from "./translation-player";
import { QuizResults } from "./quiz-results";
import type { Quiz } from "@/types/database";
import type {
  FlashcardItem,
  GapFillQuestion,
  TranslationQuestion,
} from "@/types/quiz";

interface QuizPlayerProps {
  quiz: Quiz;
}

export function QuizPlayer({ quiz }: QuizPlayerProps) {
  const router = useRouter();
  const [showResults, setShowResults] = useState(false);
  const [gapFillResults, setGapFillResults] = useState<GapFillResult[]>([]);
  const [translationResults, setTranslationResults] = useState<
    TranslationResult[]
  >([]);

  const content = quiz.generated_content as Record<string, unknown>;

  function handleRestart() {
    setShowResults(false);
    setGapFillResults([]);
    setTranslationResults([]);
  }

  if (quiz.type === "flashcards") {
    const cards = (content.cards || []) as FlashcardItem[];
    return (
      <FlashcardPlayer
        cards={cards}
        onComplete={() => router.push("/quizzes")}
      />
    );
  }

  if (quiz.type === "gap_fill") {
    if (showResults) {
      return (
        <QuizResults
          type="gap_fill"
          gapFillResults={gapFillResults}
          onRestart={handleRestart}
        />
      );
    }

    const questions = (content.questions || []) as GapFillQuestion[];
    return (
      <GapFillPlayer
        questions={questions}
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
          translationResults={translationResults}
          onRestart={handleRestart}
        />
      );
    }

    const questions = (content.questions || []) as TranslationQuestion[];
    return (
      <TranslationPlayer
        questions={questions}
        onComplete={(results) => {
          setTranslationResults(results);
          setShowResults(true);
        }}
      />
    );
  }

  return (
    <p className="text-muted-foreground">
      Unsupported quiz type: {quiz.type}
    </p>
  );
}
