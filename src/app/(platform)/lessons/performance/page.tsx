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

function addDays(date: Date, amount: number) {
  const next = stripTime(date);
  next.setDate(next.getDate() + amount);
  return next;
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

export default async function LessonsPerformancePage() {
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
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const weeklyWindowStart = addDays(startOfWeek(today), -11 * 7);
  const queryStart =
    weeklyWindowStart.getTime() < yearStart.getTime()
      ? weeklyWindowStart
      : yearStart;

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
  const weekStart = startOfWeek(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearLessons = completedLessons.filter(
    (lesson) =>
      parseLessonDate(lesson.lessonDate).getTime() >= yearStart.getTime(),
  );
  const assignedStudentYearLessons = yearLessons.filter(hasAssignedStudent);
  const weeklyTrend = buildWeeklyTrend(completedLessons, today);
  const monthlyTrend = buildMonthlyTrend(completedLessons, today);
  const dailyTrend = buildDailyTrend(completedLessons, today);
  const weekCount = countLessonsInRange(completedLessons, weekStart, today);
  const monthCount = countLessonsInRange(completedLessons, monthStart, today);
  const yearCount = yearLessons.length;
  const monthLessons = completedLessons.filter(
    (lesson) =>
      parseLessonDate(lesson.lessonDate).getTime() >= monthStart.getTime(),
  );
  const weekEarningsCents = sumLessonEarningsInRange(
    completedLessons,
    weekStart,
    today,
  );
  const monthEarningsCents = sumLessonEarningsInRange(
    completedLessons,
    monthStart,
    today,
  );
  const yearEarningsCents = sumLessonEarningsInRange(
    yearLessons,
    yearStart,
    today,
  );
  const topStudents = Array.from(
    assignedStudentYearLessons.reduce((map, lesson) => {
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
        assignedStudentYearLessons.length > 0
          ? Math.round((value.lessons / assignedStudentYearLessons.length) * 100)
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
    assignedStudentYearLessons.map((lesson) => lesson.studentId),
  ).size;
  const rollingWeeklyAverage =
    weeklyTrend.length > 0
      ? (
          weeklyTrend.reduce((total, item) => total + item.lessons, 0) /
          weeklyTrend.length
        ).toFixed(1)
      : "0.0";
  const monthTotalHours = sumLessonHoursInRange(
    monthLessons,
    monthStart,
    today,
  );
  const yearTotalHours = sumLessonHoursInRange(yearLessons, yearStart, today);
  const daysSinceMonthStart = countDaysInRange(monthStart, today);
  const daysSinceYearStart = countDaysInRange(yearStart, today);
  const workdaysSinceMonthStart = countWeekdaysInRange(monthStart, today);
  const workdaysSinceYearStart = countWeekdaysInRange(yearStart, today);
  const averageLessonsPerMonthWeek =
    daysSinceMonthStart > 0 ? (monthCount * 7) / daysSinceMonthStart : 0;
  const averageLessonsPerYearWeek =
    daysSinceYearStart > 0 ? (yearCount * 7) / daysSinceYearStart : 0;
  const averageMonthHoursPerDay =
    daysSinceMonthStart > 0 ? monthTotalHours / daysSinceMonthStart : 0;
  const averageMonthHoursPerWorkday =
    workdaysSinceMonthStart > 0 ? monthTotalHours / workdaysSinceMonthStart : 0;
  const averageHoursPerDay =
    daysSinceYearStart > 0 ? yearTotalHours / daysSinceYearStart : 0;
  const averageHoursPerWorkday =
    workdaysSinceYearStart > 0 ? yearTotalHours / workdaysSinceYearStart : 0;

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
            label: "This Week",
            value: weekCount,
            earningsCents: weekEarningsCents,
            helper: `${formatShortDate(weekStart)} - ${formatShortDate(today)}`,
            iconKey: "week",
            accentClassName: "bg-[var(--color-chart-1)]/18",
          },
          {
            label: "This Month",
            value: monthCount,
            earningsCents: monthEarningsCents,
            helper: formatLongMonthLabel(monthStart),
            iconKey: "month",
            accentClassName: "bg-[var(--color-chart-2)]/18",
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
            label: "This Year",
            value: yearCount,
            earningsCents: yearEarningsCents,
            helper: String(today.getFullYear()),
            iconKey: "year",
            accentClassName: "bg-[var(--color-chart-3)]/18",
            stats: [
              {
                label: "Avg / week",
                value: formatLessonAverage(averageLessonsPerYearWeek),
              },
              {
                label: "Avg hrs / day",
                value: formatHours(averageHoursPerDay),
              },
              {
                label: "5-day avg",
                value: formatHours(averageHoursPerWorkday),
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
          rangeLabel: `${formatFormulaDate(yearStart)} - ${formatFormulaDate(today)}`,
          totalHoursLabel: formatHours(yearTotalHours),
          calendarDays: daysSinceYearStart,
          weekdayDays: workdaysSinceYearStart,
          averageHoursPerDayLabel: formatHours(averageHoursPerDay),
          averageHoursPerWorkdayLabel: formatHours(averageHoursPerWorkday),
        }}
        hasCompletedLessons={completedLessons.length > 0}
      />
    </div>
  );
}
