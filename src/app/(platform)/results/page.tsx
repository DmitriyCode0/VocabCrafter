import { Trophy } from "lucide-react";
import { getStudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import { getAppMessages } from "@/lib/i18n/messages";
import { getTutorProgressPageData } from "@/lib/progress/tutor-progress-page-data";
import { ResultsStudentFilter } from "@/components/progress/results-student-filter";
import { TutorProgressPageHeader } from "@/components/progress/tutor-progress-page-header";
import { TutorStudentResultsPanel } from "@/components/progress/tutor-student-results-panel";
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
  const { role, appLanguage, students, activeStudentId, studentProfile } =
    await getTutorProgressPageData(requestedStudentId);
  const messages = getAppMessages(appLanguage);
  const snapshot = activeStudentId
    ? await getStudentProgressSnapshot(activeStudentId)
    : null;

  return (
    <div className="space-y-6">
      <TutorProgressPageHeader
        currentSection="overall"
        basePath="/results"
        title={messages.progress.title}
        description={messages.tutorProgressPage.overviewDescription}
        actions={
          role === "tutor" && students.length > 0 ? (
            <ResultsStudentFilter
              students={students.map((student) => ({
                id: student.id,
                label: student.full_name || student.email || "Unknown",
              }))}
              activeStudentId={activeStudentId ?? students[0].id}
            />
          ) : null
        }
      />

      {!activeStudentId || !studentProfile || !snapshot ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No student selected</CardTitle>
            <CardDescription>
              {role === "tutor"
                ? "Connect a student first, then choose them here to open their progress view."
                : "Open this page with a student id to review a specific learner's progress."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Progress is student-specific, so this page always shows one learner at a time.
            </div>
          </CardContent>
        </Card>
      ) : (
        <TutorStudentResultsPanel
          studentId={activeStudentId}
          studentName={
            studentProfile.full_name ||
            studentProfile.email ||
            messages.tutorProgressPage.studentFallback
          }
          snapshot={snapshot}
          appLanguage={appLanguage}
        />
      )}
    </div>
  );
}