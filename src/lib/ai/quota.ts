import { createAdminClient } from "@/lib/supabase/admin";
import { getPlan } from "@/lib/plans-server";

interface QuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
}

/**
 * Check whether a user still has AI calls left this month.
 * Returns { allowed, remaining, limit, used }.
 *
 * If the month has rolled over since the last reset, the counter
 * is reset to 0 before checking.
 */
export async function checkAIQuota(userId: string): Promise<QuotaResult> {
  const admin = createAdminClient();

  // Fetch profile
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, ai_calls_this_month, ai_calls_reset_at")
    .eq("id", userId)
    .single();

  if (!profile) {
    return { allowed: false, remaining: 0, limit: 0, used: 0 };
  }

  const plan = await getPlan(profile.plan);
  let used = profile.ai_calls_this_month ?? 0;

  // Auto-reset if new month
  const resetAt = profile.ai_calls_reset_at
    ? new Date(profile.ai_calls_reset_at)
    : null;
  const now = new Date();
  if (
    !resetAt ||
    resetAt.getUTCMonth() !== now.getUTCMonth() ||
    resetAt.getUTCFullYear() !== now.getUTCFullYear()
  ) {
    used = 0;
    await admin
      .from("profiles")
      .update({ ai_calls_this_month: 0, ai_calls_reset_at: now.toISOString() })
      .eq("id", userId);
  }

  const limit = plan.aiCallsPerMonth;
  const remaining = Math.max(0, limit - used);
  return { allowed: used < limit, remaining, limit, used };
}

/**
 * Increment the AI call counter for a user by `count` (default 1).
 */
export async function incrementAICalls(
  userId: string,
  count: number = 1,
): Promise<void> {
  const admin = createAdminClient();

  // Use rpc or raw update — increment atomically
  const { data: profile } = await admin
    .from("profiles")
    .select("ai_calls_this_month")
    .eq("id", userId)
    .single();

  const current = profile?.ai_calls_this_month ?? 0;

  await admin
    .from("profiles")
    .update({ ai_calls_this_month: current + count })
    .eq("id", userId);
}
