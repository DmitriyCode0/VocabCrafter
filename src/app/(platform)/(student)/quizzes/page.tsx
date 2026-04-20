import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen, PlusCircle } from "lucide-react";
import { QuizCard } from "@/components/quiz/quiz-card";
import { RemoveReviewQuizzesButton } from "@/components/quiz/remove-review-quizzes-button";
import { PagePagination } from "@/components/shared/page-pagination";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import { getCurrentPage, getPaginationRange } from "@/lib/pagination";
import { REVIEW_ACTIVITY_TITLE_PREFIX } from "@/lib/constants";

export const dynamic = "force-dynamic";

const QUIZZES_PAGE_SIZE = 12;

export default async function QuizzesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const currentPage = getCurrentPage(resolvedSearchParams.page);
  const { from, to } = getPaginationRange(currentPage, QUIZZES_PAGE_SIZE);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    profileResult,
    totalQuizzesResult,
    reviewQuizzesResult,
    quizzesResult,
  ] = await Promise.all([
    supabase.from("profiles").select("app_language").eq("id", user.id).single(),
    supabase
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id),
    supabase
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .ilike("title", `${REVIEW_ACTIVITY_TITLE_PREFIX}%`),
    supabase
      .from("quizzes")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to),
  ]);

  const messages = getAppMessages(
    normalizeAppLanguage(profileResult.data?.app_language),
  );

  const totalQuizzes = totalQuizzesResult.count;
  const reviewQuizCount = reviewQuizzesResult.count ?? 0;
  const { data: quizzes, error: quizzesError } = quizzesResult;

  if (quizzesError) {
    console.error("Failed to load quizzes:", quizzesError);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.quizzes.title}
          </h1>
          <p className="text-muted-foreground">
            {messages.quizzes.description}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <RemoveReviewQuizzesButton reviewCount={reviewQuizCount} />
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/quizzes/review">
              {messages.quizzes.reviewActivity}
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/quizzes/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              {messages.quizzes.newQuiz}
            </Link>
          </Button>
        </div>
      </div>

      {!quizzes || quizzes.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">
              {messages.quizzes.noQuizzesTitle}
            </CardTitle>
            <CardDescription>
              {messages.quizzes.noQuizzesDescription}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pb-12">
            <Button asChild className="w-full max-w-xs">
              <Link href="/quizzes/new">
                {messages.quizzes.createFirstQuiz}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))}
          </div>
          <PagePagination
            pathname="/quizzes"
            currentPage={currentPage}
            pageSize={QUIZZES_PAGE_SIZE}
            totalItems={totalQuizzes ?? quizzes.length}
            searchParams={resolvedSearchParams}
            labels={messages.pagination}
          />
        </div>
      )}
    </div>
  );
}
