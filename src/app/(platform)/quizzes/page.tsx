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
import { DeleteAllQuizzesButton } from "@/components/quiz/delete-all-quizzes-button";
import { RemoveReviewQuizzesButton } from "@/components/quiz/remove-review-quizzes-button";
import { QuizzesLibraryClient } from "@/components/quiz/quizzes-library-client";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import { REVIEW_ACTIVITY_TITLE_PREFIX } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function QuizzesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profileResult, quizzesResult] = await Promise.all([
    supabase.from("profiles").select("app_language").eq("id", user.id).single(),
    supabase
      .from("quizzes")
      .select(
        "id, creator_id, title, type, cefr_level, vocabulary_terms, config, is_public, created_at, deleted_at",
      )
      .eq("creator_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const messages = getAppMessages(
    normalizeAppLanguage(profileResult.data?.app_language),
  );

  const { data: quizzes, error: quizzesError } = quizzesResult;

  if (quizzesError) {
    console.error("Failed to load quizzes:", quizzesError);
  }

  const allQuizzes = quizzes ?? [];
  const totalQuizzes = allQuizzes.length;
  const reviewQuizCount = allQuizzes.filter((q) =>
    q.title
      .toLowerCase()
      .startsWith(REVIEW_ACTIVITY_TITLE_PREFIX.toLowerCase()),
  ).length;

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
          <DeleteAllQuizzesButton totalCount={totalQuizzes} />
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

      {allQuizzes.length === 0 ? (
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
        <QuizzesLibraryClient quizzes={allQuizzes} />
      )}
    </div>
  );
}
