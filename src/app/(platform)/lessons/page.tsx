import { createAdminClient } from "@/lib/supabase/admin";
import { LessonsScheduleClient } from "@/components/lessons/lessons-schedule-client";
import {
  formatLessonMonthParam,
  getLessonDisplayTitle,
  getLessonsLeft,
  normalizeLessonMonthParam,
  type LessonBalanceHistoryEntry,
  type LessonBalanceSummaryItem,
  type MonthlyLessonItem,
} from "@/lib/lessons";
import { getAppMessages } from "@/lib/i18n/messages";
import { autoCompleteOverduePlannedLessons } from "@/lib/lessons-server";
import {
  getGoogleCalendarConnectionSummary,
  isGoogleCalendarSyncConfigured,
} from "@/lib/google-calendar";
import { getLessonsViewerAccess } from "@/lib/lessons-access";

interface SearchParams {
  month?: string;
}

interface StudentConnectionRow {
  student_id: string;
  lesson_price_cents: number;
  student_profile: {
    full_name: string | null;
    email: string;
  } | null;
}

interface StudentTutorConnectionRow {
  tutor_id: string;
  lesson_price_cents: number;
  tutor_profile: {
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

interface TutorLessonRow {
  id: string;
  student_id: string | null;
  title: string | null;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  status: "planned" | "completed" | "cancelled";
  price_cents: number;
  meet_url?: string | null;
  student_profile: {
    full_name: string | null;
    email: string;
  } | null;
}

interface StudentLessonRow {
  id: string;
  title: string | null;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  status: "planned" | "completed" | "cancelled";
  price_cents: number;
  meet_url?: string | null;
  tutor_profile: {
    full_name: string | null;
    email: string;
  } | null;
}

interface GoogleCalendarConnectionStatusRow {
  googleEmail: string | null;
  calendarId: string;
  connectedAt: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

function mapTutorLessons(rows: TutorLessonRow[]): MonthlyLessonItem[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    lessonDate: row.lesson_date,
    startTime: row.start_time,
    endTime: row.end_time,
    notes: row.notes,
    status: row.status,
    priceCents: row.price_cents,
    studentId: row.student_id,
    participantName:
      row.student_profile?.full_name ||
      row.student_profile?.email ||
      "One-time",
    participantLabel: row.student_id ? "Student" : "Type",
    meetUrl: row.meet_url ?? null,
  }));
}

