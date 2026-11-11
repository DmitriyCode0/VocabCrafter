import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { StudentVocabularyPageContent } from "@/components/mastery/student-vocabulary-page-content";
import {
  TutorUnifiedMasteryClient,
  type TutorStudentThreeStateSummary,
} from "@/components/mastery/tutor-unified-mastery-client";
import { fetchConnectedStudents } from "@/lib/history/fetch-history-page-data";
import {
  getBatchStudentThreeStateVocabularySummaries,
  getStudentProgressSnapshot,
} from "@/lib/progress/profile-metrics";
import { Users } from "lucide-react";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";

interface TutorMasteryPageProps {
  searchParams: Promise<{ page?: string; student?: string }>;
}

async function TutorMasteryPageContent({
  searchParams,
}: TutorMasteryPageProps) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("app_language")
    .eq("id", user.id)
    .single();

  const messages = getAppMessages(normalizeAppLanguage(profile?.app_language));
  const pageHeader = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        {messages.tutorMastery.title}
      </h1>
      <p className="text-muted-foreground">
        {messages.tutorMastery.description}
      </p>
    </div>
  );

  // Fetch all active (non-archived) connected students across tutor_students and active classes
  const activeStudents = await fetchConnectedStudents(user.id);

  if (activeStudents.length === 0) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">
              {messages.tutorMastery.noStudentsTitle}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {messages.tutorMastery.noStudentsDescription}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const studentIds = activeStudents.map((s) => s.id);
  const requestedStudentId = resolvedSearchParams.student;
  const selectedStudentId =
    requestedStudentId && studentIds.includes(requestedStudentId)
      ? requestedStudentId
      : activeStudents[0].id;

  // Single unified source of truth for all active students + deep-dive snapshot for selected student
  const [threeStateSummaryMap, selectedSnapshot] = await Promise.all([
    getBatchStudentThreeStateVocabularySummaries(
      activeStudents.map((s) => ({ id: s.id, cefr_level: s.cefr_level })),
    ),
    getStudentProgressSnapshot(selectedStudentId),
  ]);

  const studentSummaries: TutorStudentThreeStateSummary[] = activeStudents.map(
    (student) => {
      const summary = threeStateSummaryMap.get(student.id)!;
      return {
        ...summary,
        name:
          student.full_name ||
          student.email ||
          messages.tutorMastery.unknownStudent,
      };
    },
  );

  return (
    <div className="space-y-6">
      {pageHeader}

      <TutorUnifiedMasteryClient
        students={studentSummaries}
        selectedStudentId={selectedStudentId}
        selectedSnapshot={selectedSnapshot}
      />
    </div>
  );
}

export default async function TutorMasteryPage({
  searchParams,
}: TutorMasteryPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "student") {
    return StudentVocabularyPageContent({ searchParams });
  }

  if (profile?.role === "superadmin") {
    redirect("/vocabulary");
  }

  return TutorMasteryPageContent({ searchParams });
}
