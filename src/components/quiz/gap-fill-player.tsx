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
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight } from "lucide-react";
import type { GapFillQuestion, QuizConfig } from "@/types/quiz";
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";
import { normalizeLearningLanguage } from "@/lib/languages";

interface GapFillPlayerProps {
  questions: GapFillQuestion[];
  quizConfig?: QuizConfig;
  onComplete: (results: GapFillResult[]) => void;
}

export interface GapFillResult {
  questionId: number;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export function GapFillPlayer({
  questions,
  quizConfig,
  onComplete,
}: GapFillPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() =>
    questions.map(() => ""),
  );
  const [submittedByIndex, setSubmittedByIndex] = useState<boolean[]>(() =>
    questions.map(() => false),
  );

  const question = questions[currentIndex];
  const targetLanguage = normalizeLearningLanguage(quizConfig?.targetLanguage);
  const spokenSentence = question.sentence.replace(
    "___",
    question.correctAnswer,
  );
  const userAnswer = answers[currentIndex] ?? "";
  const submitted = submittedByIndex[currentIndex] ?? false;
  const results: GapFillResult[] = questions
    .map((currentQuestion, index) => ({
      questionId: currentQuestion.id,
      userAnswer: answers[index] ?? "",
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect:
        (answers[index] ?? "").trim().toLowerCase() ===
        currentQuestion.correctAnswer.toLowerCase(),
    }))
    .filter((_, index) => submittedByIndex[index]);
  const completedCount = submittedByIndex.filter(Boolean).length;
  const progress = (completedCount / questions.length) * 100;
  const isCorrect =
    submitted &&
    userAnswer.trim().toLowerCase() === question.correctAnswer.toLowerCase();
  const allCompleted = completedCount === questions.length;

  function handleSubmit() {
    if (!userAnswer.trim()) return;

    setAnswers((currentAnswers) => {
      const nextAnswers = [...currentAnswers];
      nextAnswers[currentIndex] = userAnswer.trim();
      return nextAnswers;
    });
    setSubmittedByIndex((currentSubmitted) => {
      const nextSubmitted = [...currentSubmitted];
      nextSubmitted[currentIndex] = true;
      return nextSubmitted;
    });
  }

  function handleSkip() {
    setAnswers((currentAnswers) => {
      const nextAnswers = [...currentAnswers];
      nextAnswers[currentIndex] = "";
      return nextAnswers;
    });
    setSubmittedByIndex((currentSubmitted) => {
      const nextSubmitted = [...currentSubmitted];
      nextSubmitted[currentIndex] = true;
      return nextSubmitted;
    });
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(results);
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  function handleAnswerChange(value: string) {
    setAnswers((currentAnswers) => {
      const nextAnswers = [...currentAnswers];
      nextAnswers[currentIndex] = value;
      return nextAnswers;
    });
  }

  const correctCount = results.filter((r) => r.isCorrect).length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                aria-label="Previous question"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleNext}
                disabled={currentIndex === questions.length - 1}
                aria-label="Next question"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <Badge variant="outline">
              Score: {correctCount}/{completedCount}
            </Badge>
          </div>
        </div>
        <Progress value={progress} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Fill in the blank</CardTitle>
            <BrowserTtsButton
              text={spokenSentence}
              language={targetLanguage}
              label="Listen"
            />
          </div>
          <CardDescription>
            Type the missing word to complete the sentence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg leading-relaxed">{question.sentence}</p>

          <p className="text-sm text-muted-foreground">Hint: {question.hint}</p>

          <div className="flex gap-2">
            <Input
              value={userAnswer}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Type your answer..."
              disabled={submitted}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (submitted && currentIndex < questions.length - 1) {
                    handleNext();
                  } else handleSubmit();
                }
              }}
              className={
                submitted
                  ? isCorrect
                    ? "border-green-500"
                    : "border-red-500"
                  : ""
              }
            />
            {!submitted ? (
              <>
                <Button variant="outline" onClick={handleSkip}>
                  Skip
                </Button>
                <Button onClick={handleSubmit} disabled={!userAnswer.trim()}>
                  Check
                </Button>
              </>
            ) : (
              <Button
                onClick={handleNext}
                disabled={
                  !allCompleted && currentIndex === questions.length - 1
                }
              >
                {currentIndex < questions.length - 1 ? (
                  <>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  "Finish"
                )}
              </Button>
            )}
          </div>

          {currentIndex === questions.length - 1 &&
            submitted &&
            !allCompleted && (
              <p className="text-xs text-muted-foreground">
                Use the arrows to review unanswered questions before finishing.
              </p>
            )}

          {submitted && (
            <div
              className={`flex items-start gap-2 p-3 rounded-md ${
                isCorrect
                  ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                  : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 mt-0.5 shrink-0" />
              )}
              <div>
                {isCorrect ? (
                  <p className="font-medium">Correct!</p>
                ) : (
                  <>
                    <p className="font-medium">
                      Not quite. The correct answer is:{" "}
                      <span className="font-bold">
                        {question.correctAnswer}
                      </span>
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
