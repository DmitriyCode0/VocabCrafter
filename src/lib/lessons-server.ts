import "server-only";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLessonDisplayTitle,
  getLessonsLeft,
  type LessonBalanceHistoryEntry,
  type LessonBalanceSummaryItem,
} from "@/lib/lessons";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

interface StudentConnectionRow {
  id?: string;
  student_id: string;
  lesson_price_cents: number;
  archived_at?: string | null;
  student_profile: {
    full_name: string | null;
    email: string;
  } | null;
}

interface LessonBalanceTransactionRow {
  id: string;
  tutor_id: string;
  student_id: string;
  amount_cents: number;
  note: string | null;
  created_at: string;
}

interface CompletedLessonChargeRow {
  id: string;
  tutor_id: string;
  student_id: string;
  title: string | null;
  lesson_date: string;
  price_cents: number;
}

export const USER_TIMEZONE_COOKIE = "vc_tz";

interface PlannedLessonFinishCandidate {
  id: string;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  end_at?: string | null;
}

function resolveValidTimeZone(candidate?: string | null): string | undefined {
  if (!candidate) return undefined;
  const trimmed = candidate.trim();
  if (!trimmed) return undefined;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: trimmed });
    return trimmed;
  } catch {
    return undefined;
  }
}

async function getRequestTimeZone(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(USER_TIMEZONE_COOKIE)?.value;
    const decoded = raw ? decodeURIComponent(raw) : undefined;
    const fromCookie = resolveValidTimeZone(decoded);
    if (fromCookie) return fromCookie;
  } catch {
    // Ignore when called outside a request context
  }

  return resolveValidTimeZone(process.env.GOOGLE_CALENDAR_TIME_ZONE);
}

function parseMinutesOfDay(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return null;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return hour * 60 + minute;
}

function getLocalClockInTimeZone(
  now: Date,
  timeZone?: string,
): { todayIso: string; yesterdayIso: string; currentMinutes: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    ...(timeZone ? { timeZone } : {}),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const rawHour = getPart("hour");
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = getPart("minute");

  const todayIso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const yesterdayUtc = new Date(Date.UTC(year, month - 1, day - 1));
  const yesterdayIso = `${yesterdayUtc.getUTCFullYear()}-${String(yesterdayUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterdayUtc.getUTCDate()).padStart(2, "0")}`;

  return {
    todayIso,
    yesterdayIso,
    currentMinutes: hour * 60 + minute,
  };
}

function isPlannedLessonFinished(
  lesson: PlannedLessonFinishCandidate,
  clock: { todayIso: string; yesterdayIso: string; currentMinutes: number },
  nowMs: number,
): boolean {
  if (lesson.end_at) {
    const parsedEndAt = new Date(lesson.end_at);
    if (!Number.isNaN(parsedEndAt.getTime())) {
      return nowMs >= parsedEndAt.getTime();
    }
  }

  if (lesson.lesson_date > clock.todayIso) {
    return false;
  }

  const startMins = parseMinutesOfDay(lesson.start_time);
  const endMins = parseMinutesOfDay(lesson.end_time);

  let effectiveEndMins: number;
  let crossesMidnight = false;

  if (endMins !== null) {
    crossesMidnight = startMins !== null && endMins <= startMins;
    effectiveEndMins = endMins;
  } else if (startMins !== null) {
    crossesMidnight = startMins + 60 >= 1440;
    effectiveEndMins = (startMins + 60) % 1440;
  } else {
    return lesson.lesson_date < clock.todayIso;
  }

  if (lesson.lesson_date < clock.todayIso) {
    if (lesson.lesson_date === clock.yesterdayIso && crossesMidnight) {
      return clock.currentMinutes >= effectiveEndMins;
    }
    return true;
  }

  if (crossesMidnight) {
    return false;
  }

  return clock.currentMinutes >= effectiveEndMins;
}

function buildTotalsByKey<T extends object>(
  rows: T[],
  keyName: keyof T,
  amountName: keyof T,
) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const key = row[keyName];
    const amount = row[amountName];

    if (typeof key !== "string" || typeof amount !== "number") {
      continue;
    }

    totals.set(key, (totals.get(key) ?? 0) + amount);
  }

  return totals;
}

function buildBalanceHistoryByKey(
  transactions: LessonBalanceTransactionRow[],
  completedLessons: CompletedLessonChargeRow[],
  keyName: "student_id" | "tutor_id",
) {
  const history = new Map<string, LessonBalanceHistoryEntry[]>();

  for (const transaction of transactions) {
    const key = transaction[keyName];

    const entry: LessonBalanceHistoryEntry = {
      id: `transaction-${transaction.id}`,
      type: transaction.amount_cents >= 0 ? "payment" : "deduction",
      label:
        transaction.amount_cents >= 0 ? "Balance top-up" : "Balance deduction",
      description: transaction.note,
      amountCents: transaction.amount_cents,
      occurredAt: transaction.created_at,
    };

    const existing = history.get(key) ?? [];
    existing.push(entry);
    history.set(key, existing);
  }

  for (const lesson of completedLessons) {
    const key = lesson[keyName];
    const entry: LessonBalanceHistoryEntry = {
      id: `lesson-${lesson.id}`,
      type: "lesson",
      label: "Completed lesson",
      description: getLessonDisplayTitle(lesson.title),
      amountCents: -lesson.price_cents,
      occurredAt: lesson.lesson_date,
    };

    const existing = history.get(key) ?? [];
    existing.push(entry);
    history.set(key, existing);
  }

  for (const [key, entries] of history.entries()) {
    history.set(
      key,
      entries.sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime(),
      ),
    );
  }

  return history;
}

