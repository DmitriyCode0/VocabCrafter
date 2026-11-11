import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import type { Role } from "@/types/roles";

interface LessonsViewerAccessOptions {
  requireTutor?: boolean;
}

const getCachedLessonsViewer = cache(async () => {
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

  return {
    userId: user.id,
    role: profile.role as Role,
    appLanguage: normalizeAppLanguage(profile.app_language),
  };
});

export async function getLessonsViewerAccess(
  options: LessonsViewerAccessOptions = {},
) {
  const { requireTutor = false } = options;
  const { userId, role, appLanguage } = await getCachedLessonsViewer();

  if (requireTutor) {
    if (role !== "tutor") {
      redirect("/lessons");
    }

    return {
      userId,
      role,
      appLanguage,
    };
  }

  if (role !== "student" && role !== "tutor") {
    redirect("/dashboard");
  }

  return {
    userId,
    role,
    appLanguage,
  };
}
