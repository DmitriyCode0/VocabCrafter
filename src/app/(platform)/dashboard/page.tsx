import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Role } from "@/types/roles";
import { ROLE_LABELS } from "@/types/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

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

      {role === "student" && <StudentDashboard />}
      {role === "tutor" && <TutorDashboard />}
      {role === "superadmin" && <AdminDashboard />}
    </div>
  );
}

function StudentDashboard() {
  return (
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
          <GraduationCap className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">My Classes</CardTitle>
            <CardDescription>Join and view your classes</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/classes">View Classes</Link>
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
  );
}

function TutorDashboard() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Classes</CardTitle>
            <CardDescription>Manage your classes and students</CardDescription>
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
  );
}

function AdminDashboard() {
  return (
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
  );
}
