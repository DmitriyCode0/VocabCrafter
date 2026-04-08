import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PagePagination } from "@/components/shared/page-pagination";
import { StudentMasteryCards } from "@/components/mastery/student-mastery-cards";
import { PASSIVE_EQUIVALENT_WORDS_EXPLANATION } from "@/lib/mastery/passive-vocabulary";
import { getCurrentPage, getPaginationRange } from "@/lib/pagination";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

const MASTERY_PAGE_SIZE = 10;

interface MasteryLevelRow {
  student_id: string;
  mastery_level: number;
}

interface PassiveEvidenceSummaryRow {
  student_id: string;
}

interface StudentProfile {
  id: string;
  full_name: string | null;
  email: string;
}

export default async function TutorMasteryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const currentPage = getCurrentPage(resolvedSearchParams.page);
  const { from, to } = getPaginationRange(currentPage, MASTERY_PAGE_SIZE);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const supabaseAdmin = createAdminClient();

  // Get tutor's classes
  const { data: classes } = await supabaseAdmin
    .from("classes")
    .select("id, name")
    .eq("tutor_id", user.id)
    .eq("is_active", true);

  const classIds = (classes ?? []).map((c) => c.id);
  if (classIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Student Vocab Mastery
          </h1>
          <p className="text-muted-foreground">
            See how well your students know their vocabulary.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No classes yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create a class and invite students to see their vocabulary mastery
              here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get all students in tutor's classes
  const { data: members } = await supabaseAdmin
    .from("class_members")
    .select("student_id")
    .in("class_id", classIds);

  const studentIds = [...new Set((members ?? []).map((m) => m.student_id))];

  if (studentIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Student Vocab Mastery
          </h1>
          <p className="text-muted-foreground">
            See how well your students know their vocabulary.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No students enrolled</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your students will appear here once they join a class.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get student profiles
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", studentIds);

  const profileMap = new Map(
    ((profiles ?? []) as StudentProfile[]).map((p) => [p.id, p]),
  );

  // Load only per-student mastery levels for the page summary.
  const { data: allMasteryRows } = await supabaseAdmin
    .from("word_mastery")
    .select("student_id, mastery_level")
    .in("student_id", studentIds);

  const { data: passiveEvidenceRows } = await supabaseAdmin
    .from("passive_vocabulary_evidence")
    .select("student_id")
    .in("student_id", studentIds);

  const visibleMastery = (allMasteryRows ?? []) as MasteryLevelRow[];
  const visiblePassiveEvidence =
    (passiveEvidenceRows ?? []) as PassiveEvidenceSummaryRow[];

  // Group by student for lightweight summary statistics.
  const studentMastery = new Map<string, number[]>();
  for (const row of visibleMastery) {
    const studentId = row.student_id;
    if (!studentId) {
      continue;
    }

    if (!studentMastery.has(studentId)) {
      studentMastery.set(studentId, []);
    }
    studentMastery.get(studentId)!.push(row.mastery_level);
  }

  const passiveEvidenceCounts = new Map<string, number>();
  for (const row of visiblePassiveEvidence) {
    const studentId = row.student_id;
    if (!studentId) {
      continue;
    }

    passiveEvidenceCounts.set(
      studentId,
      (passiveEvidenceCounts.get(studentId) ?? 0) + 1,
    );
  }

  const summarizeStudent = (sid: string) => {
    const profile = profileMap.get(sid);
    const levels = studentMastery.get(sid) ?? [];
    const total = levels.length;
    const mastered = levels.filter((level) => level >= 5).length;
    const avgLevel =
      total > 0 ? levels.reduce((sum, level) => sum + level, 0) / total : 0;
    const levelCounts = [0, 0, 0, 0, 0, 0];

    for (const level of levels) {
      const normalizedLevel = Math.min(Math.max(level, 0), 5);
      levelCounts[normalizedLevel]++;
    }

    return {
      studentId: sid,
      name: profile?.full_name ?? profile?.email ?? "Unknown",
      totalWords: total,
      mastered,
      avgLevel: Math.round(avgLevel * 10) / 10,
      levelCounts,
      passiveEvidenceCount: passiveEvidenceCounts.get(sid) ?? 0,
      equivalentWords: passiveEvidenceCounts.get(sid) ?? 0,
    };
  };

  const studentsWithMastery = Array.from(studentMastery.keys())
    .filter((sid) => studentIds.includes(sid))
    .map(summarizeStudent)
    .sort((left, right) => {
      if (right.totalWords !== left.totalWords) {
        return right.totalWords - left.totalWords;
      }

      return left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
      });
    });

  const studentsWithoutMastery = studentIds
    .filter((sid) => !studentMastery.has(sid))
    .map(summarizeStudent)
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );

  const allStudentSummaries = [
    ...studentsWithMastery,
    ...studentsWithoutMastery,
  ];
  const totalStudents = allStudentSummaries.length;
  const studentSummaries = allStudentSummaries.slice(from, to + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Student Vocab Mastery
        </h1>
        <p className="text-muted-foreground">
          See how well your students know their vocabulary across all classes,
          including passive evidence imported from text they already understand.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student Overview</CardTitle>
          <CardDescription>
            Student summaries load first. Expand a student to load their words.
            Equivalent words is the single-word total from passive evidence used
            in passive-vocabulary estimates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {PASSIVE_EQUIVALENT_WORDS_EXPLANATION}
          </p>
          <StudentMasteryCards students={studentSummaries} />
        </CardContent>
      </Card>

      <PagePagination
        pathname="/mastery"
        currentPage={currentPage}
        pageSize={MASTERY_PAGE_SIZE}
        totalItems={totalStudents}
        searchParams={resolvedSearchParams}
      />
    </div>
  );
}