function mapStudentLessons(rows: StudentLessonRow[]): MonthlyLessonItem[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    lessonDate: row.lesson_date,
    startTime: row.start_time,
    endTime: row.end_time,
    notes: row.notes,
    status: row.status,
    priceCents: row.price_cents,
    participantName:
      row.tutor_profile?.full_name || row.tutor_profile?.email || "Tutor",
    participantLabel: "Tutor",
    meetUrl: row.meet_url ?? null,
  }));
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
    id: string;
    name: string;
    label: string;
    lessonPriceCents: number;
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
      participantId: participant.id,
      participantName: participant.name,
      participantLabel: participant.label,
      lessonPriceCents: participant.lessonPriceCents,
      totalAmountPaidCents,
      balanceCents,
      lessonsLeft: getLessonsLeft(balanceCents, participant.lessonPriceCents),
      historyEntries: historyByKey.get(participant.id) ?? [],
    } satisfies LessonBalanceSummaryItem;
  });
}

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const month = normalizeLessonMonthParam(resolvedSearchParams.month);
  const initialMonthParam = formatLessonMonthParam(month);
  const { userId, role, appLanguage } = await getLessonsViewerAccess();
  const messages = getAppMessages(appLanguage);
  const supabaseAdmin = createAdminClient();

  await autoCompleteOverduePlannedLessons(
    role === "student"
      ? { studentId: userId, supabaseAdmin }
      : { tutorId: userId, supabaseAdmin },
  );

  if (role === "student") {
    const [
      { data: lessonsResult },
      { data: connectionsResult },
      { data: topUpsResult },
      { data: completedLessonsResult },
    ] = await Promise.all([
      supabaseAdmin
        .from("tutor_student_lessons")
        .select(
          "id, title, lesson_date, start_time, end_time, notes, status, price_cents, meet_url, tutor_profile:profiles!tutor_student_lessons_tutor_id_fkey(full_name, email)",
        )
        .eq("student_id", userId)
        .order("lesson_date", { ascending: true })
        .order("start_time", { ascending: true }),
      supabaseAdmin
        .from("tutor_students")
        .select(
          "tutor_id, lesson_price_cents, tutor_profile:profiles!tutor_students_tutor_id_fkey(full_name, email)",
        )
        .eq("student_id", userId)
        .eq("status", "active"),
      supabaseAdmin
        .from("tutor_student_balance_transactions")
        .select("id, tutor_id, student_id, amount_cents, note, created_at")
        .eq("student_id", userId),
      supabaseAdmin
        .from("tutor_student_lessons")
        .select("id, tutor_id, student_id, title, lesson_date, price_cents")
        .eq("student_id", userId)
        .eq("status", "completed"),
    ]);

    const allLessons = mapStudentLessons(
      (lessonsResult ?? []) as StudentLessonRow[],
    );
    const tutorConnections = (connectionsResult ??
      []) as StudentTutorConnectionRow[];
    const balanceTransactions = (topUpsResult ??
      []) as LessonBalanceTransactionRow[];
    const completedLessonCharges = (completedLessonsResult ??
      []) as CompletedLessonChargeRow[];
    const lessonBalanceSummaries = buildLessonBalanceSummaries(
      tutorConnections
        .map((row) => ({
          id: row.tutor_id,
          name:
            row.tutor_profile?.full_name || row.tutor_profile?.email || "Tutor",
          label: "Tutor",
          lessonPriceCents: row.lesson_price_cents,
        }))
        .sort((left, right) =>
          left.name.localeCompare(right.name, undefined, {
            sensitivity: "base",
          }),
        ),
      buildTotalsByKey(balanceTransactions, "tutor_id", "amount_cents"),
      buildTotalsByKey(completedLessonCharges, "tutor_id", "price_cents"),
      buildBalanceHistoryByKey(
        balanceTransactions,
        completedLessonCharges,
        "tutor_id",
      ),
    );

    return (
      <LessonsScheduleClient
        role={role}
        initialMonthParam={initialMonthParam}
        title={messages.lessons.title}
        description={messages.lessons.scheduleDescription}
        previousLabel={messages.common.previous}
        nextLabel={messages.common.next}
        allLessons={allLessons}
        studentTutorCount={tutorConnections.length}
        studentBalanceSummaries={lessonBalanceSummaries}
      />
    );
  }

  const [
    { data: connectionsResult },
    { data: lessonsResult },
    googleCalendarConnectionResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("tutor_students")
      .select(
        "student_id, lesson_price_cents, student_profile:profiles!tutor_students_student_id_fkey(full_name, email)",
      )
      .eq("tutor_id", userId)
      .eq("status", "active")
      .is("archived_at", null),
    supabaseAdmin
      .from("tutor_student_lessons")
      .select(
        "id, student_id, title, lesson_date, start_time, end_time, notes, status, price_cents, meet_url, student_profile:profiles!tutor_student_lessons_student_id_fkey(full_name, email)",
      )
      .eq("tutor_id", userId)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true }),
    getGoogleCalendarConnectionSummary(userId, supabaseAdmin),
  ]);

  const connectedStudents = (
    (connectionsResult ?? []) as StudentConnectionRow[]
  )
    .map((row) => ({
      id: row.student_id,
      name:
        row.student_profile?.full_name ||
        row.student_profile?.email ||
        "Student",
      lessonPriceCents: row.lesson_price_cents,
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );

  const allLessons = mapTutorLessons((lessonsResult ?? []) as TutorLessonRow[]);
  const googleCalendarConnection = (googleCalendarConnectionResult ??
    null) as GoogleCalendarConnectionStatusRow | null;
  const isGoogleCalendarAvailable = isGoogleCalendarSyncConfigured();

  return (
    <LessonsScheduleClient
      role={role}
      initialMonthParam={initialMonthParam}
      title={messages.lessons.title}
      description={messages.lessons.scheduleDescription}
      previousLabel={messages.common.previous}
      nextLabel={messages.common.next}
      allLessons={allLessons}
      connectedStudents={connectedStudents}
      googleCalendarAvailable={isGoogleCalendarAvailable}
      googleCalendarConnection={googleCalendarConnection}
    />
  );
}
