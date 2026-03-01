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
  CreditCard,
  Cpu,
  Zap,
  TrendingUp,
  BookOpen,
  ClipboardList,
  Crown,
  Sparkles,
} from "lucide-react";
import type { Role } from "@/types/roles";

export const dynamic = "force-dynamic";

/* ─── Plan definitions ─── */
interface Plan {
  name: string;
  badge: "default" | "secondary" | "outline";
  quizzesPerMonth: number;
  attemptsPerMonth: number;
  aiCallsPerMonth: number;
  features: string[];
}

const PLANS: Record<string, Plan> = {
  free: {
    name: "Free",
    badge: "outline",
    quizzesPerMonth: 15,
    attemptsPerMonth: 50,
    aiCallsPerMonth: 100,
    features: [
      "Up to 15 quizzes / month",
      "50 quiz attempts / month",
      "Basic quiz types (MCQ, Gap-fill)",
      "Community support",
    ],
  },
  pro: {
    name: "Pro",
    badge: "default",
    quizzesPerMonth: 100,
    attemptsPerMonth: 500,
    aiCallsPerMonth: 1000,
    features: [
      "Up to 100 quizzes / month",
      "500 quiz attempts / month",
      "All quiz types incl. Translation & Flashcards",
      "Priority AI generation",
      "Detailed analytics",
      "Email support",
    ],
  },
  premium: {
    name: "Premium",
    badge: "secondary",
    quizzesPerMonth: Infinity,
    attemptsPerMonth: Infinity,
    aiCallsPerMonth: 5000,
    features: [
      "Unlimited quizzes & attempts",
      "5 000 AI calls / month",
      "Advanced grammar topics",
      "Custom word banks",
      "Priority support",
      "Early access to new features",
    ],
  },
};

/* ─── Cost constants (admin view) ─── */
const COST_PER_QUIZ_GENERATION = 0.002;
const COST_PER_TRANSLATION_EVAL = 0.0005;
const MONTHLY_FREE_TIER_LIMIT = 1500;

/* ─── Page ─── */
export default async function BillingPage() {
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
  if (!profile) redirect("/login");

  const role = profile.role as Role;

  // ── Common: personal usage this month ──
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthISO = monthStart.toISOString();

  const { count: myMonthlyQuizzes } = await supabase
    .from("quizzes")
    .select("*", { count: "exact", head: true })
    .eq("creator_id", user.id)
    .gte("created_at", monthISO);

  const { count: myMonthlyAttempts } = await supabase
    .from("quiz_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("completed_at", monthISO);

  // User's plan (stored in profile or default to 'free')
  // For now everyone is on the free plan — when you add Stripe,
  // you'll read `profile.plan` from the database.
  const userPlanKey = "free";
  const plan = PLANS[userPlanKey];

  const quizUsagePct =
    plan.quizzesPerMonth === Infinity
      ? 0
      : Math.min(
          100,
          Math.round(
            ((myMonthlyQuizzes ?? 0) / plan.quizzesPerMonth) * 100,
          ),
        );

  const attemptUsagePct =
    plan.attemptsPerMonth === Infinity
      ? 0
      : Math.min(
          100,
          Math.round(
            ((myMonthlyAttempts ?? 0) / plan.attemptsPerMonth) * 100,
          ),
        );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Billing &amp; Usage
        </h1>
        <p className="text-muted-foreground">
          {role === "superadmin"
            ? "Platform-wide AI costs and your personal usage."
            : "Your current plan, quota and usage this month."}
        </p>
      </div>

      {/* ── Current Plan Card ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Current Plan
            </CardTitle>
            <Badge variant={plan.badge}>{plan.name}</Badge>
          </div>
          <CardDescription>
            {userPlanKey === "free"
              ? "You are on the Free tier. Upgrade to unlock more quizzes and AI features."
              : `You are on the ${plan.name} plan.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ── Personal Usage Cards ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quizzes created */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Quizzes Created
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">
              {myMonthlyQuizzes ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                /{" "}
                {plan.quizzesPerMonth === Infinity
                  ? "∞"
                  : plan.quizzesPerMonth}
              </span>
            </div>
            <Progress value={quizUsagePct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {plan.quizzesPerMonth === Infinity
                ? "Unlimited"
                : `${plan.quizzesPerMonth - (myMonthlyQuizzes ?? 0)} remaining this month`}
            </p>
          </CardContent>
        </Card>

        {/* Quiz attempts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Quiz Attempts</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">
              {myMonthlyAttempts ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                /{" "}
                {plan.attemptsPerMonth === Infinity
                  ? "∞"
                  : plan.attemptsPerMonth}
              </span>
            </div>
            <Progress value={attemptUsagePct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {plan.attemptsPerMonth === Infinity
                ? "Unlimited"
                : `${plan.attemptsPerMonth - (myMonthlyAttempts ?? 0)} remaining this month`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Upgrade Prompt (free users only) ── */}
      {userPlanKey === "free" && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Pro card */}
          <Card className="border-primary/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Pro
                </CardTitle>
                <Badge>$9 / mo</Badge>
              </div>
              <CardDescription>
                For active learners and tutors who need more capacity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {PLANS.pro.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Premium card */}
          <Card className="border-yellow-500/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  Premium
                </CardTitle>
                <Badge variant="secondary">$24 / mo</Badge>
              </div>
              <CardDescription>
                Unlimited access for power users and institutions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {PLANS.premium.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Superadmin: Platform-wide AI usage ── */}
      {role === "superadmin" && <AdminUsageSection />}
    </div>
  );
}

/* ─────────────────────────────────────────── */
/* Admin-only: platform-wide AI cost tracking  */
/* ─────────────────────────────────────────── */
async function AdminUsageSection() {
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthISO = monthStart.toISOString();

  // All-time
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

  // Monthly
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
  const usagePct = Math.min(
    100,
    Math.round((monthlyAICalls / MONTHLY_FREE_TIER_LIMIT) * 100),
  );

  return (
    <>
      <div className="pt-2">
        <h2 className="text-xl font-semibold tracking-tight">
          Platform AI Usage
        </h2>
        <p className="text-sm text-muted-foreground">
          Gemini 2.0 Flash cost estimates (superadmin only)
        </p>
      </div>

      {/* Key Metrics */}
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
            <p className="text-xs text-muted-foreground">All-time API calls</p>
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
            <p className="text-xs text-muted-foreground">This month so far</p>
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
              Est. for{" "}
              {new Date().toLocaleString("en-US", { month: "long" })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly AI Usage</CardTitle>
          <CardDescription>
            {monthlyAICalls} / {MONTHLY_FREE_TIER_LIMIT} free tier requests used
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={usagePct} className="h-3" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{usagePct}% used</span>
            <span>{MONTHLY_FREE_TIER_LIMIT - monthlyAICalls} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quiz Generation</CardTitle>
            <CardDescription>
              AI calls for generating quiz content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Total quizzes generated</span>
              <Badge variant="outline">{totalQuizzes ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>This month</span>
              <Badge variant="outline">{monthlyQuizzes ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Cost per generation</span>
              <span className="text-muted-foreground">
                ~${COST_PER_QUIZ_GENERATION.toFixed(4)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Translation Evaluation</CardTitle>
            <CardDescription>
              AI calls for evaluating student translations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Total evaluations</span>
              <Badge variant="outline">{translationEvalCalls}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>This month</span>
              <Badge variant="outline">{monthlyTranslationEvals}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Cost per evaluation</span>
              <span className="text-muted-foreground">
                ~${COST_PER_TRANSLATION_EVAL.toFixed(4)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
