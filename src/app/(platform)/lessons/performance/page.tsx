import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { LessonsPageHeader } from "@/components/lessons/lessons-page-header";
import { TutorPerformanceDashboard } from "@/components/lessons/tutor-performance-dashboard";
import { getAppMessages } from "@/lib/i18n/messages";
import { getLessonsViewerAccess } from "@/lib/lessons-access";
import { formatLessonMonthParam } from "@/lib/lessons";
import { autoCompleteOverduePlannedLessons } from "@/lib/lessons-server";

interface CompletedPerformanceLessonRow {
  id: string;
  student_id: string | null;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  price_cents: number;
  student_profile: {
    full_name: string | null;
    email: string;
  } | null;
}

interface PerformanceLessonItem {
  id: string;
  studentId: string | null;
  studentName: string;
  lessonDate: string;
  durationHours: number;
  priceCents: number;
}

interface TrendPoint {
  label: string;
  lessons: number;
  description: string;
}

type LessonsPerformanceSearchParams = Record<
  string,
  string | string[] | undefined
>;

const TIME_PATTERN = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
const DEFAULT_LESSON_DURATION_HOURS = 1;

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLessonDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`);
}

function parseTimeToMinutes(value?: string | null) {
  if (!value || !TIME_PATTERN.test(value)) {
    return null;
  }

  const [hourText, minuteText] = value.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

function getLessonDurationHours(
  startTime?: string | null,
  endTime?: string | null,
) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes
  ) {
    return DEFAULT_LESSON_DURATION_HOURS;
  }

  return (endMinutes - startMinutes) / 60;
}

function startOfWeek(date: Date) {
  const start = stripTime(date);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date) {
  return new Date(date.getFullYear(), 11, 31);
}

function addDays(date: Date, amount: number) {
  const next = stripTime(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addYears(date: Date, amount: number) {
  return new Date(date.getFullYear() + amount, 0, 1);
}

function getSingleSearchParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePastPeriodOffset(value?: string | string[]) {
  const parsedValue = Number.parseInt(getSingleSearchParamValue(value) ?? "", 10);

  if (Number.isNaN(parsedValue)) {
    return 0;
  }

  return Math.min(parsedValue, 0);
}

function buildPerformancePageHref(
  pathname: string,
  searchParams: LessonsPerformanceSearchParams,
  periodParam: "weekOffset" | "monthOffset" | "yearOffset",
  nextOffset: number,
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === periodParam || value == null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
      return;
    }

    params.set(key, value);
  });

  if (nextOffset < 0) {
    params.set(periodParam, String(nextOffset));
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function minDate(...dates: Date[]) {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function getMetricLabel(
  period: "week" | "month" | "year",
) {
  if (period === "week") {
    return "Weekly performance";
  }

  if (period === "month") {
    return "Monthly performance";
  }

  return "Yearly performance";
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
  }).format(date);
}

function formatLongMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function countLessonsInRange(
  lessons: PerformanceLessonItem[],
  startDate: Date,
  endDate: Date,
) {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return lessons.reduce((total, lesson) => {
    const lessonTime = parseLessonDate(lesson.lessonDate).getTime();
    return lessonTime >= startTime && lessonTime <= endTime ? total + 1 : total;
  }, 0);
}

function sumLessonHoursInRange(
  lessons: PerformanceLessonItem[],
  startDate: Date,
  endDate: Date,
) {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return lessons.reduce((total, lesson) => {
    const lessonTime = parseLessonDate(lesson.lessonDate).getTime();

    if (lessonTime < startTime || lessonTime > endTime) {
      return total;
    }

    return total + lesson.durationHours;
  }, 0);
}

function sumLessonEarningsInRange(
  lessons: PerformanceLessonItem[],
  startDate: Date,
  endDate: Date,
) {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return lessons.reduce((total, lesson) => {
    const lessonTime = parseLessonDate(lesson.lessonDate).getTime();

    if (lessonTime < startTime || lessonTime > endTime) {
      return total;
    }

    return total + lesson.priceCents;
  }, 0);
}

function countDaysInRange(startDate: Date, endDate: Date) {
  const cursor = stripTime(startDate);
  const endTime = stripTime(endDate).getTime();
  let total = 0;

  while (cursor.getTime() <= endTime) {
    total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

function countWeekdaysInRange(startDate: Date, endDate: Date) {
  const cursor = stripTime(startDate);
  const endTime = stripTime(endDate).getTime();
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

function formatHours(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)} h`;
}

