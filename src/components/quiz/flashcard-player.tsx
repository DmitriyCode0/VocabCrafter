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
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import type { FlashcardItem } from "@/types/quiz";

interface FlashcardPlayerProps {
  cards: FlashcardItem[];
  onComplete: (known: number, total: number) => void;
}

export function FlashcardPlayer({ cards, onComplete }: FlashcardPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [learning, setLearning] = useState<Set<number>>(new Set());

  const card = cards[currentIndex];
  const progress = ((known.size + learning.size) / cards.length) * 100;

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
    setIsFlipped(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function goPrev() {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  function restart() {
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnown(new Set());
    setLearning(new Set());
  }

  const allReviewed = known.size + learning.size === cards.length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Card {currentIndex + 1} of {cards.length}
          </span>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-green-600">
              Know: {known.size}
            </Badge>
            <Badge variant="outline" className="text-orange-600">
              Learning: {learning.size}
            </Badge>
          </div>
        </div>
        <Progress value={progress} />
      </div>

      <Card
        className="cursor-pointer min-h-[250px] flex items-center justify-center transition-all hover:shadow-md"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <CardContent className="text-center py-12 px-8">
          {!isFlipped ? (
            <div>
              <p className="text-2xl font-bold mb-2">{card.term}</p>
              <p className="text-sm text-muted-foreground">
                Click to reveal translation
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xl font-semibold text-primary mb-2">
                {card.definition}
              </p>
              {card.example && (
                <p className="text-sm text-muted-foreground italic mt-4">
                  &ldquo;{card.example}&rdquo;
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {isFlipped && (
          <>
            <Button
              variant="outline"
              className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50"
              onClick={handleStillLearning}
            >
              Still Learning
            </Button>
            <Button className="flex-1" variant="outline" onClick={handleKnow}>
              Know It
            </Button>
          </>
        )}

        {!isFlipped && (
          <Button
            variant="outline"
            className="flex-1"
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
            <Button variant="outline" onClick={restart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart
            </Button>
            <Button onClick={() => onComplete(known.size, cards.length)}>
              Done
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
