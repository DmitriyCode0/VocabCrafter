"use client";

import { useState } from "react";
import { ChevronDown, Check, Loader2, RotateCcw, Save } from "lucide-react";
import { motion } from "motion/react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  GrammarTopicMasteryItem,
  StudentProgressAxis,
} from "@/lib/progress/profile-metrics";
import { cn } from "@/lib/utils";

const chartConfig = {
  score: {
    label: "Profile score",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig;

function getScoreTone(score: number) {
  if (score >= 80) {
    return "text-emerald-700 dark:text-emerald-300";
  }

  if (score >= 55) {
    return "text-amber-700 dark:text-amber-300";
  }

  return "text-rose-700 dark:text-rose-300";
}

interface GrammarTopicsDropdownProps {
  topics: GrammarTopicMasteryItem[];
  editable?: boolean;
  onToggle?: (topicKey: string, checked: boolean) => void;
}

function GrammarTopicsDropdown({
  topics,
  editable,
  onToggle,
}: GrammarTopicsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const masteredCount = topics.filter((t) => t.mastered).length;

  // Group topics by level
  const topicsByLevel = new Map<string, GrammarTopicMasteryItem[]>();
  for (const topic of topics) {
    const group = topicsByLevel.get(topic.level) ?? [];
    group.push(topic);
    topicsByLevel.set(topic.level, group);
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            isOpen && "rotate-180",
          )}
        />
        {masteredCount}/{topics.length} topics mastered
      </button>

      {isOpen && (
        <div className="mt-2 max-h-64 space-y-3 overflow-y-auto rounded-lg border bg-background/90 p-3">
          {Array.from(topicsByLevel.entries()).map(([level, levelTopics]) => (
            <div key={level}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {level}
              </p>
              <div className="space-y-1">
                {levelTopics.map((topic) => (
                  <div
                    key={topic.topicKey}
                    className="flex items-center gap-2 rounded-md px-2 py-1"
                  >
                    {editable ? (
                      <Checkbox
                        checked={topic.mastered}
                        onCheckedChange={(checked) =>
                          onToggle?.(topic.topicKey, Boolean(checked))
                        }
                        disabled={topic.source === "system"}
                        className="h-3.5 w-3.5"
                      />
                    ) : (
                      <div className="flex h-3.5 w-3.5 items-center justify-center">
                        {topic.mastered && (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                    )}
                    <span
                      className={cn(
                        "text-xs",
                        topic.mastered
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {topic.label}
                    </span>
                    {topic.source === "system" && topic.mastered && (
                      <Badge
                        variant="outline"
                        className="ml-auto h-4 px-1 text-[9px]"
                      >
                        auto
                      </Badge>
                    )}
                    {topic.source === "tutor" && topic.mastered && (
                      <Badge
                        variant="secondary"
                        className="ml-auto h-4 px-1 text-[9px]"
                      >
                        tutor
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface StudentSkillRadarProps {
  axes: StudentProgressAxis[];
  chartData: Array<{
    axis: string;
    score: number;
    fullMark: number;
  }>;
  cefrLevel: string;
  grammarNotice: string;
  editable?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  isResetting?: boolean;
  onAxisChange?: (
    key: StudentProgressAxis["key"],
    field: "score" | "value" | "helper",
    value: string,
  ) => void;
  onSave?: () => void;
  onUpdateFromBase?: () => void;
  grammarTopics?: GrammarTopicMasteryItem[];
  onGrammarTopicToggle?: (topicKey: string, checked: boolean) => void;
}

export function StudentSkillRadar({
  axes,
  chartData,
  cefrLevel,
  grammarNotice,
  editable,
  isDirty,
  isSaving,
  isResetting,
  onAxisChange,
  onSave,
  onUpdateFromBase,
  grammarTopics,
  onGrammarTopicToggle,
}: StudentSkillRadarProps) {
  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-secondary/20">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">Learning Profile</CardTitle>
            <CardDescription>
              A five-axis view of your current learning experience.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {editable && (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={onSave}
                  disabled={!isDirty || isSaving || isResetting}
                >
                  {isSaving ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onUpdateFromBase}
                  disabled={isSaving || isResetting}
                >
                  {isResetting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Update from Base
                </Button>
              </>
            )}
            <Badge
              variant="outline"
              className="w-fit border-primary/30 bg-primary/5 text-primary"
            >
              {cefrLevel}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative"
        >
          <div className="absolute inset-x-10 top-8 h-40 rounded-full bg-[var(--color-chart-1)]/10 blur-3xl" />
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-[360px] w-full max-w-[420px]"
          >
            <RadarChart data={chartData} outerRadius="68%">
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => (
                      <div className="flex min-w-[11rem] items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {String(item?.payload?.axis ?? "Score")}
                        </span>
                        <span className="font-mono font-semibold text-foreground">
                          {value}/100
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <PolarGrid gridType="polygon" radialLines={false} />
              <PolarAngleAxis
                dataKey="axis"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fontWeight: 600 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                dataKey="score"
                stroke="var(--color-score)"
                fill="var(--color-score)"
                fillOpacity={0.26}
                strokeWidth={2.5}
                isAnimationActive
                animationDuration={850}
                animationEasing="ease-out"
              />
            </RadarChart>
          </ChartContainer>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.06, delayChildren: 0.1 },
            },
          }}
          className="space-y-3"
        >
          {axes.map((axis) => (
            <motion.div
              key={axis.key}
              variants={{
                hidden: { opacity: 0, x: 12 },
                visible: { opacity: 1, x: 0 },
              }}
              className="rounded-2xl border bg-background/80 p-4 shadow-sm backdrop-blur-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{axis.label}</p>
                  {axis.beta && (
                    <Badge
                      variant="secondary"
                      className="text-[11px] uppercase tracking-wide"
                    >
                      Beta
                    </Badge>
                  )}
                </div>
                {editable ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={axis.score}
                      onChange={(event) =>
                        onAxisChange?.(axis.key, "score", event.target.value)
                      }
                      className="h-7 w-16 text-right text-sm font-semibold"
                    />
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                ) : (
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      getScoreTone(axis.score),
                    )}
                  >
                    {axis.score}/100
                  </p>
                )}
              </div>

              {editable ? (
                <div className="mt-2 space-y-2">
                  <Input
                    value={axis.value}
                    onChange={(event) =>
                      onAxisChange?.(axis.key, "value", event.target.value)
                    }
                    placeholder="Value line"
                    className="h-8 text-sm"
                  />
                  <Textarea
                    value={axis.helper}
                    onChange={(event) =>
                      onAxisChange?.(axis.key, "helper", event.target.value)
                    }
                    placeholder="Helper text"
                    className="min-h-14 text-xs"
                  />
                </div>
              ) : (
                <>
                  <p className="mt-2 text-sm font-medium text-foreground/90">
                    {axis.value}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {axis.helper}
                  </p>
                </>
              )}

              {axis.key === "grammar_variety" && grammarTopics && (
                <GrammarTopicsDropdown
                  topics={grammarTopics}
                  editable={editable}
                  onToggle={onGrammarTopicToggle}
                />
              )}

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${axis.score}%` }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                  className="h-full rounded-full bg-[var(--color-chart-1)]"
                />
              </div>
            </motion.div>
          ))}

          <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Grammar note.</span>{" "}
            {grammarNotice}
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
