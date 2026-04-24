"use client";

import { useState } from "react";
import { useAppI18n } from "@/components/providers/app-language-provider";
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
import { TranslationFeedbackList } from "@/components/quiz/translation-feedback-list";

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
  const { messages } = useAppI18n();
  const [userTranslation, setUserTranslation] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    score: number;
    feedback: string;
  } | null>(null);

  const normalizedTargetLanguage = normalizeLearningLanguage(
    quizConfig?.targetLanguage,
  );
  const normalizedSourceLanguage = normalizeSourceLanguage(
    quizConfig?.sourceLanguage,
  );
  const targetLanguageLabel =
    messages.common.studyLanguageNames[normalizedTargetLanguage] ||
    getLearningLanguageLabel(normalizedTargetLanguage);
  const sourceLanguageLabel =
    messages.common.studyLanguageNames[normalizedSourceLanguage] ||
    getSourceLanguageLabel(normalizedSourceLanguage);
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
            : messages.quizSession.textTranslation.evaluationFailed,
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
          <span className="text-muted-foreground">
            {messages.quizSession.textTranslation.progressLabel}
          </span>
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
              {messages.quizSession.textTranslation.title(targetLanguageLabel)}
            </CardTitle>
            <BrowserTtsButton
              text={content.originalText}
              language={quizConfig?.sourceLanguage}
              label={messages.common.listen}
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
            placeholder={messages.quizSession.textTranslation.placeholder(
              targetLanguageLabel,
            )}
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
                  {messages.quizSession.textTranslation.evaluating}
                </>
              ) : (
                messages.quizSession.textTranslation.submit
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
                {messages.quizSession.textTranslation.retryEvaluation}
              </Button>
            </div>
          )}

          {evaluation && evaluation.score >= 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-muted p-3">
                <span className="font-medium">{messages.common.score}</span>
                <span
                  className={`text-2xl font-bold ${getScoreColor(evaluation.score)}`}
                >
                  {evaluation.score}/100
                </span>
              </div>

              <div className="rounded-md bg-muted p-3 space-y-1">
                <p className="text-sm font-medium">
                  {messages.common.feedback}:
                </p>
                <TranslationFeedbackList
                  feedback={evaluation.feedback}
                  itemClassName="text-sm"
                />
              </div>

              <div className="rounded-md bg-muted p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {messages.quizSession.textTranslation.referenceTranslation(
                        targetLanguageLabel,
                      )}
                    </p>
                    <p className="whitespace-pre-line text-sm italic">
                      {content.referenceTranslation}
                    </p>
                  </div>
                  <BrowserTtsButton
                    text={content.referenceTranslation}
                    language={quizConfig?.targetLanguage}
                    label={messages.common.listen}
                    className="shrink-0"
                  />
                </div>
              </div>

              <Button onClick={handleFinish} className="w-full">
                {messages.quizSession.textTranslation.viewResults}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
