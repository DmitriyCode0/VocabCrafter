export const DEFAULT_LESSON_TIME_ZONE = "Europe/Kyiv";
export const USER_TIMEZONE_COOKIE_NAME = "vc_tz";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_HM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidIanaTimeZone(candidate?: string | null): boolean {
  if (!candidate) return false;
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

export function resolveLessonTimeZone(
  candidate?: string | null,
  fallback?: string | null,
): string {
  if (candidate && isValidIanaTimeZone(candidate)) {
    return candidate.trim();
  }
  if (fallback && isValidIanaTimeZone(fallback)) {
    return fallback.trim();
  }
  return DEFAULT_LESSON_TIME_ZONE;
}

export function getBrowserTimeZone(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidIanaTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

export function getShortTimeZoneLabel(
  date: Date = new Date(),
  timeZone?: string,
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      ...(timeZone && isValidIanaTimeZone(timeZone) ? { timeZone } : {}),
      timeZoneName: "short",
    }).formatToParts(date);
    return (
      parts.find((part) => part.type === "timeZoneName")?.value ??
      timeZone ??
      ""
    );
  } catch {
    return timeZone ?? "";
  }
}

function getZonedClockParts(date: Date, timeZone?: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    ...(timeZone && isValidIanaTimeZone(timeZone) ? { timeZone } : {}),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const readNum = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const year = readNum("year");
  const month = readNum("month");
  const day = readNum("day");
  const rawHour = readNum("hour");
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = readNum("minute");
  const second = readNum("second");

  return { year, month, day, hour, minute, second };
}

function getTimeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = getZonedClockParts(new Date(utcMs), timeZone);
  const zonedAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  );
  return zonedAsUtcMs - utcMs;
}

/**
 * Converts a local calendar date (`YYYY-MM-DD`) and wall-clock time (`HH:MM`)
 * in the specified IANA timezone into an exact UTC ISO string.
 */
export function zonedDateTimeToUtcIso(
  lessonDate: string,
  timeStr: string,
  timeZone: string,
): string | null {
  const dateMatch = lessonDate.trim().match(ISO_DATE_PATTERN);
  const timeMatch = timeStr.trim().match(TIME_HM_PATTERN);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const effectiveTz = resolveLessonTimeZone(timeZone);
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  const targetUtcBaseline = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const pass1 = targetUtcBaseline - getTimeZoneOffsetMs(targetUtcBaseline, effectiveTz);
  const pass2 = targetUtcBaseline - getTimeZoneOffsetMs(pass1, effectiveTz);

  return new Date(pass2).toISOString();
}

export function computeLessonUtcInstants({
  lessonDate,
  startTime,
  endTime,
  timeZone,
}: {
  lessonDate: string;
  startTime?: string | null;
  endTime?: string | null;
  timeZone?: string | null;
}): {
  timeZone: string;
  startAt: string | null;
  endAt: string | null;
} {
  const effectiveTz = resolveLessonTimeZone(timeZone);

  if (!startTime || !TIME_HM_PATTERN.test(startTime.trim())) {
    return {
      timeZone: effectiveTz,
      startAt: null,
      endAt: null,
    };
  }

  const cleanStart = startTime.trim();
  const startAt = zonedDateTimeToUtcIso(lessonDate, cleanStart, effectiveTz);
  if (!startAt) {
    return {
      timeZone: effectiveTz,
      startAt: null,
      endAt: null,
    };
  }

  let endAt: string | null = null;
  if (endTime && TIME_HM_PATTERN.test(endTime.trim())) {
    const cleanEnd = endTime.trim();
    if (cleanEnd > cleanStart) {
      endAt = zonedDateTimeToUtcIso(lessonDate, cleanEnd, effectiveTz);
    } else {
      const nextDay = new Date(`${lessonDate}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextDayIso = nextDay.toISOString().slice(0, 10);
      endAt = zonedDateTimeToUtcIso(nextDayIso, cleanEnd, effectiveTz);
    }
  } else {
    endAt = new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString();
  }

  return {
    timeZone: effectiveTz,
    startAt,
    endAt,
  };
}

function formatZonedPartsToDateAndTime(date: Date, timeZone?: string) {
  const parts = getZonedClockParts(date, timeZone);
  const isoDate = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const hm = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  return { isoDate, hm };
}

/**
 * Projects a lesson's UTC instants (`startAt` / `endAt`) into `targetTimeZone`
 * (or the viewer's device timezone when omitted). Falls back to stored wall-clock
 * strings when `startAt` is not available (e.g., all-day / TBA lessons).
 */
export function projectLessonToTimeZone(
  lesson: {
    lessonDate: string;
    startTime: string | null;
    endTime: string | null;
    startAt?: string | null;
    endAt?: string | null;
    timeZone?: string | null;
  },
  targetTimeZone?: string,
): {
  lessonDate: string;
  startTime: string | null;
  endTime: string | null;
  timeZoneLabel: string | null;
} {
  if (!lesson.startAt) {
    return {
      lessonDate: lesson.lessonDate,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      timeZoneLabel: null,
    };
  }

  const parsedStart = new Date(lesson.startAt);
  if (Number.isNaN(parsedStart.getTime())) {
    return {
      lessonDate: lesson.lessonDate,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      timeZoneLabel: null,
    };
  }

  const validTargetTz =
    targetTimeZone && isValidIanaTimeZone(targetTimeZone)
      ? targetTimeZone.trim()
      : undefined;

  const startLocal = formatZonedPartsToDateAndTime(parsedStart, validTargetTz);
  let endTimeLocal: string | null = lesson.endTime;

  if (lesson.endAt) {
    const parsedEnd = new Date(lesson.endAt);
    if (!Number.isNaN(parsedEnd.getTime())) {
      endTimeLocal = formatZonedPartsToDateAndTime(
        parsedEnd,
        validTargetTz,
      ).hm;
    }
  } else if (lesson.endTime === null) {
    endTimeLocal = null;
  }

  return {
    lessonDate: startLocal.isoDate,
    startTime: startLocal.hm,
    endTime: endTimeLocal,
    timeZoneLabel: getShortTimeZoneLabel(parsedStart, validTargetTz),
  };
}
