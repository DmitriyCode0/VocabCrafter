import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
  UserCheck,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleCalendarSyncCard } from "@/components/lessons/google-calendar-sync-card";
import { MonthlyLessonsCalendar } from "@/components/lessons/monthly-lessons-calendar";
import { LessonBalanceManager } from "@/components/lessons/lesson-balance-manager";
import { CreateLessonDialog } from "@/components/lessons/create-lesson-dialog";
import { LessonsPageHeader } from "@/components/lessons/lessons-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatLessonMonthLabel,
  formatLessonMonthParam,
  getLessonDisplayTitle,
  getLessonMonthRange,
  getLessonsLeft,
  normalizeLessonMonthParam,
  type LessonBalanceHistoryEntry,
  type LessonBalanceSummaryItem,
  type MonthlyLessonItem,
} from "@/lib/lessons";
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
  student_id: string;
  title: string | null;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  status: "planned" | "completed" | "cancelled";
  price_cents: number;
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

function buildMonthHref(monthDate: Date) {
  return `/lessons?month=${formatLessonMonthParam(monthDate)}`;
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
      row.student_profile?.full_name || row.student_profile?.email || "Student",
    participantLabel: "Student",
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

async function StudentLessonsView({
  userId,
  month,
}: {
  userId: string;
  month: Date;
}) {
  const supabaseAdmin = createAdminClient();
  const { startIsoDate, endIsoDate } = getLessonMonthRange(month);

  const [
    { data: lessonsResult },
    { data: connectionsResult },
    { data: topUpsResult },
    { data: completedLessonsResult },
  ] = await Promise.all([
    supabaseAdmin
      .from("tutor_student_lessons")
      .select(
        "id, title, lesson_date, start_time, end_time, notes, status, price_cents, tutor_profile:profiles!tutor_student_lessons_tutor_id_fkey(full_name, email)",
      )
      .eq("student_id", userId)
      .gte("lesson_date", startIsoDate)
      .lte("lesson_date", endIsoDate)
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

  const lessons = mapStudentLessons(
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
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Lessons This Month
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lessons.length}</div>
            <p className="text-xs text-muted-foreground">
              sessions visible in this month view
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Connected Tutors
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tutorConnections.length}</div>
            <p className="text-xs text-muted-foreground">
              tutors who can schedule lessons for you
            </p>
          </CardContent>
        </Card>
      </div>

      <MonthlyLessonsCalendar
        month={month}
        lessons={lessons}
        emptyMessage="No lessons are scheduled in this month yet. Your tutor will add them here."
      />

      {lessonBalanceSummaries.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Balances</h2>
            <p className="text-sm text-muted-foreground">
              See your prepaid balance, lesson price, and how many lessons each
              tutor balance currently covers.
            </p>
          </div>
          <LessonBalanceManager summaries={lessonBalanceSummaries} />
        </div>
      ) : null}
    </div>
  );
}

async function TutorLessonsView({
  userId,
  month,
}: {
  userId: string;
  month: Date;
}) {
  const supabaseAdmin = createAdminClient();
  const { startIsoDate, endIsoDate } = getLessonMonthRange(month);

  const [
    { data: connectionsResult },
    { data: lessonsResult },
    { data: topUpsResult },
    { data: completedLessonsResult },
    googleCalendarConnectionResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("tutor_students")
      .select(
        "student_id, lesson_price_cents, student_profile:profiles!tutor_students_student_id_fkey(full_name, email)",
      )
      .eq("tutor_id", userId)
      .eq("status", "active"),
    supabaseAdmin
      .from("tutor_student_lessons")
      .select(
        "id, student_id, title, lesson_date, start_time, end_time, notes, status, price_cents, student_profile:profiles!tutor_student_lessons_student_id_fkey(full_name, email)",
      )
      .eq("tutor_id", userId)
      .gte("lesson_date", startIsoDate)
      .lte("lesson_date", endIsoDate)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabaseAdmin
      .from("tutor_student_balance_transactions")
      .select("id, tutor_id, student_id, amount_cents, note, created_at")
      .eq("tutor_id", userId),
    supabaseAdmin
      .from("tutor_student_lessons")
      .select("id, tutor_id, student_id, title, lesson_date, price_cents")
      .eq("tutor_id", userId)
      .eq("status", "completed"),
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

  const lessons = mapTutorLessons((lessonsResult ?? []) as TutorLessonRow[]);
  const balanceTransactions = (topUpsResult ??
    []) as LessonBalanceTransactionRow[];
  const completedLessonCharges = (completedLessonsResult ??
    []) as CompletedLessonChargeRow[];
  const lessonBalanceSummaries = buildLessonBalanceSummaries(
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
  const googleCalendarConnection = (googleCalendarConnectionResult ??
    null) as GoogleCalendarConnectionStatusRow | null;
  const isGoogleCalendarAvailable = isGoogleCalendarSyncConfigured();
  const connectHref = `/api/google-calendar/connect?next=${encodeURIComponent(buildMonthHref(month))}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tutor Lesson Planner</CardTitle>
            <CardDescription>
              Add lessons for connected students so they appear on both
              calendars.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {connectedStudents.length} connected student
                {connectedStudents.length !== 1 ? "s" : ""}
              </span>
            </div>
            <CreateLessonDialog students={connectedStudents} />
          </CardContent>
        </Card>

        <GoogleCalendarSyncCard
          available={isGoogleCalendarAvailable}
          connectHref={connectHref}
          connection={googleCalendarConnection}
        />
      </div>

      <MonthlyLessonsCalendar
        month={month}
        lessons={lessons}
        emptyMessage={
          connectedStudents.length > 0
            ? "No lessons scheduled in this month yet. Add one to make it visible to the student."
            : "Connect a student first, then you can add lessons to the calendar."
        }
        canManageLessons
        studentOptions={connectedStudents}
      />

      {lessonBalanceSummaries.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Student Balances</h2>
            <p className="text-sm text-muted-foreground">
              Set a lesson price, record top-ups, and track how many lessons
              each student balance currently covers.
            </p>
          </div>
          <LessonBalanceManager summaries={lessonBalanceSummaries} canManage />
        </div>
      ) : null}
    </div>
  );
}

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const month = normalizeLessonMonthParam(resolvedSearchParams.month);
  const { userId, role } = await getLessonsViewerAccess();
  await autoCompleteOverduePlannedLessons(
    role === "student" ? { studentId: userId } : { tutorId: userId },
  );
  const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  return (
    <div className="space-y-6">
      <LessonsPageHeader
        role={role}
        currentSection="schedule"
        description="View lessons month by month and keep tutor and student sessions in one calendar."
        scheduleHref={buildMonthHref(month)}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={buildMonthHref(previousMonth)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Link>
            </Button>
            <Badge variant="outline" className="h-9 px-4 text-sm">
              {formatLessonMonthLabel(month)}
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href={buildMonthHref(nextMonth)}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />
      {role === "student" ? (
        <StudentLessonsView userId={userId} month={month} />
      ) : (
        <TutorLessonsView userId={userId} month={month} />
      )}
    </div>
  );
}
