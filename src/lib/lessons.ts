export const LESSON_STATUSES = ["planned", "completed", "cancelled"] as const;
export const LESSON_BALANCE_CURRENCY = "UAH";
export const LESSON_BALANCE_LOCALE = "uk-UA";

export type LessonStatus = (typeof LESSON_STATUSES)[number];

export interface LessonStudentOption {
  id: string;
  name: string;
  lessonPriceCents?: number;
}

export interface MonthlyLessonItem {
  id: string;
  title: string | null;
  lessonDate: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  status: LessonStatus;
  priceCents: number;
  studentId?: string;
  participantName: string;
  participantLabel: string;
}

export interface LessonBalanceSummaryItem {
  participantId: string;
  participantName: string;
  participantLabel: string;
  lessonPriceCents: number;
  totalAmountPaidCents: number;
  balanceCents: number;
  lessonsLeft: number | null;
  historyEntries: LessonBalanceHistoryEntry[];
}

export interface LessonBalanceHistoryEntry {
  id: string;
  type: "payment" | "deduction" | "lesson";
  label: string;
  description: string | null;
  amountCents: number;
  occurredAt: string;
}

export interface LessonMonthCell {
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

const MONTH_PARAM_PATTERN = /^\d{4}-\d{2}$/;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeLessonMonthParam(value?: string) {
  if (value && MONTH_PARAM_PATTERN.test(value)) {
    const [yearText, monthText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText) - 1;
    const parsed = new Date(year, month, 1);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

export function formatLessonMonthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatLessonMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatLessonDayLabel(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00`));
}

export function getLessonMonthRange(date: Date) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    startIsoDate: toIsoDate(monthStart),
    endIsoDate: toIsoDate(monthEnd),
  };
}

export function buildLessonMonthCells(date: Date): LessonMonthCell[] {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    1 - startOffset,
  );
  const todayIso = toIsoDate(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    const isoDate = toIsoDate(cellDate);

    return {
      isoDate,
      dayNumber: cellDate.getDate(),
      inCurrentMonth: cellDate.getMonth() === date.getMonth(),
      isToday: isoDate === todayIso,
    };
  });
}

export function getLessonWeekdayLabels() {
  return WEEKDAY_LABELS;
}

export function formatLessonTimeRange(
  startTime?: string | null,
  endTime?: string | null,
) {
  if (startTime && endTime) {
    return `${startTime}-${endTime}`;
  }

  if (startTime) {
    return startTime;
  }

  if (endTime) {
    return `until ${endTime}`;
  }

  return "Time not set";
}

export function getLessonDisplayTitle(title?: string | null) {
  const normalized = title?.trim();
  return normalized ? normalized : "Lesson";
}

export function getSuggestedLessonEndTime(startTime?: string | null) {
  if (!startTime || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(startTime)) {
    return "";
  }

  const [hourText, minuteText] = startTime.split(":");
  const hour = Number(hourText);

  if (!Number.isFinite(hour) || hour >= 23) {
    return "";
  }

  return `${String(hour + 1).padStart(2, "0")}:${minuteText}`;
}

export function formatLessonCurrency(amountCents: number) {
  return new Intl.NumberFormat(LESSON_BALANCE_LOCALE, {
    style: "currency",
    currency: LESSON_BALANCE_CURRENCY,
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function formatLessonCurrencyInput(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

export function parseLessonCurrencyInput(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function getLessonsLeft(balanceCents: number, lessonPriceCents: number) {
  if (lessonPriceCents <= 0) {
    return null;
  }

  return Math.floor(balanceCents / lessonPriceCents);
}

export function getLessonStatusLabel(status: LessonStatus) {
  switch (status) {
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Planned";
  }
}

export function getLessonStatusBadgeClassName(status: LessonStatus) {
  switch (status) {
    case "completed":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300";
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300";
  }
}

export function getLessonStatusSurfaceClassName(status: LessonStatus) {
  switch (status) {
    case "completed":
      return "border-green-200 bg-green-50/50 dark:border-green-900/60 dark:bg-green-950/10";
    case "cancelled":
      return "border-red-200 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/10";
    default:
      return "border-blue-200 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/10";
  }
}

export function groupLessonsByDate(lessons: MonthlyLessonItem[]) {
  const groups = new Map<string, MonthlyLessonItem[]>();

  for (const lesson of lessons) {
    const existing = groups.get(lesson.lessonDate) ?? [];
    existing.push(lesson);
    groups.set(lesson.lessonDate, existing);
  }

  return groups;
}
