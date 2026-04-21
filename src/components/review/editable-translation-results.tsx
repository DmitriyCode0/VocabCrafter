"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { removeSuggestedAnswerLines, stripMarkdownEmphasis } from "@/lib/utils";
import { useAppI18n } from "@/components/providers/app-language-provider";

interface EditableTranslationResult {
  ukrainianSentence?: string;
  userTranslation?: string;
  referenceTranslation?: string;
  score?: number;
  feedback?: string;
}

export interface TranslationScoreSaveResult {
  questionIndex: number;
  score: number;
  overallScore: number;
  maxScore: number;
}

interface EditableTranslationResultsProps {
  attemptId: string;
  results: EditableTranslationResult[];
  onScoreSaved?: (result: TranslationScoreSaveResult) => void;
}

function FeedbackChecklist({ feedback }: { feedback: string }) {
  const lines = removeSuggestedAnswerLines(feedback)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const isPass = line.startsWith("✓");
        const isFail = line.startsWith("✗");

        return (
          <div
            key={`${line}-${index}`}
            className={cn(
              "rounded-md border px-3 py-2 text-xs leading-relaxed",
              isPass &&
                "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
              isFail &&
                "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
              !isPass &&
                !isFail &&
                "border-border bg-background text-muted-foreground",
            )}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

function TranslationSection({
  label,
  content,
  tone,
}: {
  label: string;
  content: React.ReactNode;
  tone: "question" | "student" | "reference" | "feedback";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        tone === "question" &&
          "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40",
        tone === "student" &&
          "border-cyan-200 bg-cyan-50 dark:border-cyan-900/60 dark:bg-cyan-950/30",
        tone === "reference" &&
          "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30",
        tone === "feedback" &&
          "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30",
      )}
    >
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm leading-relaxed text-foreground">{content}</div>
    </div>
  );
}

export function EditableTranslationResults({
  attemptId,
  results,
  onScoreSaved,
}: EditableTranslationResultsProps) {
  const { messages } = useAppI18n();
  const router = useRouter();
  const [scores, setScores] = useState(
    results.map((result) => String(result.score ?? 0)),
  );
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const overallScore = useMemo(() => {
    if (scores.length === 0) {
      return 0;
    }

    const total = scores.reduce(
      (sum, score) => sum + Math.min(100, Math.max(0, Number(score) || 0)),
      0,
    );

    return Math.round(total / scores.length);
  }, [scores]);

  async function handleSave(index: number) {
    setSavingIndex(index);

    try {
      const response = await fetch(`/api/review/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIndex: index,
          score: Number(scores[index]),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          data?.error || messages.reviewDetail.translationResults.updateFailed,
        );
      }

      const data = (await response.json()) as {
        overallScore: number;
        maxScore: number;
        result?: { score?: number };
      };

      const savedScore =
        typeof data.result?.score === "number"
          ? data.result.score
          : Math.min(100, Math.max(0, Number(scores[index]) || 0));

      setScores((currentScores) => {
        const nextScores = [...currentScores];
        nextScores[index] = String(savedScore);
        return nextScores;
      });

      onScoreSaved?.({
        questionIndex: index,
        score: savedScore,
        overallScore: data.overallScore,
        maxScore: data.maxScore,
      });

      toast.success(messages.reviewDetail.translationResults.updateSuccess);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : messages.reviewDetail.translationResults.updateFailed,
      );
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">
          {messages.reviewDetail.translationResults.title}
        </h3>
        <Badge variant="outline">
          {messages.reviewDetail.translationResults.currentOverall(overallScore)}
        </Badge>
      </div>

      {results.map((result, index) => {
        const score = Number(scores[index]) || 0;

        return (
          <div
            key={index}
            className="overflow-hidden rounded-xl border bg-background shadow-sm"
          >
            <div className="flex flex-col gap-3 border-b bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  Q{index + 1}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {messages.reviewDetail.translationResults.itemLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={scores[index]}
                  onChange={(event) => {
                    const nextScores = [...scores];
                    nextScores[index] = event.target.value;
                    setScores(nextScores);
                  }}
                  className="w-24 bg-background"
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(index)}
                  disabled={savingIndex === index || score < 0 || score > 100}
                >
                  {savingIndex === index
                    ? messages.reviewDetail.translationResults.saving
                    : messages.reviewDetail.translationResults.save}
                </Button>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    score >= 80 && "border-emerald-300 text-emerald-700",
                    score >= 50 &&
                      score < 80 &&
                      "border-amber-300 text-amber-700",
                    score < 50 && "border-rose-300 text-rose-700",
                  )}
                >
                  {score}/100
                </Badge>
              </div>
            </div>

            <div className="space-y-3 p-4">
              {result.ukrainianSentence && (
                <TranslationSection
                  label={messages.reviewDetail.translationResults.question}
                  tone="question"
                  content={stripMarkdownEmphasis(result.ukrainianSentence)}
                />
              )}

              {result.userTranslation && (
                <TranslationSection
                  label={messages.reviewDetail.translationResults.studentResponse}
                  tone="student"
                  content={<em>{result.userTranslation}</em>}
                />
              )}

              {result.referenceTranslation && (
                <TranslationSection
                  label={messages.reviewDetail.translationResults.referenceAnswer}
                  tone="reference"
                  content={<em>{result.referenceTranslation}</em>}
                />
              )}

              {result.feedback && (
                <TranslationSection
                  label={messages.reviewDetail.translationResults.aiFeedback}
                  tone="feedback"
                  content={<FeedbackChecklist feedback={result.feedback} />}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
