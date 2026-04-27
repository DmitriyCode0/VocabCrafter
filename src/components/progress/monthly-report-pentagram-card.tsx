"use client";

import { StudentSkillRadar } from "@/components/progress/student-skill-radar";

type MonthlyReportPentagramAxisKey =
  | "active_vocab"
  | "grammar_variety"
  | "engagement"
  | "accuracy"
  | "passive_vocab";

interface MonthlyReportPentagramAxis {
  key: MonthlyReportPentagramAxisKey;
  label: string;
  shortLabel: string;
  score: number;
  value: string;
  helper: string;
  beta?: boolean;
}

interface MonthlyReportPentagramChartDatum {
  axis: string;
  score: number;
  fullMark: number;
}

interface MonthlyReportPentagramMonth {
  reportMonth: string;
  axes: MonthlyReportPentagramAxis[];
  chartData: MonthlyReportPentagramChartDatum[];
}

interface MonthlyReportPentagramSnapshot {
  currentMonth: MonthlyReportPentagramMonth;
  previousMonth: MonthlyReportPentagramMonth;
}

interface MonthlyReportPentagramCardProps {
  pentagram: MonthlyReportPentagramSnapshot;
  locale: string;
  title: string;
  description: string;
  badgeLabel?: string;
}

const MONTHLY_GRAMMAR_NOTICE =
  "Grammar variety is month-scoped here and reflects confident grammar-topic coverage inside the reporting window rather than cumulative lifetime grammar coverage.";

function formatMonthLabel(reportMonth: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${reportMonth}T00:00:00.000Z`));
}

export function MonthlyReportPentagramCard({
  pentagram,
  locale,
  title,
  description,
  badgeLabel,
}: MonthlyReportPentagramCardProps) {
  const currentLabel = formatMonthLabel(pentagram.currentMonth.reportMonth, locale);
  const previousLabel = formatMonthLabel(
    pentagram.previousMonth.reportMonth,
    locale,
  );

  return (
    <StudentSkillRadar
      axes={pentagram.currentMonth.axes}
      chartData={pentagram.currentMonth.chartData}
      cefrLevel={badgeLabel ?? currentLabel}
      grammarNotice={MONTHLY_GRAMMAR_NOTICE}
      title={title}
      description={description}
      comparison={{
        currentLabel,
        previousLabel,
        previousAxes: pentagram.previousMonth.axes,
        previousChartData: pentagram.previousMonth.chartData,
      }}
    />
  );
}