import {
  BookOpen,
  ClipboardList,
  Cpu,
  CreditCard,
  Database,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type PlanKey = "free" | "pro" | "premium";

export const PLAN_ORDER: PlanKey[] = ["free", "pro", "premium"];

export interface PlanDefinition {
  name: string;
  key: PlanKey;
  description: string;
  price: number; // monthly USD, 0 = free
  badge: "default" | "secondary" | "outline";
  aiCallsPerMonth: number;
  reportsPerMonth: number;
  quizzesPerMonth: number; // Infinity = unlimited
  attemptsPerMonth: number;
  wordBanks: number; // max saved word banks
  highlighted?: boolean; // "most popular" ring
}

export const DEFAULT_PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    name: "Free",
    key: "free",
    description: "Core practice tools for learners getting started.",
    price: 0,
    badge: "outline",
    aiCallsPerMonth: 500,
    reportsPerMonth: 0,
    quizzesPerMonth: 30,
    attemptsPerMonth: 100,
    wordBanks: 5,
  },
  pro: {
    name: "Pro",
    key: "pro",
    description: "Higher monthly limits for regular learners and tutors.",
    price: 9,
    badge: "default",
    aiCallsPerMonth: 3000,
    reportsPerMonth: 20,
    quizzesPerMonth: 200,
    attemptsPerMonth: 1000,
    wordBanks: 50,
    highlighted: true,
  },
  premium: {
    name: "Premium",
    key: "premium",
    description: "Generous AI capacity and open-ended practice limits.",
    price: 24,
    badge: "secondary",
    aiCallsPerMonth: 15000,
    reportsPerMonth: 80,
    quizzesPerMonth: Infinity,
    attemptsPerMonth: Infinity,
    wordBanks: Infinity,
  },
};

const PLAN_EXTRA_FEATURES: Record<PlanKey, string[]> = {
  free: ["All quiz types", "Community support"],
  pro: ["Priority AI generation", "Detailed analytics", "Email support"],
  premium: [
    "Custom grammar topics",
    "Priority support",
    "Early access to new features",
  ],
};

export type PlanLimitDetailKey =
  | "price"
  | "aiCalls"
  | "reports"
  | "quizzes"
  | "attempts"
  | "wordBanks";

export const PLAN_LIMIT_DETAIL_ORDER: PlanLimitDetailKey[] = [
  "price",
  "aiCalls",
  "reports",
  "quizzes",
  "attempts",
  "wordBanks",
];

export const PLAN_LIMIT_DETAILS: Record<
  PlanLimitDetailKey,
  {
    title: string;
    description: string;
    extra?: string;
    icon: LucideIcon;
  }
> = {
  price: {
    title: "Monthly Price",
    description:
      "The subscription amount charged per month for the plan. Free plans cost $0.",
    extra:
      "This page describes plan limits only. Actual payment collection can still be wired separately.",
    icon: CreditCard,
  },
  aiCalls: {
    title: "AI Calls",
    description: "One AI call is one completed Gemini request made by the app.",
    extra:
      "This includes generating quizzes, parsing pasted vocabulary, evaluating translation answers, building Review Activity quizzes, and server-side text-to-speech generation. Replaying already cached audio in the browser does not consume a new AI call.",
    icon: Cpu,
  },
  reports: {
    title: "AI Reports",
    description:
      "How many long-form student progress reports can be generated in one calendar month.",
    extra:
      "These reports are intended to use a stronger model with larger prompts and better reasoning, so the limit is kept separate from regular AI calls.",
    icon: Sparkles,
  },
  quizzes: {
    title: "Quizzes Created",
    description: "How many quizzes a user can create in one calendar month.",
    extra:
      "Saved Review Activity sessions count as quizzes because they are stored in the quizzes table.",
    icon: BookOpen,
  },
  attempts: {
    title: "Quiz Attempts",
    description:
      "How many completed quiz submissions a user can make in one calendar month.",
    extra:
      "Opening a quiz does not count by itself. An attempt is counted when a completed submission is saved.",
    icon: ClipboardList,
  },
  wordBanks: {
    title: "Word Banks",
    description:
      "How many saved word-bank collections a user can keep at once.",
    extra:
      "Vocabulary imported directly into mastery is separate from word banks and does not count toward this limit.",
    icon: Database,
  },
};

export function buildPlanFeatures(plan: PlanDefinition): string[] {
  const features = [`${fmtLimit(plan.aiCallsPerMonth)} AI calls / month`];

  features.push(
    plan.reportsPerMonth > 0
      ? `${fmtLimit(plan.reportsPerMonth)} AI reports / month`
      : "No AI report generation",
  );

  if (
    !Number.isFinite(plan.quizzesPerMonth) &&
    !Number.isFinite(plan.attemptsPerMonth)
  ) {
    features.push("Unlimited quizzes & attempts");
  } else {
    features.push(
      Number.isFinite(plan.quizzesPerMonth)
        ? `Create up to ${fmtLimit(plan.quizzesPerMonth)} quizzes`
        : "Unlimited quizzes",
    );
    features.push(
      Number.isFinite(plan.attemptsPerMonth)
        ? `${fmtLimit(plan.attemptsPerMonth)} quiz attempts`
        : "Unlimited quiz attempts",
    );
  }

  features.push(
    Number.isFinite(plan.wordBanks)
      ? `${fmtLimit(plan.wordBanks)} word banks`
      : "Unlimited word banks",
  );

  return [...features, ...PLAN_EXTRA_FEATURES[plan.key]];
}

/** Format a limit number for display (∞ for Infinity) */
export function fmtLimit(n: number): string {
  if (!isFinite(n)) return "∞";
  return n.toLocaleString();
}
