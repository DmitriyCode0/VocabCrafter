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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight } from "lucide-react";
import type { MCQQuestion } from "@/types/quiz";

export interface MCQResult {
  questionId: number;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  originalTerm: string;
}

interface MCQPlayerProps {
  questions: MCQQuestion[];
  onComplete: (results: MCQResult[]) => void;
}

export function MCQPlayer({ questions, onComplete }: MCQPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() =>
    questions.map(() => ""),
  );
  const [submittedByIndex, setSubmittedByIndex] = useState<boolean[]>(() =>
    questions.map(() => false),
  );

  const question = questions[currentIndex];
  const selectedAnswer = answers[currentIndex] ?? "";
  const submitted = submittedByIndex[currentIndex] ?? false;
  const results: MCQResult[] = questions
    .map((currentQuestion, index) => ({
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      selectedAnswer: answers[index] ?? "",
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: (answers[index] ?? "") === currentQuestion.correctAnswer,
      originalTerm: currentQuestion.originalTerm,
    }))
    .filter((_, index) => submittedByIndex[index]);
  const completedCount = submittedByIndex.filter(Boolean).length;
  const correctCount = results.filter((result) => result.isCorrect).length;
  const progress = (completedCount / questions.length) * 100;
  const isCorrect = submitted && selectedAnswer === question.correctAnswer;
  const allCompleted = completedCount === questions.length;

  function handleSelectAnswer(option: string) {
    if (submitted) {
      return;
    }

    setAnswers((currentAnswers) => {
      const nextAnswers = [...currentAnswers];
      nextAnswers[currentIndex] = option;
      return nextAnswers;
    });
  }

  function handleSubmit() {
    if (!selectedAnswer) {
      return;
    }

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
          <CardTitle className="text-lg">Multiple choice</CardTitle>
          <CardDescription>
            Pick the best answer for this vocabulary question.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg leading-relaxed">{question.question}</p>

          <div className="space-y-2">
            {question.options.map((option) => {
              const isSelected = selectedAnswer === option;
              const showCorrect = submitted && option === question.correctAnswer;
              const showWrong = submitted && isSelected && option !== question.correctAnswer;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelectAnswer(option)}
                  disabled={submitted}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    showCorrect
                      ? "border-green-500 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-300"
                      : showWrong
                        ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-300"
                        : isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/60 hover:bg-muted/40"
                  } ${submitted ? "cursor-default" : "cursor-pointer"}`}
                >
                  <span>{option}</span>
                  {showCorrect ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : showWrong ? (
                    <XCircle className="h-4 w-4 shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            {!submitted ? (
              <>
                <Button variant="outline" onClick={handleSkip}>
                  Skip
                </Button>
                <Button onClick={handleSubmit} disabled={!selectedAnswer}>
                  Check
                </Button>
              </>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!allCompleted && currentIndex === questions.length - 1}
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

          {currentIndex === questions.length - 1 && submitted && !allCompleted ? (
            <p className="text-xs text-muted-foreground">
              Use the arrows to review unanswered questions before finishing.
            </p>
          ) : null}

          {submitted ? (
            <div
              className={`flex items-start gap-2 rounded-md p-3 ${
                isCorrect
                  ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                  : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                {isCorrect ? (
                  <p className="font-medium">Correct!</p>
                ) : (
                  <>
                    <p className="font-medium">
                      Not quite. The correct answer is:{" "}
                      <span className="font-bold">{question.correctAnswer}</span>
                    </p>
                    {selectedAnswer ? (
                      <p className="text-sm opacity-90">
                        You selected {selectedAnswer}.
                      </p>
                    ) : (
                      <p className="text-sm opacity-90">You skipped this question.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}