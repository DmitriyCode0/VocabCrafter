"use client";

import { motion } from "motion/react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  ChartColumnBig,
  Clock3,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatLessonCurrency } from "@/lib/lessons";
import { cn } from "@/lib/utils";

const weeklyChartConfig = {
  lessons: {
    label: "Completed lessons",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig;

const monthlyChartConfig = {
  lessons: {
    label: "Completed lessons",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig;

const dailyChartConfig = {
  lessons: {
    label: "Completed lessons",
    color: "var(--color-chart-3)",
  },
} satisfies ChartConfig;

interface PeriodMetric {
  label: string;
  value: number;
  earningsCents: number;
  helper: string;
  stats?: Array<{
    label: string;
    value: string;
  }>;
  iconKey: "week" | "month" | "year";
  accentClassName: string;
}

interface TrendPoint {
  label: string;
  lessons: number;
  description: string;
}

interface StudentPerformanceItem {
  id: string;
  name: string;
  lessons: number;
  share: number;
}

interface PerformanceInsight {
  label: string;
  value: string;
}

interface FormulaMetrics {
  yearLabel: number;
  rangeLabel: string;
  totalHoursLabel: string;
  calendarDays: number;
  weekdayDays: number;
  averageHoursPerDayLabel: string;
  averageHoursPerWorkdayLabel: string;
}

interface TutorPerformanceDashboardProps {
  periodMetrics: PeriodMetric[];
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
  dailyTrend: TrendPoint[];
  topStudents: StudentPerformanceItem[];
  insights: PerformanceInsight[];
  formulaMetrics: FormulaMetrics;
  hasCompletedLessons: boolean;
}

function MetricCard({
  metric,
  index,
}: {
  metric: PeriodMetric;
  index: number;
}) {
  const Icon =
    metric.iconKey === "week"
      ? CalendarDays
      : metric.iconKey === "month"
        ? ChartColumnBig
        : TrendingUp;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
    >
      <Card className="h-full overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-muted/30">
        <CardHeader className="relative pb-3">
          <div
            className={cn(
              "absolute right-0 top-0 h-24 w-24 rounded-full blur-3xl",
              metric.accentClassName,
            )}
          />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
              <div className="mt-2 text-4xl font-semibold tracking-tight">
                {metric.value}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground/75">
                Earned {formatLessonCurrency(metric.earningsCents)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm backdrop-blur-sm">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{metric.helper}</p>
          {metric.stats?.length ? (
            <div className="space-y-2 border-t border-border/60 pt-4">
              {metric.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-muted-foreground">{stat.label}</span>
                  <span className="font-semibold tracking-tight text-foreground">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FormulaCard({
  title,
  description,
  formula,
  accentClassName,
}: {
  title: string;
  description: string;
  formula: Array<{ label: string; value: string }>;
  accentClassName: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/85 p-5 shadow-sm backdrop-blur-sm">
      <div
        className={cn(
          "absolute right-0 top-0 h-24 w-24 rounded-full blur-3xl",
          accentClassName,
        )}
      />
      <div className="relative space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {title}
          </p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          {formula.map((part, index) => (
            <div key={part.label} className="flex items-center gap-2">
              <div className="rounded-2xl border border-border/60 bg-muted/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {part.label}
                </p>
                <p className="mt-1 text-base font-semibold tracking-tight">
                  {part.value}
                </p>
              </div>
              {index < formula.length - 1 ? (
                <span className="text-lg font-semibold text-muted-foreground">
                  {index === formula.length - 2 ? "=" : "/"}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TutorPerformanceDashboard({
  periodMetrics,
  weeklyTrend,
  monthlyTrend,
  dailyTrend,
  topStudents,
  insights,
  formulaMetrics,
  hasCompletedLessons,
}: TutorPerformanceDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {periodMetrics.map((metric, index) => (
          <MetricCard key={metric.label} metric={metric} index={index} />
        ))}
      </div>

      {!hasCompletedLessons ? (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.12 }}
        >
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No completed lessons yet</CardTitle>
              <CardDescription>
                This page starts filling out once lesson records are marked as
                completed.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm text-muted-foreground">
                Your charts are ready, but there is no completed lesson history
                to plot yet. Use the schedule tab to manage lessons, then mark
                completed sessions to build your performance view.
              </p>
              <Button asChild>
                <Link href="/lessons">Back to schedule</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <motion.div
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.14 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ChartColumnBig className="h-5 w-5 text-primary" />
                <CardTitle>Weekly teaching rhythm</CardTitle>
              </div>
              <CardDescription>
                Completed lessons across the last 12 teaching weeks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={weeklyChartConfig}
                className="h-[320px] w-full"
              >
                <BarChart data={weeklyTrend} barCategoryGap="22%">
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={12}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) =>
                          String(payload?.[0]?.payload?.description ?? "Week")
                        }
                        formatter={(value) => (
                          <div className="flex min-w-[12rem] items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              Completed lessons
                            </span>
                            <span className="font-mono font-semibold text-foreground">
                              {value}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="lessons"
                    fill="var(--color-lessons)"
                    radius={[10, 10, 0, 0]}
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.18 }}
        >
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Most taught students</CardTitle>
              </div>
              <CardDescription>
                Student breakdown for your completed lessons this year.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topStudents.length > 0 ? (
                <div className="space-y-4">
                  {topStudents.map((student, index) => (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        ease: "easeOut",
                        delay: 0.22 + index * 0.05,
                      }}
                      className="rounded-2xl border border-border/60 bg-background/70 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {student.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {student.lessons} completed lesson
                            {student.lessons !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground/80">
                          {student.share}%
                        </p>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${student.share}%` }}
                          transition={{
                            duration: 0.55,
                            ease: "easeOut",
                            delay: 0.26 + index * 0.05,
                          }}
                          className="h-full rounded-full bg-[var(--color-chart-1)]"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                  Student breakdown will appear once your completed lessons
                  start accumulating this year.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.22 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>Monthly volume</CardTitle>
              </div>
              <CardDescription>
                Year-to-date lesson totals by month.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={monthlyChartConfig}
                className="h-[300px] w-full"
              >
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient
                      id="lessons-performance-monthly"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--color-lessons)"
                        stopOpacity={0.34}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-lessons)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) =>
                          String(payload?.[0]?.payload?.description ?? "Month")
                        }
                        formatter={(value) => (
                          <div className="flex min-w-[12rem] items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              Completed lessons
                            </span>
                            <span className="font-mono font-semibold text-foreground">
                              {value}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="lessons"
                    stroke="var(--color-lessons)"
                    fill="url(#lessons-performance-monthly)"
                    strokeWidth={2.5}
                    isAnimationActive
                    animationDuration={950}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.26 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-primary" />
                <CardTitle>This month by day</CardTitle>
              </div>
              <CardDescription>
                Daily lesson completions for the current month so far.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={dailyChartConfig}
                className="h-[300px] w-full"
              >
                <LineChart data={dailyTrend}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={14}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) =>
                          String(payload?.[0]?.payload?.description ?? "Day")
                        }
                        formatter={(value) => (
                          <div className="flex min-w-[12rem] items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              Completed lessons
                            </span>
                            <span className="font-mono font-semibold text-foreground">
                              {value}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="lessons"
                    stroke="var(--color-lessons)"
                    strokeWidth={3}
                    dot={{ r: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    isAnimationActive
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
      >
        <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-secondary/20">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-xl">Teaching cadence</CardTitle>
                <CardDescription>
                  Track how your completed lesson volume is moving across recent
                  weeks, this year, and the current month.
                </CardDescription>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {insights.map((insight) => (
                  <div
                    key={insight.label}
                    className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm backdrop-blur-sm"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {insight.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold tracking-tight">
                      {insight.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.3 }}
      >
        <Card className="border-border/60 bg-gradient-to-r from-muted/30 via-background to-muted/10">
          <CardHeader className="space-y-2">
            <CardTitle>Average formulas</CardTitle>
            <CardDescription>
              Year-to-date lesson hours for {formulaMetrics.yearLabel} across{" "}
              {formulaMetrics.rangeLabel}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <FormulaCard
              title="7-day average"
              description="Completed lesson hours this year divided by every calendar day since Jan 1."
              formula={[
                {
                  label: "Hours this year",
                  value: formulaMetrics.totalHoursLabel,
                },
                {
                  label: "Calendar days",
                  value: `${formulaMetrics.calendarDays}`,
                },
                {
                  label: "Avg hrs / day",
                  value: formulaMetrics.averageHoursPerDayLabel,
                },
              ]}
              accentClassName="bg-[var(--color-chart-2)]/18"
            />
            <FormulaCard
              title="5-day average"
              description="The same year-to-date lesson hours divided by weekdays only, excluding Saturdays and Sundays."
              formula={[
                {
                  label: "Hours this year",
                  value: formulaMetrics.totalHoursLabel,
                },
                {
                  label: "Weekdays",
                  value: `${formulaMetrics.weekdayDays}`,
                },
                {
                  label: "Avg hrs / day",
                  value: formulaMetrics.averageHoursPerWorkdayLabel,
                },
              ]}
              accentClassName="bg-[var(--color-chart-3)]/18"
            />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
