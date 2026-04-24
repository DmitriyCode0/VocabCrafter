import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import { getStudentMonthlyActivity } from "@/lib/progress/tutor-progress-monthly";
import { TutorProgressPageHeader } from "@/components/progress/tutor-progress-page-header";
import { StudentMonthlyProgressPanel } from "@/components/progress/tutor-student-monthly-performance";

export const dynamic = "force-dynamic";

export default async function StudentProgressMonthlyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileResult } = await supabase
    .from("profiles")
    .select("app_language")
    .eq("id", user.id)
    .single();
  const appLanguage = normalizeAppLanguage(profileResult?.app_language);
  const messages = getAppMessages(appLanguage);
  const trend = await getStudentMonthlyActivity(user.id, appLanguage);

  return (
    <div className="space-y-6">
      <TutorProgressPageHeader
        currentSection="monthly"
        basePath="/progress"
        title={messages.progress.title}
        description={messages.progress.monthlyDescription}
      />

      <StudentMonthlyProgressPanel trend={trend} />
    </div>
  );
}