function formatLessonAverage(value: number) {
  return `${value.toFixed(1)} lessons`;
}

function formatFormulaDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function buildWeeklyTrend(lessons: PerformanceLessonItem[], today: Date) {
  const currentWeekStart = startOfWeek(today);

  return Array.from({ length: 12 }, (_, index) => {
    const offset = index - 11;
    const weekStart = addDays(currentWeekStart, offset * 7);
    const weekEnd = addDays(weekStart, 6);

    return {
      label: formatShortDate(weekStart),
      lessons: countLessonsInRange(lessons, weekStart, weekEnd),
      description: `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`,
    } satisfies TrendPoint;
  });
}

function buildMonthlyTrend(lessons: PerformanceLessonItem[], today: Date) {
  return Array.from({ length: today.getMonth() + 1 }, (_, monthIndex) => {
    const monthStart = new Date(today.getFullYear(), monthIndex, 1);
    const monthEnd = new Date(today.getFullYear(), monthIndex + 1, 0);

    return {
      label: formatMonthLabel(monthStart),
      lessons: countLessonsInRange(lessons, monthStart, monthEnd),
      description: formatLongMonthLabel(monthStart),
    } satisfies TrendPoint;
  });
}

function buildDailyTrend(lessons: PerformanceLessonItem[], today: Date) {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return Array.from({ length: today.getDate() }, (_, dayIndex) => {
    const currentDate = addDays(monthStart, dayIndex);

    return {
      label: String(currentDate.getDate()),
      lessons: countLessonsInRange(lessons, currentDate, currentDate),
      description: formatLongDate(currentDate),
    } satisfies TrendPoint;
  });
}

function mapPerformanceLessons(rows: CompletedPerformanceLessonRow[]) {
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName:
      row.student_profile?.full_name || row.student_profile?.email || "Student",
    lessonDate: row.lesson_date,
    durationHours: getLessonDurationHours(row.start_time, row.end_time),
    priceCents: row.price_cents,
  }));
}

function hasAssignedStudent(
  lesson: PerformanceLessonItem,
): lesson is PerformanceLessonItem & { studentId: string } {
  return typeof lesson.studentId === "string" && lesson.studentId.length > 0;
}

