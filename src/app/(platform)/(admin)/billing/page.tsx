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
import { CreditCard, Cpu, Zap, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

// Approximate per-request costs for Gemini 2.0 Flash
const COST_PER_QUIZ_GENERATION = 0.002; // ~500 input tokens + ~2000 output tokens
const COST_PER_TRANSLATION_EVAL = 0.0005; // ~200 input + 100 output
const MONTHLY_FREE_TIER_LIMIT = 1500; // free RPM approx

export default async function BillingPage() {
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

  // Count quiz generations (each quiz = 1 AI call)
  const { count: totalQuizzes } = await supabase
    .from("quizzes")
    .select("*", { count: "exact", head: true });

  // Count translation attempts (each translation quiz attempt ≈ N eval calls)
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

  // Monthly usage (current month)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: monthlyQuizzes } = await supabase
    .from("quizzes")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthStart.toISOString());

  const { data: monthlyTranslationAttempts } = await supabase
    .from("quiz_attempts")
    .select("answers, quizzes!inner(type)")
    .eq("quizzes.type", "translation")
    .gte("completed_at", monthStart.toISOString());

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing & Usage</h1>
        <p className="text-muted-foreground">
          AI usage costs and platform resource tracking.
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <Badge>Free Tier</Badge>
          </div>
          <CardDescription>
            Using Gemini 2.0 Flash free tier for AI quiz generation and
            translation evaluation.
          </CardDescription>
        </CardHeader>
      </Card>

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
              Est. for {new Date().toLocaleString("en-US", { month: "long" })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Usage</CardTitle>
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
    </div>
  );
}
