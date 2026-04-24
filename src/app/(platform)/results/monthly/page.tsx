import { Trophy } from "lucide-react";
import { getAppMessages } from "@/lib/i18n/messages";
import { getTutorProgressPageData } from "@/lib/progress/tutor-progress-page-data";
import { getStudentMonthlyActivity } from "@/lib/progress/tutor-progress-monthly";
import { ResultsStudentFilter } from "@/components/progress/results-student-filter";
import { TutorProgressPageHeader } from "@/components/progress/tutor-progress-page-header";
import { TutorStudentMonthlyPerformance } from "@/components/progress/tutor-student-monthly-performance";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function MonthlyResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student: requestedStudentId } = await searchParams;
  const { role, appLanguage, students, activeStudentId, studentProfile } =
    await getTutorProgressPageData(requestedStudentId);
  const messages = getAppMessages(appLanguage);
  const trend = activeStudentId
    ? await getStudentMonthlyActivity(activeStudentId, appLanguage)
    : null;

  return (
    <div className="space-y-6">
      <TutorProgressPageHeader
        currentSection="monthly"
        basePath="/results"
        title={messages.progress.title}
        description={messages.tutorProgressPage.monthlyDescription}
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

      {!activeStudentId || !studentProfile || !trend ? (
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
              Progress is student-specific, so this page always shows one
              learner at a time.
            </div>
          </CardContent>
        </Card>
      ) : (
        <TutorStudentMonthlyPerformance
          studentId={activeStudentId}
          studentName={
            studentProfile.full_name ||
            studentProfile.email ||
            messages.tutorProgressPage.studentFallback
          }
          studentLevel={studentProfile.cefr_level}
          trend={trend}
        />
      )}
    </div>
  );
}
