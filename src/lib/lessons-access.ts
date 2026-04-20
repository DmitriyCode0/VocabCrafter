import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import type { Role } from "@/types/roles";

interface LessonsViewerAccessOptions {
  requireTutor?: boolean;
}

export async function getLessonsViewerAccess(
  options: LessonsViewerAccessOptions = {},
) {
  const { requireTutor = false } = options;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, app_language")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/dashboard");
  }

  const role = profile.role as Role;

  if (requireTutor) {
    if (role !== "tutor") {
      redirect("/lessons");
    }

    return {
      userId: user.id,
      role,
      appLanguage: normalizeAppLanguage(profile.app_language),
    };
  }

  if (role !== "student" && role !== "tutor") {
    redirect("/dashboard");
  }

  return {
    userId: user.id,
    role,
    appLanguage: normalizeAppLanguage(profile.app_language),
  };
}
