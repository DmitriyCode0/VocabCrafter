"use client";

import { useEffect, useRef } from "react";
import { useAppI18n } from "@/components/providers/app-language-provider";
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
import { removeSuggestedAnswerLines, stripMarkdownEmphasis } from "@/lib/utils";
import type { GapFillResult } from "./gap-fill-player";
import type { MCQResult } from "./mcq-player";
import type { TextTranslationResult } from "./text-translation-player";
import type { TranslationResult } from "./translation-player";
import type { QuizConfig } from "@/types/quiz";
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";
import {
  getLearningLanguageLabel,
  getSourceLanguageLabel,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
} from "@/lib/languages";

interface QuizResultsProps {
  type: "mcq" | "gap_fill" | "translation" | "text_translation";
  quizId: string;
  timeSpentSeconds: number;
  mcqResults?: MCQResult[];
  gapFillResults?: GapFillResult[];
  translationResults?: TranslationResult[];
  textTranslationResults?: TextTranslationResult[];
  quizConfig?: QuizConfig;
  onRestart: () => void;
}

export function QuizResults({
  type,
  quizId,
  timeSpentSeconds,
  mcqResults,
  gapFillResults,
  translationResults,
  textTranslationResults,
  quizConfig,
  onRestart,
}: QuizResultsProps) {
  const { messages } = useAppI18n();
  const savedRef = useRef(false);
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

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    if (type === "mcq" && mcqResults) {
      const correct = mcqResults.filter((r) => r.isCorrect).length;
      saveAttempt(
        quizId,
        { type: "mcq", results: mcqResults },
        correct,
        mcqResults.length,
        timeSpentSeconds,
      );
    } else if (type === "gap_fill" && gapFillResults) {
      const correct = gapFillResults.filter((r) => r.isCorrect).length;
      saveAttempt(
        quizId,
        { type: "gap_fill", results: gapFillResults },
        correct,
        gapFillResults.length,
        timeSpentSeconds,
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
        timeSpentSeconds,
      );
    } else if (type === "text_translation" && textTranslationResults) {
      const averageScore = Math.round(
        textTranslationResults.reduce((sum, result) => sum + result.score, 0) /
          textTranslationResults.length,
      );
      saveAttempt(
        quizId,
        { type: "text_translation", results: textTranslationResults },
        averageScore,
        100,
        timeSpentSeconds,
      );
    }
  }, [
    type,
    quizId,
    timeSpentSeconds,
    mcqResults,
    gapFillResults,
    textTranslationResults,
    translationResults,
  ]);
  if (type === "mcq" && mcqResults) {
    const correct = mcqResults.filter((r) => r.isCorrect).length;
    const total = mcqResults.length;
    const percentage = Math.round((correct / total) * 100);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {messages.quizSession.results.quizCompleteTitle}
            </CardTitle>
            <CardDescription>
              {messages.quizSession.results.scored(correct, total, percentage)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mcqResults.map((result, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 rounded-md p-3 ${
                  result.isCorrect
                    ? "bg-green-50 dark:bg-green-950/30"
                    : "bg-red-50 dark:bg-red-950/30"
                }`}
              >
                {result.isCorrect ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                )}
                <div className="text-sm">
                  <p className="mb-1 font-medium">{result.question}</p>
                  <p>
                    {messages.quizSession.results.yourAnswer}: <strong>{result.selectedAnswer || "—"}</strong>
                  </p>
                  {!result.isCorrect ? (
                    <p className="text-muted-foreground">
                      {messages.quizSession.results.correctAnswer}:{" "}
                      <strong>{result.correctAnswer}</strong>
                    </p>
                  ) : null}
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onRestart}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {messages.common.restart}
              </Button>
              <Button asChild className="flex-1">
                <Link href="/quizzes">
                  <Home className="mr-2 h-4 w-4" />
                  {messages.quizzes.title}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (type === "gap_fill" && gapFillResults) {
    const correct = gapFillResults.filter((r) => r.isCorrect).length;
    const total = gapFillResults.length;
    const percentage = Math.round((correct / total) * 100);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {messages.quizSession.results.quizCompleteTitle}
            </CardTitle>
            <CardDescription>
              {messages.quizSession.results.scored(correct, total, percentage)}
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
                    {messages.quizSession.results.yourAnswer}:{" "}
                    <strong>{result.userAnswer}</strong>
                  </p>
                  {!result.isCorrect && (
                    <p className="text-muted-foreground">
                      {messages.quizSession.results.correctAnswer}:{" "}
                      <strong>{result.correctAnswer}</strong>
                    </p>
                  )}
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onRestart}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {messages.common.restart}
              </Button>
              <Button asChild className="flex-1">
                <Link href="/quizzes">
                  <Home className="mr-2 h-4 w-4" />
                  {messages.quizzes.title}
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
            <CardTitle className="text-2xl">
              {messages.quizSession.results.translationCompleteTitle}
            </CardTitle>
            <CardDescription>
              {messages.quizSession.results.averageScore(avgScore)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {translationResults.map((result, index) => {
              const visibleFeedback = removeSuggestedAnswerLines(
                result.feedback,
              )
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);

              return (
                <div key={index} className="p-3 rounded-md bg-muted space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {messages.quizSession.results.sentenceLabel(index + 1)}
                    </p>
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
                  <p className="text-sm">
                    {stripMarkdownEmphasis(result.ukrainianSentence)}
                  </p>
                  <p className="text-sm">
                    {messages.quizSession.results.yourTranslation}:{" "}
                    <em>{result.userTranslation}</em>
                  </p>
                  <div className="space-y-2 rounded-md bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {messages.quizSession.results.referenceTranslation(
                          targetLanguageLabel,
                        )}{" "}
                        <em>{result.referenceTranslation}</em>
                      </p>
                      <BrowserTtsButton
                        text={result.referenceTranslation}
                        language={quizConfig?.targetLanguage}
                        label={messages.common.listen}
                        className="shrink-0"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {messages.quizSession.results.sourceSentence(
                      sourceLanguageLabel,
                    )}
                  </p>
                  {visibleFeedback.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {visibleFeedback.map((line, i) => {
                        const isPass = line.startsWith("✓");
                        const isFail = line.startsWith("✗");
                        return (
                          <p
                            key={i}
                            className={
                              isFail
                                ? "text-red-500"
                                : isPass
                                  ? "text-green-600 dark:text-green-400"
                                  : ""
                            }
                          >
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onRestart}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {messages.common.restart}
              </Button>
              <Button asChild className="flex-1">
                <Link href="/quizzes">
                  <Home className="mr-2 h-4 w-4" />
                  {messages.quizzes.title}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (type === "text_translation" && textTranslationResults) {
    const result = textTranslationResults[0];

    if (!result) {
      return null;
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {messages.quizSession.results.textTranslationCompleteTitle}
            </CardTitle>
            <CardDescription>
              {messages.quizSession.results.scoreDescription(result.score)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {messages.quizSession.results.sourceText(sourceLanguageLabel)}
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {stripMarkdownEmphasis(result.originalText)}
              </p>
            </div>

            <div className="rounded-md bg-muted p-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {messages.quizSession.results.yourTranslationTitle}
              </p>
              <p className="whitespace-pre-line text-sm">
                <em>{result.userTranslation}</em>
              </p>
            </div>

            <div className="space-y-2 rounded-md bg-background/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {messages.quizSession.results.referenceTranslation(
                      targetLanguageLabel,
                    )}
                  </p>
                  <p className="whitespace-pre-line text-sm italic">
                    {result.referenceTranslation}
                  </p>
                </div>
                <BrowserTtsButton
                  text={result.referenceTranslation}
                  language={quizConfig?.targetLanguage}
                  label={messages.common.listen}
                  className="shrink-0"
                />
              </div>
            </div>

            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-0.5">
              {removeSuggestedAnswerLines(result.feedback)
                .split("\n")
                .map((line, index) => {
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

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onRestart}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {messages.common.restart}
              </Button>
              <Button asChild className="flex-1">
                <Link href="/quizzes">
                  <Home className="mr-2 h-4 w-4" />
                  {messages.quizzes.title}
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
