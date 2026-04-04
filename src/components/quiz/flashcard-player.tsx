"use client";

import { useState } from "react";
import { motion } from "motion/react";
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
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import type { FlashcardItem, QuizConfig } from "@/types/quiz";
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";
import {
  normalizeLearningLanguage,
  normalizeSourceLanguage,
} from "@/lib/languages";

export interface FlashcardResult {
  term: string;
  known: boolean;
}

interface FlashcardPlayerProps {
  cards: FlashcardItem[];
  quizConfig?: QuizConfig;
  onComplete: (
    results: FlashcardResult[],
    known: number,
    total: number,
  ) => void;
}

export function FlashcardPlayer({
  cards,
  quizConfig,
  onComplete,
}: FlashcardPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [learning, setLearning] = useState<Set<number>>(new Set());

  const card = cards[currentIndex];
  const targetLanguage = normalizeLearningLanguage(quizConfig?.targetLanguage);
  const sourceLanguage = normalizeSourceLanguage(quizConfig?.sourceLanguage);
  const progress = ((known.size + learning.size) / cards.length) * 100;
  const reviewedCount = known.size + learning.size;
  const remainingCount = Math.max(0, cards.length - reviewedCount);

  function handleKnow() {
    setKnown((prev) => new Set(prev).add(currentIndex));
    learning.delete(currentIndex);
    setLearning(new Set(learning));
    goNext();
  }

  function handleStillLearning() {
    setLearning((prev) => new Set(prev).add(currentIndex));
    known.delete(currentIndex);
    setKnown(new Set(known));
    goNext();
  }

  function goNext() {
    setSlideDirection(1);
    setIsFlipped(false);
    setCurrentIndex((index) => (index < cards.length - 1 ? index + 1 : index));
  }

  function goPrev() {
    setSlideDirection(-1);
    setIsFlipped(false);
    setCurrentIndex((index) => (index > 0 ? index - 1 : index));
  }

  function restart() {
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnown(new Set());
    setLearning(new Set());
  }

  const allReviewed = known.size + learning.size === cards.length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="mx-auto max-w-4xl rounded-2xl border border-border/70 bg-card/50 px-4 py-4 shadow-none backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_14px_36px_rgba(15,23,42,0.06)] sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 lg:flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-foreground">
                Card {currentIndex + 1} of {cards.length}
              </span>
              <span className="text-muted-foreground">
                {remainingCount} remaining
              </span>
            </div>
            <Progress value={progress} className="h-2.5" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-green-600">
              Know: {known.size}
            </Badge>
            <Badge variant="outline" className="text-orange-600">
              Learning: {learning.size}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl">
        <Card
          className="group cursor-pointer overflow-hidden border-primary/15 bg-card shadow-none transition-[border-color,box-shadow,transform] duration-300 hover:border-primary/30 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)] focus-visible:border-primary/30 focus-visible:shadow-[0_18px_42px_rgba(15,23,42,0.12)]"
          onClick={() => setIsFlipped(!isFlipped)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setIsFlipped((current) => !current);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={
            isFlipped
              ? "Flashcard back. Press to show the front."
              : "Flashcard front. Press to reveal the translation."
          }
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/[0.06] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/10 via-primary/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
          <CardContent className="relative w-full px-5 py-5 sm:px-8 sm:py-8 lg:min-h-[255px] lg:px-10 lg:py-8">
            <div className="absolute right-5 top-5 z-10 sm:right-8 sm:top-8 lg:right-10 lg:top-10">
              <BrowserTtsButton
                text={isFlipped ? card.definition : card.term}
                language={isFlipped ? sourceLanguage : targetLanguage}
                label="Listen"
                className="bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background/90"
              />
            </div>

            <div className="flex h-full min-h-[200px] items-center justify-center py-6 sm:min-h-[220px] sm:py-8 lg:min-h-[205px] lg:py-4">
              <motion.div
                key={currentIndex}
                className="w-full"
                initial={{ opacity: 0, x: slideDirection * 28, scale: 0.985 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                <div className="w-full [perspective:1600px]">
                  <motion.div
                    className="relative mx-auto h-[180px] w-full max-w-xl sm:h-[200px] lg:h-[170px]"
                    animate={{
                      rotateY: isFlipped ? 180 : 0,
                      scale: isFlipped ? 0.985 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 260, damping: 30 }}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div
                      className="absolute inset-0 flex items-center justify-center px-4 text-center"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <p className="mx-auto text-center text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                        {card.term}
                      </p>
                    </div>

                    <div
                      className="absolute inset-0 flex items-center justify-center px-4 text-center"
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                    >
                      <div className="mx-auto w-full max-w-2xl space-y-5 text-center">
                        <p className="mx-auto text-center text-3xl font-semibold tracking-tight text-primary sm:text-4xl lg:text-5xl">
                          {card.definition}
                        </p>
                        {card.example ? (
                          <div className="mx-auto max-w-2xl rounded-2xl border border-border/70 bg-background/55 px-5 py-4 text-left shadow-none">
                            <p className="text-sm italic text-muted-foreground sm:text-base">
                              &ldquo;{card.example}&rdquo;
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          size="sm"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="sm:w-11"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {isFlipped && (
          <>
            <Button
              variant="outline"
              className="flex-1 border-orange-500/25 bg-orange-500/5 text-orange-600 hover:bg-orange-500/10"
              onClick={handleStillLearning}
            >
              Still Learning
            </Button>
            <Button
              className="flex-1 border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
              variant="outline"
              onClick={handleKnow}
            >
              Know It
            </Button>
          </>
        )}

        {!isFlipped && (
          <Button
            variant="outline"
            className="flex-1 border-primary/20 bg-primary/5 hover:bg-primary/10"
            onClick={() => setIsFlipped(true)}
          >
            Flip Card
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={goNext}
          disabled={currentIndex === cards.length - 1}
          className="sm:w-11"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {allReviewed && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Session Complete!</CardTitle>
            <CardDescription>
              You know {known.size} of {cards.length} terms.{" "}
              {learning.size > 0 &&
                `${learning.size} term${learning.size !== 1 ? "s" : ""} still need practice.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 justify-center">
            <Button onClick={restart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart
            </Button>
            <Button
              onClick={() => {
                const results: FlashcardResult[] = cards.map(
                  (currentCard, idx) => ({
                    term: currentCard.term,
                    known: known.has(idx),
                  }),
                );
                onComplete(results, known.size, cards.length);
              }}
            >
              Done
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
