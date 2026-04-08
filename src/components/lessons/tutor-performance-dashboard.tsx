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
  Sparkles,
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
  helper: string;
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

interface TutorPerformanceDashboardProps {
  periodMetrics: PeriodMetric[];
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
  dailyTrend: TrendPoint[];
  topStudents: StudentPerformanceItem[];
  insights: PerformanceInsight[];
  hasCompletedLessons: boolean;
}

function MetricCard({ metric, index }: { metric: PeriodMetric; index: number }) {
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
      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-muted/30">
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
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm backdrop-blur-sm">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{metric.helper}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function TutorPerformanceDashboard({
  periodMetrics,
  weeklyTrend,
  monthlyTrend,
  dailyTrend,
  topStudents,
  insights,
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
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
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
                  Student breakdown will appear once your completed lessons start
                  accumulating this year.
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
                    <linearGradient id="lessons-performance-monthly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-lessons)" stopOpacity={0.34} />
                      <stop offset="100%" stopColor="var(--color-lessons)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
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
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
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
          <CardContent className="flex flex-col gap-3 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Completed lessons are the source of truth here.
              </p>
              <p className="text-sm text-muted-foreground">
                This view updates as lessons move to the completed state on your
                schedule.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Built from the same lesson records students already see.
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}