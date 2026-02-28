import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  Users,
  BookOpen,
  GraduationCap,
  Target,
  TrendingUp,
} from "lucide-react";

import { ACTIVITY_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verify superadmin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") redirect("/dashboard");

  // --- Core Counts ---
  const [
    { count: userCount },
    { count: quizCount },
    { count: classCount },
    { count: attemptCount },
    { count: assignmentCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("quizzes").select("*", { count: "exact", head: true }),
    supabase.from("classes").select("*", { count: "exact", head: true }),
    supabase.from("quiz_attempts").select("*", { count: "exact", head: true }),
    supabase.from("assignments").select("*", { count: "exact", head: true }),
  ]);

  // --- Role breakdown ---
  const { data: profiles } = await supabase.from("profiles").select("role");

  const roleCounts = { student: 0, tutor: 0, superadmin: 0 };
  profiles?.forEach((p) => {
    if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++;
  });

  // --- Quiz type breakdown ---
  const { data: quizzes } = await supabase.from("quizzes").select("type");

  const typeCounts: Record<string, number> = {};
  quizzes?.forEach((q) => {
    typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
  });

  // --- Score stats ---
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("score, max_score, completed_at")
    .not("score", "is", null)
    .order("completed_at", { ascending: false })
    .limit(200);

  let avgScore = 0;
  if (attempts && attempts.length > 0) {
    const total = attempts.reduce(
      (sum, a) => sum + (Number(a.score) / Number(a.max_score)) * 100,
      0,
    );
    avgScore = Math.round(total / attempts.length);
  }

  // --- Recent activity (last 7 days) ---
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentAttempts =
    attempts?.filter((a) => new Date(a.completed_at) > weekAgo).length ?? 0;

  // --- CEFR level breakdown ---
  const cefrCounts: Record<string, number> = {};
  const { data: cefrProfiles } = await supabase
    .from("profiles")
    .select("cefr_level")
    .not("cefr_level", "is", null);

  cefrProfiles?.forEach((p) => {
    const level = p.cefr_level ?? "Unknown";
    cefrCounts[level] = (cefrCounts[level] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Platform usage metrics and performance data.
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {roleCounts.student}s / {roleCounts.tutor}t /{" "}
              {roleCounts.superadmin}a
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Quizzes Created
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quizCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {Object.entries(typeCounts)
                .map(([t, c]) => `${c} ${ACTIVITY_LABELS[t] || t}`)
                .join(", ") || "None yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Quiz Attempts</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attemptCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {recentAttempts} in the last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgScore}%</div>
            <p className="text-xs text-muted-foreground">
              Across {attempts?.length ?? 0} scored attempts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Classes & Assignments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Active Classes</span>
              <Badge>{classCount ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Assignments</span>
              <Badge variant="outline">{assignmentCount ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Tutors</span>
              <Badge variant="secondary">{roleCounts.tutor}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              User Roles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(roleCounts).map(([role, count]) => {
              const total = userCount ?? 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={role} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">
                      {role === "superadmin" ? "Admin" : role}
                    </span>
                    <span className="text-muted-foreground">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* CEFR Distribution */}
      {Object.keys(cefrCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CEFR Level Distribution</CardTitle>
            <CardDescription>
              Language proficiency levels across all users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => (
                <div key={level} className="text-center p-3 border rounded-lg">
                  <div className="text-lg font-bold">
                    {cefrCounts[level] ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">{level}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
