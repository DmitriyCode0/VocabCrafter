"use client";

import { motion } from "motion/react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { StudentProgressAxis } from "@/lib/progress/profile-metrics";
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

interface StudentSkillRadarProps {
  axes: StudentProgressAxis[];
  chartData: Array<{
    axis: string;
    score: number;
    fullMark: number;
  }>;
  cefrLevel: string;
  grammarNotice: string;
}

export function StudentSkillRadar({
  axes,
  chartData,
  cefrLevel,
  grammarNotice,
}: StudentSkillRadarProps) {
  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-secondary/20">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">Learning Profile</CardTitle>
            <CardDescription>
              A five-axis view of your current learning experience. Grammar is
              visible, but still marked as beta until it gets dedicated mastery
              tracking.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="w-fit border-primary/30 bg-primary/5 text-primary"
          >
            Profile level target {cefrLevel}
          </Badge>
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
                <p
                  className={cn(
                    "text-sm font-semibold",
                    getScoreTone(axis.score),
                  )}
                >
                  {axis.score}/100
                </p>
              </div>

              <p className="mt-2 text-sm font-medium text-foreground/90">
                {axis.value}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {axis.helper}
              </p>

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
