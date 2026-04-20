"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  vocabularyEstimateSchema,
  type ProgressInsights,
} from "@/lib/progress/contracts";

interface VocabularyEstimate {
  low: number;
  high: number;
  rationale: string;
}

type ProgressInsightsResponse = ProgressInsights;

function formatEstimateRange(estimate: VocabularyEstimate) {
  return `${estimate.low.toLocaleString()}-${estimate.high.toLocaleString()}`;
}

export function StudentProgressInsights({
  hasData,
  initialInsights = null,
  sourceLabel,
  isTutorVersion = false,
}: {
  hasData: boolean;
  initialInsights?: ProgressInsightsResponse | null;
  sourceLabel?: string | null;
  isTutorVersion?: boolean;
}) {
  const [insights, setInsights] = useState<ProgressInsightsResponse | null>(
    initialInsights,
  );
  const [error, setError] = useState<string | null>(null);
  const [isRefreshingPassive, setIsRefreshingPassive] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function loadInsights() {
    setError(null);

    const response = await fetch("/api/ai/progress-insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = (await response.json().catch(() => null)) as
      | (ProgressInsightsResponse & { error?: never })
      | { error?: string }
      | null;

    if (!response.ok) {
      throw new Error(
        data && "error" in data
          ? data.error || "Failed to generate insights"
          : "Failed to generate insights",
      );
    }

    setInsights(data as ProgressInsightsResponse);
  }

  function handleGenerate() {
    startTransition(() => {
      void loadInsights().catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to generate insights",
        );
      });
    });
  }

  async function handleRefreshPassiveVocabulary() {
    if (!hasData || !insights || isTutorVersion) {
      return;
    }

    setError(null);
    setIsRefreshingPassive(true);

    try {
      const response = await fetch("/api/ai/progress-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "passive-vocabulary",
          estimatedBand: insights.estimatedBand,
          activeVocabulary: insights.activeVocabulary,
          currentInsights: insights,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { passiveVocabulary?: ProgressInsightsResponse["passiveVocabulary"] }
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && "error" in data
            ? data.error || "Failed to refresh passive vocabulary"
            : "Failed to refresh passive vocabulary",
        );
      }

      const nextPassiveVocabulary = vocabularyEstimateSchema.parse(
        data && "passiveVocabulary" in data ? data.passiveVocabulary : data,
      );

      setInsights((currentInsights) =>
        currentInsights
          ? {
              ...currentInsights,
              passiveVocabulary: nextPassiveVocabulary,
            }
          : currentInsights,
      );
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to refresh passive vocabulary",
      );
    } finally {
      setIsRefreshingPassive(false);
    }
  }

  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-accent/20">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">AI Estimate & Suggestions</CardTitle>
            <CardDescription>
              Generate an approximate passive and active vocabulary estimate, an
              overall study band, and a personalized plan for what to learn
              next.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={
                  !hasData || isPending || isRefreshingPassive || isTutorVersion
                }
                className="w-full sm:w-auto"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {insights ? "Refresh Suggestions" : "Generate Suggestions"}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleRefreshPassiveVocabulary}
                disabled={
                  !hasData ||
                  !insights ||
                  isPending ||
                  isRefreshingPassive ||
                  isTutorVersion
                }
                className="w-full sm:w-auto"
              >
                {isRefreshingPassive ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Passive Vocabulary
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground sm:max-w-sm sm:text-right">
              Passive-only refresh uses the latest passive evidence imports
              only. It updates just the passive estimate and leaves the rest of
              the current AI plan unchanged.
            </p>
          </div>
        </div>

        {isTutorVersion && sourceLabel && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">Tutor Version</Badge>
            <span>
              Shown from {sourceLabel}. Student-side regeneration is disabled
              while a tutor version is active.
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasData && (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            Add some vocabulary or complete a few activities first. The AI plan
            becomes more useful once there is real progress data to interpret.
          </div>
        )}

        {hasData && !insights && !isPending && (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
            This runs only when asked, so your progress page stays fast and the
            AI estimate is based on your latest words, streak, scores, and
            grammar-topic coverage.
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {insights && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.06 },
              },
            }}
            className="space-y-4"
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0 },
              }}
              className="grid gap-3 md:grid-cols-3"
            >
              <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Estimated Band
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-3xl font-semibold">
                    {insights.estimatedBand}
                  </p>
                  <Badge variant="outline">Approximate</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Use this as a coaching signal, not an official CEFR result.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Passive Vocabulary
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatEstimateRange(insights.passiveVocabulary)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {insights.passiveVocabulary.rationale}
                </p>
              </div>

              <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Active Vocabulary
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatEstimateRange(insights.activeVocabulary)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {insights.activeVocabulary.rationale}
                </p>
              </div>
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0 },
              }}
              className="rounded-2xl border bg-background/80 p-4 shadow-sm"
            >
              <p className="text-sm leading-relaxed text-foreground/90">
                {insights.summary}
              </p>
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0 },
              }}
              className="grid gap-4 lg:grid-cols-2"
            >
              <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                <p className="text-sm font-semibold">Strengths</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {insights.strengths.map((item) => (
                    <li key={item} className="rounded-lg bg-muted/50 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                <p className="text-sm font-semibold">Focus Areas</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {insights.focusAreas.map((item) => (
                    <li key={item} className="rounded-lg bg-muted/50 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {insights.grammarPlan.length > 0 && (
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="rounded-2xl border bg-background/80 p-4 shadow-sm"
              >
                <p className="text-sm font-semibold">Grammar Plan</p>
                <div className="mt-3 space-y-3">
                  {insights.grammarPlan.map((item) => (
                    <div
                      key={item.topic}
                      className="rounded-xl bg-muted/50 p-3"
                    >
                      <p className="text-sm font-medium">{item.topic}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
