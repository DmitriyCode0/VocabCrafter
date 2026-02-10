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
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import type { GapFillQuestion } from "@/types/quiz";

interface GapFillPlayerProps {
  questions: GapFillQuestion[];
  onComplete: (results: GapFillResult[]) => void;
}

export interface GapFillResult {
  questionId: number;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export function GapFillPlayer({ questions, onComplete }: GapFillPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<GapFillResult[]>([]);

  const question = questions[currentIndex];
  const progress = ((currentIndex + (submitted ? 1 : 0)) / questions.length) * 100;
  const isCorrect =
    submitted &&
    userAnswer.trim().toLowerCase() === question.correctAnswer.toLowerCase();

  function handleSubmit() {
    if (!userAnswer.trim()) return;

    const result: GapFillResult = {
      questionId: question.id,
      userAnswer: userAnswer.trim(),
      correctAnswer: question.correctAnswer,
      isCorrect:
        userAnswer.trim().toLowerCase() ===
        question.correctAnswer.toLowerCase(),
    };

    setResults([...results, result]);
    setSubmitted(true);
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer("");
      setSubmitted(false);
    } else {
      const finalResults = [
        ...results,
      ];
      onComplete(finalResults);
    }
  }

  const correctCount = results.filter((r) => r.isCorrect).length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <Badge variant="outline">
            Score: {correctCount}/{results.length}
          </Badge>
        </div>
        <Progress value={progress} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fill in the blank</CardTitle>
          <CardDescription>
            Type the missing word to complete the sentence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg leading-relaxed">{question.sentence}</p>

          <p className="text-sm text-muted-foreground">
            Hint: {question.hint}
          </p>

          <div className="flex gap-2">
            <Input
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type your answer..."
              disabled={submitted}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (submitted) handleNext();
                  else handleSubmit();
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
              <Button
                onClick={handleSubmit}
                disabled={!userAnswer.trim()}
              >
                Check
              </Button>
            ) : (
              <Button onClick={handleNext}>
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

          {submitted && (
            <div
              className={`flex items-start gap-2 p-3 rounded-md ${
                isCorrect
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
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
                      <span className="font-bold">{question.correctAnswer}</span>
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
