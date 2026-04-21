import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Cpu,
  Zap,
  TrendingUp,
  BookOpen,
  ClipboardList,
  Crown,
  Check,
  Database,
} from "lucide-react";
import type { Role } from "@/types/roles";
import { fmtLimit } from "@/lib/plans";
import { getPlan } from "@/lib/plans-server";
import { normalizeAppLanguage, type AppLanguage } from "@/lib/i18n/app-language";
import { formatMonthNameForAppLanguage } from "@/lib/i18n/format";
import { getAppMessages, type AppMessages } from "@/lib/i18n/messages";
import {
  getLocalizedPlanFeatures,
  getLocalizedPlanName,
} from "@/lib/i18n/plans";
import {
  AUDIO_TOKENS_PER_SECOND,
  GEMINI_TEXT_INPUT_COST_PER_MILLION,
  GEMINI_TEXT_OUTPUT_COST_PER_MILLION,
  GEMINI_TTS_INPUT_COST_PER_MILLION,
  GEMINI_TTS_OUTPUT_COST_PER_MILLION,
  calculateTextCostUsd,
  calculateTtsCostUsd,
} from "@/lib/ai/usage";
import { GEMINI_MODEL, GEMINI_TTS_MODEL } from "@/lib/gemini/client";

export const dynamic = "force-dynamic";

