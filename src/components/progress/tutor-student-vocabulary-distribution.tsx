"use client";

import { motion } from "motion/react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import type { StudentProgressSnapshot } from "@/lib/progress/profile-metrics";

const CEFR_LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

type VocabularyCefrCounts = StudentProgressSnapshot["activeSignals"]["cefrCounts"];

function buildChartData(counts: VocabularyCefrCounts) {
  return CEFR_LEVEL_ORDER.map((level) => ({
    level,
    count: counts[level],
  }));
}

function getKnownCount(counts: VocabularyCefrCounts) {
  return CEFR_LEVEL_ORDER.reduce((sum, level) => sum + counts[level], 0);
}

function VocabularyDistributionChart({
  title,
  description,
  counts,
  pendingReviewCount,
  color,
  emptyTitle,
}: {
  title: string;
  description: string;
  counts: VocabularyCefrCounts;
  pendingReviewCount: number;
  color: string;
  emptyTitle: string;
}) {
  const { messages } = useAppI18n();
  const chartData = buildChartData(counts);
  const chartConfig = {
    count: {
      label: messages.tutorProgressPage.vocabularyItemsLabel,
      color,
    },
  } satisfies ChartConfig;
  const knownCount = getKnownCount(counts);

  return (
    <Card className="border-border/60 bg-background/80">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="secondary">
              {messages.tutorProgressPage.vocabularyKnownCountLabel(knownCount)}
            </Badge>
            {pendingReviewCount > 0 ? (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-800"
              >
                {messages.tutorProgressPage.vocabularyPendingReviewCountLabel(
                  pendingReviewCount,
                )}
              </Badge>
            ) : null}
            {counts.unknown > 0 ? (
              <Badge variant="outline">
                {messages.tutorProgressPage.vocabularyUnknownCountLabel(
                  counts.unknown,
                )}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {knownCount === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyTitle}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart data={chartData} barCategoryGap="26%">
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="level"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(_, payload) =>
                      String(payload?.[0]?.payload?.level ?? "CEFR")
                    }
                  />
                }
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[10, 10, 0, 0]}
                isAnimationActive
                animationDuration={850}
                animationEasing="ease-out"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

interface TutorStudentVocabularyDistributionProps {
  activeSignals: StudentProgressSnapshot["activeSignals"];
  passiveSignals: StudentProgressSnapshot["passiveSignals"];
  learningSignals: StudentProgressSnapshot["learningSignals"];
}

export function TutorStudentVocabularyDistribution({
  activeSignals,
  passiveSignals,
  learningSignals,
}: TutorStudentVocabularyDistributionProps) {
  const { messages } = useAppI18n();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: 0.12 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle>
              {messages.tutorProgressPage.vocabularyDistributionTitle}
            </CardTitle>
          </div>
          <CardDescription>
            {messages.tutorProgressPage.vocabularyDistributionDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          <VocabularyDistributionChart
            title={messages.tutorProgressPage.activeVocabularyDistributionTitle}
            description={messages.tutorProgressPage.activeVocabularyDistributionDescription}
            counts={activeSignals.cefrCounts}
            pendingReviewCount={activeSignals.pendingReviewCount}
            color="var(--color-chart-1)"
            emptyTitle={messages.tutorProgressPage.noActiveVocabularyDistribution}
          />
          <VocabularyDistributionChart
            title={messages.tutorProgressPage.passiveVocabularyDistributionTitle}
            description={messages.tutorProgressPage.passiveVocabularyDistributionDescription}
            counts={passiveSignals.cefrCounts}
            pendingReviewCount={passiveSignals.pendingReviewCount}
            color="#f59e0b"
            emptyTitle={messages.tutorProgressPage.noPassiveVocabularyDistribution}
          />
          <VocabularyDistributionChart
            title={messages.tutorProgressPage.learningVocabularyDistributionTitle}
            description={messages.tutorProgressPage.learningVocabularyDistributionDescription}
            counts={learningSignals.cefrCounts}
            pendingReviewCount={learningSignals.pendingReviewCount}
            color="#2563eb"
            emptyTitle={messages.tutorProgressPage.noLearningVocabularyDistribution}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}