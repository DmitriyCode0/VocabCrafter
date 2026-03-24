"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import {
  getPrimaryGrammarTopic,
  removeSuggestedAnswerLines,
  stripMarkdownEmphasis,
} from "@/lib/utils";
import type { TranslationQuestion, QuizConfig } from "@/types/quiz";
import {
  getLearningLanguageLabel,
  getSourceLanguageLabel,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
} from "@/lib/languages";
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";

interface TranslationPlayerProps {
  questions: TranslationQuestion[];
  cefrLevel?: string;
  quizConfig?: QuizConfig;
  canPreviewQuestions?: boolean;
  onComplete: (results: TranslationResult[]) => void;
}

export interface TranslationResult {
  questionId: number;
  ukrainianSentence: string;
  userTranslation: string;
  referenceTranslation: string;
  score: number;
  feedback: string;
}

export function TranslationPlayer({
  questions,
  cefrLevel,
  quizConfig,
  canPreviewQuestions = false,
  onComplete,
}: TranslationPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userTranslation, setUserTranslation] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showLearningNote, setShowLearningNote] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    score: number;
    feedback: string;
  } | null>(null);
  const [results, setResults] = useState<TranslationResult[]>([]);

  const question = questions[currentIndex];
  const grammarTopic = getPrimaryGrammarTopic(quizConfig);
  const targetLanguageLabel = getLearningLanguageLabel(
    normalizeLearningLanguage(quizConfig?.targetLanguage),
  );
  const sourceLanguageLabel = getSourceLanguageLabel(
    normalizeSourceLanguage(quizConfig?.sourceLanguage),
  );
  const visibleFeedback = evaluation
    ? removeSuggestedAnswerLines(evaluation.feedback)
    : "";
  const canUsePreviewArrows =
    canPreviewQuestions && results.length === 0 && !evaluation && !isEvaluating;
  const progress =
    ((currentIndex + (evaluation ? 1 : 0)) / questions.length) * 100;
  const displayedGrammarTopic = question.validatedGrammarTopic ?? grammarTopic;

  /** Bold the target vocabulary word in the source sentence */
  function renderHighlightedSentence(
    sentence: string,
    highlight?: string,
  ): React.ReactNode {
    const cleanSentence = stripMarkdownEmphasis(sentence);

    if (!highlight) return cleanSentence;

    const idx = cleanSentence.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx === -1) return cleanSentence;

    const before = cleanSentence.slice(0, idx);
    const match = cleanSentence.slice(idx, idx + highlight.length);
    const after = cleanSentence.slice(idx + highlight.length);

    return (
      <>
        {before}
        <span className="font-bold text-primary underline decoration-primary/40 decoration-2 underline-offset-2">
          {match}
        </span>
        {after}
      </>
    );
  }

  async function handleSubmit() {
    if (!userTranslation.trim()) return;

    setIsEvaluating(true);

    try {
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userTranslation: userTranslation.trim(),
          referenceTranslation: question.englishReference,
          targetTerm: question.sourceTerm,
          validatedGrammarTopic: question.validatedGrammarTopic,
          grammarValidationReason: question.grammarValidationReason,
          cefrLevel: cefrLevel ?? "B1",
          config: quizConfig,
        }),
      });

      if (!res.ok) {
        const errorPayload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(errorPayload?.error || "Evaluation failed");
      }

      const data = await res.json();
      setEvaluation(data);

      const result: TranslationResult = {
        questionId: question.id,
        ukrainianSentence: stripMarkdownEmphasis(question.ukrainianSentence),
        userTranslation: userTranslation.trim(),
        referenceTranslation: question.englishReference,
        score: data.score,
        feedback: data.feedback,
      };

      setResults([...results, result]);
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

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserTranslation("");
      setEvaluation(null);
      setShowLearningNote(false);
    } else {
      onComplete(results);
    }
  }

  function handleRetry() {
    setEvaluation(null);
    setShowLearningNote(false);
  }

  function handlePreviewNavigation(nextIndex: number) {
    setCurrentIndex(nextIndex);
    setUserTranslation("");
    setEvaluation(null);
    setShowLearningNote(false);
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-orange-600";
    return "text-red-600";
  }

  const avgScore =
    results.length > 0
      ? Math.round(
          results.reduce((sum, r) => sum + r.score, 0) / results.length,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Sentence {currentIndex + 1} of {questions.length}
          </span>
          <div className="flex items-center gap-2">
            {canUsePreviewArrows && questions.length > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePreviewNavigation(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  aria-label="Previous sentence"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePreviewNavigation(currentIndex + 1)}
                  disabled={currentIndex === questions.length - 1}
                  aria-label="Next sentence"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            {results.length > 0 && (
              <Badge variant="outline">Avg Score: {avgScore}/100</Badge>
            )}
          </div>
        </div>
        <Progress value={progress} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">
              Translate to {targetLanguageLabel}
            </CardTitle>
            <BrowserTtsButton
              text={stripMarkdownEmphasis(question.ukrainianSentence)}
              language={quizConfig?.sourceLanguage}
              label="Listen"
            />
          </div>

          {grammarTopic && (
            <div>
              <Badge
                variant="outline"
                className="mt-2 h-auto w-fit max-w-full whitespace-normal break-words border-amber-300 bg-amber-50 text-left leading-tight text-amber-900"
              >
                Grammar Focus: {grammarTopic}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-md bg-muted">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {sourceLanguageLabel}
            </p>
            <p className="text-lg font-medium">
              {renderHighlightedSentence(
                question.ukrainianSentence,
                question.highlightText,
              )}
            </p>
          </div>

          <Textarea
            value={userTranslation}
            onChange={(e) => setUserTranslation(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !evaluation &&
                !isEvaluating &&
                userTranslation.trim()
              ) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={`Type your ${targetLanguageLabel} translation... (Enter to submit, Shift+Enter for new line)`}
            rows={3}
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
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
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
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <span className="font-medium">Score</span>
                <span
                  className={`text-2xl font-bold ${getScoreColor(evaluation.score)}`}
                >
                  {evaluation.score}/100
                </span>
              </div>

              <div className="p-3 rounded-md bg-muted space-y-1">
                <p className="text-sm font-medium">Feedback:</p>
                <div className="text-sm space-y-0.5">
                  {visibleFeedback.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    const isPass = trimmed.startsWith("✓");
                    const isFail = trimmed.startsWith("✗");
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
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-md bg-muted space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Reference translation ({targetLanguageLabel}):
                    </p>
                    <p className="text-sm italic">
                      {question.englishReference}
                    </p>
                  </div>
                  <BrowserTtsButton
                    text={question.englishReference}
                    language={quizConfig?.targetLanguage}
                    label="Listen"
                    className="shrink-0"
                  />
                </div>

                <div className="border-t border-border/60 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => setShowLearningNote((current) => !current)}
                  >
                    {showLearningNote
                      ? "Hide learning note"
                      : "Reveal learning note"}
                  </Button>

                  {showLearningNote && (
                    <div className="mt-2 rounded-md bg-background/70 p-3 text-sm text-muted-foreground space-y-2">
                      <p>
                        <span className="font-medium text-foreground">
                          Small translation:
                        </span>{" "}
                        {question.englishReference}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">
                          Target vocab:
                        </span>{" "}
                        {question.sourceTerm}
                      </p>
                      {displayedGrammarTopic && (
                        <p>
                          <span className="font-medium text-foreground">
                            Grammar:
                          </span>{" "}
                          {displayedGrammarTopic}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={handleNext} className="w-full">
                {currentIndex < questions.length - 1 ? (
                  <>
                    Next Sentence
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  "View Results"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
