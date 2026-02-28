import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Shield, GraduationCap, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLE_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  student: { label: "Student", variant: "secondary" },
  tutor: { label: "Tutor", variant: "default" },
  superadmin: { label: "Admin", variant: "destructive" },
};

export default async function UsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verify superadmin role
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentProfile?.role !== "superadmin") redirect("/dashboard");

  // Fetch all users with their stats
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Get quiz counts per user
  const { data: quizCounts } = await supabase
    .from("quizzes")
    .select("creator_id");

  const userQuizMap: Record<string, number> = {};
  quizCounts?.forEach((q) => {
    userQuizMap[q.creator_id] = (userQuizMap[q.creator_id] || 0) + 1;
  });

  // Get attempt counts per student
  const { data: attemptCounts } = await supabase
    .from("quiz_attempts")
    .select("student_id");

  const userAttemptMap: Record<string, number> = {};
  attemptCounts?.forEach((a) => {
    userAttemptMap[a.student_id] = (userAttemptMap[a.student_id] || 0) + 1;
  });

  const roleCounts = { student: 0, tutor: 0, superadmin: 0 };
  profiles?.forEach((p) => {
    if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage platform users, roles, and permissions.
        </p>
      </div>

      {/* Role Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleCounts.student}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tutors</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleCounts.tutor}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleCounts.superadmin}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users ({profiles?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!profiles || profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No users found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>CEFR</TableHead>
                  <TableHead>Quizzes</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Onboarded</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => {
                  const config = ROLE_CONFIG[profile.role] ?? {
                    label: profile.role,
                    variant: "outline" as const,
                  };
                  return (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">
                        {profile.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {profile.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {profile.cefr_level ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>{userQuizMap[profile.id] ?? 0}</TableCell>
                      <TableCell>{userAttemptMap[profile.id] ?? 0}</TableCell>
                      <TableCell>
                        {profile.onboarding_completed ? (
                          <Badge variant="secondary" className="text-xs">
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(profile.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
