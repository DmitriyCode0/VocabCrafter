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
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { DeleteAssignmentButton } from "@/components/assignments/delete-assignment-button";
import { CreateAssignmentDialog } from "@/components/assignments/create-assignment-dialog";
import { ACTIVITY_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "student";

  if (role === "student") {
    return <StudentAssignments supabaseUserId={user.id} />;
  }

  // Tutor / superadmin view
  const { data: assignments } = await supabase
    .from("assignments")
    .select("*, classes(name, id), quizzes(title, type)")
    .eq("tutor_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground">
            Manage quiz assignments for your classes.
          </p>
        </div>
        <CreateAssignmentDialog />
      </div>

      {!assignments || assignments.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No assignments yet</CardTitle>
            <CardDescription>
              Create your first assignment by selecting a class and quiz.
            </CardDescription>
            <div className="mt-4">
              <CreateAssignmentDialog />
            </div>
          </CardHeader>
        </Card>
      ) : (
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
              assignment.due_date && new Date(assignment.due_date) < new Date();

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
                          {isPastDue ? "Past due" : "Due"}{" "}
                          {new Date(assignment.due_date).toLocaleDateString(
                            "en-US",
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
                        Class: {cls.name}
                      </Link>
                    )}
                    {quiz && (
                      <span>
                        Quiz: {quiz.title} (
                        {ACTIVITY_LABELS[quiz.type] || quiz.type})
                      </span>
                    )}
                  </div>
                  {assignment.instructions && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {assignment.instructions}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Created{" "}
                    {new Date(assignment.created_at).toLocaleDateString("en-US")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Student view ────────────────────────────────────────────────

async function StudentAssignments({
  supabaseUserId,
}: {
  supabaseUserId: string;
}) {
  const supabase = await createClient();

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
          <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground">
            Quizzes assigned to you by your tutors.
          </p>
        </div>
        <Card>
          <CardHeader className="items-center text-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No classes joined</CardTitle>
            <CardDescription>
              Join a class first to see assignments from your tutors.
            </CardDescription>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/classes">Go to Classes</Link>
            </Button>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Get assignments for those classes (admin client to bypass RLS on joined tables)
  const supabaseAdmin = createAdminClient();
  const { data: assignments } = await supabaseAdmin
    .from("assignments")
    .select("*, classes(name), quizzes(id, title, type, cefr_level)")
    .in("class_id", classIds)
    .order("created_at", { ascending: false });

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
          a.score / a.max_score >
            existing.score / (existing.max_score ?? 1)))
    ) {
      attemptMap[a.quiz_id] = { score: a.score, max_score: a.max_score };
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
        <p className="text-muted-foreground">
          Quizzes assigned to you by your tutors.
        </p>
      </div>

      {!assignments || assignments.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No assignments yet</CardTitle>
            <CardDescription>
              Your tutors haven&apos;t assigned any quizzes yet. Check back
              later!
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
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
              assignment.due_date && new Date(assignment.due_date) < new Date();
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
                          {pct !== null ? `${pct}%` : "Done"}
                        </Badge>
                      ) : isPastDue ? (
                        <Badge variant="destructive">Past due</Badge>
                      ) : assignment.due_date ? (
                        <Badge variant="outline">
                          Due{" "}
                          {new Date(assignment.due_date).toLocaleDateString(
                            "en-US",
                          )}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {cls && <span>Class: {cls.name}</span>}
                        {quiz && (
                          <span>
                            {ACTIVITY_LABELS[quiz.type] || quiz.type} &middot;
                            CEFR {quiz.cefr_level}
                          </span>
                        )}
                      </div>
                      {assignment.instructions && (
                        <p className="text-sm text-muted-foreground">
                          {assignment.instructions}
                        </p>
                      )}
                    </div>
                    {quiz && (
                      <Button
                        asChild
                        size="sm"
                        variant={isCompleted ? "outline" : "default"}
                      >
                        <Link href={`/quizzes/${quiz.id}`}>
                          {isCompleted ? "Retry" : "Start"}
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
