import { Trophy } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import { fetchConnectedStudents } from "@/lib/history/fetch-history-page-data";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { ResultsStudentFilter } from "@/components/progress/results-student-filter";
import { TutorStudentResultsPanel } from "@/components/progress/tutor-student-results-panel";
import type { Role } from "@/types/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student: requestedStudentId } = await searchParams;
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
  const students = role === "tutor" ? await fetchConnectedStudents(user.id) : [];
  const activeStudentId =
    role === "tutor"
      ? students.find((student) => student.id === requestedStudentId)?.id ??
        students[0]?.id ??
        null
      : requestedStudentId ?? null;

  const studentProfile = activeStudentId
    ? role === "tutor"
      ? students.find((student) => student.id === activeStudentId) ?? null
      : await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url, cefr_level")
          .eq("id", activeStudentId)
          .single()
          .then((result) => (result.error ? null : result.data))
    : null;
  const snapshot = activeStudentId
    ? await getStudentProgressSnapshot(activeStudentId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Results</h1>
          <p className="text-muted-foreground">
            Review one connected student at a time with the same performance summary used in progress reporting.
          </p>
        </div>

        {role === "tutor" && students.length > 0 ? (
          <ResultsStudentFilter
            students={students.map((student) => ({
              id: student.id,
              label: student.full_name || student.email || "Unknown",
            }))}
            activeStudentId={activeStudentId ?? students[0].id}
          />
        ) : null}
      </div>

      {!activeStudentId || !studentProfile || !snapshot ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No student selected</CardTitle>
            <CardDescription>
              {role === "tutor"
                ? "Connect a student first, then choose them here to open their results view."
                : "Open this page with a student id to review a specific learner's results."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Results is student-specific, so this page always shows one learner at a time.
            </div>
          </CardContent>
        </Card>
      ) : (
        <TutorStudentResultsPanel
          studentId={activeStudentId}
          studentName={studentProfile.full_name || studentProfile.email || "Student"}
          snapshot={snapshot}
          appLanguage={appLanguage}
        />
      )}
    </div>
  );
}