function buildLessonBalanceSummaries(
  participants: Array<{
    connectionId?: string;
    id: string;
    name: string;
    label: string;
    lessonPriceCents: number;
    archivedAt?: string | null;
  }>,
  totalAmountPaidTotals: Map<string, number>,
  completedSpendTotals: Map<string, number>,
  historyByKey: Map<string, LessonBalanceHistoryEntry[]>,
) {
  return participants.map((participant) => {
    const totalAmountPaidCents = totalAmountPaidTotals.get(participant.id) ?? 0;
    const totalCompletedSpendCents =
      completedSpendTotals.get(participant.id) ?? 0;
    const balanceCents = totalAmountPaidCents - totalCompletedSpendCents;

    return {
      connectionId: participant.connectionId,
      participantId: participant.id,
      participantName: participant.name,
      participantLabel: participant.label,
      lessonPriceCents: participant.lessonPriceCents,
      totalAmountPaidCents,
      balanceCents,
      lessonsLeft: getLessonsLeft(balanceCents, participant.lessonPriceCents),
      historyEntries: historyByKey.get(participant.id) ?? [],
      archivedAt: participant.archivedAt ?? null,
    } satisfies LessonBalanceSummaryItem;
  });
}

export async function autoCompleteOverduePlannedLessons({
  tutorId,
  studentId,
  timeZone,
  supabaseAdmin = createAdminClient(),
}: {
  tutorId?: string;
  studentId?: string;
  timeZone?: string | null;
  supabaseAdmin?: SupabaseAdminClient;
}): Promise<string[]> {
  if (!tutorId && !studentId) {
    return [];
  }

  const now = new Date();
  const effectiveTimeZone =
    resolveValidTimeZone(timeZone) ?? (await getRequestTimeZone());
  const clock = getLocalClockInTimeZone(now, effectiveTimeZone);
  const tomorrowUtc = new Date(`${clock.todayIso}T00:00:00Z`);
  tomorrowUtc.setUTCDate(tomorrowUtc.getUTCDate() + 1);
  const tomorrowIso = tomorrowUtc.toISOString().slice(0, 10);

  let selectQuery = supabaseAdmin
    .from("tutor_student_lessons")
    .select("id, lesson_date, start_time, end_time, end_at")
    .eq("status", "planned")
    .lte("lesson_date", tomorrowIso);

  if (tutorId) {
    selectQuery = selectQuery.eq("tutor_id", tutorId);
  }

  if (studentId) {
    selectQuery = selectQuery.eq("student_id", studentId);
  }

  const { data: candidates, error: selectError } = await selectQuery;

  if (selectError) {
    throw selectError;
  }

  const nowMs = now.getTime();
  const overdueIds = ((candidates ?? []) as PlannedLessonFinishCandidate[])
    .filter((row) => isPlannedLessonFinished(row, clock, nowMs))
    .map((row) => row.id);

  if (overdueIds.length === 0) {
    return [];
  }

  const { error: updateError } = await supabaseAdmin
    .from("tutor_student_lessons")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .in("id", overdueIds)
    .eq("status", "planned");

  if (updateError) {
    throw updateError;
  }

  return overdueIds;
}

export async function getTutorLessonBalanceSummaries(
  tutorId: string,
  supabaseAdmin = createAdminClient(),
) {
  const [
    { data: connectionsResult, error: connectionsError },
    { data: topUpsResult, error: topUpsError },
    { data: completedLessonsResult, error: completedLessonsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("tutor_students")
      .select(
        "id, student_id, lesson_price_cents, archived_at, student_profile:profiles!tutor_students_student_id_fkey(full_name, email)",
      )
      .eq("tutor_id", tutorId)
      .eq("status", "active"),
    supabaseAdmin
      .from("tutor_student_balance_transactions")
      .select("id, tutor_id, student_id, amount_cents, note, created_at")
      .eq("tutor_id", tutorId),
    supabaseAdmin
      .from("tutor_student_lessons")
      .select("id, tutor_id, student_id, title, lesson_date, price_cents")
      .eq("tutor_id", tutorId)
      .eq("status", "completed"),
  ]);

  if (connectionsError) {
    throw connectionsError;
  }

  if (topUpsError) {
    throw topUpsError;
  }

  if (completedLessonsError) {
    throw completedLessonsError;
  }

  const connectedStudents = ((connectionsResult ?? []) as StudentConnectionRow[])
    .map((row) => ({
      connectionId: row.id,
      id: row.student_id,
      name:
        row.student_profile?.full_name ||
        row.student_profile?.email ||
        "Student",
      lessonPriceCents: row.lesson_price_cents,
      archivedAt: row.archived_at ?? null,
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );
  const balanceTransactions = (topUpsResult ?? []) as LessonBalanceTransactionRow[];
  const completedLessonCharges =
    (completedLessonsResult ?? []) as CompletedLessonChargeRow[];

  return buildLessonBalanceSummaries(
    connectedStudents.map((student) => ({
      connectionId: student.connectionId,
      id: student.id,
      name: student.name,
      label: "Student",
      lessonPriceCents: student.lessonPriceCents ?? 0,
      archivedAt: student.archivedAt,
    })),
    buildTotalsByKey(balanceTransactions, "student_id", "amount_cents"),
    buildTotalsByKey(completedLessonCharges, "student_id", "price_cents"),
    buildBalanceHistoryByKey(
      balanceTransactions,
      completedLessonCharges,
      "student_id",
    ),
  );
}
