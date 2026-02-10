import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role, Permission } from "@/types/roles";
import type { Profile } from "@/types/database";
import { hasPermission } from "./check-permission";

export async function getAuthenticatedUser(): Promise<{
  user: { id: string; email: string };
  profile: Profile;
} | null> {
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

  if (!hasPermission(result.profile.role as Role, permission)) {
    redirect("/dashboard");
  }

  return result;
}
