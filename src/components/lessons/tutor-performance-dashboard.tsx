"use client";

import { motion } from "motion/react";
import Link from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  type MouseEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  previousHref?: string;
  nextHref?: string;
  previousAriaLabel: string;
  nextAriaLabel: string;
}

const PERIOD_METRICS_CACHE_KEY =
  "vocab-crafter.lessons-performance.period-metrics";
const PERIOD_METRICS_CACHE_TTL_MS = 1000 * 60 * 15;
const PERIOD_METRICS_CACHE_MAX_ENTRIES = 24;

interface PeriodMetricsCacheEntry {
  cachedAt: number;
  periodMetrics: PeriodMetric[];
}

function sanitizePeriodMetricsCache(
  value: unknown,
): Record<string, PeriodMetricsCacheEntry> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const now = Date.now();
  const sanitizedEntries: Array<[string, PeriodMetricsCacheEntry]> =
    Object.entries(value as Record<string, unknown>).flatMap(([href, entry]) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const cachedAt = (entry as { cachedAt?: unknown }).cachedAt;
      const periodMetrics = (entry as { periodMetrics?: unknown }).periodMetrics;

      if (
        typeof cachedAt !== "number" ||
        now - cachedAt > PERIOD_METRICS_CACHE_TTL_MS ||
        !Array.isArray(periodMetrics)
      ) {
        return [];
      }

      return [
        [href, { cachedAt, periodMetrics: periodMetrics as PeriodMetric[] }],
      ];
    });

  return Object.fromEntries(
    sanitizedEntries
      .sort((left, right) => right[1].cachedAt - left[1].cachedAt)
      .slice(0, PERIOD_METRICS_CACHE_MAX_ENTRIES),
  );
}

function readPeriodMetricsCache() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const storedValue = window.localStorage.getItem(PERIOD_METRICS_CACHE_KEY);

    if (!storedValue) {
      return {};
    }

    const parsedValue = JSON.parse(storedValue) as unknown;
    const sanitizedValue = sanitizePeriodMetricsCache(parsedValue);

    if (JSON.stringify(parsedValue) !== JSON.stringify(sanitizedValue)) {
      window.localStorage.setItem(
        PERIOD_METRICS_CACHE_KEY,
        JSON.stringify(sanitizedValue),
      );
    }

    return sanitizedValue;
  } catch {
    return {};
  }
}

function getCachedPeriodMetrics(href: string) {
  return readPeriodMetricsCache()[href]?.periodMetrics;
}

function storeCachedPeriodMetrics(href: string, periodMetrics: PeriodMetric[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const nextCache = readPeriodMetricsCache();
    nextCache[href] = {
      cachedAt: Date.now(),
      periodMetrics,
    };

    window.localStorage.setItem(
      PERIOD_METRICS_CACHE_KEY,
      JSON.stringify(sanitizePeriodMetricsCache(nextCache)),
    );
  } catch {
    // Ignore storage failures and keep the live dashboard responsive.
  }
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

export interface PerformanceLessonClientItem {
  id: string;
  studentId: string | null;
  studentName: string;
  lessonDate: string;
  durationHours: number;
  priceCents: number;
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
  completedLessons?: PerformanceLessonClientItem[];
  todayIsoDate?: string;
  initialWeekOffset?: number;
  initialMonthOffset?: number;
  initialYearOffset?: number;
}

function stripClientTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseClientLessonDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`);
}

function startOfClientWeek(date: Date) {
  const start = stripClientTime(date);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function startOfClientMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfClientMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfClientYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfClientYear(date: Date) {
  return new Date(date.getFullYear(), 11, 31);
}

function addClientDays(date: Date, amount: number) {
  const next = stripClientTime(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addClientMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addClientYears(date: Date, amount: number) {
  return new Date(date.getFullYear() + amount, 0, 1);
}

function formatClientShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatClientLongMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function countClientLessonsInRange(
  lessons: PerformanceLessonClientItem[],
  startDate: Date,
  endDate: Date,
) {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return lessons.reduce((total, lesson) => {
    const lessonTime = parseClientLessonDate(lesson.lessonDate).getTime();
    return lessonTime >= startTime && lessonTime <= endTime ? total + 1 : total;
  }, 0);
}

function sumClientLessonHoursInRange(
  lessons: PerformanceLessonClientItem[],
  startDate: Date,
  endDate: Date,
) {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return lessons.reduce((total, lesson) => {
    const lessonTime = parseClientLessonDate(lesson.lessonDate).getTime();
    if (lessonTime < startTime || lessonTime > endTime) {
      return total;
    }
    return total + lesson.durationHours;
  }, 0);
}

function sumClientLessonEarningsInRange(
  lessons: PerformanceLessonClientItem[],
  startDate: Date,
  endDate: Date,
) {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return lessons.reduce((total, lesson) => {
    const lessonTime = parseClientLessonDate(lesson.lessonDate).getTime();
    if (lessonTime < startTime || lessonTime > endTime) {
      return total;
    }
    return total + lesson.priceCents;
  }, 0);
}

function countClientDaysInRange(startDate: Date, endDate: Date) {
  const cursor = stripClientTime(startDate);
  const endTime = stripClientTime(endDate).getTime();
  let total = 0;

  while (cursor.getTime() <= endTime) {
    total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

function countClientWeekdaysInRange(startDate: Date, endDate: Date) {
  const cursor = stripClientTime(startDate);
  const endTime = stripClientTime(endDate).getTime();
  let total = 0;

  while (cursor.getTime() <= endTime) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      total += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

function formatClientHours(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)} h`;
}

