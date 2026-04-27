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
import { getAllowedCefrLevels } from "@/lib/languages";
import { CefrLevelSelector } from "./cefr-level-selector";
import { GrammarArticleEditorPermissionToggle } from "./grammar-article-editor-permission-toggle";
import { RoleSelector } from "./role-selector";
import { listGrammarArticleEditorPermissionUserIds } from "@/lib/grammar/article-permissions";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { formatDateForAppLanguage } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verify superadmin role
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role, app_language")
    .eq("id", user.id)
    .single();

  if (currentProfile?.role !== "superadmin") redirect("/dashboard");

  const appLanguage = normalizeAppLanguage(currentProfile?.app_language);
  const messages = getAppMessages(appLanguage);
  const roleConfig: Record<
    string,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
    student: {
      label: messages.adminUsers.roleLabels.student,
      variant: "secondary",
    },
    tutor: {
      label: messages.adminUsers.roleLabels.tutor,
      variant: "default",
    },
    superadmin: {
      label: messages.adminUsers.roleLabels.superadmin,
      variant: "destructive",
    },
  };

  const currentUserId = user.id;
  const grammarArticleEditorPermissionUserIds =
    await listGrammarArticleEditorPermissionUserIds();

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
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.adminUsers.title}
        </h1>
        <p className="text-muted-foreground">
          {messages.adminUsers.description}
        </p>
      </div>

      {/* Role Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.adminUsers.summaryTitles.students}
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleCounts.student}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.adminUsers.summaryTitles.tutors}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleCounts.tutor}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.adminUsers.summaryTitles.admins}
            </CardTitle>
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
            {messages.adminUsers.allUsers(profiles?.length ?? 0)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!profiles || profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {messages.adminUsers.noUsersFound}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{messages.adminUsers.columns.name}</TableHead>
                  <TableHead>{messages.adminUsers.columns.email}</TableHead>
                  <TableHead>{messages.adminUsers.columns.role}</TableHead>
                  <TableHead>{messages.adminUsers.columns.changeRole}</TableHead>
                  <TableHead>{messages.adminUsers.columns.articleEditor}</TableHead>
                  <TableHead>{messages.adminUsers.columns.cefr}</TableHead>
                  <TableHead>{messages.adminUsers.columns.quizzes}</TableHead>
                  <TableHead>{messages.adminUsers.columns.attempts}</TableHead>
                  <TableHead>{messages.adminUsers.columns.onboarded}</TableHead>
                  <TableHead>{messages.adminUsers.columns.joined}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => {
                  const config = roleConfig[profile.role] ?? {
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
                        <RoleSelector
                          userId={profile.id}
                          currentRole={
                            profile.role as "student" | "tutor" | "superadmin"
                          }
                          isSelf={profile.id === currentUserId}
                        />
                      </TableCell>
                      <TableCell>
                        {profile.role === "tutor" ? (
                          <GrammarArticleEditorPermissionToggle
                            userId={profile.id}
                            enabled={grammarArticleEditorPermissionUserIds.has(
                              profile.id,
                            )}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {profile.role === "student" ? (
                          <CefrLevelSelector
                            userId={profile.id}
                            currentCefrLevel={profile.cefr_level}
                            allowedLevels={getAllowedCefrLevels(
                              profile.preferred_language,
                            )}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{userQuizMap[profile.id] ?? 0}</TableCell>
                      <TableCell>{userAttemptMap[profile.id] ?? 0}</TableCell>
                      <TableCell>
                        {profile.onboarding_completed ? (
                          <Badge variant="secondary" className="text-xs">
                            {messages.adminUsers.yes}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {messages.adminUsers.no}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateForAppLanguage(appLanguage, profile.created_at)}
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
