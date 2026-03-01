"use client";

import { useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CheckCircle2, XCircle, RotateCcw, Home } from "lucide-react";
import { saveAttempt } from "@/lib/save-attempt";
import type { GapFillResult } from "./gap-fill-player";
import type { TranslationResult } from "./translation-player";

interface QuizResultsProps {
  type: "gap_fill" | "translation";
  quizId: string;
  gapFillResults?: GapFillResult[];
  translationResults?: TranslationResult[];
  onRestart: () => void;
}

export function QuizResults({
  type,
  quizId,
  gapFillResults,
  translationResults,
  onRestart,
}: QuizResultsProps) {
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    if (type === "gap_fill" && gapFillResults) {
      const correct = gapFillResults.filter((r) => r.isCorrect).length;
      saveAttempt(
        quizId,
        { type: "gap_fill", results: gapFillResults },
        correct,
        gapFillResults.length,
      );
    } else if (type === "translation" && translationResults) {
      const avgScore = Math.round(
        translationResults.reduce((sum, r) => sum + r.score, 0) /
          translationResults.length,
      );
      saveAttempt(
        quizId,
        { type: "translation", results: translationResults },
        avgScore,
        100,
      );
    }
  }, [type, quizId, gapFillResults, translationResults]);
  if (type === "gap_fill" && gapFillResults) {
    const correct = gapFillResults.filter((r) => r.isCorrect).length;
    const total = gapFillResults.length;
    const percentage = Math.round((correct / total) * 100);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Quiz Complete!</CardTitle>
            <CardDescription>
              You scored {correct} out of {total} ({percentage}%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gapFillResults.map((result, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-md ${
                  result.isCorrect
                    ? "bg-green-50 dark:bg-green-950/30"
                    : "bg-red-50 dark:bg-red-950/30"
                }`}
              >
                {result.isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                )}
                <div className="text-sm">
                  <p>
                    Your answer: <strong>{result.userAnswer}</strong>
                  </p>
                  {!result.isCorrect && (
                    <p className="text-muted-foreground">
                      Correct: <strong>{result.correctAnswer}</strong>
                    </p>
                  )}
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onRestart}>
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

  if (type === "translation" && translationResults) {
    const avgScore = Math.round(
      translationResults.reduce((sum, r) => sum + r.score, 0) /
        translationResults.length,
    );

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Translation Complete!</CardTitle>
            <CardDescription>Average score: {avgScore}/100</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {translationResults.map((result, index) => (
              <div key={index} className="p-3 rounded-md bg-muted space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Sentence {index + 1}</p>
                  <Badge
                    variant="outline"
                    className={
                      result.score >= 80
                        ? "text-green-600"
                        : result.score >= 50
                          ? "text-orange-600"
                          : "text-red-600"
                    }
                  >
                    {result.score}/100
                  </Badge>
                </div>
                <p className="text-sm">{result.ukrainianSentence}</p>
                <p className="text-sm">
                  Your translation: <em>{result.userTranslation}</em>
                </p>
                <p className="text-sm text-muted-foreground">
                  Reference: <em>{result.referenceTranslation}</em>
                </p>
                <p className="text-xs text-muted-foreground">
                  {result.feedback}
                </p>
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onRestart}>
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

  return null;
}
