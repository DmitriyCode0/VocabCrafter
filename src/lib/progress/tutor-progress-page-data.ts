import { redirect } from "next/navigation";
import {
  fetchConnectedStudents,
  type HistoryStudent,
} from "@/lib/history/fetch-history-page-data";
import {
  normalizeAppLanguage,
  type AppLanguage,
} from "@/lib/i18n/app-language";
import { getAuthenticatedUser } from "@/lib/rbac/require-role";
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
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) {
    redirect("/login");
  }

  const { user, profile } = authenticatedUser;
  const role = profile.role as Role;

  if (role !== "tutor" && role !== "superadmin") {
    redirect("/dashboard");
  }

  const appLanguage = normalizeAppLanguage(profile.app_language);
  const students =
    role === "tutor" ? await fetchConnectedStudents(user.id) : [];

  let activeStudentId: string | null = null;
  let studentProfile: HistoryStudent | null = null;

  if (role === "tutor") {
    const matchedActive = students.find((student) => student.id === requestedStudentId);
    if (matchedActive) {
      activeStudentId = matchedActive.id;
      studentProfile = matchedActive;
    } else if (requestedStudentId) {
      const supabase = await createClient();
      const { data: ownStudent } = await supabase
        .from("tutor_students")
        .select(
          "student_id, profiles!tutor_students_student_id_fkey(id, full_name, email, avatar_url, cefr_level)",
        )
        .eq("tutor_id", user.id)
        .eq("student_id", requestedStudentId)
        .maybeSingle();

      if (ownStudent?.profiles) {
        activeStudentId = requestedStudentId;
        const p = ownStudent.profiles as unknown as Record<string, unknown>;
        studentProfile = {
          id: p.id as string,
          full_name: (p.full_name as string) || null,
          email: (p.email as string) || null,
          avatar_url: (p.avatar_url as string) || null,
          cefr_level: (p.cefr_level as string) || null,
        };
      } else {
        activeStudentId = students[0]?.id ?? null;
        studentProfile = students[0] ?? null;
      }
    } else {
      activeStudentId = students[0]?.id ?? null;
      studentProfile = students[0] ?? null;
    }
  } else {
    activeStudentId = requestedStudentId ?? null;
    if (activeStudentId) {
      const supabase = await createClient();
      studentProfile = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, cefr_level")
        .eq("id", activeStudentId)
        .single()
        .then((result) =>
          result.error ? null : (result.data as HistoryStudent),
        );
    } else {
      studentProfile = null;
    }
  }

  return {
    userId: user.id,
    role,
    appLanguage,
    students,
    activeStudentId,
    studentProfile,
  };
}
