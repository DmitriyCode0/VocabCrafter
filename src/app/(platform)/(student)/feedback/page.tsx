import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, BookOpen } from "lucide-react";
import { ACTIVITY_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface FeedbackRow {
  id: string;
  content: string;
  rating: number | null;
  created_at: string;
  attempt_id: string;
  profiles: { full_name: string | null } | null;
  quiz_attempts: {
    score: number | null;
    max_score: number | null;
    completed_at: string;
    quizzes: { title: string; type: string } | null;
  } | null;
}

export default async function StudentFeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const supabaseAdmin = createAdminClient();

  // Fetch all feedback on this student's quiz attempts
  // We join feedback → quiz_attempts → quizzes, and feedback → profiles (tutor name)
  const { data: feedbackItems } = await supabaseAdmin
    .from("feedback")
    .select(
      "id, content, rating, created_at, attempt_id, profiles(full_name), quiz_attempts(score, max_score, completed_at, quizzes(title, type))",
    )
    .in(
      "attempt_id",
      // Subquery: get all attempt IDs by this student
      (
        await supabaseAdmin
          .from("quiz_attempts")
          .select("id")
          .eq("student_id", user.id)
      ).data?.map((a) => a.id) ?? [],
    )
    .order("created_at", { ascending: false });

  const items = (feedbackItems ?? []) as unknown as FeedbackRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Feedback</h1>
        <p className="text-muted-foreground">
          Feedback from tutors on your quiz submissions
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No feedback yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your tutors&apos; feedback on your quiz submissions will appear
              here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((fb) => {
            const quiz = fb.quiz_attempts?.quizzes;
            const attempt = fb.quiz_attempts;
            const tutor = fb.profiles;
            const scored =
              attempt?.score != null && attempt?.max_score != null;
            const pct = scored
              ? Math.round(
                  (Number(attempt.score) / Number(attempt.max_score)) * 100,
                )
              : null;

            return (
              <Card key={fb.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      {quiz?.title ?? "Quiz"}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {quiz && (
                        <Badge variant="outline" className="text-xs">
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
                          className="text-xs"
                        >
                          {pct}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="flex items-center justify-between">
                    <span>
                      From{" "}
                      <strong>{tutor?.full_name ?? "Tutor"}</strong>
                    </span>
                    <span>
                      {new Date(fb.created_at).toLocaleDateString()}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fb.rating && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span
                          key={i}
                          className={
                            i < fb.rating!
                              ? "text-yellow-500"
                              : "text-muted-foreground/30"
                          }
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">{fb.content}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
