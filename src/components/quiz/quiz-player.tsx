"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { FlashcardPlayer, type FlashcardResult } from "./flashcard-player";
import { GapFillPlayer, type GapFillResult } from "./gap-fill-player";
import { MCQPlayer, type MCQResult } from "./mcq-player";
import { DiscussionPlayer } from "./discussion-player";
import {
  TranslationPlayer,
  type TranslationResult,
} from "./translation-player";
import {
  TextTranslationPlayer,
  type TextTranslationResult,
} from "./text-translation-player";
import { QuizResults } from "./quiz-results";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RotateCcw, Home, Clock3 } from "lucide-react";
import { saveAttempt } from "@/lib/save-attempt";
import type { Quiz } from "@/types/database";
import type {
  DiscussionPrompt,
  FlashcardItem,
  GapFillQuestion,
  MCQQuestion,
  QuizTerm,
  TextTranslationContent,
  TranslationQuestion,
} from "@/types/quiz";

interface QuizPlayerProps {
  quiz: Quiz;
  isOwner?: boolean;
}

const QUIZ_TIMER_IDLE_TIMEOUT_MS = 60_000;

function normalizeDiscussionPrompts(
  rawPrompts: DiscussionPrompt[],
  vocabularyTerms: QuizTerm[],
) {
  return rawPrompts.map((prompt, index) => {
    const fallbackTerm = vocabularyTerms[index]?.term;
    const sourceTerm = prompt.sourceTerm ?? fallbackTerm;
    const highlightText = prompt.highlightText ?? sourceTerm;

    return {
      ...prompt,
      sourceTerm,
      highlightText,
    } satisfies DiscussionPrompt;
  });
}

function formatElapsedSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((value, index) =>
        index === 0 ? String(value) : String(value).padStart(2, "0"),
      )
      .join(":");
  }

  return [minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function SessionTimer({ elapsedSeconds }: { elapsedSeconds: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-sm shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock3 className="h-4 w-4" />
        <span>Session timer</span>
      </div>
      <span className="font-mono text-base font-semibold text-foreground">
        {formatElapsedSeconds(elapsedSeconds)}
      </span>
    </div>
  );
}

export function QuizPlayer({ quiz, isOwner = false }: QuizPlayerProps) {
  const { messages } = useAppI18n();
  const [showResults, setShowResults] = useState(false);
  const [mcqResults, setMcqResults] = useState<MCQResult[]>([]);
  const [gapFillResults, setGapFillResults] = useState<GapFillResult[]>([]);
  const [translationResults, setTranslationResults] = useState<
    TranslationResult[]
  >([]);
  const [textTranslationResults, setTextTranslationResults] = useState<
    TextTranslationResult[]
  >([]);
  const [discussionPromptCount, setDiscussionPromptCount] = useState(0);
  const [flashcardKnown, setFlashcardKnown] = useState(0);
  const [flashcardTotal, setFlashcardTotal] = useState(0);
  const [completedTimeSpentSeconds, setCompletedTimeSpentSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerSessionKey, setTimerSessionKey] = useState(0);
  const elapsedMsRef = useRef(0);
  const activeStartedAtRef = useRef<number | null>(null);
  const lastActivityAtRef = useRef<number | null>(null);

  const content = quiz.generated_content as Record<string, unknown>;
  const vocabularyTerms = useMemo(
    () => ((quiz.vocabulary_terms ?? []) as unknown as QuizTerm[]),
    [quiz.vocabulary_terms],
  );
  const quizConfig = quiz.config as
    | import("@/types/quiz").QuizConfig
    | null
    | undefined;
  const [discussionPrompts, setDiscussionPrompts] = useState<
    DiscussionPrompt[]
  >(() =>
    quiz.type === "discussion"
      ? normalizeDiscussionPrompts(
          ((content.prompts || []) as DiscussionPrompt[]) ?? [],
          vocabularyTerms,
        )
      : [],
  );

  const flushElapsedMs = useCallback((now = Date.now()) => {
    if (
      activeStartedAtRef.current === null ||
      lastActivityAtRef.current === null
    ) {
      return elapsedMsRef.current;
    }

    const idleCutoff =
      lastActivityAtRef.current + QUIZ_TIMER_IDLE_TIMEOUT_MS;
    const activeUntil = Math.min(now, idleCutoff);

    if (activeUntil > activeStartedAtRef.current) {
      elapsedMsRef.current += activeUntil - activeStartedAtRef.current;
    }

    activeStartedAtRef.current = now < idleCutoff ? now : null;

    return elapsedMsRef.current;
  }, []);

  const syncElapsed = useCallback(
    (now = Date.now()) => {
      const activeMs = flushElapsedMs(now);
      setElapsedSeconds(Math.floor(activeMs / 1000));
      return activeMs;
    },
    [flushElapsedMs],
  );

  useEffect(() => {
    if (showResults) {
      return;
    }

    const resumeTimer = (now = Date.now()) => {
      lastActivityAtRef.current = now;

      if (
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        activeStartedAtRef.current === null
      ) {
        activeStartedAtRef.current = now;
      }
    };

    const handleVisibilityChange = () => {
      const now = Date.now();
      syncElapsed(now);

      if (document.visibilityState === "hidden") {
        activeStartedAtRef.current = null;
      } else {
        resumeTimer(now);
      }
    };

    const handleWindowBlur = () => {
      syncElapsed(Date.now());
      activeStartedAtRef.current = null;
    };

    const handleActivity = () => {
      const now = Date.now();
      syncElapsed(now);
      resumeTimer(now);
    };

    resumeTimer();
    setElapsedSeconds(Math.floor(elapsedMsRef.current / 1000));

    const intervalId = window.setInterval(() => syncElapsed(), 1000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleActivity);
    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("input", handleActivity);
    window.addEventListener("scroll", handleActivity, { passive: true });

    return () => {
      syncElapsed(Date.now());
      activeStartedAtRef.current = null;

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleActivity);
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("input", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.clearInterval(intervalId);
    };
  }, [showResults, syncElapsed, timerSessionKey]);

  const getCompletedElapsedSeconds = useCallback(() => {
    const activeMs = syncElapsed(Date.now());

    return Math.max(1, Math.round(activeMs / 1000));
  }, [syncElapsed]);

  const resetTimer = useCallback(() => {
    elapsedMsRef.current = 0;
    activeStartedAtRef.current = null;
    lastActivityAtRef.current = null;
    setElapsedSeconds(0);
    setTimerSessionKey((current) => current + 1);
  }, []);

  function renderWithTimer(children: React.ReactNode) {
    return (
      <div className="space-y-4">
        <SessionTimer elapsedSeconds={elapsedSeconds} />
        {children}
      </div>
    );
  }

  function handleRestart() {
    setShowResults(false);
    setMcqResults([]);
    setGapFillResults([]);
    setTranslationResults([]);
    setTextTranslationResults([]);
    setDiscussionPromptCount(0);
    setFlashcardKnown(0);
    setFlashcardTotal(0);
    setCompletedTimeSpentSeconds(0);
    resetTimer();
  }

  const handleFlashcardComplete = useCallback(
    (results: FlashcardResult[], known: number, total: number) => {
      const completedElapsedSeconds = getCompletedElapsedSeconds();

      saveAttempt(
        quiz.id,
        {
          type: "flashcards",
          known,
          total,
          results: results.map((r) => ({ term: r.term, known: r.known })),
        },
        known,
        total,
        completedElapsedSeconds,
      );
      setFlashcardKnown(known);
      setFlashcardTotal(total);
      setCompletedTimeSpentSeconds(completedElapsedSeconds);
      setShowResults(true);
    },
    [getCompletedElapsedSeconds, quiz.id],
  );

  if (quiz.type === "mcq") {
    if (showResults) {
      return (
        <QuizResults
          type="mcq"
          quizId={quiz.id}
          timeSpentSeconds={completedTimeSpentSeconds}
          mcqResults={mcqResults}
          onRestart={handleRestart}
        />
      );
    }

    const questions = (content.questions || []) as MCQQuestion[];
    return renderWithTimer(
      <MCQPlayer
        questions={questions}
        onComplete={(results) => {
          setMcqResults(results);
          setCompletedTimeSpentSeconds(getCompletedElapsedSeconds());
          setShowResults(true);
        }}
      />
    );
  }

  if (quiz.type === "flashcards") {
    if (showResults) {
      const percentage =
        flashcardTotal > 0
          ? Math.round((flashcardKnown / flashcardTotal) * 100)
          : 0;
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                {messages.quizSession.flashcardsResult.title}
              </CardTitle>
              <CardDescription>
                {messages.quizSession.flashcardsResult.description(
                  flashcardKnown,
                  flashcardTotal,
                  percentage,
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={percentage} className="h-3" />
              <p className="text-center text-sm text-muted-foreground">
                {percentage >= 80
                  ? messages.quizSession.flashcardsResult.encouragementHigh
                  : percentage >= 50
                    ? messages.quizSession.flashcardsResult
                        .encouragementMedium
                    : messages.quizSession.flashcardsResult.encouragementLow}
              </p>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleRestart}>
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

    const cards = (content.cards || []) as FlashcardItem[];
    return renderWithTimer(
      <FlashcardPlayer
        cards={cards}
        quizConfig={quizConfig ?? undefined}
        onComplete={handleFlashcardComplete}
      />
    );
  }

  if (quiz.type === "gap_fill") {
    if (showResults) {
      return (
        <QuizResults
          type="gap_fill"
          quizId={quiz.id}
          timeSpentSeconds={completedTimeSpentSeconds}
          gapFillResults={gapFillResults}
          onRestart={handleRestart}
        />
      );
    }

    const questions = (content.questions || []) as GapFillQuestion[];
    return renderWithTimer(
      <GapFillPlayer
        questions={questions}
        quizConfig={quizConfig ?? undefined}
        onComplete={(results) => {
          setGapFillResults(results);
          setCompletedTimeSpentSeconds(getCompletedElapsedSeconds());
          setShowResults(true);
        }}
      />
    );
  }

  if (quiz.type === "translation") {
    if (showResults) {
      return (
        <QuizResults
          type="translation"
          quizId={quiz.id}
          timeSpentSeconds={completedTimeSpentSeconds}
          translationResults={translationResults}
          quizConfig={quizConfig ?? undefined}
          onRestart={handleRestart}
        />
      );
    }

    const questions = (content.questions || []) as TranslationQuestion[];
    return renderWithTimer(
      <TranslationPlayer
        questions={questions}
        cefrLevel={quiz.cefr_level}
        quizConfig={quizConfig ?? undefined}
        canPreviewQuestions={isOwner}
        onComplete={(results) => {
          setTranslationResults(results);
          setCompletedTimeSpentSeconds(getCompletedElapsedSeconds());
          setShowResults(true);
        }}
      />
    );
  }

  if (quiz.type === "text_translation") {
    if (showResults) {
      return (
        <QuizResults
          type="text_translation"
          quizId={quiz.id}
          timeSpentSeconds={completedTimeSpentSeconds}
          textTranslationResults={textTranslationResults}
          quizConfig={quizConfig ?? undefined}
          onRestart={handleRestart}
        />
      );
    }

    const textTranslationContent = content.content as TextTranslationContent;

    return renderWithTimer(
      <TextTranslationPlayer
        content={textTranslationContent}
        cefrLevel={quiz.cefr_level}
        quizConfig={quizConfig ?? undefined}
        onComplete={(result) => {
          setTextTranslationResults([result]);
          setCompletedTimeSpentSeconds(getCompletedElapsedSeconds());
          setShowResults(true);
        }}
      />
    );
  }

  if (quiz.type === "discussion") {
    if (showResults) {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                {messages.quizSession.discussionResult.title}
              </CardTitle>
              <CardDescription>
                {messages.quizSession.discussionResult.description(
                  discussionPromptCount,
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleRestart}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {messages.quizSession.discussionResult.reopenPrompts}
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

    return renderWithTimer(
      <DiscussionPlayer
        quizId={quiz.id}
        prompts={discussionPrompts}
        vocabularyTerms={vocabularyTerms}
        quizConfig={quizConfig ?? undefined}
        isOwner={isOwner}
        onPromptsChange={setDiscussionPrompts}
        onComplete={(usedPrompts) => {
          const completedElapsedSeconds = getCompletedElapsedSeconds();

          saveAttempt(
            quiz.id,
            {
              type: "discussion",
              prompts: usedPrompts,
            },
            null,
            null,
            completedElapsedSeconds,
          );
          setDiscussionPromptCount(usedPrompts.length);
          setCompletedTimeSpentSeconds(completedElapsedSeconds);
          setShowResults(true);
        }}
      />
    );
  }

  return (
    <p className="text-muted-foreground">
      {messages.quizSession.unsupportedQuizType(quiz.type)}
    </p>
  );
}
