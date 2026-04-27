import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLessonDisplayTitle,
  getLessonsLeft,
  type LessonBalanceHistoryEntry,
  type LessonBalanceSummaryItem,
} from "@/lib/lessons";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

interface StudentConnectionRow {
  student_id: string;
  lesson_price_cents: number;
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

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export async function autoCompleteOverduePlannedLessons({
  tutorId,
  studentId,
  supabaseAdmin = createAdminClient(),
}: {
  tutorId?: string;
  studentId?: string;
  supabaseAdmin?: SupabaseAdminClient;
}) {
  if (!tutorId && !studentId) {
    return;
  }

  const todayIsoDate = toIsoDate(new Date());
  const nowIso = new Date().toISOString();

  let query = supabaseAdmin
    .from("tutor_student_lessons")
    .update({
      status: "completed",
      updated_at: nowIso,
    })
    .eq("status", "planned")
    .lt("lesson_date", todayIsoDate);

  if (tutorId) {
    query = query.eq("tutor_id", tutorId);
  }

  if (studentId) {
    query = query.eq("student_id", studentId);
  }

  const { error } = await query;

  if (error) {
    throw error;
  }
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
        "student_id, lesson_price_cents, student_profile:profiles!tutor_students_student_id_fkey(full_name, email)",
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
  const balanceTransactions = (topUpsResult ?? []) as LessonBalanceTransactionRow[];
  const completedLessonCharges =
    (completedLessonsResult ?? []) as CompletedLessonChargeRow[];

  return buildLessonBalanceSummaries(
    connectedStudents.map((student) => ({
      id: student.id,
      name: student.name,
      label: "Student",
      lessonPriceCents: student.lessonPriceCents ?? 0,
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