export default async function LessonsPerformancePage({
  searchParams,
}: {
  searchParams: Promise<LessonsPerformanceSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { userId, role, appLanguage } = await getLessonsViewerAccess({
    requireTutor: true,
  });
  const messages = getAppMessages(appLanguage);
  const supabaseAdmin = createAdminClient();
  await autoCompleteOverduePlannedLessons({
    tutorId: userId,
    supabaseAdmin,
  });
  const today = stripTime(new Date());
  const currentWeekStart = startOfWeek(today);
  const currentMonthStart = startOfMonth(today);
  const currentYearStart = startOfYear(today);
  const weekOffset = parsePastPeriodOffset(resolvedSearchParams.weekOffset);
  const monthOffset = parsePastPeriodOffset(resolvedSearchParams.monthOffset);
  const yearOffset = parsePastPeriodOffset(resolvedSearchParams.yearOffset);
  const selectedWeekStart = addDays(currentWeekStart, weekOffset * 7);
  const selectedWeekEnd = weekOffset === 0 ? today : addDays(selectedWeekStart, 6);
  const selectedMonthStart = addMonths(currentMonthStart, monthOffset);
  const selectedMonthEnd = monthOffset === 0 ? today : endOfMonth(selectedMonthStart);
  const selectedYearStart = addYears(currentYearStart, yearOffset);
  const selectedYearEnd = yearOffset === 0 ? today : endOfYear(selectedYearStart);
  const weeklyWindowStart = addDays(currentWeekStart, -11 * 7);
  const queryStart = minDate(
    weeklyWindowStart,
    currentYearStart,
    selectedWeekStart,
    selectedMonthStart,
    selectedYearStart,
  );

  const { data: completedLessonsResult } = await supabaseAdmin
    .from("tutor_student_lessons")
    .select(
      "id, student_id, lesson_date, start_time, end_time, price_cents, student_profile:profiles!tutor_student_lessons_student_id_fkey(full_name, email)",
    )
    .eq("tutor_id", userId)
    .eq("status", "completed")
    .gte("lesson_date", toIsoDate(queryStart))
    .lte("lesson_date", toIsoDate(today))
    .order("lesson_date", { ascending: true });

  const completedLessons = mapPerformanceLessons(
    (completedLessonsResult ?? []) as CompletedPerformanceLessonRow[],
  );
  const firstLessonDate = completedLessons[0]
    ? parseLessonDate(completedLessons[0].lessonDate)
    : null;
  const currentYearLessons = completedLessons.filter(
    (lesson) =>
      parseLessonDate(lesson.lessonDate).getTime() >= currentYearStart.getTime(),
  );
  const assignedStudentCurrentYearLessons = currentYearLessons.filter(
    hasAssignedStudent,
  );
  const weeklyTrend = buildWeeklyTrend(completedLessons, today);
  const monthlyTrend = buildMonthlyTrend(completedLessons, today);
  const dailyTrend = buildDailyTrend(completedLessons, today);
  const weekCount = countLessonsInRange(
    completedLessons,
    selectedWeekStart,
    selectedWeekEnd,
  );
  const monthCount = countLessonsInRange(
    completedLessons,
    selectedMonthStart,
    selectedMonthEnd,
  );
  const yearCount = countLessonsInRange(
    completedLessons,
    selectedYearStart,
    selectedYearEnd,
  );
  const weekEarningsCents = sumLessonEarningsInRange(
    completedLessons,
    selectedWeekStart,
    selectedWeekEnd,
  );
  const monthEarningsCents = sumLessonEarningsInRange(
    completedLessons,
    selectedMonthStart,
    selectedMonthEnd,
  );
  const yearEarningsCents = sumLessonEarningsInRange(
    completedLessons,
    selectedYearStart,
    selectedYearEnd,
  );
  const topStudents = Array.from(
    assignedStudentCurrentYearLessons.reduce((map, lesson) => {
      const current = map.get(lesson.studentId);
      if (current) {
        current.lessons += 1;
      } else {
        map.set(lesson.studentId, {
          id: lesson.studentId,
          name: lesson.studentName,
          lessons: 1,
        });
      }

      return map;
    }, new Map<string, { id: string; name: string; lessons: number }>()),
  )
    .map(([, value]) => ({
      ...value,
      share:
        assignedStudentCurrentYearLessons.length > 0
          ? Math.round(
              (value.lessons / assignedStudentCurrentYearLessons.length) * 100,
            )
          : 0,
    }))
    .sort(
      (left, right) =>
        right.lessons - left.lessons ||
        left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    )
    .slice(0, 5);

  const busiestWeek = weeklyTrend.reduce(
    (best, item) => (item.lessons > best.lessons ? item : best),
    weeklyTrend[weeklyTrend.length - 1] ?? {
      label: "-",
      lessons: 0,
      description: "No activity",
    },
  );
  const busiestMonth = monthlyTrend.reduce(
    (best, item) => (item.lessons > best.lessons ? item : best),
    monthlyTrend[monthlyTrend.length - 1] ?? {
      label: "-",
      lessons: 0,
      description: "No activity",
    },
  );
  const activeStudentsCount = new Set(
    assignedStudentCurrentYearLessons.map((lesson) => lesson.studentId),
  ).size;
  const rollingWeeklyAverage =
    weeklyTrend.length > 0
      ? (
          weeklyTrend.reduce((total, item) => total + item.lessons, 0) /
          weeklyTrend.length
        ).toFixed(1)
      : "0.0";
  const monthTotalHours = sumLessonHoursInRange(
    completedLessons,
    selectedMonthStart,
    selectedMonthEnd,
  );
  const selectedYearTotalHours = sumLessonHoursInRange(
    completedLessons,
    selectedYearStart,
    selectedYearEnd,
  );
  const currentYearTotalHours = sumLessonHoursInRange(
    completedLessons,
    currentYearStart,
    today,
  );
  const daysSinceMonthStart = countDaysInRange(
    selectedMonthStart,
    selectedMonthEnd,
  );
  const daysInSelectedYear = countDaysInRange(selectedYearStart, selectedYearEnd);
  const daysSinceCurrentYearStart = countDaysInRange(currentYearStart, today);
  const workdaysSinceMonthStart = countWeekdaysInRange(
    selectedMonthStart,
    selectedMonthEnd,
  );
  const workdaysInSelectedYear = countWeekdaysInRange(
    selectedYearStart,
    selectedYearEnd,
  );
  const workdaysSinceCurrentYearStart = countWeekdaysInRange(
    currentYearStart,
    today,
  );
  const averageLessonsPerMonthWeek =
    daysSinceMonthStart > 0 ? (monthCount * 7) / daysSinceMonthStart : 0;
  const averageLessonsPerYearWeek =
    daysInSelectedYear > 0 ? (yearCount * 7) / daysInSelectedYear : 0;
  const averageMonthHoursPerDay =
    daysSinceMonthStart > 0 ? monthTotalHours / daysSinceMonthStart : 0;
  const averageMonthHoursPerWorkday =
    workdaysSinceMonthStart > 0 ? monthTotalHours / workdaysSinceMonthStart : 0;
  const selectedYearAverageHoursPerDay =
    daysInSelectedYear > 0 ? selectedYearTotalHours / daysInSelectedYear : 0;
  const selectedYearAverageHoursPerWorkday =
    workdaysInSelectedYear > 0
      ? selectedYearTotalHours / workdaysInSelectedYear
      : 0;
  const averageHoursPerDay =
    daysSinceCurrentYearStart > 0
      ? currentYearTotalHours / daysSinceCurrentYearStart
      : 0;
  const averageHoursPerWorkday =
    workdaysSinceCurrentYearStart > 0
      ? currentYearTotalHours / workdaysSinceCurrentYearStart
      : 0;
  const performancePathname = "/lessons/performance";
  const canGoToPreviousWeek = firstLessonDate
    ? selectedWeekStart.getTime() > startOfWeek(firstLessonDate).getTime()
    : false;
  const canGoToPreviousMonth = firstLessonDate
    ? selectedMonthStart.getTime() > startOfMonth(firstLessonDate).getTime()
    : false;
  const canGoToPreviousYear = firstLessonDate
    ? selectedYearStart.getTime() > startOfYear(firstLessonDate).getTime()
    : false;

  return (
    <div className="space-y-6">
      <LessonsPageHeader
        role={role}
        currentSection="performance"
        title={messages.lessons.title}
        description={messages.lessons.performanceDescription}
        scheduleHref={`/lessons?month=${formatLessonMonthParam(today)}`}
        actions={
          <>
            <Badge variant="secondary">{messages.lessons.tutorOnlyBadge}</Badge>
            <Badge variant="outline">
              {messages.lessons.performanceYearBadge}
            </Badge>
          </>
        }
      />

      <TutorPerformanceDashboard
        periodMetrics={[
          {
            label: `${formatShortDate(selectedWeekStart)} - ${formatShortDate(selectedWeekEnd)}`,
            value: weekCount,
            earningsCents: weekEarningsCents,
            helper: getMetricLabel("week"),
            iconKey: "week",
            accentClassName: "bg-[var(--color-chart-1)]/18",
            previousHref: canGoToPreviousWeek
              ? buildPerformancePageHref(
                  performancePathname,
                  resolvedSearchParams,
                  "weekOffset",
                  weekOffset - 1,
                )
              : undefined,
            nextHref:
              weekOffset < 0
                ? buildPerformancePageHref(
                    performancePathname,
                    resolvedSearchParams,
                    "weekOffset",
                    Math.min(weekOffset + 1, 0),
                  )
                : undefined,
            previousAriaLabel: "View previous week",
            nextAriaLabel: "View next week",
          },
          {
            label: formatLongMonthLabel(selectedMonthStart),
            value: monthCount,
            earningsCents: monthEarningsCents,
            helper: getMetricLabel("month"),
            iconKey: "month",
            accentClassName: "bg-[var(--color-chart-2)]/18",
            previousHref: canGoToPreviousMonth
              ? buildPerformancePageHref(
                  performancePathname,
                  resolvedSearchParams,
                  "monthOffset",
                  monthOffset - 1,
                )
              : undefined,
            nextHref:
              monthOffset < 0
                ? buildPerformancePageHref(
                    performancePathname,
                    resolvedSearchParams,
                    "monthOffset",
                    Math.min(monthOffset + 1, 0),
                  )
                : undefined,
            previousAriaLabel: "View previous month",
            nextAriaLabel: "View next month",
            stats: [
              {
                label: "Avg / week",
                value: formatLessonAverage(averageLessonsPerMonthWeek),
              },
              {
                label: "Avg hrs / day",
                value: formatHours(averageMonthHoursPerDay),
              },
              {
                label: "5-day avg",
                value: formatHours(averageMonthHoursPerWorkday),
              },
            ],
          },
          {
            label: String(selectedYearStart.getFullYear()),
            value: yearCount,
            earningsCents: yearEarningsCents,
            helper: getMetricLabel("year"),
            iconKey: "year",
            accentClassName: "bg-[var(--color-chart-3)]/18",
            previousHref: canGoToPreviousYear
              ? buildPerformancePageHref(
                  performancePathname,
                  resolvedSearchParams,
                  "yearOffset",
                  yearOffset - 1,
                )
              : undefined,
            nextHref:
              yearOffset < 0
                ? buildPerformancePageHref(
                    performancePathname,
                    resolvedSearchParams,
                    "yearOffset",
                    Math.min(yearOffset + 1, 0),
                  )
                : undefined,
            previousAriaLabel: "View previous year",
            nextAriaLabel: "View next year",
            stats: [
              {
                label: "Avg / week",
                value: formatLessonAverage(averageLessonsPerYearWeek),
              },
              {
                label: "Avg hrs / day",
                value: formatHours(selectedYearAverageHoursPerDay),
              },
              {
                label: "5-day avg",
                value: formatHours(selectedYearAverageHoursPerWorkday),
              },
            ],
          },
        ]}
        weeklyTrend={weeklyTrend}
        monthlyTrend={monthlyTrend}
        dailyTrend={dailyTrend}
        topStudents={topStudents}
        insights={[
          {
            label: "Best week",
            value:
              busiestWeek.lessons > 0
                ? `${busiestWeek.lessons} in ${busiestWeek.label}`
                : "No activity yet",
          },
          {
            label: "Best month",
            value:
              busiestMonth.lessons > 0
                ? `${busiestMonth.lessons} in ${busiestMonth.label}`
                : "No activity yet",
          },
          {
            label: "12-wk avg",
            value: `${rollingWeeklyAverage} lessons`,
          },
          {
            label: "Avg hrs / day",
            value: formatHours(averageHoursPerDay),
          },
          {
            label: "Avg hrs / day (5-day week)",
            value: formatHours(averageHoursPerWorkday),
          },
          {
            label: "Students taught",
            value: `${activeStudentsCount}`,
          },
        ]}
        formulaMetrics={{
          yearLabel: today.getFullYear(),
          rangeLabel: `${formatFormulaDate(currentYearStart)} - ${formatFormulaDate(today)}`,
          totalHoursLabel: formatHours(currentYearTotalHours),
          calendarDays: daysSinceCurrentYearStart,
          weekdayDays: workdaysSinceCurrentYearStart,
          averageHoursPerDayLabel: formatHours(averageHoursPerDay),
          averageHoursPerWorkdayLabel: formatHours(averageHoursPerWorkday),
        }}
        hasCompletedLessons={completedLessons.length > 0}
      />
    </div>
  );
}
