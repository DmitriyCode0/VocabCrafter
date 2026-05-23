"use client";

import { StudentSkillRadar } from "@/components/progress/student-skill-radar";
import {
  getMonthlyPentagramUiCopy,
  localizeMonthlyReportPentagramSnapshot,
} from "@/lib/progress/monthly-pentagram-localization";
import type { MonthlyPentagramSnapshot } from "@/lib/progress/monthly-pentagram-localization";

interface MonthlyReportPentagramCardProps {
  pentagram: MonthlyPentagramSnapshot;
  locale: string;
  title: string;
  description: string;
  badgeLabel?: string;
}

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
  const localizedPentagram = localizeMonthlyReportPentagramSnapshot(
    pentagram,
    locale,
  );
  const uiCopy = getMonthlyPentagramUiCopy(locale);
  const currentLabel = formatMonthLabel(
    localizedPentagram.currentMonth.reportMonth,
    locale,
  );
  const previousLabel = formatMonthLabel(
    localizedPentagram.previousMonth.reportMonth,
    locale,
  );

  return (
    <StudentSkillRadar
      axes={localizedPentagram.currentMonth.axes}
      chartData={localizedPentagram.currentMonth.chartData}
      cefrLevel={badgeLabel ?? currentLabel}
      grammarNotice={uiCopy.grammarNotice}
      betaLabel={uiCopy.betaLabel}
      grammarNoteLabel={uiCopy.grammarNoteLabel}
      title={title}
      description={description}
      comparison={{
        currentLabel,
        previousLabel,
        previousAxes: localizedPentagram.previousMonth.axes,
        previousChartData: localizedPentagram.previousMonth.chartData,
      }}
    />
  );
}