import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
  UserCheck,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MonthlyLessonsCalendar } from "@/components/lessons/monthly-lessons-calendar";
import { CreateLessonDialog } from "@/components/lessons/create-lesson-dialog";
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
  getLessonMonthRange,
  normalizeLessonMonthParam,
  type MonthlyLessonItem,
} from "@/lib/lessons";
import type { Role } from "@/types/roles";

interface SearchParams {
  month?: string;
}

interface StudentConnectionRow {
  student_id: string;
  student_profile: {
    full_name: string | null;
    email: string;
  } | null;
}

interface TutorLessonRow {
  id: string;
  student_id: string;
  title: string;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  status: "planned" | "completed" | "cancelled";
  student_profile: {
    full_name: string | null;
    email: string;
  } | null;
}

interface StudentLessonRow {
  id: string;
  title: string;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  status: "planned" | "completed" | "cancelled";
  tutor_profile: {
    full_name: string | null;
    email: string;
  } | null;
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
    participantName:
      row.tutor_profile?.full_name || row.tutor_profile?.email || "Tutor",
    participantLabel: "Tutor",
  }));
}

function LessonsHeader({ month }: { month: Date }) {
  const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lessons</h1>
        <p className="text-muted-foreground">
          View lessons month by month and keep tutor/student sessions in one
          calendar.
        </p>
      </div>

      <div className="flex items-center gap-2 self-start md:self-auto">
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
      </div>
    </div>
  );
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

  const [{ data: lessonsResult }, { count: tutorCount }] = await Promise.all([
    supabaseAdmin
      .from("tutor_student_lessons")
      .select(
        "id, title, lesson_date, start_time, end_time, notes, status, tutor_profile:profiles!tutor_student_lessons_tutor_id_fkey(full_name, email)",
      )
      .eq("student_id", userId)
      .gte("lesson_date", startIsoDate)
      .lte("lesson_date", endIsoDate)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabaseAdmin
      .from("tutor_students")
      .select("id", { count: "exact", head: true })
      .eq("student_id", userId)
      .eq("status", "active"),
  ]);

  const lessons = mapStudentLessons(
    (lessonsResult ?? []) as StudentLessonRow[],
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
            <div className="text-2xl font-bold">{tutorCount ?? 0}</div>
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

  const [{ data: connectionsResult }, { data: lessonsResult }] =
    await Promise.all([
      supabaseAdmin
        .from("tutor_students")
        .select(
          "student_id, student_profile:profiles!tutor_students_student_id_fkey(full_name, email)",
        )
        .eq("tutor_id", userId)
        .eq("status", "active"),
      supabaseAdmin
        .from("tutor_student_lessons")
        .select(
          "id, student_id, title, lesson_date, start_time, end_time, notes, status, student_profile:profiles!tutor_student_lessons_student_id_fkey(full_name, email)",
        )
        .eq("tutor_id", userId)
        .gte("lesson_date", startIsoDate)
        .lte("lesson_date", endIsoDate)
        .order("lesson_date", { ascending: true })
        .order("start_time", { ascending: true }),
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
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );

  const lessons = mapTutorLessons((lessonsResult ?? []) as TutorLessonRow[]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
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
    </div>
  );
}

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const month = normalizeLessonMonthParam(resolvedSearchParams.month);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/dashboard");
  }

  const role = profile.role as Role;

  if (role !== "student" && role !== "tutor") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <LessonsHeader month={month} />
      {role === "student" ? (
        <StudentLessonsView userId={user.id} month={month} />
      ) : (
        <TutorLessonsView userId={user.id} month={month} />
      )}
    </div>
  );
}
