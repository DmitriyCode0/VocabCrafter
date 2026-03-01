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
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Cpu,
  Zap,
  TrendingUp,
  BookOpen,
  ClipboardList,
  Crown,
  Sparkles,
  Check,
  Database,
} from "lucide-react";
import type { Role } from "@/types/roles";
import { PLANS, getPlan, fmtLimit, type PlanKey } from "@/lib/plans";

export const dynamic = "force-dynamic";

/* ─── Cost constants (admin view) ─── */
const COST_PER_QUIZ_GENERATION = 0.002;
const COST_PER_TRANSLATION_EVAL = 0.0005;
const MONTHLY_GEMINI_FREE_LIMIT = 1500;

/* ─── helpers ─── */
function pct(used: number, total: number) {
  if (!isFinite(total) || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
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
    .select("role, plan, ai_calls_this_month, ai_calls_reset_at")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const role = profile.role as Role;
  const plan = getPlan(profile.plan);

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

  const { count: myMonthlyQuizzes } = await supabase
    .from("quizzes")
    .select("*", { count: "exact", head: true })
    .eq("creator_id", user.id)
    .gte("created_at", monthISO);

  const { count: myMonthlyAttempts } = await supabase
    .from("quiz_attempts")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user.id)
    .gte("completed_at", monthISO);

  const { count: myWordBanks } = await supabase
    .from("word_banks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const quizUsed = myMonthlyQuizzes ?? 0;
  const attemptUsed = myMonthlyAttempts ?? 0;
  const wbUsed = myWordBanks ?? 0;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Billing &amp; Usage
        </h1>
        <p className="text-muted-foreground">
          {role === "superadmin"
            ? "Your plan, usage quotas, and platform-wide AI cost tracking."
            : "Your current plan and quota usage this month."}
        </p>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/*  Current Plan                           */}
      {/* ═══════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              {plan.name} Plan
            </CardTitle>
            <Badge variant={plan.badge}>
              {plan.price === 0 ? "Free" : `$${plan.price}/mo`}
            </Badge>
          </div>
          <CardDescription>
            {plan.key === "free"
              ? "You are on the Free tier — all core features included."
              : `You are subscribed to the ${plan.name} plan.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                {f}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════ */}
      {/*  Usage meters                           */}
      {/* ═══════════════════════════════════════ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UsageMeter
          title="AI Calls"
          icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
          used={aiCallsUsed}
          limit={plan.aiCallsPerMonth}
          color="bg-violet-500"
        />
        <UsageMeter
          title="Quizzes Created"
          icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}
          used={quizUsed}
          limit={plan.quizzesPerMonth}
          color="bg-blue-500"
        />
        <UsageMeter
          title="Quiz Attempts"
          icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
          used={attemptUsed}
          limit={plan.attemptsPerMonth}
          color="bg-emerald-500"
        />
        <UsageMeter
          title="Word Banks"
          icon={<Database className="h-4 w-4 text-muted-foreground" />}
          used={wbUsed}
          limit={plan.wordBanks}
          color="bg-amber-500"
          isTotal
        />
      </div>

      {/* ═══════════════════════════════════════ */}
      {/*  Available Plans                        */}
      {/* ═══════════════════════════════════════ */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight mb-1">
          Available Plans
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Compare features and choose the plan that fits your learning goals.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(PLANS) as PlanKey[]).map((key) => {
            const p = PLANS[key];
            const isCurrent = key === plan.key;
            return (
              <Card
                key={key}
                className={
                  isCurrent
                    ? "border-primary ring-2 ring-primary/20"
                    : p.highlighted
                      ? "border-primary/40"
                      : ""
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {key === "premium" ? (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      ) : key === "pro" ? (
                        <Zap className="h-4 w-4 text-primary" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                      )}
                      {p.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {isCurrent && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                      {p.highlighted && !isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Popular
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="text-3xl font-bold">
                      {p.price === 0 ? "Free" : `$${p.price}`}
                    </span>
                    {p.price > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        / month
                      </span>
                    )}
                  </div>
                </CardHeader>

                <Separator />

                <CardContent className="pt-4">
                  {/* Limits summary */}
                  <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                    <div>
                      <p className="font-medium">
                        {fmtLimit(p.aiCallsPerMonth)}
                      </p>
                      <p className="text-xs text-muted-foreground">AI calls</p>
                    </div>
                    <div>
                      <p className="font-medium">
                        {fmtLimit(p.quizzesPerMonth)}
                      </p>
                      <p className="text-xs text-muted-foreground">Quizzes</p>
                    </div>
                    <div>
                      <p className="font-medium">
                        {fmtLimit(p.attemptsPerMonth)}
                      </p>
                      <p className="text-xs text-muted-foreground">Attempts</p>
                    </div>
                    <div>
                      <p className="font-medium">{fmtLimit(p.wordBanks)}</p>
                      <p className="text-xs text-muted-foreground">
                        Word banks
                      </p>
                    </div>
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-1.5">
                    {p.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA placeholder — Stripe integration later */}
                  {!isCurrent && p.price > 0 && (
                    <div className="mt-4 rounded-md bg-muted/50 p-3 text-center text-xs text-muted-foreground">
                      Coming soon
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/*  Superadmin: Platform AI cost section   */}
      {/* ═══════════════════════════════════════ */}
      {role === "superadmin" && <AdminUsageSection />}
    </div>
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
}: {
  title: string;
  icon: React.ReactNode;
  used: number;
  limit: number;
  color: string;
  isTotal?: boolean;
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
              ? `${Math.max(0, limit - used).toLocaleString()} remaining`
              : `${Math.max(0, limit - used).toLocaleString()} remaining this month`
            : "Unlimited"}
        </p>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────── */
/*  Admin-only: platform-wide AI cost section  */
/* ─────────────────────────────────────────── */
async function AdminUsageSection() {
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthISO = monthStart.toISOString();

  const { count: totalQuizzes } = await supabase
    .from("quizzes")
    .select("*", { count: "exact", head: true });

  const { data: translationAttempts } = await supabase
    .from("quiz_attempts")
    .select("answers, quizzes!inner(type)")
    .eq("quizzes.type", "translation");

  let translationEvalCalls = 0;
  translationAttempts?.forEach((a) => {
    const answers = a.answers as Record<string, unknown>;
    translationEvalCalls += Object.keys(answers).length;
  });

  const totalAICalls = (totalQuizzes ?? 0) + translationEvalCalls;
  const estimatedCost =
    (totalQuizzes ?? 0) * COST_PER_QUIZ_GENERATION +
    translationEvalCalls * COST_PER_TRANSLATION_EVAL;

  const { count: monthlyQuizzes } = await supabase
    .from("quizzes")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthISO);

  const { data: monthlyTranslationAttempts } = await supabase
    .from("quiz_attempts")
    .select("answers, quizzes!inner(type)")
    .eq("quizzes.type", "translation")
    .gte("completed_at", monthISO);

  let monthlyTranslationEvals = 0;
  monthlyTranslationAttempts?.forEach((a) => {
    const answers = a.answers as Record<string, unknown>;
    monthlyTranslationEvals += Object.keys(answers).length;
  });

  const monthlyAICalls = (monthlyQuizzes ?? 0) + monthlyTranslationEvals;
  const monthlyCost =
    (monthlyQuizzes ?? 0) * COST_PER_QUIZ_GENERATION +
    monthlyTranslationEvals * COST_PER_TRANSLATION_EVAL;
  const usagePct = pct(monthlyAICalls, MONTHLY_GEMINI_FREE_LIMIT);

  return (
    <>
      <Separator className="my-2" />

      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Platform AI Usage
        </h2>
        <p className="text-sm text-muted-foreground">
          Gemini 2.0 Flash cost estimates (superadmin only)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total AI Calls
            </CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAICalls}</div>
            <p className="text-xs text-muted-foreground">All-time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Est. Total Cost
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${estimatedCost.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Covered by free tier
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Calls</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyAICalls}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthlyCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleString("en-US", { month: "long" })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gemini Free Tier Usage</CardTitle>
          <CardDescription>
            {monthlyAICalls.toLocaleString()} /{" "}
            {MONTHLY_GEMINI_FREE_LIMIT.toLocaleString()} free-tier requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={usagePct} className="h-3" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{usagePct}% used</span>
            <span>
              {(MONTHLY_GEMINI_FREE_LIMIT - monthlyAICalls).toLocaleString()}{" "}
              remaining
            </span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
