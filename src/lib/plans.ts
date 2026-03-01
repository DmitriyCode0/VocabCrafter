export type PlanKey = "free" | "pro" | "premium";

export interface PlanDefinition {
  name: string;
  key: PlanKey;
  price: number; // monthly USD, 0 = free
  badge: "default" | "secondary" | "outline";
  aiCallsPerMonth: number;
  quizzesPerMonth: number; // Infinity = unlimited
  attemptsPerMonth: number;
  wordBanks: number; // max saved word banks
  features: string[];
  highlighted?: boolean; // "most popular" ring
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    name: "Free",
    key: "free",
    price: 0,
    badge: "outline",
    aiCallsPerMonth: 500,
    quizzesPerMonth: 30,
    attemptsPerMonth: 100,
    wordBanks: 5,
    features: [
      "500 AI calls / month",
      "Create up to 30 quizzes",
      "100 quiz attempts",
      "5 word banks",
      "All quiz types",
      "Community support",
    ],
  },
  pro: {
    name: "Pro",
    key: "pro",
    price: 9,
    badge: "default",
    aiCallsPerMonth: 3000,
    quizzesPerMonth: 200,
    attemptsPerMonth: 1000,
    wordBanks: 50,
    highlighted: true,
    features: [
      "3 000 AI calls / month",
      "Create up to 200 quizzes",
      "1 000 quiz attempts",
      "50 word banks",
      "Priority AI generation",
      "Detailed analytics",
      "Email support",
    ],
  },
  premium: {
    name: "Premium",
    key: "premium",
    price: 24,
    badge: "secondary",
    aiCallsPerMonth: 15000,
    quizzesPerMonth: Infinity,
    attemptsPerMonth: Infinity,
    wordBanks: Infinity,
    features: [
      "15 000 AI calls / month",
      "Unlimited quizzes & attempts",
      "Unlimited word banks",
      "Custom grammar topics",
      "Priority support",
      "Early access to new features",
    ],
  },
};

/** Get the plan matching a DB value, falling back to free */
export function getPlan(key: string | null | undefined): PlanDefinition {
  if (key && key in PLANS) return PLANS[key as PlanKey];
  return PLANS.free;
}

/** Format a limit number for display (∞ for Infinity) */
export function fmtLimit(n: number): string {
  if (!isFinite(n)) return "∞";
  return n.toLocaleString();
}
