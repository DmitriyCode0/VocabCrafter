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
import { ACTIVITY_LABELS } from "@/lib/constants";

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

  // Use admin client to bypass RLS for cross-table queries
  const supabaseAdmin = createAdminClient();

  // Fetch the attempt with quiz and student info
  const { data: attempt } = await supabaseAdmin
    .from("quiz_attempts")
    .select(
      "*, quizzes(title, type, vocabulary_terms, config), profiles(full_name, email)",
    )
    .eq("id", id)
    .single();

  if (!attempt) notFound();

  // Fetch existing feedback for this attempt
  const { data: feedbackList } = await supabaseAdmin
    .from("feedback")
    .select("*, profiles(full_name)")
    .eq("attempt_id", id)
    .order("created_at", { ascending: false });

  const quiz = attempt.quizzes as unknown as {
    title: string;
    type: string;
    vocabulary_terms: string[];
    config: Record<string, unknown>;
  } | null;
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
          <Link href="/review">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Review Submission
          </h1>
          <p className="text-muted-foreground">
            {student?.full_name ?? student?.email ?? "Unknown Student"}
          </p>
        </div>
      </div>

      {/* Attempt Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{quiz?.title ?? "Quiz"}</CardTitle>
            <div className="flex items-center gap-2">
              {quiz && (
                <Badge variant="outline">
                  {ACTIVITY_LABELS[quiz.type] || quiz.type}
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
                  Score: {pct}%
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>
            Completed {new Date(attempt.completed_at).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scored && (
            <p className="text-sm text-muted-foreground mb-4">
              Raw score: {Number(attempt.score)} / {Number(attempt.max_score)}
            </p>
          )}

          {/* Show answers based on quiz type */}
          {quiz?.type === "gap_fill" && answerResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Student Answers</h3>
              {answerResults.map((result, index) => {
                const r = result as {
                  userAnswer?: string;
                  correctAnswer?: string;
                  isCorrect?: boolean;
                };
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 text-sm rounded px-3 py-2 ${
                      r.isCorrect
                        ? "bg-green-50 dark:bg-green-950/30"
                        : "bg-red-50 dark:bg-red-950/30"
                    }`}
                  >
                    <span className="font-mono text-muted-foreground shrink-0">
                      Q{index + 1}:
                    </span>
                    <div>
                      <p>
                        Answer: <strong>{r.userAnswer ?? "—"}</strong>
                        {r.isCorrect === false && r.correctAnswer && (
                          <span className="text-muted-foreground ml-2">
                            (Correct: <strong>{r.correctAnswer}</strong>)
                          </span>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`ml-auto shrink-0 text-xs ${r.isCorrect ? "text-green-600" : "text-red-600"}`}
                    >
                      {r.isCorrect ? "Correct" : "Wrong"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}

          {quiz?.type === "translation" && answerResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Translation Answers</h3>
              {answerResults.map((result, index) => {
                const r = result as {
                  ukrainianSentence?: string;
                  userTranslation?: string;
                  referenceTranslation?: string;
                  score?: number;
                  feedback?: string;
                };
                return (
                  <div
                    key={index}
                    className="bg-muted/50 rounded px-3 py-2 space-y-1"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono text-muted-foreground">
                        Q{index + 1}:
                      </span>
                      {r.score != null && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            r.score >= 80
                              ? "text-green-600"
                              : r.score >= 50
                                ? "text-orange-600"
                                : "text-red-600"
                          }`}
                        >
                          {r.score}/100
                        </Badge>
                      )}
                    </div>
                    {r.ukrainianSentence && (
                      <p className="text-sm text-muted-foreground">
                        {r.ukrainianSentence}
                      </p>
                    )}
                    {r.userTranslation && (
                      <p className="text-sm">
                        Student: <em>{r.userTranslation}</em>
                      </p>
                    )}
                    {r.referenceTranslation && (
                      <p className="text-sm text-muted-foreground">
                        Reference: <em>{r.referenceTranslation}</em>
                      </p>
                    )}
                    {r.feedback && (
                      <p className="text-xs text-muted-foreground">
                        AI: {r.feedback}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {quiz?.type === "flashcards" && (
            <div className="text-sm text-muted-foreground">
              <p>
                Flashcard session —{" "}
                {scored
                  ? `${Number(attempt.score)} of ${Number(attempt.max_score)} cards marked as known`
                  : "completed"}
                .
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
              Previous Feedback
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
                      {fbAuthor?.full_name ?? "Tutor"}
                    </span>
                    <div className="flex items-center gap-2">
                      {fb.rating && (
                        <Badge variant="outline">
                          {"★".repeat(fb.rating)}
                          {"☆".repeat(5 - fb.rating)}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(fb.created_at).toLocaleDateString()}
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
