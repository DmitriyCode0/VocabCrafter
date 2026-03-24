"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import type { QuizConfig, TextTranslationContent } from "@/types/quiz";
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";
import {
  getLearningLanguageLabel,
  getSourceLanguageLabel,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
} from "@/lib/languages";
import { removeSuggestedAnswerLines } from "@/lib/utils";

export interface TextTranslationResult {
  originalText: string;
  userTranslation: string;
  referenceTranslation: string;
  score: number;
  feedback: string;
}

interface TextTranslationPlayerProps {
  content: TextTranslationContent;
  cefrLevel?: string;
  quizConfig?: QuizConfig;
  onComplete: (result: TextTranslationResult) => void;
}

export function TextTranslationPlayer({
  content,
  cefrLevel,
  quizConfig,
  onComplete,
}: TextTranslationPlayerProps) {
  const [userTranslation, setUserTranslation] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    score: number;
    feedback: string;
  } | null>(null);

  const targetLanguageLabel = getLearningLanguageLabel(
    normalizeLearningLanguage(quizConfig?.targetLanguage),
  );
  const sourceLanguageLabel = getSourceLanguageLabel(
    normalizeSourceLanguage(quizConfig?.sourceLanguage),
  );
  const visibleFeedback = evaluation
    ? removeSuggestedAnswerLines(evaluation.feedback)
    : "";
  const progress = evaluation ? 100 : 50;

  async function handleSubmit() {
    if (!userTranslation.trim()) {
      return;
    }

    setIsEvaluating(true);

    try {
      const response = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userTranslation: userTranslation.trim(),
          referenceTranslation: content.referenceTranslation,
          cefrLevel: cefrLevel ?? "B1",
          config: quizConfig,
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(errorPayload?.error || "Evaluation failed");
      }

      const data = (await response.json()) as {
        score: number;
        feedback: string;
      };

      setEvaluation(data);
    } catch (error) {
      setEvaluation({
        score: -1,
        feedback:
          error instanceof Error
            ? error.message
            : "Could not evaluate your translation. Please try again.",
      });
    } finally {
      setIsEvaluating(false);
    }
  }

  function handleRetry() {
    setEvaluation(null);
  }

  function handleFinish() {
    if (!evaluation || evaluation.score < 0) {
      return;
    }

    onComplete({
      originalText: content.originalText,
      userTranslation: userTranslation.trim(),
      referenceTranslation: content.referenceTranslation,
      score: evaluation.score,
      feedback: evaluation.feedback,
    });
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-orange-600";
    return "text-red-600";
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Passage translation</span>
          {evaluation && evaluation.score >= 0 && (
            <span className={`font-medium ${getScoreColor(evaluation.score)}`}>
              {evaluation.score}/100
            </span>
          )}
        </div>
        <Progress value={progress} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">
              Translate the text to {targetLanguageLabel}
            </CardTitle>
            <BrowserTtsButton
              text={content.originalText}
              language={quizConfig?.sourceLanguage}
              label="Listen"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {sourceLanguageLabel}
            </p>
            <p className="whitespace-pre-line leading-relaxed">
              {content.originalText}
            </p>
          </div>

          <Textarea
            value={userTranslation}
            onChange={(event) => setUserTranslation(event.target.value)}
            placeholder={`Write your ${targetLanguageLabel} translation here...`}
            rows={10}
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
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
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
              <div className="flex items-center justify-between rounded-md bg-muted p-3">
                <span className="font-medium">Score</span>
                <span
                  className={`text-2xl font-bold ${getScoreColor(evaluation.score)}`}
                >
                  {evaluation.score}/100
                </span>
              </div>

              <div className="rounded-md bg-muted p-3 space-y-1">
                <p className="text-sm font-medium">Feedback:</p>
                <div className="text-sm space-y-0.5">
                  {visibleFeedback.split("\n").map((line, index) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    const isPass = trimmed.startsWith("✓");
                    const isFail = trimmed.startsWith("✗");

                    return (
                      <p
                        key={index}
                        className={
                          isFail
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

              <div className="rounded-md bg-muted p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Reference translation ({targetLanguageLabel}):
                    </p>
                    <p className="whitespace-pre-line text-sm italic">
                      {content.referenceTranslation}
                    </p>
                  </div>
                  <BrowserTtsButton
                    text={content.referenceTranslation}
                    language={quizConfig?.targetLanguage}
                    label="Listen"
                    className="shrink-0"
                  />
                </div>
              </div>

              <Button onClick={handleFinish} className="w-full">
                View Results
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