/* ─── helpers ─── */
function pct(used: number, total: number) {
  if (!isFinite(total) || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function formatApproxUsd(value: number) {
  const digits = value > 0 && value < 0.01 ? 4 : 2;
  return `$${value.toFixed(digits)}`;
}

function isCurrentMonth(
  isoString: string | null | undefined,
  monthStart: Date,
) {
  if (!isoString) {
    return false;
  }

  const date = new Date(isoString);
  return (
    date.getUTCFullYear() === monthStart.getUTCFullYear() &&
    date.getUTCMonth() === monthStart.getUTCMonth()
  );
}

/* ─── Page ─── */
export default async function BillingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, plan, ai_calls_this_month, ai_calls_reset_at, app_language")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const role = profile.role as Role;
  const appLanguage = normalizeAppLanguage(profile.app_language);
  const messages = getAppMessages(appLanguage);
  const plan = await getPlan(profile.plan);
  const isSuperadmin = role === "superadmin";

  /* ── Auto-reset monthly counter if needed ── */
  const resetAt = new Date(profile.ai_calls_reset_at);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  let aiCallsUsed = profile.ai_calls_this_month ?? 0;
  if (resetAt < monthStart) {
    // New month — reset counter (fire-and-forget)
    aiCallsUsed = 0;
    supabase
      .from("profiles")
      .update({
        ai_calls_this_month: 0,
        ai_calls_reset_at: monthStart.toISOString(),
      })
      .eq("id", user.id)
      .then(() => {});
  }

  /* ── Personal usage this month ── */
  const monthISO = monthStart.toISOString();

  let quizUsed = 0;
  let attemptUsed = 0;
  let wbUsed = 0;

  if (!isSuperadmin) {
    const [myMonthlyQuizzesResult, myMonthlyAttemptsResult, myWordBanksResult] =
      await Promise.all([
        supabase
          .from("quizzes")
          .select("*", { count: "exact", head: true })
          .eq("creator_id", user.id)
          .gte("created_at", monthISO),
        supabase
          .from("quiz_attempts")
          .select("*", { count: "exact", head: true })
          .eq("student_id", user.id)
          .gte("completed_at", monthISO),
        supabase
          .from("word_banks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

    quizUsed = myMonthlyQuizzesResult.count ?? 0;
    attemptUsed = myMonthlyAttemptsResult.count ?? 0;
    wbUsed = myWordBanksResult.count ?? 0;
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.billing.title}
          </h1>
          <p className="text-muted-foreground">
            {isSuperadmin
              ? messages.billing.adminDescription
              : messages.billing.userDescription}
          </p>
        </div>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/plans">{messages.billing.openPlans}</Link>
        </Button>
      </div>

      {!isSuperadmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                {messages.billing.currentPlanTitle(
                  getLocalizedPlanName(messages, plan.key),
                )}
              </CardTitle>
              <Badge variant={plan.badge}>
                {plan.price === 0
                  ? messages.billing.freeBadge
                  : messages.billing.paidBadge(plan.price)}
              </Badge>
            </div>
            <CardDescription>
              {plan.key === "free"
                ? messages.billing.freePlanDescription
                : messages.billing.subscribedDescription(
                    getLocalizedPlanName(messages, plan.key),
                  )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {getLocalizedPlanFeatures(messages, plan).map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════ */}
      {/*  Usage meters                           */}
      {/* ═══════════════════════════════════════ */}
      {isSuperadmin ? (
        <SuperadminOverviewCards appLanguage={appLanguage} messages={messages} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UsageMeter
            title={messages.billing.usageTitles.aiCalls}
            icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
            used={aiCallsUsed}
            limit={plan.aiCallsPerMonth}
            color="bg-violet-500"
            messages={messages}
          />
          <UsageMeter
            title={messages.billing.usageTitles.quizzesCreated}
            icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}
            used={quizUsed}
            limit={plan.quizzesPerMonth}
            color="bg-blue-500"
            messages={messages}
          />
          <UsageMeter
            title={messages.billing.usageTitles.quizAttempts}
            icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
            used={attemptUsed}
            limit={plan.attemptsPerMonth}
            color="bg-emerald-500"
            messages={messages}
          />
          <UsageMeter
            title={messages.billing.usageTitles.wordBanks}
            icon={<Database className="h-4 w-4 text-muted-foreground" />}
            used={wbUsed}
            limit={plan.wordBanks}
            color="bg-amber-500"
            isTotal
            messages={messages}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/*  Superadmin: Platform AI cost section   */}
      {/* ═══════════════════════════════════════ */}
      {role === "superadmin" && (
        <AdminUsageSection appLanguage={appLanguage} messages={messages} />
      )}
    </div>
  );
}

async function SuperadminOverviewCards({
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

  const [
    profilesResult,
    totalQuizzesResult,
    monthlyQuizzesResult,
    totalAttemptsResult,
    monthlyAttemptsResult,
    totalWordBanksResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("ai_calls_this_month, ai_calls_reset_at"),
    supabaseAdmin.from("quizzes").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthISO),
    supabaseAdmin
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .gte("completed_at", monthISO),
    supabaseAdmin
      .from("word_banks")
      .select("id", { count: "exact", head: true }),
  ]);

  const totalAiCallsThisMonth = (profilesResult.data ?? []).reduce(
    (sum, profile) => {
      if (!isCurrentMonth(profile.ai_calls_reset_at, monthStart)) {
        return sum;
      }

      return sum + (profile.ai_calls_this_month ?? 0);
    },
    0,
  );
  const totalQuizzes = totalQuizzesResult.count ?? 0;
  const monthlyQuizzes = monthlyQuizzesResult.count ?? 0;
  const totalAttempts = totalAttemptsResult.count ?? 0;
  const monthlyAttempts = monthlyAttemptsResult.count ?? 0;
  const totalWordBanks = totalWordBanksResult.count ?? 0;
  const monthLabel = formatMonthNameForAppLanguage(appLanguage, new Date());

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <PlatformStatCard
        title={messages.billing.usageTitles.aiCalls}
        icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
        value={totalAiCallsThisMonth.toLocaleString()}
        description={messages.billing.platformDescriptions.aiCalls(monthLabel)}
      />
      <PlatformStatCard
        title={messages.billing.usageTitles.quizzesCreated}
        icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}
        value={totalQuizzes.toLocaleString()}
        description={messages.billing.platformDescriptions.quizzesCreated(
          monthlyQuizzes.toLocaleString(),
        )}
      />
      <PlatformStatCard
        title={messages.billing.usageTitles.quizAttempts}
        icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
        value={totalAttempts.toLocaleString()}
        description={messages.billing.platformDescriptions.quizAttempts(
          monthlyAttempts.toLocaleString(),
        )}
      />
      <PlatformStatCard
        title={messages.billing.usageTitles.wordBanks}
        icon={<Database className="h-4 w-4 text-muted-foreground" />}
        value={totalWordBanks.toLocaleString()}
        description={messages.billing.platformDescriptions.wordBanks}
      />
    </div>
  );
}

function PlatformStatCard({
  title,
  icon,
  value,
  description,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── */
/*  Reusable usage meter card  */
/* ─────────────────────────── */
function UsageMeter({
  title,
  icon,
  used,
  limit,
  color,
  isTotal,
  messages,
}: {
  title: string;
  icon: React.ReactNode;
  used: number;
  limit: number;
  color: string;
  isTotal?: boolean;
  messages: AppMessages;
}) {
  const percentage = pct(used, limit);
  const isWarning = percentage >= 80;
  const isOver = percentage >= 100;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold">
          {used.toLocaleString()}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            / {fmtLimit(limit)}
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : isWarning ? "bg-amber-500" : color}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {isFinite(limit)
            ? isTotal
              ? messages.billing.remaining(
                  Math.max(0, limit - used).toLocaleString(),
                )
              : messages.billing.remainingThisMonth(
                  Math.max(0, limit - used).toLocaleString(),
                )
            : messages.billing.unlimited}
        </p>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────── */
/*  Admin-only: platform-wide AI cost section  */
/* ─────────────────────────────────────────── */
async function AdminUsageSection({
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

  const [profilesResult, monthlyUsageEventsResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("ai_calls_this_month, ai_calls_reset_at"),
    supabaseAdmin
      .from("ai_usage_events")
      .select(
        "request_type, prompt_tokens, response_tokens, audio_output_tokens, is_estimated",
      )
      .gte("created_at", monthISO),
  ]);

  if (profilesResult.error || monthlyUsageEventsResult.error) {
    console.error("Failed to load AI billing metrics:", {
      profilesError: profilesResult.error,
      usageEventsError: monthlyUsageEventsResult.error,
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {messages.billing.loadFailedTitle}
          </CardTitle>
          <CardDescription>
            {messages.billing.loadFailedDescription}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalAiCallsThisMonth = (profilesResult.data ?? []).reduce(
    (sum, profile) => {
      if (!isCurrentMonth(profile.ai_calls_reset_at, monthStart)) {
        return sum;
      }

      return sum + (profile.ai_calls_this_month ?? 0);
    },
    0,
  );
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
  const estimatedEventCount = monthlyUsageEvents.filter(
    (event) => event.is_estimated,
  ).length;
  const legacyCombinedCalls = Math.max(
    0,
    totalAiCallsThisMonth - trackedRequestCount,
  );

  const textPromptTokens = textEvents.reduce(
    (sum, event) => sum + (event.prompt_tokens ?? 0),
    0,
  );
  const textResponseTokens = textEvents.reduce(
    (sum, event) => sum + (event.response_tokens ?? 0),
    0,
  );
  const ttsPromptTokens = ttsEvents.reduce(
    (sum, event) => sum + (event.prompt_tokens ?? 0),
    0,
  );
  const ttsAudioOutputTokens = ttsEvents.reduce(
    (sum, event) => sum + (event.audio_output_tokens ?? 0),
    0,
  );

  const textCost = calculateTextCostUsd(textPromptTokens, textResponseTokens);
  const ttsCost = calculateTtsCostUsd(ttsPromptTokens, ttsAudioOutputTokens);
  const totalTrackedCost = textCost + ttsCost;

  return (
    <>
      <Separator className="my-2" />

      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {messages.billing.platformAiUsageTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {messages.billing.platformAiUsageDescription(
            GEMINI_MODEL,
            GEMINI_TTS_MODEL,
            monthLabel,
          )}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.billing.usageTitles.textRequests}
            </CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {textRequestCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {messages.billing.textRequestsSummary(
                formatApproxUsd(textCost),
                textPromptTokens.toLocaleString(),
                textResponseTokens.toLocaleString(),
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.billing.usageTitles.ttsRequests}
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ttsRequestCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {messages.billing.ttsRequestsSummary(
                formatApproxUsd(ttsCost),
                ttsPromptTokens.toLocaleString(),
                ttsAudioOutputTokens.toLocaleString(),
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.billing.usageTitles.trackedAiCost}
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatApproxUsd(totalTrackedCost)}
            </div>
            <p className="text-xs text-muted-foreground">
              {messages.billing.trackedCostSummary(
                trackedRequestCount.toLocaleString(),
                monthLabel,
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.billing.usageTitles.unallocatedCalls}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {legacyCombinedCalls.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {legacyCombinedCalls > 0
                ? messages.billing.unallocatedCallsOld
                : messages.billing.unallocatedCallsNone}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {messages.billing.pricingBasisTitle}
          </CardTitle>
          <CardDescription>
            {messages.billing.pricingBasisDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium text-foreground">{GEMINI_MODEL}</p>
              <p>
                {messages.billing.inputTokensPrice(
                  formatApproxUsd(GEMINI_TEXT_INPUT_COST_PER_MILLION),
                )}
              </p>
              <p>
                {messages.billing.outputTokensPrice(
                  formatApproxUsd(GEMINI_TEXT_OUTPUT_COST_PER_MILLION),
                )}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium text-foreground">{GEMINI_TTS_MODEL}</p>
              <p>
                {messages.billing.inputTextTokensPrice(
                  formatApproxUsd(GEMINI_TTS_INPUT_COST_PER_MILLION),
                )}
              </p>
              <p>
                {messages.billing.outputAudioTokensPrice(
                  formatApproxUsd(GEMINI_TTS_OUTPUT_COST_PER_MILLION),
                )}
              </p>
            </div>
          </div>
          <p className="text-xs">
            {messages.billing.estimationNote(AUDIO_TOKENS_PER_SECOND)}
          </p>
          <p className="text-xs">
            {messages.billing.estimatedRequests(estimatedEventCount)}
          </p>
          {legacyCombinedCalls > 0 && (
            <p className="text-xs">
              {messages.billing.legacyCombinedCalls(
                monthLabel,
                legacyCombinedCalls.toLocaleString(),
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
