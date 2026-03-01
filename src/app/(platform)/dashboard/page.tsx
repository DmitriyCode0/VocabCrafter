import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { Role } from "@/types/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  TrendingUp,
  Users,
  ClipboardList,
  MessageSquare,
  BarChart3,
  PlusCircle,
  Trophy,
  Target,
  Clock,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role as Role;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {profile.full_name || profile.email}
        </h1>
        <p className="text-muted-foreground">
          {role === "student" &&
            "Practice vocabulary, take quizzes, and track your progress."}
          {role === "tutor" &&
            "Manage your classes, assign quizzes, and review student work."}
          {role === "superadmin" &&
            "Monitor platform analytics and manage users."}
        </p>
      </div>

      {role === "student" && <StudentDashboard userId={user.id} />}
      {role === "tutor" && <TutorDashboard userId={user.id} />}
      {role === "superadmin" && <AdminDashboard />}
    </div>
  );
}

async function StudentDashboard({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [
    { count: quizCount },
    { count: attemptCount },
    { data: recentAttempts },
    { data: memberships },
  ] = await Promise.all([
    supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", userId),
    supabase
      .from("quiz_attempts")
      .select("*", { count: "exact", head: true })
      .eq("student_id", userId),
    supabase
      .from("quiz_attempts")
      .select("score, max_score, completed_at, quizzes(title, type)")
      .eq("student_id", userId)
      .order("completed_at", { ascending: false })
      .limit(5),
    supabase.from("class_members").select("class_id").eq("student_id", userId),
  ]);

  // Fetch pending assignments for student
  const classIds = memberships?.map((m) => m.class_id) ?? [];
  let pendingAssignments: {
    id: string;
    title: string;
    due_date: string | null;
    instructions: string | null;
    quiz_id: string;
    classes: { name: string } | null;
    quizzes: { id: string; title: string; type: string } | null;
  }[] = [];

  if (classIds.length > 0) {
    const supabaseAdmin = createAdminClient();
    const { data: allAssignments } = await supabaseAdmin
      .from("assignments")
      .select(
        "id, title, due_date, instructions, quiz_id, classes(name), quizzes(id, title, type)",
      )
      .in("class_id", classIds)
      .order("created_at", { ascending: false });

    // Filter out completed ones
    const quizIds = allAssignments?.map((a) => a.quiz_id).filter(Boolean) ?? [];
    const { data: attempts } = quizIds.length
      ? await supabase
          .from("quiz_attempts")
          .select("quiz_id")
          .eq("student_id", userId)
          .in("quiz_id", quizIds)
      : { data: [] };

    const completedQuizIds = new Set(attempts?.map((a) => a.quiz_id) ?? []);
    pendingAssignments = (
      (allAssignments ?? []) as typeof pendingAssignments
    ).filter((a) => !completedQuizIds.has(a.quiz_id));
  }

  const avgScore =
    recentAttempts && recentAttempts.length > 0
      ? Math.round(
          recentAttempts.reduce((sum, a) => {
            if (a.score !== null && a.max_score !== null && a.max_score > 0) {
              return sum + (a.score / a.max_score) * 100;
            }
            return sum;
          }, 0) /
            recentAttempts.filter(
              (a) => a.max_score !== null && a.max_score > 0,
            ).length || 0,
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Quizzes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quizCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">quizzes created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Attempts</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attemptCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">quizzes completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgScore > 0 ? `${avgScore}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">recent performance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Active</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recentAttempts && recentAttempts.length > 0
                ? new Date(recentAttempts[0].completed_at).toLocaleDateString()
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">last quiz attempt</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending assignments */}
      {pendingAssignments.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Pending Assignments ({pendingAssignments.length})
              </CardTitle>
              <CardDescription>Quizzes assigned by your tutors</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/assignments">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingAssignments.slice(0, 5).map((assignment) => {
              const quiz = assignment.quizzes as {
                id: string;
                title: string;
                type: string;
              } | null;
              const cls = assignment.classes as { name: string } | null;
              const isPastDue =
                assignment.due_date &&
                new Date(assignment.due_date) < new Date();

              return (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {assignment.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {cls && <span>{cls.name}</span>}
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
                    </div>
                  </div>
                  {quiz && (
                    <Button asChild size="sm">
                      <Link href={`/quizzes/${quiz.id}`}>Start</Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      {recentAttempts && recentAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Your latest quiz attempts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAttempts.map((attempt, i) => {
              const quiz = attempt.quizzes as unknown as {
                title: string;
                type: string;
              } | null;
              const pct =
                attempt.score !== null &&
                attempt.max_score !== null &&
                attempt.max_score > 0
                  ? Math.round((attempt.score / attempt.max_score) * 100)
                  : null;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {quiz?.title ?? "Untitled Quiz"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(attempt.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                  {pct !== null && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Progress value={pct} className="w-20 h-2" />
                      <Badge
                        variant="outline"
                        className={
                          pct >= 80
                            ? "text-green-600"
                            : pct >= 50
                              ? "text-orange-600"
                              : "text-red-600"
                        }
                      >
                        {pct}%
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Create Quiz</CardTitle>
              <CardDescription>Generate a new AI-powered quiz</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/quizzes/new">New Quiz</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">My Quizzes</CardTitle>
              <CardDescription>View and retake your quizzes</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/quizzes">View Quizzes</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Progress</CardTitle>
              <CardDescription>Track your learning journey</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/progress">View Progress</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function TutorDashboard({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [
    { count: classCount },
    { count: assignmentCount },
    { data: recentClasses },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*", { count: "exact", head: true })
      .eq("tutor_id", userId),
    supabase
      .from("assignments")
      .select("*", { count: "exact", head: true })
      .eq("tutor_id", userId),
    supabase
      .from("classes")
      .select("id, name, cefr_level, is_active, created_at")
      .eq("tutor_id", userId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  // Get total student count across all classes
  let totalStudents = 0;
  if (recentClasses && recentClasses.length > 0) {
    const classIds = recentClasses.map((c) => c.id);
    const { count } = await supabase
      .from("class_members")
      .select("*", { count: "exact", head: true })
      .in("class_id", classIds);
    totalStudents = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Classes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">active classes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">enrolled students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assignments</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignmentCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">total assignments</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Classes</CardTitle>
              <CardDescription>
                Manage your classes and students
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/classes">Manage Classes</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Assignments</CardTitle>
              <CardDescription>Create and manage assignments</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/assignments">View Assignments</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Review</CardTitle>
              <CardDescription>Review student submissions</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/review">Review Work</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: userCount },
    { count: quizCount },
    { count: classCount },
    { count: attemptCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("quizzes").select("*", { count: "exact", head: true }),
    supabase.from("classes").select("*", { count: "exact", head: true }),
    supabase.from("quiz_attempts").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quizCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">quizzes created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Classes</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">active classes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Attempts</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attemptCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">quiz attempts</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Analytics</CardTitle>
              <CardDescription>Platform usage and metrics</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/analytics">View Analytics</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Users</CardTitle>
              <CardDescription>Manage platform users</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/users">Manage Users</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
