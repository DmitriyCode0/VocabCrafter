import { redirect } from "next/navigation";
import {
  fetchConnectedStudents,
  type HistoryStudent,
} from "@/lib/history/fetch-history-page-data";
import {
  normalizeAppLanguage,
  type AppLanguage,
} from "@/lib/i18n/app-language";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/roles";

export interface TutorProgressPageData {
  userId: string;
  role: Role;
  appLanguage: AppLanguage;
  students: HistoryStudent[];
  activeStudentId: string | null;
  studentProfile: HistoryStudent | null;
}

export async function getTutorProgressPageData(
  requestedStudentId?: string | null,
): Promise<TutorProgressPageData> {
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
    redirect("/login");
  }

  const role = profile.role as Role;

  if (role !== "tutor" && role !== "superadmin") {
    redirect("/dashboard");
  }

  const appLanguage = normalizeAppLanguage(profile.app_language);
  const students =
    role === "tutor" ? await fetchConnectedStudents(user.id) : [];
  const activeStudentId =
    role === "tutor"
      ? (students.find((student) => student.id === requestedStudentId)?.id ??
        students[0]?.id ??
        null)
      : (requestedStudentId ?? null);
  const studentProfile = activeStudentId
    ? role === "tutor"
      ? (students.find((student) => student.id === activeStudentId) ?? null)
      : await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url, cefr_level")
          .eq("id", activeStudentId)
          .single()
          .then((result) =>
            result.error ? null : (result.data as HistoryStudent),
          )
    : null;

  return {
    userId: user.id,
    role,
    appLanguage,
    students,
    activeStudentId,
    studentProfile,
  };
}
