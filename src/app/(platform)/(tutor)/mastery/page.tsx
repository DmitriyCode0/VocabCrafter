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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const LEVEL_LABELS = [
  "New",
  "Seen",
  "Learning",
  "Familiar",
  "Practiced",
  "Mastered",
] as const;

const LEVEL_COLORS = [
  "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
] as const;

interface MasteryRow {
  student_id: string;
  term: string;
  definition: string | null;
  mastery_level: number;
  correct_count: number;
  incorrect_count: number;
  streak: number;
  last_practiced: string | null;
}

interface StudentProfile {
  id: string;
  full_name: string | null;
  email: string;
}

export default async function TutorMasteryPage() {
  const supabase = await createClient();
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
            Student Vocabulary Mastery
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

  const studentIds = [
    ...new Set((members ?? []).map((m) => m.student_id)),
  ];

  if (studentIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Student Vocabulary Mastery
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

  // Get word mastery for all students
  const { data: masteryData } = await supabaseAdmin
    .from("word_mastery")
    .select(
      "student_id, term, definition, mastery_level, correct_count, incorrect_count, streak, last_practiced",
    )
    .in("student_id", studentIds);

  const allMastery = (masteryData ?? []) as MasteryRow[];

  // Group by student
  const studentMastery = new Map<string, MasteryRow[]>();
  for (const row of allMastery) {
    if (!studentMastery.has(row.student_id)) {
      studentMastery.set(row.student_id, []);
    }
    studentMastery.get(row.student_id)!.push(row);
  }

  // Per-student summary
  const studentSummaries = studentIds.map((sid) => {
    const profile = profileMap.get(sid);
    const words = studentMastery.get(sid) ?? [];
    const total = words.length;
    const mastered = words.filter((w) => w.mastery_level >= 5).length;
    const avgLevel =
      total > 0
        ? words.reduce((sum, w) => sum + w.mastery_level, 0) / total
        : 0;
    const weakWords = words
      .filter((w) => w.mastery_level <= 1)
      .sort(
        (a, b) =>
          a.correct_count / Math.max(1, a.correct_count + a.incorrect_count) -
          b.correct_count / Math.max(1, b.correct_count + b.incorrect_count),
      )
      .slice(0, 5);

    return {
      studentId: sid,
      name: profile?.full_name ?? profile?.email ?? "Unknown",
      totalWords: total,
      mastered,
      avgLevel: Math.round(avgLevel * 10) / 10,
      weakWords,
    };
  });

  // Class-wide weak words: terms where the average mastery is lowest
  const termStats = new Map<
    string,
    { definition: string; totalLevel: number; count: number }
  >();
  for (const row of allMastery) {
    const existing = termStats.get(row.term) ?? {
      definition: row.definition ?? "",
      totalLevel: 0,
      count: 0,
    };
    existing.totalLevel += row.mastery_level;
    existing.count++;
    if (row.definition) existing.definition = row.definition;
    termStats.set(row.term, existing);
  }

  const classWeakWords = Array.from(termStats.entries())
    .map(([term, s]) => ({
      term,
      definition: s.definition,
      avgLevel: Math.round((s.totalLevel / s.count) * 10) / 10,
      studentCount: s.count,
    }))
    .sort((a, b) => a.avgLevel - b.avgLevel)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Student Vocabulary Mastery
        </h1>
        <p className="text-muted-foreground">
          See how well your students know their vocabulary across all classes.
        </p>
      </div>

      {/* Class-wide weak words */}
      {classWeakWords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Class-wide Weak Words
            </CardTitle>
            <CardDescription>
              Words your students struggle with most (lowest avg mastery)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {classWeakWords.map((w) => (
                <Badge
                  key={w.term}
                  variant="outline"
                  className={`${LEVEL_COLORS[Math.min(Math.round(w.avgLevel), 5)]} border-0 px-3 py-1.5`}
                >
                  <span className="font-medium">{w.term}</span>
                  <span className="ml-1.5 opacity-70">
                    lvl {w.avgLevel} · {w.studentCount} student
                    {w.studentCount !== 1 ? "s" : ""}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-student table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student Overview</CardTitle>
          <CardDescription>
            Vocabulary mastery for each student in your classes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="text-center">Words</TableHead>
                <TableHead className="text-center">Mastered</TableHead>
                <TableHead className="text-center">Avg Level</TableHead>
                <TableHead>Weakest Words</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentSummaries.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-center">{s.totalWords}</TableCell>
                  <TableCell className="text-center">
                    {s.totalWords > 0 ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-green-600">{s.mastered}</span>
                        <Progress
                          value={(s.mastered / s.totalWords) * 100}
                          className="h-2 w-16"
                        />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.totalWords > 0 ? (
                      <Badge
                        variant="outline"
                        className={`${LEVEL_COLORS[Math.min(Math.round(s.avgLevel), 5)]} border-0`}
                      >
                        {s.avgLevel}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.weakWords.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {s.weakWords.map((w) => (
                          <Badge
                            key={w.term}
                            variant="secondary"
                            className="text-xs"
                          >
                            {w.term}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {s.totalWords > 0 ? "All good!" : "No data"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Per-student detailed breakdown */}
      {studentSummaries
        .filter((s) => s.totalWords > 0)
        .map((s) => {
          const words = studentMastery.get(s.studentId) ?? [];
          // Group by level
          const byLevel = new Map<number, MasteryRow[]>();
          for (const w of words) {
            if (!byLevel.has(w.mastery_level)) byLevel.set(w.mastery_level, []);
            byLevel.get(w.mastery_level)!.push(w);
          }

          return (
            <Card key={s.studentId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <CardDescription>
                  {s.totalWords} words · avg level {s.avgLevel} · {s.mastered}{" "}
                  mastered
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {LEVEL_LABELS.map((label, i) => {
                    const count = byLevel.get(i)?.length ?? 0;
                    if (count === 0) return null;
                    return (
                      <Badge
                        key={i}
                        variant="outline"
                        className={`${LEVEL_COLORS[i]} border-0 text-xs`}
                      >
                        {label}: {count}
                      </Badge>
                    );
                  })}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                  {words
                    .sort((a, b) => a.mastery_level - b.mastery_level)
                    .map((w) => (
                      <div
                        key={w.term}
                        className="flex items-center justify-between rounded border px-2.5 py-1.5 text-sm"
                      >
                        <span className="truncate mr-2">{w.term}</span>
                        <Badge
                          variant="outline"
                          className={`${LEVEL_COLORS[w.mastery_level]} border-0 text-xs shrink-0`}
                        >
                          {w.mastery_level}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
