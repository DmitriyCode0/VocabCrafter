"use client";

import { motion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
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
import type { StudentMonthlyActivitySnapshot } from "@/lib/progress/tutor-progress-monthly";

interface TutorStudentMonthlyPerformanceProps {
  studentName: string;
  studentLevel?: string | null;
  targetLanguageLabel: string;
  trend: StudentMonthlyActivitySnapshot;
}

const TOP_SEGMENT_RADIUS = [10, 10, 0, 0] as const;
const TOP_SEGMENT_CELL_RADIUS = TOP_SEGMENT_RADIUS as unknown as number;

function MetricCard({
  title,
  value,
  index,
}: {
  title: string;
  value: number;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay: index * 0.05 }}
    >
      <Card className="h-full border-border/60 bg-background/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MonthlyActivityContent({
  trend,
}: {
  trend: StudentMonthlyActivitySnapshot;
}) {
  const { messages } = useAppI18n();
  const chartConfig = {
    quizzes: {
      label: messages.progress.completedQuizzes,
      color: "var(--color-chart-1)",
    },
    lessons: {
      label: messages.progress.completedLessons,
      color: "#f59e0b",
    },
  } satisfies ChartConfig;
  const hasMonthlyActivity = trend.totalQuizzes > 0 || trend.totalLessons > 0;

  if (!hasMonthlyActivity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {messages.progress.noMonthlyActivityTitle}
          </CardTitle>
          <CardDescription>
            {messages.progress.noMonthlyActivityDescription}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title={messages.progress.completedQuizzes}
          value={trend.totalQuizzes}
          index={0}
        />
        <MetricCard
          title={messages.progress.completedLessons}
          value={trend.totalLessons}
          index={1}
        />
        <MetricCard
          title={messages.progress.activeDays}
          value={trend.activeDays}
          index={2}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.14 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle>{messages.progress.monthlyChartTitle}</CardTitle>
            </div>
            <CardDescription>
              {messages.progress.monthlyChartDescription(
                trend.startDateLabel,
                trend.endDateLabel,
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[340px] w-full">
              <BarChart data={trend.points} barCategoryGap="22%">
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={18}
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
                    />
                  }
                />
                <Bar
                  dataKey="quizzes"
                  stackId="activity"
                  fill="var(--color-quizzes)"
                  isAnimationActive
                  animationDuration={850}
                  animationEasing="ease-out"
                >
                  {trend.points.map((point) => (
                    <Cell
                      key={`quizzes-${point.date}`}
                      radius={
                        point.quizzes > 0 && point.lessons === 0
                          ? TOP_SEGMENT_CELL_RADIUS
                          : 0
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="lessons"
                  stackId="activity"
                  fill="var(--color-lessons)"
                  isAnimationActive
                  animationDuration={950}
                  animationEasing="ease-out"
                >
                  {trend.points.map((point) => (
                    <Cell
                      key={`lessons-${point.date}`}
                      radius={point.lessons > 0 ? TOP_SEGMENT_CELL_RADIUS : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}

export function StudentMonthlyProgressPanel({
  trend,
}: {
  trend: StudentMonthlyActivitySnapshot;
}) {
  return <MonthlyActivityContent trend={trend} />;
}

export function TutorStudentMonthlyPerformance({
  studentName,
  studentLevel,
  targetLanguageLabel,
  trend,
}: TutorStudentMonthlyPerformanceProps) {
  const { messages } = useAppI18n();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{studentName}</h2>
          <Badge variant="outline">{targetLanguageLabel}</Badge>
          {studentLevel ? (
            <Badge variant="secondary">
              {messages.tutorProgressPage.targetLabel(studentLevel)}
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground">
          {messages.tutorProgressPage.monthlyPanelDescription(studentName)}
        </p>
      </div>

      <MonthlyActivityContent trend={trend} />
    </div>
  );
}
