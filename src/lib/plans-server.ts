import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PLANS,
  PLAN_ORDER,
  type PlanDefinition,
  type PlanKey,
} from "@/lib/plans";
import type { Database } from "@/types/database";

type PlanLimitRow = Database["public"]["Tables"]["plan_limits"]["Row"];

function toPlanLimitValue(value: number | null | undefined, fallback: number) {
  return value == null ? fallback : value;
}

function isMissingPlanLimitsTableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    candidate.message?.includes("plan_limits") ||
    false
  );
}

function mergePlanLimitRow(
  planKey: PlanKey,
  row: PlanLimitRow | undefined,
): PlanDefinition {
  const fallback = DEFAULT_PLANS[planKey];

  return {
    ...fallback,
    price: toPlanLimitValue(row?.price, fallback.price),
    aiCallsPerMonth: toPlanLimitValue(
      row?.ai_calls_per_month,
      fallback.aiCallsPerMonth,
    ),
    quizzesPerMonth:
      row?.quizzes_per_month == null
        ? fallback.quizzesPerMonth
        : row.quizzes_per_month,
    attemptsPerMonth:
      row?.attempts_per_month == null
        ? fallback.attemptsPerMonth
        : row.attempts_per_month,
    wordBanks:
      row?.word_banks == null ? fallback.wordBanks : row.word_banks,
  };
}

export async function getPlansCatalog(): Promise<Record<PlanKey, PlanDefinition>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("plan_limits").select("*");

  if (error) {
    if (isMissingPlanLimitsTableError(error)) {
      return DEFAULT_PLANS;
    }

    throw error;
  }

  const rowsByKey = new Map(
    (data ?? []).map((row) => [row.key as PlanKey, row]),
  );

  return PLAN_ORDER.reduce(
    (catalog, planKey) => {
      catalog[planKey] = mergePlanLimitRow(planKey, rowsByKey.get(planKey));
      return catalog;
    },
    {} as Record<PlanKey, PlanDefinition>,
  );
}

export async function listPlans(): Promise<PlanDefinition[]> {
  const catalog = await getPlansCatalog();
  return PLAN_ORDER.map((planKey) => catalog[planKey]);
}

export async function getPlan(
  key: string | null | undefined,
): Promise<PlanDefinition> {
  const catalog = await getPlansCatalog();

  if (key && key in catalog) {
    return catalog[key as PlanKey];
  }

  return catalog.free;
}