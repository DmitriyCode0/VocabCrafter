"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Circle, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GrammarLibraryTopicQuiz } from "@/lib/grammar/library-topic-content";
import { cn } from "@/lib/utils";

interface GrammarTopicMiniQuizProps {
  quiz: GrammarLibraryTopicQuiz;
  title: string;
  explainLabel: string;
  submitLabel: string;
  finishQuizLabel: string;
  resetLabel: string;
  correctOptionLabel: string;
  questionLabel: string;
  scoreLabel: string;
}

export function GrammarTopicMiniQuiz({
  quiz,
  title,
  explainLabel,
  submitLabel,
  finishQuizLabel,
  resetLabel,
  correctOptionLabel,
  questionLabel,
  scoreLabel,
}: GrammarTopicMiniQuizProps) {
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<number, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const totalQuestions = quiz.questions.length;
  const score = quiz.questions.reduce((total, question, questionIndex) => {
    return total + (selectedOptionIds[questionIndex] === question.correctOptionId ? 1 : 0);
  }, 0);
  const currentQuestion = quiz.questions[currentQuestionIndex];
  const selectedOptionId = selectedOptionIds[currentQuestionIndex] ?? null;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const correctOption = currentQuestion?.options.find(
    (option) => option.id === currentQuestion.correctOptionId,
  );

  function handleSubmit() {
    if (!selectedOptionId) {
      return;
    }

    if (isLastQuestion) {
      setIsFinished(true);
      setShowExplanation(false);
      return;
    }

    setCurrentQuestionIndex((current) => current + 1);
    setShowExplanation(false);
  }

  function handleReset() {
    setSelectedOptionIds({});
    setCurrentQuestionIndex(0);
    setShowExplanation(false);
    setIsFinished(false);
  }

  return (
    <section id="mini-quiz" className="scroll-mt-24">
      <Card className="border-primary/20 bg-gradient-to-br from-accent/25 via-card to-muted/30 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold tracking-tight">
            {title}
          </CardTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {questionLabel} {Math.min(currentQuestionIndex + 1, totalQuestions)}/{totalQuestions}
            </span>
            {isFinished ? (
              <span className="font-medium text-foreground">
                {scoreLabel}: {score}/{totalQuestions}
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {isFinished ? (
              <motion.div
                key="quiz-finished"
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-primary/20 bg-primary/8 px-5 py-6 text-center">
                  <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                    {scoreLabel}
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
                    {score}/{totalQuestions}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button type="button" variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4" />
                    {resetLabel}
                  </Button>
                </div>
              </motion.div>
            ) : currentQuestion ? (
              <motion.div
                key={currentQuestionIndex}
                initial={{ opacity: 0, x: 28, scale: 0.985 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -28, scale: 0.985 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="space-y-3 rounded-xl border bg-card/80 p-4">
                  <p className="text-sm leading-6 text-foreground/90">
                    {currentQuestion.question}
                  </p>

                  <div className="space-y-3">
                    {currentQuestion.options.map((option) => {
                      const selected = selectedOptionId === option.id;
                      const revealCorrect =
                        showExplanation && option.id === currentQuestion.correctOptionId;
                      const revealIncorrect =
                        showExplanation &&
                        selectedOptionId === option.id &&
                        option.id !== currentQuestion.correctOptionId;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setSelectedOptionIds((current) => ({
                              ...current,
                              [currentQuestionIndex]: option.id,
                            }));
                          }}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-200",
                            selected && !showExplanation && "border-primary bg-primary/5",
                            revealCorrect && "border-primary/50 bg-primary/10",
                            revealIncorrect && "border-destructive/40 bg-destructive/10",
                            !selected && !showExplanation && "hover:bg-muted/60",
                          )}
                        >
                          {revealCorrect ? (
                            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                          ) : revealIncorrect ? (
                            <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
                          ) : (
                            <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="text-sm leading-6 text-foreground/90">
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {showExplanation && correctOption ? (
                    <motion.div
                      key={`explanation-${currentQuestionIndex}`}
                      initial={{ opacity: 0, y: 12, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -12, height: 0 }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm leading-6 text-foreground">
                        <p className="font-semibold">
                          {correctOptionLabel}: {correctOption.label}
                        </p>
                        <p className="mt-1">{currentQuestion.explanation}</p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowExplanation((current) => !current)}
                    disabled={!selectedOptionId}
                  >
                    {explainLabel}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!selectedOptionId}
                  >
                    {isLastQuestion ? finishQuizLabel : submitLabel}
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </CardContent>
      </Card>
    </section>
  );
}