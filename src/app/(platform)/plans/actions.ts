"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plans-server";
import type { PlanKey } from "@/lib/plans";

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    throw new Error("Forbidden");
  }
}

function parseWholeNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number of 0 or more`);
  }

  return value;
}

function parseOptionalWholeNumber(value: number | null, label: string) {
  if (value == null) {
    return null;
  }

  return parseWholeNumber(value, label);
}

function revalidatePlanPaths() {
  revalidatePath("/plans");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
}

export async function savePlanLimits(input: {
  key: PlanKey;
  price: number;
  aiCallsPerMonth: number;
  quizzesPerMonth: number | null;
  attemptsPerMonth: number | null;
  wordBanks: number | null;
}) {
  await requireSuperadmin();

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin.from("plan_limits").upsert({
    key: input.key,
    price: parseWholeNumber(input.price, "Price"),
    ai_calls_per_month: parseWholeNumber(
      input.aiCallsPerMonth,
      "AI calls per month",
    ),
    quizzes_per_month: parseOptionalWholeNumber(
      input.quizzesPerMonth,
      "Quizzes per month",
    ),
    attempts_per_month: parseOptionalWholeNumber(
      input.attemptsPerMonth,
      "Attempts per month",
    ),
    word_banks: parseOptionalWholeNumber(input.wordBanks, "Word banks"),
    updated_at: now,
  });

  if (error) {
    throw new Error("Failed to save plan limits");
  }

  revalidatePlanPaths();
  return getPlan(input.key);
}