"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { StudentSkillRadar } from "@/components/progress/student-skill-radar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  applyTutorAxisOverrides,
  buildChartDataFromAxes,
  EMPTY_TUTOR_PROGRESS_OVERRIDE,
  progressInsightsSchema,
  type ProgressInsights,
  type TutorProgressOverride,
} from "@/lib/progress/contracts";
import type { StudentProgressAxis } from "@/lib/progress/profile-metrics";

const ESTIMATED_BANDS = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

interface InsightDraft {
  estimatedBand: ProgressInsights["estimatedBand"];
  summary: string;
  passiveLow: string;
  passiveHigh: string;
  passiveRationale: string;
  activeLow: string;
  activeHigh: string;
  activeRationale: string;
  strengths: string;
  focusAreas: string;
  grammarPlan: string;
  vocabularyThemes: string;
  nextActions: string;
}

const EMPTY_INSIGHT_DRAFT: InsightDraft = {
  estimatedBand: "A1",
  summary: "",
  passiveLow: "",
  passiveHigh: "",
  passiveRationale: "",
  activeLow: "",
  activeHigh: "",
  activeRationale: "",
  strengths: "",
  focusAreas: "",
  grammarPlan: "",
  vocabularyThemes: "",
  nextActions: "",
};

function formatEstimateRange(low: number, high: number) {
  return `${low.toLocaleString()}-${high.toLocaleString()}`;
}

function formatStringList(values: string[]) {
  return values.join("\n");
}

function parseStringList(text: string, max: number) {
  return text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function formatGrammarPlan(insights: ProgressInsights["grammarPlan"]) {
  return insights.map((item) => `${item.topic} :: ${item.reason}`).join("\n");
}

function parseGrammarPlan(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [topic, ...reasonParts] = line.split("::");
      return {
        topic: topic?.trim() ?? "",
        reason: reasonParts.join("::").trim(),
      };
    })
    .filter((item) => item.topic && item.reason)
    .slice(0, 6);
}

function formatVocabularyThemes(
  insights: ProgressInsights["vocabularyThemes"],
) {
  return insights
    .map(
      (item) =>
        `${item.theme} :: ${item.reason} :: ${item.exampleWords.join(", ")}`,
    )
    .join("\n");
}

function parseVocabularyThemes(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [theme, reason, examples] = line
        .split("::")
        .map((item) => item.trim());
      return {
        theme,
        reason,
        exampleWords: examples
          ? examples
              .split(",")
              .map((word) => word.trim())
              .filter(Boolean)
              .slice(0, 5)
          : [],
      };
    })
    .filter((item) => item.theme && item.reason)
    .slice(0, 6);
}

function createDraftFromInsights(insights: ProgressInsights): InsightDraft {
  return {
    estimatedBand: insights.estimatedBand,
    summary: insights.summary,
    passiveLow: String(insights.passiveVocabulary.low),
    passiveHigh: String(insights.passiveVocabulary.high),
    passiveRationale: insights.passiveVocabulary.rationale,
    activeLow: String(insights.activeVocabulary.low),
    activeHigh: String(insights.activeVocabulary.high),
    activeRationale: insights.activeVocabulary.rationale,
    strengths: formatStringList(insights.strengths),
    focusAreas: formatStringList(insights.focusAreas),
    grammarPlan: formatGrammarPlan(insights.grammarPlan),
    vocabularyThemes: formatVocabularyThemes(insights.vocabularyThemes),
    nextActions: formatStringList(insights.nextActions),
  };
}

function hasInsightDraftContent(draft: InsightDraft) {
  return [
    draft.summary,
    draft.passiveLow,
    draft.passiveHigh,
    draft.passiveRationale,
    draft.activeLow,
    draft.activeHigh,
    draft.activeRationale,
    draft.strengths,
    draft.focusAreas,
    draft.grammarPlan,
    draft.vocabularyThemes,
    draft.nextActions,
  ].some((value) => value.trim().length > 0);
}

