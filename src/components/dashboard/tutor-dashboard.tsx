import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CustomizableDashboard,
  DashboardCustomizableItem,
} from "@/components/dashboard/customizable-dashboard";
import Link from "next/link";
import {
  BookOpen,
  BookMarked,
  GraduationCap,
  MessageSquare,
  PlusCircle,
} from "lucide-react";
import { fmtLimit } from "@/lib/plans";
import { getPlan } from "@/lib/plans-server";
import {
  AnimatedCard,
} from "@/components/ui/animated-dashboard";
import type { AppMessages } from "@/lib/i18n/messages";

function pct(used: number, total: number) {
  if (!isFinite(total) || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

export async function TutorDashboard({
  userId,
  planKey,
  messages,
}: {
  userId: string;
  planKey?: string | null;
  messages: AppMessages;
}) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const plan = await getPlan(planKey);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ count: monthlyQuizCount }, { data: connections }] =
    await Promise.all([
      supabase
        .from("quizzes")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", userId)
        .gte("created_at", monthStart.toISOString()),
      supabaseAdmin
        .from("tutor_students")
        .select("student_id")
        .eq("tutor_id", userId)
        .eq("status", "active"),
    ]);

  const connectedStudentIds = Array.from(
    new Set(
      (connections ?? [])
        .map((connection) => connection.student_id)
        .filter((studentId) => studentId !== userId),
    ),
  );
  const totalStudents = connectedStudentIds.length;

  const quizLimit = plan.quizzesPerMonth;
  const quizPercentage = pct(monthlyQuizCount ?? 0, quizLimit);
  const isQuizWarning = quizPercentage >= 80;
  const isQuizOver = quizPercentage >= 100;
  const passiveImportHref =
    connectedStudentIds.length === 1
      ? `/vocabulary?student=${connectedStudentIds[0]}`
      : "/vocabulary";
  const passiveImportDescription =
    connectedStudentIds.length === 0
      ? messages.dashboard.tutor.passiveDescriptionNone
      : connectedStudentIds.length === 1
        ? messages.dashboard.tutor.passiveDescriptionSingle
        : messages.dashboard.tutor.passiveDescriptionMultiple;
  const passiveImportButtonLabel =
    connectedStudentIds.length === 0
      ? messages.dashboard.tutor.passiveButtonNone
      : connectedStudentIds.length === 1
        ? messages.dashboard.tutor.passiveButtonSingle
        : messages.dashboard.tutor.passiveButtonMultiple;

  return (
    <div className="space-y-6">
      <CustomizableDashboard
        storageKey={`vocab-crafter.dashboard-layout:tutor:${userId}`}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <DashboardCustomizableItem
          id="new-quiz"
          title={messages.dashboard.tutor.newQuizTitle}
        >
          <AnimatedCard>
            <Card data-tour-id="tutor-new-quiz">
              <CardHeader className="flex flex-row items-center gap-2">
                <PlusCircle className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">
                    {messages.dashboard.tutor.newQuizTitle}
                  </CardTitle>
                  <CardDescription>
                    {messages.dashboard.tutor.newQuizDescription}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto justify-center">
                <Button asChild className="w-full">
                  <Link href="/quizzes/new">
                    {messages.dashboard.tutor.createQuizButton}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="review"
          title={messages.dashboard.tutor.reviewTitle}
        >
          <AnimatedCard>
            <Card data-tour-id="tutor-review">
              <CardHeader className="flex flex-row items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">
                    {messages.dashboard.tutor.reviewTitle}
                  </CardTitle>
                  <CardDescription>
                    {messages.dashboard.tutor.reviewDescription}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto justify-center">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/assignments/review">
                    {messages.dashboard.tutor.reviewButton}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="passive-vocabulary"
          title={messages.dashboard.tutor.passiveTitle}
        >
          <AnimatedCard>
            <Card data-tour-id="tutor-passive-recognition">
              <CardHeader className="flex flex-row items-center gap-2">
                <BookMarked className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">
                    {messages.dashboard.tutor.passiveTitle}
                  </CardTitle>
                  <CardDescription>{passiveImportDescription}</CardDescription>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto justify-center">
                {connectedStudentIds.length > 0 ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={passiveImportHref}>
                      {passiveImportButtonLabel}
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    {passiveImportButtonLabel}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="students"
          title={messages.dashboard.tutor.studentsTitle}
        >
          <AnimatedCard>
            <Card data-tour-id="tutor-students">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {messages.dashboard.tutor.studentsTitle}
                </CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStudents}</div>
                <p className="text-xs text-muted-foreground">
                  {messages.dashboard.tutor.enrolledStudents}
                </p>
              </CardContent>
              <CardFooter className="mt-auto justify-center">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/students">
                    {messages.dashboard.tutor.viewStudentsButton}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>

        <DashboardCustomizableItem
          id="quizzes-created"
          title={messages.dashboard.tutor.quizzesCreatedTitle}
        >
          <AnimatedCard>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {messages.dashboard.tutor.quizzesCreatedTitle}
                </CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold">
                  {(monthlyQuizCount ?? 0).toLocaleString()}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {fmtLimit(quizLimit)}
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${isQuizOver ? "bg-red-500" : isQuizWarning ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(quizPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isFinite(quizLimit)
                    ? messages.dashboard.tutor.remainingThisMonth(
                        Math.max(0, quizLimit - (monthlyQuizCount ?? 0)),
                      )
                    : messages.dashboard.tutor.unlimited}
                </p>
              </CardContent>
            </Card>
          </AnimatedCard>
        </DashboardCustomizableItem>
      </CustomizableDashboard>
    </div>
  );
}
