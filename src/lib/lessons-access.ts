import { cache } from "react";
import { redirect } from "next/navigation";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAuthenticatedUser } from "@/lib/rbac/require-role";
import type { Role } from "@/types/roles";

interface LessonsViewerAccessOptions {
  requireTutor?: boolean;
}

const getCachedLessonsViewer = cache(async () => {
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) {
    redirect("/login");
  }

  return {
    userId: authenticatedUser.user.id,
    role: authenticatedUser.profile.role as Role,
    appLanguage: normalizeAppLanguage(authenticatedUser.profile.app_language),
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
