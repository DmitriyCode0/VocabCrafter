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
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { ACTIVITY_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get all classes this tutor owns
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("tutor_id", user.id);

  const classIds = classes?.map((c) => c.id) ?? [];

  if (classIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review</h1>
          <p className="text-muted-foreground">
            Review student submissions and provide feedback.
          </p>
        </div>
        <Card>
          <CardHeader className="items-center text-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No classes yet</CardTitle>
            <CardDescription>
              Create a class first so students can join and submit quiz
              attempts.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Use admin client to bypass RLS for cross-table queries
  const supabaseAdmin = createAdminClient();

  // Get students in tutor's classes
  const { data: members } = await supabaseAdmin
    .from("class_members")
    .select("student_id")
    .in("class_id", classIds);

  const studentIds = [...new Set(members?.map((m) => m.student_id) ?? [])];

  if (studentIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review</h1>
          <p className="text-muted-foreground">
            Review student submissions and provide feedback.
          </p>
        </div>
        <Card>
          <CardHeader className="items-center text-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No students yet</CardTitle>
            <CardDescription>
              Students will appear here once they join your classes and complete
              quizzes.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Get quiz attempts via assignments (matches RLS: "Tutors can read attempts for assigned quizzes")
  // Also include attempts by students for quizzes the tutor owns directly
  const { data: assignments } = await supabase
    .from("assignments")
    .select("quiz_id")
    .eq("tutor_id", user.id);

  const assignedQuizIds = assignments?.map((a) => a.quiz_id) ?? [];

  // Get tutor's own quizzes too
  const { data: ownQuizzes } = await supabase
    .from("quizzes")
    .select("id")
    .eq("creator_id", user.id);

  const ownQuizIds = ownQuizzes?.map((q) => q.id) ?? [];
  const allQuizIds = [...new Set([...assignedQuizIds, ...ownQuizIds])];

  if (allQuizIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review</h1>
          <p className="text-muted-foreground">
            Review student submissions and provide feedback.
          </p>
        </div>
        <Card>
          <CardHeader className="items-center text-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No quizzes assigned</CardTitle>
            <CardDescription>
              Create assignments for your classes so student submissions appear
              here.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Get quiz attempts for assigned/owned quizzes by students in tutor's classes
  const { data: attempts } = await supabaseAdmin
    .from("quiz_attempts")
    .select("*, quizzes(title, type), profiles(full_name, email)")
    .in("quiz_id", allQuizIds)
    .in("student_id", studentIds)
    .order("completed_at", { ascending: false })
    .limit(50);

  // Get existing feedback from this tutor
  const attemptIds = attempts?.map((a) => a.id) ?? [];
  const { data: feedbackList } = attemptIds.length
    ? await supabaseAdmin
        .from("feedback")
        .select("attempt_id")
        .eq("tutor_id", user.id)
        .in("attempt_id", attemptIds)
    : { data: [] };

  const reviewedSet = new Set(feedbackList?.map((f) => f.attempt_id) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review</h1>
        <p className="text-muted-foreground">
          Review student submissions and provide feedback.
        </p>
      </div>

      {!attempts || attempts.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No submissions yet</CardTitle>
            <CardDescription>
              Student quiz attempts will appear here once they start completing
              activities.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
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
              ? Math.round(
                  (Number(attempt.score) / Number(attempt.max_score)) * 100,
                )
              : null;
            const reviewed = reviewedSet.has(attempt.id);

            return (
              <Link
                key={attempt.id}
                href={`/review/${attempt.id}`}
                className="block"
              >
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {student?.full_name ?? student?.email ?? "Unknown"}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {reviewed ? (
                          <Badge variant="secondary">Reviewed</Badge>
                        ) : (
                          <Badge>Needs Review</Badge>
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
                            {pct}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {quiz && (
                        <span>
                          {quiz.title} (
                          {ACTIVITY_LABELS[quiz.type] || quiz.type})
                        </span>
                      )}
                      <span>
                        {new Date(attempt.completed_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
