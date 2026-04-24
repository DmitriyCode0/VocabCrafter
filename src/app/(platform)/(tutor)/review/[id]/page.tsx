import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { ReviewFeedbackForm } from "@/components/review/review-feedback-form";
import { EditableGapFillResults } from "@/components/review/editable-gap-fill-results";
import { EditableTranslationResults } from "@/components/review/editable-translation-results";
import { ACTIVITY_LABELS } from "@/lib/constants";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import {
  formatDateForAppLanguage,
  formatDateTimeForAppLanguage,
} from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verify the user is a tutor or superadmin before using admin client
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, app_language")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "tutor" && profile.role !== "superadmin")) {
    redirect("/dashboard");
  }

  const appLanguage = normalizeAppLanguage(profile.app_language);
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

  // Use admin client to bypass RLS for cross-table queries
  const supabaseAdmin = createAdminClient();

  // Fetch the attempt with quiz and student info
  const { data: attempt } = await supabaseAdmin
    .from("quiz_attempts")
    .select(
      "*, quizzes(title, type, vocabulary_terms, config, creator_id), profiles(full_name, email)",
    )
    .eq("id", id)
    .single();

  if (!attempt) notFound();

  // Ownership check: verify the tutor owns the quiz or assigned it via a class
  const quizData = attempt.quizzes as unknown as {
    title: string;
    type: string;
    vocabulary_terms: string[];
    config: Record<string, unknown>;
    creator_id: string;
  } | null;

  if (quizData?.creator_id !== user.id && profile.role !== "superadmin") {
    // Check if the tutor assigned this quiz via one of their classes
    const { data: assignment } = await supabaseAdmin
      .from("assignments")
      .select("id")
      .eq("quiz_id", attempt.quiz_id)
      .eq("tutor_id", user.id)
      .limit(1)
      .single();

    if (!assignment) {
      redirect("/review");
    }
  }

  // Fetch existing feedback for this attempt
  const { data: feedbackList } = await supabaseAdmin
    .from("feedback")
    .select("*, profiles(full_name)")
    .eq("attempt_id", id)
    .order("created_at", { ascending: false });

  const quiz = quizData;
  const student = attempt.profiles as unknown as {
    full_name: string | null;
    email: string;
  } | null;
  const rawAnswers = attempt.answers as Record<string, unknown> | null;
  // Answers are stored as {type, results: [...]} or {type, known, total}
  const answerResults = (rawAnswers?.results ?? []) as Record<
    string,
    unknown
  >[];
  const scored = attempt.score != null && attempt.max_score != null;
  const pct = scored
    ? Math.round((Number(attempt.score) / Number(attempt.max_score)) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/review" aria-label={messages.reviewDetail.backToReview}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.reviewDetail.title}
          </h1>
          <p className="text-muted-foreground">
            {student?.full_name ??
              student?.email ??
              messages.reviewDetail.unknownStudent}
          </p>
        </div>
      </div>

      {/* Attempt Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {quiz?.title ?? messages.reviewDetail.quizFallback}
            </CardTitle>
            <div className="flex items-center gap-2">
              {quiz && (
                <Badge variant="outline">
                  {getActivityLabel(quiz.type)}
                </Badge>
              )}
              {pct !== null && (
                <Badge
                  variant={
                    pct >= 80
                      ? "default"
                      : pct >= 50
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {messages.reviewDetail.scoreBadge(pct)}
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>
            {messages.reviewDetail.completedAt(
              formatDateTimeForAppLanguage(appLanguage, attempt.completed_at),
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scored && (
            <p className="text-sm text-muted-foreground mb-4">
              {messages.reviewDetail.rawScore(
                Number(attempt.score),
                Number(attempt.max_score),
              )}
            </p>
          )}

          {/* Show answers based on quiz type */}
          {quiz?.type === "gap_fill" && answerResults.length > 0 && (
            <EditableGapFillResults
              attemptId={id}
              results={
                answerResults as {
                  sentence?: string;
                  userAnswer?: string;
                  correctAnswer?: string;
                  isCorrect?: boolean;
                }[]
              }
            />
          )}

          {quiz?.type === "translation" && answerResults.length > 0 && (
            <EditableTranslationResults
              attemptId={id}
              results={
                answerResults as {
                  ukrainianSentence?: string;
                  userTranslation?: string;
                  referenceTranslation?: string;
                  score?: number;
                  feedback?: string;
                }[]
              }
            />
          )}

          {quiz?.type === "flashcards" && (
            <div className="text-sm text-muted-foreground">
              <p>
                {scored
                  ? messages.reviewDetail.flashcardKnown(
                      Number(attempt.score),
                      Number(attempt.max_score),
                    )
                  : messages.reviewDetail.flashcardCompleted}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Feedback */}
      {feedbackList && feedbackList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {messages.reviewDetail.previousFeedback}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {feedbackList.map((fb) => {
              const fbAuthor = fb.profiles as unknown as {
                full_name: string | null;
              } | null;
              return (
                <div key={fb.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {fbAuthor?.full_name ?? messages.reviewDetail.tutorFallback}
                    </span>
                    <div className="flex items-center gap-2">
                      {fb.rating && (
                        <Badge variant="outline">
                          {"★".repeat(fb.rating)}
                          {"☆".repeat(5 - fb.rating)}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDateForAppLanguage(appLanguage, fb.created_at)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{fb.content}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Feedback Form */}
      <ReviewFeedbackForm attemptId={id} />
    </div>
  );
}