function formatClientLessonAverage(value: number) {
  return `${value.toFixed(1)} lessons`;
}

function buildClientPerformanceHref(
  pathname: string,
  weekOffset: number,
  monthOffset: number,
  yearOffset: number,
) {
  const params = new URLSearchParams();
  if (weekOffset < 0) params.set("weekOffset", String(weekOffset));
  if (monthOffset < 0) params.set("monthOffset", String(monthOffset));
  if (yearOffset < 0) params.set("yearOffset", String(yearOffset));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function MetricCard({
  metric,
  index,
  isPending,
  onNavigate,
}: {
  metric: PeriodMetric;
  index: number;
  isPending: boolean;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href?: string) => void;
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
              <CardTitle className="max-w-[14rem] text-sm font-medium text-muted-foreground sm:max-w-[16rem]">
                {metric.label}
              </CardTitle>
              <div className="mt-2 text-4xl font-semibold tracking-tight">
                {metric.value}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground/75">
                Earned {formatLessonCurrency(metric.earningsCents)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm backdrop-blur-sm">
                <Icon className="h-5 w-5 text-foreground" />
              </div>
              <Pagination
                aria-busy={isPending}
                className={cn(
                  "mx-0 w-auto justify-end transition-opacity",
                  isPending && "pointer-events-none opacity-60",
                )}
              >
                <PaginationContent className="gap-1">
                  <PaginationItem>
                    <PaginationPrevious
                      href={metric.previousHref}
                      onClick={(event) => onNavigate(event, metric.previousHref)}
                      aria-label={metric.previousAriaLabel}
                      aria-disabled={!metric.previousHref}
                      tabIndex={metric.previousHref ? undefined : -1}
                      className={cn(
                        "h-8 w-8 min-w-8 px-0 [&_span]:hidden",
                        !metric.previousHref && "pointer-events-none opacity-40",
                      )}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href={metric.nextHref}
                      onClick={(event) => onNavigate(event, metric.nextHref)}
                      aria-label={metric.nextAriaLabel}
                      aria-disabled={!metric.nextHref}
                      tabIndex={metric.nextHref ? undefined : -1}
                      className={cn(
                        "h-8 w-8 min-w-8 px-0 [&_span]:hidden",
                        !metric.nextHref && "pointer-events-none opacity-40",
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
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
  completedLessons,
  todayIsoDate,
  initialWeekOffset = 0,
  initialMonthOffset = 0,
  initialYearOffset = 0,
}: TutorPerformanceDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [weekOffset, setWeekOffset] = useState(initialWeekOffset);
  const [monthOffset, setMonthOffset] = useState(initialMonthOffset);
  const [yearOffset, setYearOffset] = useState(initialYearOffset);
  const [optimisticPeriodSnapshot, setOptimisticPeriodSnapshot] = useState<{
    href: string;
    periodMetrics: PeriodMetric[];
  } | null>(null);
  const searchParamsString = searchParams.toString();
  const currentHref = useMemo(
    () =>
      searchParamsString.length > 0
        ? `${pathname}?${searchParamsString}`
        : pathname,
    [pathname, searchParamsString],
  );

  const clientPeriodMetrics = useMemo<PeriodMetric[] | null>(() => {
    if (!completedLessons || !todayIsoDate) {
      return null;
    }

    const today = parseClientLessonDate(todayIsoDate);
    const currentWeekStart = startOfClientWeek(today);
    const currentMonthStart = startOfClientMonth(today);
    const currentYearStart = startOfClientYear(today);

    const selectedWeekStart = addClientDays(currentWeekStart, weekOffset * 7);
    const selectedWeekEnd =
      weekOffset === 0 ? today : addClientDays(selectedWeekStart, 6);
    const selectedMonthStart = addClientMonths(currentMonthStart, monthOffset);
    const selectedMonthEnd =
      monthOffset === 0 ? today : endOfClientMonth(selectedMonthStart);
    const selectedYearStart = addClientYears(currentYearStart, yearOffset);
    const selectedYearEnd =
      yearOffset === 0 ? today : endOfClientYear(selectedYearStart);

    const firstLessonDate = completedLessons[0]
      ? parseClientLessonDate(completedLessons[0].lessonDate)
      : null;

    const weekCount = countClientLessonsInRange(
      completedLessons,
      selectedWeekStart,
      selectedWeekEnd,
    );
    const monthCount = countClientLessonsInRange(
      completedLessons,
      selectedMonthStart,
      selectedMonthEnd,
    );
    const yearCount = countClientLessonsInRange(
      completedLessons,
      selectedYearStart,
      selectedYearEnd,
    );

    const weekEarningsCents = sumClientLessonEarningsInRange(
      completedLessons,
      selectedWeekStart,
      selectedWeekEnd,
    );
    const monthEarningsCents = sumClientLessonEarningsInRange(
      completedLessons,
      selectedMonthStart,
      selectedMonthEnd,
    );
    const yearEarningsCents = sumClientLessonEarningsInRange(
      completedLessons,
      selectedYearStart,
      selectedYearEnd,
    );

    const monthTotalHours = sumClientLessonHoursInRange(
      completedLessons,
      selectedMonthStart,
      selectedMonthEnd,
    );
    const selectedYearTotalHours = sumClientLessonHoursInRange(
      completedLessons,
      selectedYearStart,
      selectedYearEnd,
    );

    const daysSinceMonthStart = countClientDaysInRange(
      selectedMonthStart,
      selectedMonthEnd,
    );
    const daysInSelectedYear = countClientDaysInRange(
      selectedYearStart,
      selectedYearEnd,
    );
    const workdaysSinceMonthStart = countClientWeekdaysInRange(
      selectedMonthStart,
      selectedMonthEnd,
    );
    const workdaysInSelectedYear = countClientWeekdaysInRange(
      selectedYearStart,
      selectedYearEnd,
    );

    const averageLessonsPerMonthWeek =
      daysSinceMonthStart > 0 ? (monthCount * 7) / daysSinceMonthStart : 0;
    const averageLessonsPerYearWeek =
      daysInSelectedYear > 0 ? (yearCount * 7) / daysInSelectedYear : 0;
    const averageMonthHoursPerDay =
      daysSinceMonthStart > 0 ? monthTotalHours / daysSinceMonthStart : 0;
    const averageMonthHoursPerWorkday =
      workdaysSinceMonthStart > 0
        ? monthTotalHours / workdaysSinceMonthStart
        : 0;
    const selectedYearAverageHoursPerDay =
      daysInSelectedYear > 0 ? selectedYearTotalHours / daysInSelectedYear : 0;
    const selectedYearAverageHoursPerWorkday =
      workdaysInSelectedYear > 0
        ? selectedYearTotalHours / workdaysInSelectedYear
        : 0;

    const canGoToPreviousWeek = firstLessonDate
      ? selectedWeekStart.getTime() > startOfClientWeek(firstLessonDate).getTime()
      : false;
    const canGoToPreviousMonth = firstLessonDate
      ? selectedMonthStart.getTime() >
        startOfClientMonth(firstLessonDate).getTime()
      : false;
    const canGoToPreviousYear = firstLessonDate
      ? selectedYearStart.getTime() > startOfClientYear(firstLessonDate).getTime()
      : false;

    return [
      {
        label: `${formatClientShortDate(selectedWeekStart)} - ${formatClientShortDate(selectedWeekEnd)}`,
        value: weekCount,
        earningsCents: weekEarningsCents,
        helper: "Weekly performance",
        iconKey: "week",
        accentClassName: "bg-[var(--color-chart-1)]/18",
        previousHref: canGoToPreviousWeek
          ? buildClientPerformanceHref(
              pathname,
              weekOffset - 1,
              monthOffset,
              yearOffset,
            )
          : undefined,
        nextHref:
          weekOffset < 0
            ? buildClientPerformanceHref(
                pathname,
                Math.min(weekOffset + 1, 0),
                monthOffset,
                yearOffset,
              )
            : undefined,
        previousAriaLabel: "View previous week",
        nextAriaLabel: "View next week",
      },
      {
        label: formatClientLongMonthLabel(selectedMonthStart),
        value: monthCount,
        earningsCents: monthEarningsCents,
        helper: "Monthly performance",
        iconKey: "month",
        accentClassName: "bg-[var(--color-chart-2)]/18",
        previousHref: canGoToPreviousMonth
          ? buildClientPerformanceHref(
              pathname,
              weekOffset,
              monthOffset - 1,
              yearOffset,
            )
          : undefined,
        nextHref:
          monthOffset < 0
            ? buildClientPerformanceHref(
                pathname,
                weekOffset,
                Math.min(monthOffset + 1, 0),
                yearOffset,
              )
            : undefined,
        previousAriaLabel: "View previous month",
        nextAriaLabel: "View next month",
        stats: [
          {
            label: "Avg / week",
            value: formatClientLessonAverage(averageLessonsPerMonthWeek),
          },
          {
            label: "Avg hrs / day",
            value: formatClientHours(averageMonthHoursPerDay),
          },
          {
            label: "5-day avg",
            value: formatClientHours(averageMonthHoursPerWorkday),
          },
        ],
      },
      {
        label: String(selectedYearStart.getFullYear()),
        value: yearCount,
        earningsCents: yearEarningsCents,
        helper: "Yearly performance",
        iconKey: "year",
        accentClassName: "bg-[var(--color-chart-3)]/18",
        previousHref: canGoToPreviousYear
          ? buildClientPerformanceHref(
              pathname,
              weekOffset,
              monthOffset,
              yearOffset - 1,
            )
          : undefined,
        nextHref:
          yearOffset < 0
            ? buildClientPerformanceHref(
                pathname,
                weekOffset,
                monthOffset,
                Math.min(yearOffset + 1, 0),
              )
            : undefined,
        previousAriaLabel: "View previous year",
        nextAriaLabel: "View next year",
        stats: [
          {
            label: "Avg / week",
            value: formatClientLessonAverage(averageLessonsPerYearWeek),
          },
          {
            label: "Avg hrs / day",
            value: formatClientHours(selectedYearAverageHoursPerDay),
          },
          {
            label: "5-day avg",
            value: formatClientHours(selectedYearAverageHoursPerWorkday),
          },
        ],
      },
    ];
  }, [
    completedLessons,
    monthOffset,
    pathname,
    todayIsoDate,
    weekOffset,
    yearOffset,
  ]);

  const displayedPeriodMetrics = useMemo(
    () =>
      clientPeriodMetrics ??
      (optimisticPeriodSnapshot && optimisticPeriodSnapshot.href !== currentHref
        ? optimisticPeriodSnapshot.periodMetrics
        : periodMetrics),
    [clientPeriodMetrics, currentHref, optimisticPeriodSnapshot, periodMetrics],
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    storeCachedPeriodMetrics(currentHref, displayedPeriodMetrics);
  }, [currentHref, displayedPeriodMetrics]);

  function handlePeriodNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    href?: string,
  ) {
    event.preventDefault();

    if (!href) {
      return;
    }

    if (completedLessons && todayIsoDate) {
      const queryIndex = href.indexOf("?");
      const nextParams = new URLSearchParams(
        queryIndex >= 0 ? href.slice(queryIndex + 1) : "",
      );
      const parseOffset = (val: string | null) => {
        const parsed = Number.parseInt(val ?? "", 10);
        return Number.isNaN(parsed) ? 0 : Math.min(parsed, 0);
      };

      setWeekOffset(parseOffset(nextParams.get("weekOffset")));
      setMonthOffset(parseOffset(nextParams.get("monthOffset")));
      setYearOffset(parseOffset(nextParams.get("yearOffset")));

      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", href);
      }
      return;
    }

    if (isPending) {
      return;
    }

    const cachedPeriodMetrics = getCachedPeriodMetrics(href);

    if (cachedPeriodMetrics) {
      setOptimisticPeriodSnapshot({
        href,
        periodMetrics: cachedPeriodMetrics,
      });
    }

    startTransition(() => {
      router.prefetch(href);
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {displayedPeriodMetrics.map((metric, index) => (
          <MetricCard
            key={metric.iconKey}
            metric={metric}
            index={index}
            isPending={isPending}
            onNavigate={handlePeriodNavigation}
          />
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