function buildInsightsFromDraft(draft: InsightDraft): ProgressInsights | null {
  if (!hasInsightDraftContent(draft)) {
    return null;
  }

  return progressInsightsSchema.parse({
    estimatedBand: draft.estimatedBand,
    summary: draft.summary.trim(),
    passiveVocabulary: {
      low: Number(draft.passiveLow),
      high: Number(draft.passiveHigh),
      rationale: draft.passiveRationale.trim(),
    },
    activeVocabulary: {
      low: Number(draft.activeLow),
      high: Number(draft.activeHigh),
      rationale: draft.activeRationale.trim(),
    },
    strengths: parseStringList(draft.strengths, 5),
    focusAreas: parseStringList(draft.focusAreas, 5),
    grammarPlan: parseGrammarPlan(draft.grammarPlan),
    vocabularyThemes: parseVocabularyThemes(draft.vocabularyThemes),
    nextActions: parseStringList(draft.nextActions, 6),
  });
}

function getValidationMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return (
      issue?.message || "Please fix the tutor coaching fields before saving."
    );
  }

  return error instanceof Error
    ? error.message
    : "Please fix the tutor coaching fields before saving.";
}

function TutorInsightsPreview({
  insights,
}: {
  insights: ProgressInsights | null;
}) {
  if (!insights) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
        No tutor coaching override yet. Generate suggestions for this student,
        edit them, and save the version you want to keep.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Estimated Band
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-3xl font-semibold">{insights.estimatedBand}</p>
            <Badge variant="outline">Tutor View</Badge>
          </div>
        </div>

        <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Passive Vocabulary
          </p>
          <p className="mt-2 text-3xl font-semibold">
            {formatEstimateRange(
              insights.passiveVocabulary.low,
              insights.passiveVocabulary.high,
            )}
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
            {formatEstimateRange(
              insights.activeVocabulary.low,
              insights.activeVocabulary.high,
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {insights.activeVocabulary.rationale}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
        <p className="text-sm leading-relaxed text-foreground/90">
          {insights.summary}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
          <p className="text-sm font-semibold">Grammar Plan</p>
          <div className="mt-3 space-y-3">
            {insights.grammarPlan.map((item) => (
              <div key={item.topic} className="rounded-xl bg-muted/50 p-3">
                <p className="text-sm font-medium">{item.topic}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.reason}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
          <p className="text-sm font-semibold">Vocabulary Themes</p>
          <div className="mt-3 space-y-3">
            {insights.vocabularyThemes.map((item) => (
              <div key={item.theme} className="rounded-xl bg-muted/50 p-3">
                <p className="text-sm font-medium">{item.theme}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.reason}
                </p>
                {item.exampleWords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.exampleWords.map((word) => (
                      <Badge key={word} variant="secondary">
                        {word}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
        <p className="text-sm font-semibold">Next Actions</p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {insights.nextActions.map((item) => (
            <li key={item} className="rounded-lg bg-muted/50 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface TutorStudentProgressWorkspaceProps {
  studentId: string;
  studentName: string;
  baseAxes: StudentProgressAxis[];
  cefrLevel: string;
  grammarNotice: string;
  hasData: boolean;
  initialOverride?: TutorProgressOverride;
}

export function TutorStudentProgressWorkspace({
  studentId,
  studentName,
  baseAxes,
  cefrLevel,
  grammarNotice,
  hasData,
  initialOverride = EMPTY_TUTOR_PROGRESS_OVERRIDE,
}: TutorStudentProgressWorkspaceProps) {
  const router = useRouter();
  const [axes, setAxes] = useState(() =>
    applyTutorAxisOverrides(baseAxes, initialOverride.axisOverrides),
  );
  const [draft, setDraft] = useState<InsightDraft>(() =>
    initialOverride.insightsOverride
      ? createDraftFromInsights(initialOverride.insightsOverride)
      : EMPTY_INSIGHT_DRAFT,
  );
  const [lastValidInsights, setLastValidInsights] =
    useState<ProgressInsights | null>(initialOverride.insightsOverride);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const chartData = useMemo(() => buildChartDataFromAxes(axes), [axes]);
  const previewInsights = useMemo(() => {
    try {
      return buildInsightsFromDraft(draft);
    } catch {
      return lastValidInsights;
    }
  }, [draft, lastValidInsights]);

  function updateAxis(
    key: StudentProgressAxis["key"],
    field: "score" | "value" | "helper",
    value: string,
  ) {
    setAxes((currentAxes) =>
      currentAxes.map((axis) => {
        if (axis.key !== key) {
          return axis;
        }

        if (field === "score") {
          const nextScore = Math.max(
            0,
            Math.min(100, Math.round(Number(value) || 0)),
          );
          return { ...axis, score: nextScore };
        }

        return {
          ...axis,
          [field]: value,
        };
      }),
    );
  }

  async function handleGenerateInsights() {
    if (!hasData) {
      toast.error(
        "This student needs some real progress data before AI suggestions can be generated.",
      );
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/progress-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });

      const data = (await response.json().catch(() => null)) as
        | (ProgressInsights & { error?: never })
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && "error" in data
            ? data.error || "Failed to generate student insights"
            : "Failed to generate student insights",
        );
      }

      const nextInsights = progressInsightsSchema.parse(data);
      setDraft(createDraftFromInsights(nextInsights));
      setLastValidInsights(nextInsights);
      const saveResponse = await fetch(
        `/api/tutor/students/${studentId}/progress`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            axisOverrides: axes.map((axis) => ({
              key: axis.key,
              score: axis.score,
              value: axis.value,
              helper: axis.helper,
            })),
            insightsOverride: nextInsights,
          }),
        },
      );

      if (!saveResponse.ok) {
        const saveData = (await saveResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          saveData?.error || "Failed to save generated student suggestions",
        );
      }

      toast.success(`Generated fresh coaching suggestions for ${studentName}.`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate student insights",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveOverrides() {
    setIsSaving(true);

    try {
      const insightsOverride = buildInsightsFromDraft(draft);
      const response = await fetch(
        `/api/tutor/students/${studentId}/progress`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            axisOverrides: axes.map((axis) => ({
              key: axis.key,
              score: axis.score,
              value: axis.value,
              helper: axis.helper,
            })),
            insightsOverride,
          }),
        },
      );

      const data = (await response.json().catch(() => null)) as
        | TutorProgressOverride
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && "error" in data
            ? data.error || "Failed to save tutor progress overrides"
            : "Failed to save tutor progress overrides",
        );
      }

      const savedOverride = data as TutorProgressOverride;
      setAxes(applyTutorAxisOverrides(baseAxes, savedOverride.axisOverrides));
      setLastValidInsights(savedOverride.insightsOverride);
      setDraft(
        savedOverride.insightsOverride
          ? createDraftFromInsights(savedOverride.insightsOverride)
          : EMPTY_INSIGHT_DRAFT,
      );
      toast.success("Tutor progress customizations saved.");
      router.refresh();
    } catch (error) {
      toast.error(getValidationMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetOverrides() {
    setIsResetting(true);

    try {
      const response = await fetch(
        `/api/tutor/students/${studentId}/progress`,
        {
          method: "DELETE",
        },
      );

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to reset tutor progress overrides",
        );
      }

      setAxes(baseAxes);
      setDraft(EMPTY_INSIGHT_DRAFT);
      setLastValidInsights(null);
      toast.success(
        "Tutor overrides cleared. The page is back to computed values.",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to reset tutor progress overrides",
      );
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <StudentSkillRadar
          axes={axes}
          chartData={chartData}
          cefrLevel={cefrLevel}
          grammarNotice={grammarNotice}
        />

        <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-accent/20">
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3">
              <div className="space-y-2">
                <CardTitle className="text-xl">Tutor Coaching Layer</CardTitle>
                <CardDescription>
                  Generate and curate the coaching view for {studentName}. These
                  edits sit on top of the raw computed profile and do not change
                  the student&apos;s recorded attempts, streak, or vocabulary
                  history.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleGenerateInsights}
                  disabled={isGenerating || !hasData}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Student Suggestions
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveOverrides}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Tutor Version
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetOverrides}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset Overrides
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {!hasData && !previewInsights && (
              <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
                This student does not have enough recorded progress yet. You can
                still shape the radar metrics manually, but AI suggestions need
                real quiz or vocabulary data first.
              </div>
            )}

            <TutorInsightsPreview insights={previewInsights} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit Radar Metrics</CardTitle>
            <CardDescription>
              Adjust the five radar axes for your tutor-facing interpretation.
              These saved tutor edits sit on top of the computed student data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {axes.map((axis) => (
              <div
                key={axis.key}
                className="rounded-2xl border bg-muted/20 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{axis.label}</p>
                    {axis.beta && <Badge variant="secondary">Beta</Badge>}
                  </div>
                  <Badge variant="outline">{axis.score}/100</Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Score
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={axis.score}
                      onChange={(event) =>
                        updateAxis(axis.key, "score", event.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Value line
                    </label>
                    <Input
                      value={axis.value}
                      onChange={(event) =>
                        updateAxis(axis.key, "value", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Helper text
                  </label>
                  <Textarea
                    value={axis.helper}
                    onChange={(event) =>
                      updateAxis(axis.key, "helper", event.target.value)
                    }
                    className="min-h-20"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit AI Coaching</CardTitle>
            <CardDescription>
              Generate a draft, then rewrite it into the coaching version you
              want to keep for this student.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Estimated band
                </label>
                <Select
                  value={draft.estimatedBand}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      estimatedBand: value as InsightDraft["estimatedBand"],
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTIMATED_BANDS.map((band) => (
                      <SelectItem key={band} value={band}>
                        {band}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Summary
                </label>
                <Textarea
                  value={draft.summary}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  className="min-h-24"
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-sm font-semibold">Passive Vocabulary</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Low
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={draft.passiveLow}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          passiveLow: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      High
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={draft.passiveHigh}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          passiveHigh: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Rationale
                  </label>
                  <Textarea
                    value={draft.passiveRationale}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        passiveRationale: event.target.value,
                      }))
                    }
                    className="min-h-20"
                  />
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-sm font-semibold">Active Vocabulary</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Low
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={draft.activeLow}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          activeLow: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      High
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={draft.activeHigh}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          activeHigh: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Rationale
                  </label>
                  <Textarea
                    value={draft.activeRationale}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        activeRationale: event.target.value,
                      }))
                    }
                    className="min-h-20"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Strengths
                </label>
                <Textarea
                  value={draft.strengths}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      strengths: event.target.value,
                    }))
                  }
                  className="min-h-28"
                />
                <p className="text-xs text-muted-foreground">
                  One item per line, up to 5.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Focus Areas
                </label>
                <Textarea
                  value={draft.focusAreas}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      focusAreas: event.target.value,
                    }))
                  }
                  className="min-h-28"
                />
                <p className="text-xs text-muted-foreground">
                  One item per line, up to 5.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Grammar Plan
              </label>
              <Textarea
                value={draft.grammarPlan}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    grammarPlan: event.target.value,
                  }))
                }
                className="min-h-28"
              />
              <p className="text-xs text-muted-foreground">
                Use one line per item in the format topic :: reason.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Vocabulary Themes
              </label>
              <Textarea
                value={draft.vocabularyThemes}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    vocabularyThemes: event.target.value,
                  }))
                }
                className="min-h-28"
              />
              <p className="text-xs text-muted-foreground">
                Use one line per item in the format theme :: reason :: word 1,
                word 2.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Next Actions
              </label>
              <Textarea
                value={draft.nextActions}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    nextActions: event.target.value,
                  }))
                }
                className="min-h-24"
              />
              <p className="text-xs text-muted-foreground">
                One item per line, up to 6.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
