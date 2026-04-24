"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppI18n } from "@/components/providers/app-language-provider";

interface EditableGapFillResult {
  sentence?: string;
  userAnswer?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
}

export interface GapFillResultSaveResult {
  questionIndex: number;
  isCorrect: boolean;
  overallScore: number;
  maxScore: number;
}

interface EditableGapFillResultsProps {
  attemptId: string;
  results: EditableGapFillResult[];
  onResultSaved?: (result: GapFillResultSaveResult) => void;
}

export function EditableGapFillResults({
  attemptId,
  results,
  onResultSaved,
}: EditableGapFillResultsProps) {
  const { messages } = useAppI18n();
  const router = useRouter();
  const [statuses, setStatuses] = useState(
    results.map((result) => result.isCorrect === true),
  );
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const correctCount = useMemo(
    () => statuses.filter(Boolean).length,
    [statuses],
  );

  async function handleToggle(index: number) {
    const nextIsCorrect = !statuses[index];
    setSavingIndex(index);

    try {
      const response = await fetch(`/api/review/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIndex: index,
          isCorrect: nextIsCorrect,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            overallScore?: number;
            maxScore?: number;
            result?: { isCorrect?: boolean };
            error?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(
          data?.error || messages.reviewDetail.gapFillResults.updateFailed,
        );
      }

      const savedIsCorrect =
        typeof data?.result?.isCorrect === "boolean"
          ? data.result.isCorrect
          : nextIsCorrect;

      setStatuses((currentStatuses) => {
        const nextStatuses = [...currentStatuses];
        nextStatuses[index] = savedIsCorrect;
        return nextStatuses;
      });

      onResultSaved?.({
        questionIndex: index,
        isCorrect: savedIsCorrect,
        overallScore:
          typeof data?.overallScore === "number"
            ? data.overallScore
            : savedIsCorrect
              ? correctCount + 1
              : Math.max(0, correctCount - 1),
        maxScore:
          typeof data?.maxScore === "number" ? data.maxScore : results.length,
      });

      toast.success(messages.reviewDetail.gapFillResults.updateSuccess);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : messages.reviewDetail.gapFillResults.updateFailed,
      );
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">
          {messages.reviewDetail.gapFillResults.title}
        </h3>
        <Badge variant="outline">
          {messages.reviewDetail.gapFillResults.currentOverall(
            correctCount,
            results.length,
          )}
        </Badge>
      </div>

      {results.map((result, index) => {
        const isCorrect = statuses[index];

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
                  {messages.reviewDetail.gapFillResults.itemLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggle(index)}
                  disabled={savingIndex === index}
                >
                  {savingIndex === index
                    ? messages.reviewDetail.gapFillResults.saving
                    : isCorrect
                      ? messages.reviewDetail.gapFillResults.markWrong
                      : messages.reviewDetail.gapFillResults.markCorrect}
                </Button>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    isCorrect
                      ? "border-emerald-300 text-emerald-700"
                      : "border-rose-300 text-rose-700"
                  }`}
                >
                  {isCorrect
                    ? messages.reviewDetail.correctBadge
                    : messages.reviewDetail.wrongBadge}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 p-4 text-sm">
              {result.sentence && (
                <p className="text-muted-foreground">{result.sentence}</p>
              )}

              <p>
                {messages.reviewDetail.answerLabel}: <strong>{result.userAnswer ?? "-"}</strong>
                {!isCorrect && result.correctAnswer && (
                  <span className="ml-2 text-muted-foreground">
                    ({messages.reviewDetail.correctLabel}: <strong>{result.correctAnswer}</strong>)
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}