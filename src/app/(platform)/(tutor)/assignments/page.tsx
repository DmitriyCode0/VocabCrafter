import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { AssignmentsPageHeader } from "@/components/assignments/assignments-page-header";
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
import { DeleteAssignmentButton } from "@/components/assignments/delete-assignment-button";
import { CreateAssignmentDialog } from "@/components/assignments/create-assignment-dialog";
import { ACTIVITY_LABELS } from "@/lib/constants";
import { PagePagination } from "@/components/shared/page-pagination";
import {
  normalizeAppLanguage,
  type AppLanguage,
} from "@/lib/i18n/app-language";
import { getAppMessages, type AppMessages } from "@/lib/i18n/messages";
import { getCurrentPage, getPaginationRange } from "@/lib/pagination";
import { formatDateForAppLanguage } from "@/lib/i18n/format";
import type { Role } from "@/types/roles";

export const dynamic = "force-dynamic";

const ASSIGNMENTS_PAGE_SIZE = 10;

function getActivityLabel(messages: AppMessages, type: string | null | undefined) {
  if (!type) {
    return "";
  }

  return (
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

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const currentPage = getCurrentPage(resolvedSearchParams.page);
  const { from, to } = getPaginationRange(currentPage, ASSIGNMENTS_PAGE_SIZE);

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

  // Tutor / superadmin view
  const { count: totalAssignments } = await supabase
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("tutor_id", user.id);

  const { data: assignments } = await supabase
    .from("assignments")
    .select("*, classes(name, id), quizzes(title, type)")
    .eq("tutor_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <div className="space-y-6">
      <AssignmentsPageHeader
        role={role}
        currentSection="assignments"
        title={messages.assignments.title}
        description={messages.assignments.tutorDescription}
        actions={<CreateAssignmentDialog />}
      />

      {!assignments || assignments.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">
              {messages.assignments.noAssignmentsTitle}
            </CardTitle>
            <CardDescription>
              {messages.assignments.noAssignmentsTutorDescription}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pb-12">
            <CreateAssignmentDialog />
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const cls = assignment.classes as unknown as {
                name: string;
                id: string;
              } | null;
              const quiz = assignment.quizzes as unknown as {
                title: string;
                type: string;
              } | null;
              const isPastDue =
                assignment.due_date &&
                new Date(assignment.due_date) < new Date();

              return (
                <Card key={assignment.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {assignment.title}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {assignment.due_date && (
                          <Badge
                            variant={isPastDue ? "destructive" : "outline"}
                            className="text-xs"
                          >
                            {isPastDue
                              ? messages.assignments.pastDue
                              : messages.assignments.due}{" "}
                            {formatDateForAppLanguage(
                              appLanguage,
                              assignment.due_date,
                            )}
                          </Badge>
                        )}
                        <DeleteAssignmentButton assignmentId={assignment.id} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {cls && (
                        <Link
                          href={`/classes/${cls.id}`}
                          className="hover:text-primary"
                        >
                          {messages.assignments.classLabel}: {cls.name}
                        </Link>
                      )}
                      {quiz && (
                        <span>
                          {messages.assignments.quizLabel}: {quiz.title} (
                          {getActivityLabel(messages, quiz.type)})
                        </span>
                      )}
                    </div>
                    {assignment.instructions && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {assignment.instructions}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {messages.assignments.created}{" "}
                      {formatDateForAppLanguage(
                        appLanguage,
                        assignment.created_at,
                      )}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <PagePagination
            pathname="/assignments"
            currentPage={currentPage}
            pageSize={ASSIGNMENTS_PAGE_SIZE}
            totalItems={totalAssignments ?? assignments.length}
            searchParams={resolvedSearchParams}
            labels={messages.pagination}
          />
        </div>
      )}
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
