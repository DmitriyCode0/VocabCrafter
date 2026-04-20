"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { StudentSkillRadar } from "@/components/progress/student-skill-radar";
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
  vocabularyEstimateSchema,
  type ProgressInsights,
  type TutorProgressOverride,
} from "@/lib/progress/contracts";
import type {
  GrammarTopicMasteryItem,
  StudentProgressAxis,
} from "@/lib/progress/profile-metrics";
import { getTopicsForLevel } from "@/lib/grammar/topics";

const ESTIMATED_BANDS = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

interface GrammarPlanItem {
  topic: string;
  reason: string;
}

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
  grammarPlanItems: GrammarPlanItem[];
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
  grammarPlanItems: [],
};

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
    grammarPlanItems: insights.grammarPlan.map((item) => ({
      topic: item.topic,
      reason: item.reason,
    })),
  };
}

function hasInsightDraftContent(draft: InsightDraft) {
  return (
    [
      draft.summary,
      draft.passiveLow,
      draft.passiveHigh,
      draft.passiveRationale,
      draft.activeLow,
      draft.activeHigh,
      draft.activeRationale,
      draft.strengths,
      draft.focusAreas,
    ].some((value) => value.trim().length > 0) ||
    draft.grammarPlanItems.length > 0
  );
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
    grammarPlan: draft.grammarPlanItems
      .filter((item) => item.topic.trim() && item.reason.trim())
      .slice(0, 6),
    vocabularyThemes: [],
    nextActions: [],
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

function GrammarPlanTopicSelector({
  value,
  onChange,
  availableTopics,
}: {
  value: string;
  onChange: (topic: string) => void;
  availableTopics: Array<{ level: string; topics: string[] }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const query = value.toLowerCase();
    if (!query) return availableTopics;

    return availableTopics
      .map((group) => ({
        level: group.level,
        topics: group.topics.filter((t) => t.toLowerCase().includes(query)),
      }))
      .filter((group) => group.topics.length > 0);
  }, [availableTopics, value]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search or type a grammar topic..."
        className="h-8 text-sm"
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.map((group) => (
            <div key={group.level}>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.level}
              </p>
              {group.topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                  onClick={() => {
                    onChange(topic);
                    setIsOpen(false);
                  }}
                >
                  {topic}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
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
  grammarTopicMastery: GrammarTopicMasteryItem[];
}

export function TutorStudentProgressWorkspace({
  studentId,
  studentName,
  baseAxes,
  cefrLevel,
  grammarNotice,
  hasData,
  initialOverride = EMPTY_TUTOR_PROGRESS_OVERRIDE,
  grammarTopicMastery: initialGrammarTopics,
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
  const [grammarTopics, setGrammarTopics] =
    useState<GrammarTopicMasteryItem[]>(initialGrammarTopics);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingPassive, setIsRegeneratingPassive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const savedAxesRef = useRef(
    JSON.stringify(
      applyTutorAxisOverrides(baseAxes, initialOverride.axisOverrides).map(
        (a) => ({
          key: a.key,
          score: a.score,
          value: a.value,
          helper: a.helper,
        }),
      ),
    ),
  );
  const savedDraftRef = useRef(
    JSON.stringify(
      initialOverride.insightsOverride
        ? createDraftFromInsights(initialOverride.insightsOverride)
        : EMPTY_INSIGHT_DRAFT,
    ),
  );

  const chartData = useMemo(() => buildChartDataFromAxes(axes), [axes]);
  const availableGrammarTopics = useMemo(
    () => getTopicsForLevel(cefrLevel),
    [cefrLevel],
  );

  const isDirty = useMemo(() => {
    const currentAxes = JSON.stringify(
      axes.map((a) => ({
        key: a.key,
        score: a.score,
        value: a.value,
        helper: a.helper,
      })),
    );
    const currentDraft = JSON.stringify(draft);

    return (
      currentAxes !== savedAxesRef.current ||
      currentDraft !== savedDraftRef.current
    );
  }, [axes, draft]);

  function updateAxis(
    key: StudentProgressAxis["key"],
    field: "score" | "value" | "helper",
    value: string,
  ) {
    setAxes((currentAxes) =>
      currentAxes.map((axis) => {
        if (axis.key !== key) return axis;

        if (field === "score") {
          const nextScore = Math.max(
            0,
            Math.min(100, Math.round(Number(value) || 0)),
          );
          return { ...axis, score: nextScore };
        }

        return { ...axis, [field]: value };
      }),
    );
  }

  function buildAxisOverridesPayload() {
    return axes.map((axis) => ({
      key: axis.key,
      score: axis.score,
      value: axis.value,
      helper: axis.helper,
    }));
  }

  async function persistTutorOverride(
    insightsOverride: ProgressInsights | null,
  ) {
    const response = await fetch(`/api/tutor/students/${studentId}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        axisOverrides: buildAxisOverridesPayload(),
        insightsOverride,
      }),
    });

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

    return data as TutorProgressOverride;
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
      await persistTutorOverride(nextInsights);

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
      const savedOverride = await persistTutorOverride(insightsOverride);
      const nextAxes = applyTutorAxisOverrides(
        baseAxes,
        savedOverride.axisOverrides,
      );
      setAxes(nextAxes);
      const nextDraft = savedOverride.insightsOverride
        ? createDraftFromInsights(savedOverride.insightsOverride)
        : EMPTY_INSIGHT_DRAFT;
      setDraft(nextDraft);

      savedAxesRef.current = JSON.stringify(
        nextAxes.map((a) => ({
          key: a.key,
          score: a.score,
          value: a.value,
          helper: a.helper,
        })),
      );
      savedDraftRef.current = JSON.stringify(nextDraft);

      toast.success("Tutor progress customizations saved.");
      router.refresh();
    } catch (error) {
      toast.error(getValidationMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRegeneratePassiveVocabulary() {
    if (!hasData) {
      toast.error(
        "This student needs some real progress data before passive vocabulary can be recalculated.",
      );
      return;
    }

    let currentInsights: ProgressInsights | null;

    try {
      currentInsights = buildInsightsFromDraft(draft);
    } catch {
      toast.error(
        "Fix the current tutor coaching fields before recalculating passive vocabulary.",
      );
      return;
    }

    if (!currentInsights) {
      toast.error(
        "Generate student suggestions first, then passive vocabulary can be recalculated on top of them.",
      );
      return;
    }

    setIsRegeneratingPassive(true);

    try {
      const response = await fetch("/api/ai/progress-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          mode: "passive-vocabulary",
          estimatedBand: currentInsights.estimatedBand,
          activeVocabulary: currentInsights.activeVocabulary,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            passiveVocabulary?: ProgressInsights["passiveVocabulary"];
            error?: never;
          }
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && "error" in data
            ? data.error || "Failed to recalculate passive vocabulary"
            : "Failed to recalculate passive vocabulary",
        );
      }

      const nextPassiveVocabulary = vocabularyEstimateSchema.parse(
        data && "passiveVocabulary" in data ? data.passiveVocabulary : data,
      );

      setDraft((currentDraft) => ({
        ...currentDraft,
        passiveLow: String(nextPassiveVocabulary.low),
        passiveHigh: String(nextPassiveVocabulary.high),
        passiveRationale: nextPassiveVocabulary.rationale,
      }));

      const nextInsights = progressInsightsSchema.parse({
        ...currentInsights,
        passiveVocabulary: nextPassiveVocabulary,
      });
      await persistTutorOverride(nextInsights);

      toast.success(`Passive vocabulary refreshed for ${studentName}.`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to recalculate passive vocabulary",
      );
    } finally {
      setIsRegeneratingPassive(false);
    }
  }

  async function handleUpdateFromBase() {
    setIsResetting(true);

    try {
      setAxes(baseAxes);
      setGrammarTopics(initialGrammarTopics);

      savedAxesRef.current = JSON.stringify(
        baseAxes.map((a) => ({
          key: a.key,
          score: a.score,
          value: a.value,
          helper: a.helper,
        })),
      );

      toast.success(
        "Radar metrics reset to system-computed values. Save to persist.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to reset to base values",
      );
    } finally {
      setIsResetting(false);
    }
  }

  async function handleGrammarTopicToggle(
    topicKey: string,
    checked: boolean,
  ) {
    setGrammarTopics((current) =>
      current.map((topic) => {
        if (topic.topicKey !== topicKey) return topic;
        if (topic.source === "system") return topic;

        return {
          ...topic,
          mastered: checked,
          source: checked ? ("tutor" as const) : null,
        };
      }),
    );

    try {
      const response = await fetch(
        `/api/tutor/students/${studentId}/grammar-topics`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicKey, marked: checked }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to toggle grammar topic");
      }

      const updatedTopics = grammarTopics.map((topic) => {
        if (topic.topicKey !== topicKey) return topic;
        if (topic.source === "system") return topic;

        return {
          ...topic,
          mastered: checked,
          source: checked ? ("tutor" as const) : null,
        };
      });
      const masteredCount = updatedTopics.filter((t) => t.mastered).length;
      const grammarScore =
        updatedTopics.length > 0
          ? Math.max(
              0,
              Math.min(
                100,
                Math.round((masteredCount / updatedTopics.length) * 100),
              ),
            )
          : 0;

      setAxes((currentAxes) =>
        currentAxes.map((axis) =>
          axis.key === "grammar_variety"
            ? {
                ...axis,
                score: grammarScore,
                value: `${masteredCount}/${updatedTopics.length} topics mastered`,
              }
            : axis,
        ),
      );
    } catch {
      setGrammarTopics(initialGrammarTopics);
      toast.error("Failed to toggle grammar topic.");
    }
  }

  function updateGrammarPlanItem(
    index: number,
    field: "topic" | "reason",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      grammarPlanItems: current.grammarPlanItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function addGrammarPlanItem() {
    if (draft.grammarPlanItems.length >= 6) return;

    setDraft((current) => ({
      ...current,
      grammarPlanItems: [
        ...current.grammarPlanItems,
        { topic: "", reason: "" },
      ],
    }));
  }

  function removeGrammarPlanItem(index: number) {
    setDraft((current) => ({
      ...current,
      grammarPlanItems: current.grammarPlanItems.filter((_, i) => i !== index),
    }));
  }

  const anyBusy =
    isGenerating || isRegeneratingPassive || isSaving || isResetting;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <StudentSkillRadar
        axes={axes}
        chartData={chartData}
        cefrLevel={cefrLevel}
        grammarNotice={grammarNotice}
        editable
        isDirty={isDirty}
        isSaving={isSaving}
        isResetting={isResetting}
        onAxisChange={updateAxis}
        onSave={handleSaveOverrides}
        onUpdateFromBase={handleUpdateFromBase}
        grammarTopics={grammarTopics}
        onGrammarTopicToggle={handleGrammarTopicToggle}
      />

      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-accent/20">
        <CardHeader className="gap-3">
          <div className="space-y-2">
            <CardTitle className="text-xl">Tutor Coaching Layer</CardTitle>
            <CardDescription>
              Generate and curate the coaching view for {studentName}. These
              edits sit on top of the raw computed profile.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateInsights}
              disabled={anyBusy || !hasData}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Suggestions
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleRegeneratePassiveVocabulary}
              disabled={anyBusy || !hasData}
            >
              {isRegeneratingPassive ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recalculating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regen Passive Vocab
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {!hasData && !hasInsightDraftContent(draft) && (
            <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
              This student does not have enough recorded progress yet. You can
              still shape the radar metrics manually, but AI suggestions need
              real quiz or vocabulary data first.
            </div>
          )}

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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Grammar Plan
              </label>
              {draft.grammarPlanItems.length < 6 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addGrammarPlanItem}
                  className="h-7 text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add topic
                </Button>
              )}
            </div>

            {draft.grammarPlanItems.length === 0 && (
              <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
                No grammar plan items yet. Add one or generate suggestions.
              </div>
            )}

            {draft.grammarPlanItems.map((item, index) => (
              <div
                key={index}
                className="flex gap-2 rounded-xl border bg-muted/20 p-3"
              >
                <div className="flex-1 space-y-2">
                  <GrammarPlanTopicSelector
                    value={item.topic}
                    onChange={(topic) =>
                      updateGrammarPlanItem(index, "topic", topic)
                    }
                    availableTopics={availableGrammarTopics}
                  />
                  <Input
                    value={item.reason}
                    onChange={(e) =>
                      updateGrammarPlanItem(index, "reason", e.target.value)
                    }
                    placeholder="Reason for this topic..."
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGrammarPlanItem(index)}
                  className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
