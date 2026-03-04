"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2 } from "lucide-react";
import type { TranslationQuestion, QuizConfig } from "@/types/quiz";

interface TranslationPlayerProps {
  questions: TranslationQuestion[];
  cefrLevel?: string;
  quizConfig?: QuizConfig;
  onComplete: (results: TranslationResult[]) => void;
}

export interface TranslationResult {
  questionId: number;
  ukrainianSentence: string;
  userTranslation: string;
  referenceTranslation: string;
  score: number;
  feedback: string;
}

export function TranslationPlayer({
  questions,
  cefrLevel,
  quizConfig,
  onComplete,
}: TranslationPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userTranslation, setUserTranslation] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    score: number;
    feedback: string;
  } | null>(null);
  const [results, setResults] = useState<TranslationResult[]>([]);

  const question = questions[currentIndex];
  const progress =
    ((currentIndex + (evaluation ? 1 : 0)) / questions.length) * 100;

  /** Bold the target vocabulary word in the Ukrainian sentence */
  function renderHighlightedSentence(
    sentence: string,
    highlight?: string,
  ): React.ReactNode {
    if (!highlight) return sentence;
    const idx = sentence.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx === -1) return sentence;
    const before = sentence.slice(0, idx);
    const match = sentence.slice(idx, idx + highlight.length);
    const after = sentence.slice(idx + highlight.length);
    return (
      <>
        {before}
        <span className="font-bold text-primary underline decoration-primary/40 decoration-2 underline-offset-2">
          {match}
        </span>
        {after}
      </>
    );
  }

  async function handleSubmit() {
    if (!userTranslation.trim()) return;

    setIsEvaluating(true);

    try {
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userTranslation: userTranslation.trim(),
          referenceTranslation: question.englishReference,
          cefrLevel: cefrLevel ?? "B1",
          config: quizConfig,
        }),
      });

      if (!res.ok) {
        throw new Error("Evaluation failed");
      }

      const data = await res.json();
      setEvaluation(data);

      const result: TranslationResult = {
        questionId: question.id,
        ukrainianSentence: question.ukrainianSentence,
        userTranslation: userTranslation.trim(),
        referenceTranslation: question.englishReference,
        score: data.score,
        feedback: data.feedback,
      };

      setResults([...results, result]);
    } catch {
      setEvaluation({
        score: -1,
        feedback: "Could not evaluate your translation. Please try again.",
      });
    } finally {
      setIsEvaluating(false);
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserTranslation("");
      setEvaluation(null);
    } else {
      onComplete(results);
    }
  }

  function handleRetry() {
    setEvaluation(null);
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-orange-600";
    return "text-red-600";
  }

  const avgScore =
    results.length > 0
      ? Math.round(
          results.reduce((sum, r) => sum + r.score, 0) / results.length,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Sentence {currentIndex + 1} of {questions.length}
          </span>
          {results.length > 0 && (
            <Badge variant="outline">Avg Score: {avgScore}/100</Badge>
          )}
        </div>
        <Progress value={progress} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Translate to English</CardTitle>
          <CardDescription>
            Read the Ukrainian sentence and write your English translation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-md bg-muted">
            <p className="text-lg font-medium">
              {renderHighlightedSentence(
                question.ukrainianSentence,
                question.highlightText,
              )}
            </p>
          </div>

          <Textarea
            value={userTranslation}
            onChange={(e) => setUserTranslation(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !evaluation &&
                !isEvaluating &&
                userTranslation.trim()
              ) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Type your English translation... (Enter to submit, Shift+Enter for new line)"
            rows={3}
            disabled={!!evaluation || isEvaluating}
          />

          {!evaluation && (
            <Button
              onClick={handleSubmit}
              disabled={!userTranslation.trim() || isEvaluating}
              className="w-full"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Evaluating...
                </>
              ) : (
                "Submit Translation"
              )}
            </Button>
          )}

          {evaluation && evaluation.score === -1 && (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {evaluation.feedback}
              </div>
              <Button
                onClick={handleRetry}
                className="w-full"
                variant="outline"
              >
                Retry Evaluation
              </Button>
            </div>
          )}

          {evaluation && evaluation.score >= 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <span className="font-medium">Score</span>
                <span
                  className={`text-2xl font-bold ${getScoreColor(evaluation.score)}`}
                >
                  {evaluation.score}/100
                </span>
              </div>

              <div className="p-3 rounded-md bg-muted space-y-1">
                <p className="text-sm font-medium">Feedback:</p>
                <div className="text-sm space-y-0.5">
                  {evaluation.feedback.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    const isPass = trimmed.startsWith("✓");
                    const isFail = trimmed.startsWith("✗");
                    const isSuggested =
                      trimmed.toLowerCase().startsWith("suggested");
                    return (
                      <p
                        key={i}
                        className={
                          isSuggested
                            ? "text-muted-foreground italic mt-1"
                            : isFail
                              ? "text-red-500"
                              : isPass
                                ? "text-green-600 dark:text-green-400"
                                : ""
                        }
                      >
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-md bg-muted space-y-1">
                <p className="text-sm font-medium">Reference translation:</p>
                <p className="text-sm italic">{question.englishReference}</p>
              </div>

              <Button onClick={handleNext} className="w-full">
                {currentIndex < questions.length - 1 ? (
                  <>
                    Next Sentence
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  "View Results"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
