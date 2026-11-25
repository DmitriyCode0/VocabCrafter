import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Role, Permission } from "@/types/roles";
import type { Profile } from "@/types/database";
import { hasPermission } from "./check-permission";

export const getAuthenticatedUser = cache(async (): Promise<{
  user: { id: string; email: string };
  profile: Profile;
} | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile,
  };
});

export function isProfileApproved(
  profile: Pick<Profile, "role"> & { approval_status?: string | null },
): boolean {
  if (profile.role === "superadmin") return true;
  if (!profile.approval_status) return true;
  return profile.approval_status === "approved";
}

export async function requireRole(...roles: Role[]): Promise<{
  user: { id: string; email: string };
  profile: Profile;
}> {
  const result = await getAuthenticatedUser();

  if (!result) {
    redirect("/login");
  }

  if (!result.profile.onboarding_completed) {
    redirect("/onboarding");
  }

  if (!isProfileApproved(result.profile)) {
    redirect("/dashboard");
  }

  if (!roles.includes(result.profile.role as Role)) {
    redirect("/dashboard");
  }

  return result;
}

export async function requirePermission(permission: Permission): Promise<{
  user: { id: string; email: string };
  profile: Profile;
}> {
  const result = await getAuthenticatedUser();

  if (!result) {
    redirect("/login");
  }

  if (!result.profile.onboarding_completed) {
    redirect("/onboarding");
  }

  if (!isProfileApproved(result.profile)) {
    redirect("/dashboard");
  }

  if (!hasPermission(result.profile.role as Role, permission)) {
    redirect("/dashboard");
  }

  return result;
}
