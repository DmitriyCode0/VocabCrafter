import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { AssignmentsPageHeader } from "@/components/assignments/assignments-page-header";
import {
  TutorHomeworkClient,
  type FormalClassAssignmentItem,
  type HomeworkAttemptItem,
  type RegularityDayItem,
  type StudentHomeworkItem,
} from "@/components/assignments/tutor-homework-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { ACTIVITY_LABELS } from "@/lib/constants";
import { PagePagination } from "@/components/shared/page-pagination";
import {
  normalizeAppLanguage,
  type AppLanguage,
} from "@/lib/i18n/app-language";
import { getAppMessages, type AppMessages } from "@/lib/i18n/messages";
import { getCurrentPage, getPaginationRange } from "@/lib/pagination";
import { formatDateForAppLanguage } from "@/lib/i18n/format";
import {
  getGrammarTopicDisplayName,
  getPrimaryGrammarTopic,
} from "@/lib/utils";
import type { Role } from "@/types/roles";

export const dynamic = "force-dynamic";

const ASSIGNMENTS_PAGE_SIZE = 10;

function getActivityLabel(
  messages: AppMessages,
  type: string | null | undefined,
) {
  if (!type) {
    return "";
  }

  return (
    messages.quizzes.typeLabels[
      type as keyof typeof messages.quizzes.typeLabels
    ] ||
    messages.createQuiz.activityLabels[
      type as keyof typeof messages.createQuiz.activityLabels
    ] ||
    messages.createQuiz.quizWordPicker.typeLabels[
      type as keyof typeof messages.createQuiz.quizWordPicker.typeLabels
    ] ||
    ACTIVITY_LABELS[type] ||
    type
  );
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface TutorStudentConnectionRow {
  student_id: string;
  student_profile: {
    id: string;
    full_name: string | null;
    email: string;
    cefr_level: string | null;
  } | null;
}

interface TutorLessonRow {
  student_id: string | null;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  status: "planned" | "completed" | "cancelled";
}

interface StudentQuizAttemptRow {
  id: string;
  student_id: string;
  quiz_id: string;
  score: number | null;
  max_score: number | null;
  time_spent_seconds: number | null;
  completed_at: string;
  quizzes: {
    id: string;
    title: string;
    type: string;
    cefr_level: string | null;
    vocabulary_terms: Array<{ term?: string }> | null;
    config: unknown;
  } | null;
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const currentPage = getCurrentPage(resolvedSearchParams.page);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, app_language")
    .eq("id", user.id)
    .single();

  const role = (profile?.role ?? "student") as Role;
  const appLanguage = normalizeAppLanguage(profile?.app_language);
  const messages = getAppMessages(appLanguage);

  if (role === "student") {
    return (
      <StudentAssignments
        supabaseUserId={user.id}
        currentPage={currentPage}
        searchParams={resolvedSearchParams}
        appLanguage={appLanguage}
        messages={messages}
      />
    );
  }

  const supabaseAdmin = createAdminClient();
  const now = new Date();
  const todayIso = toLocalIsoDate(now);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const weekdayLocale = appLanguage === "uk" ? "uk-UA" : "en-GB";

  const [
    { data: connectionsData },
    { data: lessonsData },
    { data: assignmentsData },
  ] = await Promise.all([
    supabaseAdmin
      .from("tutor_students")
      .select(
        "student_id, student_profile:profiles!tutor_students_student_id_fkey(id, full_name, email, cefr_level)",
      )
      .eq("tutor_id", user.id)
      .eq("status", "active")
      .is("archived_at", null),
    supabaseAdmin
      .from("tutor_student_lessons")
      .select("student_id, lesson_date, start_time, end_time, status")
      .eq("tutor_id", user.id)
      .neq("status", "cancelled")
      .not("student_id", "is", null)
      .order("lesson_date", { ascending: false })
      .order("start_time", { ascending: false }),
    supabase
      .from("assignments")
      .select("*, classes(name, id), quizzes(title, type)")
      .eq("tutor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const activeConnections = (
    (connectionsData ?? []) as TutorStudentConnectionRow[]
  ).filter((row) => row.student_id !== user.id);

  const activeStudentIds = Array.from(
    new Set(activeConnections.map((row) => row.student_id)),
  );

  const { data: attemptsData } =
    activeStudentIds.length > 0
      ? await supabaseAdmin
          .from("quiz_attempts")
          .select(
            "id, student_id, quiz_id, score, max_score, time_spent_seconds, completed_at, quizzes(id, title, type, cefr_level, vocabulary_terms, config)",
          )
          .in("student_id", activeStudentIds)
          .gte("completed_at", sixtyDaysAgo.toISOString())
          .order("completed_at", { ascending: false })
      : { data: [] as StudentQuizAttemptRow[] };

  // Build last completed lesson & next planned lesson maps per student
  const lastCompletedLessonByStudent = new Map<
    string,
    { lessonDate: string; cutoffMs: number }
  >();
  const nextPlannedLessonByStudent = new Map<
    string,
    { lessonDate: string; startTime: string | null }
  >();

  for (const lesson of (lessonsData ?? []) as TutorLessonRow[]) {
    if (!lesson.student_id) continue;

    if (
      lesson.status === "completed" &&
      !lastCompletedLessonByStudent.has(lesson.student_id)
    ) {
      const endTimePart = lesson.end_time ? `${lesson.end_time}:00` : "23:59:59";
      const parsedMs = new Date(`${lesson.lesson_date}T${endTimePart}`).getTime();
      const cutoffMs = Number.isFinite(parsedMs)
        ? parsedMs
        : new Date(`${lesson.lesson_date}T23:59:59`).getTime();
      lastCompletedLessonByStudent.set(lesson.student_id, {
        lessonDate: lesson.lesson_date,
        cutoffMs,
      });
    }

    if (lesson.status === "planned" && lesson.lesson_date >= todayIso) {
      const existingNext = nextPlannedLessonByStudent.get(lesson.student_id);
      if (
        !existingNext ||
        lesson.lesson_date < existingNext.lessonDate ||
        (lesson.lesson_date === existingNext.lessonDate &&
          (lesson.start_time ?? "") < (existingNext.startTime ?? ""))
      ) {
        nextPlannedLessonByStudent.set(lesson.student_id, {
          lessonDate: lesson.lesson_date,
          startTime: lesson.start_time,
        });
      }
    }
  }

  // Group attempts by student
  const attemptsByStudent = new Map<string, StudentQuizAttemptRow[]>();
  for (const attempt of (attemptsData ?? []) as StudentQuizAttemptRow[]) {
    const existing = attemptsByStudent.get(attempt.student_id) ?? [];
    existing.push(attempt);
    attemptsByStudent.set(attempt.student_id, existing);
  }

  // Build 7-day window template (D-6 .. Today)
  const sevenDayWindow = Array.from({ length: 7 }, (_, index) => {
    const dayDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (6 - index),
    );
    return {
      isoDate: toLocalIsoDate(dayDate),
      shortWeekday: new Intl.DateTimeFormat(weekdayLocale, {
        weekday: "short",
      }).format(dayDate),
      dayNumber: String(dayDate.getDate()),
    };
  });

  const studentHomeworkItems: StudentHomeworkItem[] = activeConnections
    .map((connection) => {
      const studentId = connection.student_id;
      const studentName =
        connection.student_profile?.full_name ||
        connection.student_profile?.email ||
        "Student";
      const cefrLevel = connection.student_profile?.cefr_level ?? null;

      const lastLesson = lastCompletedLessonByStudent.get(studentId) ?? null;
      const nextLesson = nextPlannedLessonByStudent.get(studentId) ?? null;
      const cutoffMs = lastLesson
        ? lastLesson.cutoffMs
        : fourteenDaysAgo.getTime();

      const allStudentAttempts = attemptsByStudent.get(studentId) ?? [];

      // 7-day regularity calculation across all attempts in the last 7 days
      const countsByDay = new Map<string, number>();
      for (const attempt of allStudentAttempts) {
        const dayIso = toLocalIsoDate(new Date(attempt.completed_at));
        countsByDay.set(dayIso, (countsByDay.get(dayIso) ?? 0) + 1);
      }

      const regularityDays: RegularityDayItem[] = sevenDayWindow.map((day) => ({
        ...day,
        count: countsByDay.get(day.isoDate) ?? 0,
      }));
      const activeDaysCount = regularityDays.filter(
        (day) => day.count > 0,
      ).length;

      // Attempts completed strictly since the last completed lesson
      const sinceLessonRows = allStudentAttempts.filter(
        (attempt) => new Date(attempt.completed_at).getTime() > cutoffMs,
      );

      const uniqueTermsSet = new Set<string>();
      const activityCountMap = new Map<string, number>();
      let totalTimeSeconds = 0;
      let scoredSum = 0;
      let scoredCount = 0;

      const mappedAttempts: HomeworkAttemptItem[] = sinceLessonRows.map(
        (attempt) => {
          const quiz = attempt.quizzes;
          const quizType = quiz?.type ?? "mcq";
          const activityLabel = getActivityLabel(messages, quizType);
          activityCountMap.set(
            activityLabel,
            (activityCountMap.get(activityLabel) ?? 0) + 1,
          );

          const rawTerms = Array.isArray(quiz?.vocabulary_terms)
            ? quiz.vocabulary_terms
            : [];
          for (const item of rawTerms) {
            if (typeof item?.term === "string" && item.term.trim()) {
              uniqueTermsSet.add(item.term.trim().toLowerCase());
            }
          }

          const isFlashcards = quizType === "flashcards";
          const hasScore =
            !isFlashcards &&
            attempt.score !== null &&
            attempt.max_score !== null &&
            attempt.max_score > 0;
          const scorePercent = hasScore
            ? Math.round(
                (Number(attempt.score) / Number(attempt.max_score)) * 100,
              )
            : null;

          if (scorePercent !== null) {
            scoredSum += scorePercent;
            scoredCount += 1;
          }

          if (
            typeof attempt.time_spent_seconds === "number" &&
            attempt.time_spent_seconds > 0
          ) {
            totalTimeSeconds += attempt.time_spent_seconds;
          }

          const grammarTopicKey = getPrimaryGrammarTopic(quiz?.config);
          const grammarTopic = grammarTopicKey
            ? getGrammarTopicDisplayName(quiz?.config, grammarTopicKey)
            : null;

          return {
            id: attempt.id,
            quizId: attempt.quiz_id,
            quizTitle: quiz?.title || "Quiz",
            quizType,
            activityLabel,
            cefrLevel: quiz?.cefr_level ?? null,
            grammarTopic,
            scorePercent,
            wordsCount: rawTerms.length,
            timeSpentSeconds: attempt.time_spent_seconds,
            completedAt: attempt.completed_at,
          };
        },
      );

      const activityCounts = Array.from(activityCountMap.entries()).map(
        ([label, count]) => ({ label, count }),
      );

      return {
        studentId,
        studentName,
        cefrLevel,
        lastLessonDate: lastLesson?.lessonDate ?? null,
        nextLessonDate: nextLesson?.lessonDate ?? null,
        nextLessonTime: nextLesson?.startTime
          ? nextLesson.startTime.slice(0, 5)
          : null,
        exercisesCount: mappedAttempts.length,
        avgScorePercent:
          scoredCount > 0 ? Math.round(scoredSum / scoredCount) : null,
        uniqueWordsPracticed: uniqueTermsSet.size,
        totalTimeSeconds,
        activityCounts,
        regularityDays,
        activeDaysCount,
        attempts: mappedAttempts,
      };
    })
    .sort(
      (left, right) =>
        right.exercisesCount - left.exercisesCount ||
        right.activeDaysCount - left.activeDaysCount ||
        left.studentName.localeCompare(right.studentName, undefined, {
          sensitivity: "base",
        }),
    );

  const formalAssignments: FormalClassAssignmentItem[] = (
    assignmentsData ?? []
  ).map((assignment) => {
    const cls = assignment.classes as unknown as {
      name: string;
      id: string;
    } | null;
    const quiz = assignment.quizzes as unknown as {
      title: string;
      type: string;
    } | null;

    return {
      id: assignment.id,
      title: assignment.title,
      instructions: assignment.instructions,
      dueDate: assignment.due_date,
      createdAt: assignment.created_at,
      classId: cls?.id ?? null,
      className: cls?.name ?? null,
      quizTitle: quiz?.title ?? null,
      quizActivityLabel: quiz?.type
        ? getActivityLabel(messages, quiz.type)
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <AssignmentsPageHeader
        role={role}
        currentSection="assignments"
        title={messages.assignments.title}
        description={messages.assignments.tutorDescription}
      />

      <TutorHomeworkClient
        students={studentHomeworkItems}
        formalAssignments={formalAssignments}
      />
    </div>
  );
}

// ─── Student view ────────────────────────────────────────────────

async function StudentAssignments({
  supabaseUserId,
  currentPage,
  searchParams,
  appLanguage,
  messages,
}: {
  supabaseUserId: string;
  currentPage: number;
  searchParams: { page?: string };
  appLanguage: AppLanguage;
  messages: AppMessages;
}) {
  const supabase = await createClient();
  const { from, to } = getPaginationRange(currentPage, ASSIGNMENTS_PAGE_SIZE);

  // Get classes the student has joined
  const { data: memberships } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("student_id", supabaseUserId);

  const classIds = memberships?.map((m) => m.class_id) ?? [];

  if (classIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.assignments.title}
          </h1>
          <p className="text-muted-foreground">
            {messages.assignments.studentDescription}
          </p>
        </div>
        <Card>
          <CardHeader className="items-center text-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">
              {messages.assignments.noClassesJoinedTitle}
            </CardTitle>
            <CardDescription>
              {messages.assignments.noClassesJoinedDescription}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pb-12">
            <Button asChild className="w-full max-w-xs" variant="outline">
              <Link href="/classes">{messages.assignments.goToClasses}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Get assignments for those classes (admin client to bypass RLS on joined tables)
  const supabaseAdmin = createAdminClient();
  const { count: totalAssignments } = await supabaseAdmin
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .in("class_id", classIds);

  const { data: assignments } = await supabaseAdmin
    .from("assignments")
    .select("*, classes(name), quizzes(id, title, type, cefr_level)")
    .in("class_id", classIds)
    .order("created_at", { ascending: false })
    .range(from, to);

  // Check completion status
  const quizIds = assignments?.map((a) => a.quiz_id).filter(Boolean) ?? [];
  const { data: attempts } = quizIds.length
    ? await supabase
        .from("quiz_attempts")
        .select("quiz_id, score, max_score")
        .eq("student_id", supabaseUserId)
        .in("quiz_id", quizIds)
    : { data: [] };

  const attemptMap: Record<
    string,
    { score: number | null; max_score: number | null }
  > = {};
  attempts?.forEach((a) => {
    const existing = attemptMap[a.quiz_id];
    if (
      !existing ||
      (a.score != null &&
        a.max_score != null &&
        (existing.score == null ||
          a.score / a.max_score > existing.score / (existing.max_score ?? 1)))
    ) {
      attemptMap[a.quiz_id] = { score: a.score, max_score: a.max_score };
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.assignments.title}
        </h1>
        <p className="text-muted-foreground">
          {messages.assignments.studentDescription}
        </p>
      </div>

      {!assignments || assignments.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">
              {messages.assignments.noAssignmentsTitle}
            </CardTitle>
            <CardDescription>
              {messages.assignments.noAssignmentsStudentDescription}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const cls = assignment.classes as unknown as {
                name: string;
              } | null;
              const quiz = assignment.quizzes as unknown as {
                id: string;
                title: string;
                type: string;
                cefr_level: string;
              } | null;
              const isPastDue =
                assignment.due_date &&
                new Date(assignment.due_date) < new Date();
              const attempt = quiz ? attemptMap[quiz.id] : null;
              const isCompleted = !!attempt;
              const pct =
                attempt?.score != null && attempt?.max_score != null
                  ? Math.round((attempt.score / attempt.max_score) * 100)
                  : null;

              return (
                <Card key={assignment.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {assignment.title}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <Badge variant="secondary">
                            {pct !== null
                              ? `${pct}%`
                              : messages.assignments.done}
                          </Badge>
                        ) : isPastDue ? (
                          <Badge variant="destructive">
                            {messages.assignments.pastDue}
                          </Badge>
                        ) : assignment.due_date ? (
                          <Badge variant="outline">
                            {messages.assignments.due}{" "}
                            {formatDateForAppLanguage(
                              appLanguage,
                              assignment.due_date,
                            )}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {cls && (
                          <span>
                            {messages.assignments.classLabel}: {cls.name}
                          </span>
                        )}
                        {quiz && (
                          <span>
                            {getActivityLabel(messages, quiz.type)} &middot;{" "}
                            {quiz.cefr_level}
                          </span>
                        )}
                      </div>
                      {assignment.instructions && (
                        <p className="text-sm text-muted-foreground">
                          {assignment.instructions}
                        </p>
                      )}
                    </div>
                  </CardContent>
                  {quiz && (
                    <CardFooter className="justify-center">
                      <Button
                        asChild
                        className="w-full sm:w-auto"
                        size="sm"
                        variant={isCompleted ? "outline" : "default"}
                      >
                        <Link href={`/quizzes/${quiz.id}`}>
                          {isCompleted
                            ? messages.assignments.retry
                            : messages.assignments.start}
                        </Link>
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>
          <PagePagination
            pathname="/assignments"
            currentPage={currentPage}
            pageSize={ASSIGNMENTS_PAGE_SIZE}
            totalItems={totalAssignments ?? assignments.length}
            searchParams={searchParams}
            labels={messages.pagination}
          />
        </div>
      )}
    </div>
  );
}
