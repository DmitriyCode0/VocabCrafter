import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { AssignmentsPageHeader } from "@/components/assignments/assignments-page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PagePagination } from "@/components/shared/page-pagination";
import { ACTIVITY_LABELS } from "@/lib/constants";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { formatDateForAppLanguage } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/messages";
import { getCurrentPage, getPaginationRange } from "@/lib/pagination";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/roles";

export const dynamic = "force-dynamic";

const REVIEW_PAGE_SIZE = 12;

export default async function AssignmentsReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const currentPage = getCurrentPage(resolvedSearchParams.page);
  const { from, to } = getPaginationRange(currentPage, REVIEW_PAGE_SIZE);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, app_language")
    .eq("id", user.id)
    .single();

  const role = profile?.role as Role | undefined;

  if (role !== "tutor" && role !== "superadmin") {
    redirect("/dashboard");
  }

  const appLanguage = normalizeAppLanguage(profile?.app_language);
  const messages = getAppMessages(appLanguage);

  function getActivityLabel(type: string | null | undefined) {
    if (!type) {
      return "";
    }

    return (
      messages.quizzes.typeLabels[
        type as keyof typeof messages.quizzes.typeLabels
      ] ||
      messages.createQuiz.quizWordPicker.typeLabels[
        type as keyof typeof messages.createQuiz.quizWordPicker.typeLabels
      ] ||
      ACTIVITY_LABELS[type] ||
      type
    );
  }

  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("tutor_id", user.id);

  const classIds = classes?.map((item) => item.id) ?? [];

  if (classIds.length === 0) {
    return (
      <div className="space-y-6">
        <AssignmentsPageHeader
          role={role}
          currentSection="review"
          title={messages.assignments.title}
          description={messages.assignments.reviewDescription}
        />
        <Card>
          <CardHeader className="items-center py-12 text-center">
            <MessageSquare className="mb-2 h-12 w-12 text-muted-foreground/50" />
            <CardTitle className="text-lg">
              {messages.reviewPage.noClassesTitle}
            </CardTitle>
            <CardDescription>
              {messages.reviewPage.noClassesDescription}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const supabaseAdmin = createAdminClient();
  const { data: members } = await supabaseAdmin
    .from("class_members")
    .select("student_id")
    .in("class_id", classIds);

  const studentIds = [...new Set(members?.map((member) => member.student_id) ?? [])];

  if (studentIds.length === 0) {
    return (
      <div className="space-y-6">
        <AssignmentsPageHeader
          role={role}
          currentSection="review"
          title={messages.assignments.title}
          description={messages.assignments.reviewDescription}
        />
        <Card>
          <CardHeader className="items-center py-12 text-center">
            <MessageSquare className="mb-2 h-12 w-12 text-muted-foreground/50" />
            <CardTitle className="text-lg">
              {messages.reviewPage.noStudentsTitle}
            </CardTitle>
            <CardDescription>
              {messages.reviewPage.noStudentsDescription}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { data: assignments } = await supabase
    .from("assignments")
    .select("quiz_id")
    .eq("tutor_id", user.id);

  const assignedQuizIds = assignments?.map((assignment) => assignment.quiz_id) ?? [];

  const { data: ownQuizzes } = await supabase
    .from("quizzes")
    .select("id")
    .eq("creator_id", user.id);

  const ownQuizIds = ownQuizzes?.map((quiz) => quiz.id) ?? [];
  const allQuizIds = [...new Set([...assignedQuizIds, ...ownQuizIds])];

  if (allQuizIds.length === 0) {
    return (
      <div className="space-y-6">
        <AssignmentsPageHeader
          role={role}
          currentSection="review"
          title={messages.assignments.title}
          description={messages.assignments.reviewDescription}
        />
        <Card>
          <CardHeader className="items-center py-12 text-center">
            <MessageSquare className="mb-2 h-12 w-12 text-muted-foreground/50" />
            <CardTitle className="text-lg">
              {messages.reviewPage.noQuizzesTitle}
            </CardTitle>
            <CardDescription>
              {messages.reviewPage.noQuizzesDescription}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { count: totalAttempts } = await supabaseAdmin
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .in("quiz_id", allQuizIds)
    .in("student_id", studentIds);

  const { data: attempts } = await supabaseAdmin
    .from("quiz_attempts")
    .select("*, quizzes(title, type), profiles(full_name, email)")
    .in("quiz_id", allQuizIds)
    .in("student_id", studentIds)
    .order("completed_at", { ascending: false })
    .range(from, to);

  const attemptIds = attempts?.map((attempt) => attempt.id) ?? [];
  const { data: feedbackList } = attemptIds.length
    ? await supabaseAdmin
        .from("feedback")
        .select("attempt_id")
        .eq("tutor_id", user.id)
        .in("attempt_id", attemptIds)
    : { data: [] };

  const reviewedSet = new Set(feedbackList?.map((feedback) => feedback.attempt_id) ?? []);

  return (
    <div className="space-y-6">
      <AssignmentsPageHeader
        role={role}
        currentSection="review"
        title={messages.assignments.title}
        description={messages.assignments.reviewDescription}
      />

      {!attempts || attempts.length === 0 ? (
        <Card>
          <CardHeader className="items-center py-12 text-center">
            <MessageSquare className="mb-2 h-12 w-12 text-muted-foreground/50" />
            <CardTitle className="text-lg">
              {messages.reviewPage.noSubmissionsTitle}
            </CardTitle>
            <CardDescription>
              {messages.reviewPage.noSubmissionsDescription}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {attempts.map((attempt) => {
              const quiz = attempt.quizzes as unknown as {
                title: string;
                type: string;
              } | null;
              const student = attempt.profiles as unknown as {
                full_name: string | null;
                email: string;
              } | null;
              const scored = attempt.score != null && attempt.max_score != null;
              const pct = scored
                ? Math.round((Number(attempt.score) / Number(attempt.max_score)) * 100)
                : null;
              const reviewed = reviewedSet.has(attempt.id);

              return (
                <Link
                  key={attempt.id}
                  href={`/assignments/review/${attempt.id}`}
                  className="block"
                >
                  <Card className="cursor-pointer transition-colors hover:border-primary/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {student?.full_name ??
                            student?.email ??
                            messages.reviewPage.unknownStudent}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {reviewed ? (
                            <Badge variant="secondary">
                              {messages.reviewPage.reviewed}
                            </Badge>
                          ) : (
                            <Badge>{messages.reviewPage.needsReview}</Badge>
                          )}
                          {pct !== null ? (
                            <Badge
                              variant={
                                pct >= 80
                                  ? "default"
                                  : pct >= 50
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {pct}%
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {quiz ? (
                          <span>
                            {quiz.title} ({getActivityLabel(quiz.type)})
                          </span>
                        ) : null}
                        <span>
                          {formatDateForAppLanguage(appLanguage, attempt.completed_at)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          <PagePagination
            pathname="/assignments/review"
            currentPage={currentPage}
            pageSize={REVIEW_PAGE_SIZE}
            totalItems={totalAttempts ?? attempts.length}
            searchParams={resolvedSearchParams}
            labels={messages.pagination}
          />
        </div>
      )}
    </div>
  );
}