import { createAdminClient } from "@/lib/supabase/admin";
import {
  type AppLanguage,
} from "@/lib/i18n/app-language";
import { formatMonthNameForAppLanguage } from "@/lib/i18n/format";
import type { AppMessages } from "@/lib/i18n/messages";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BookOpen,
  Users,
  BarChart3,
  Clock,
  Cpu,
  Zap,
  CreditCard,
} from "lucide-react";
import {
  AnimatedDashboard,
  AnimatedCard,
} from "@/components/ui/animated-dashboard";
import { calculateTextCostUsd, calculateTtsCostUsd } from "@/lib/ai/usage";

function formatApproxUsd(value: number) {
  const digits = value > 0 && value < 0.01 ? 4 : 2;
  return `$${value.toFixed(digits)}`;
}

export async function AdminDashboard({
  appLanguage,
  messages,
}: {
  appLanguage: AppLanguage;
  messages: AppMessages;
}) {
  const supabaseAdmin = createAdminClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthISO = monthStart.toISOString();
  const monthLabel = formatMonthNameForAppLanguage(appLanguage, new Date());

  const [
    { count: userCount },
    { count: pendingUserCount },
    { count: totalQuizCount },
    { count: monthlyQuizCount },
    monthlyUsageEventsResult,
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending")
      .neq("role", "superadmin"),
    supabaseAdmin.from("quizzes").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthISO),
    supabaseAdmin
      .from("ai_usage_events")
      .select(
        "request_type, prompt_tokens, response_tokens, audio_output_tokens",
      )
      .gte("created_at", monthISO),
  ]);

  if (monthlyUsageEventsResult.error) {
    console.error("Failed to load admin dashboard AI usage summary:", {
      message: monthlyUsageEventsResult.error.message,
    });
  }

  const monthlyUsageEvents = monthlyUsageEventsResult.data ?? [];
  const textEvents = monthlyUsageEvents.filter(
    (event) => event.request_type === "text",
  );
  const ttsEvents = monthlyUsageEvents.filter(
    (event) => event.request_type === "tts",
  );
  const textRequestCount = textEvents.length;
  const ttsRequestCount = ttsEvents.length;
  const trackedRequestCount = monthlyUsageEvents.length;
  const textCost = calculateTextCostUsd(
    textEvents.reduce((sum, event) => sum + (event.prompt_tokens ?? 0), 0),
    textEvents.reduce((sum, event) => sum + (event.response_tokens ?? 0), 0),
  );
  const ttsCost = calculateTtsCostUsd(
    ttsEvents.reduce((sum, event) => sum + (event.prompt_tokens ?? 0), 0),
    ttsEvents.reduce((sum, event) => sum + (event.audio_output_tokens ?? 0), 0),
  );
  const totalTrackedCost = textCost + ttsCost;

  return (
    <div className="space-y-6">
      {(pendingUserCount ?? 0) > 0 ? (
        <Card className="border-amber-500/45 bg-amber-500/[0.05]">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <Clock className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">
                  {messages.dashboard.admin.pendingRequestsBannerTitle(
                    pendingUserCount ?? 0,
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {messages.dashboard.admin.pendingRequestsBannerDescription}
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link href="/users" prefetch={false}>
                {messages.dashboard.admin.reviewRequestsButton}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <AnimatedDashboard className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AnimatedCard>
          <Card data-tour-id="admin-quizzes-created">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.admin.quizzesCreatedTitle}
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(totalQuizCount ?? 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {messages.dashboard.admin.createdThisMonth(
                  monthlyQuizCount ?? 0,
                )}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-text-requests">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.admin.textRequestsTitle}
              </CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {textRequestCount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatApproxUsd(textCost)}{" "}
                {messages.dashboard.admin.trackedInMonth(monthLabel)}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-tts-requests">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.admin.ttsRequestsTitle}
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {ttsRequestCount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatApproxUsd(ttsCost)}{" "}
                {messages.dashboard.admin.trackedInMonth(monthLabel)}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-tracked-cost">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.admin.trackedCostTitle}
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatApproxUsd(totalTrackedCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {messages.dashboard.admin.trackedRequestsInMonth(
                  trackedRequestCount,
                  monthLabel,
                )}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-total-users">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {messages.dashboard.admin.totalUsersTitle}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                {messages.dashboard.admin.registeredUsers}
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>
      </AnimatedDashboard>

      <AnimatedDashboard className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatedCard>
          <Card data-tour-id="admin-analytics">
            <CardHeader className="flex flex-row items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">
                  {messages.dashboard.admin.analyticsTitle}
                </CardTitle>
                <CardDescription>
                  {messages.dashboard.admin.analyticsDescription}
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild className="w-full">
                <Link href="/analytics" prefetch={false}>
                  {messages.dashboard.admin.viewAnalyticsButton}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>

        <AnimatedCard>
          <Card data-tour-id="admin-users">
            <CardHeader className="flex flex-row items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">
                  {messages.dashboard.admin.usersTitle}
                </CardTitle>
                <CardDescription>
                  {messages.dashboard.admin.usersDescription}
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto justify-center">
              <Button asChild variant="outline" className="w-full">
                <Link href="/users" prefetch={false}>
                  {messages.dashboard.admin.manageUsersButton}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </AnimatedCard>
      </AnimatedDashboard>
    </div>
  );
}
