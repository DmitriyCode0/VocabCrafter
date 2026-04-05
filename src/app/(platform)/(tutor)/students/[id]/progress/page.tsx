import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Flame,
  Star,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DeletePassiveEvidenceButton } from "@/components/mastery/delete-passive-evidence-button";
import { EditPassiveEvidenceDialog } from "@/components/mastery/edit-passive-evidence-dialog";
import { ImportPassiveVocabularyCard } from "@/components/mastery/import-passive-vocabulary-card";
import { TutorStudentProgressWorkspace } from "@/components/progress/tutor-student-progress-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatAppDate } from "@/lib/dates";
import { parseTutorProgressOverride } from "@/lib/progress/contracts";
import { getStudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";

export const dynamic = "force-dynamic";

interface PassiveEvidenceRow {
  id: string;
  term: string;
  definition: string | null;
  item_type: "word" | "phrase";
  source_type: "full_text" | "manual_list" | "curated_list";
  source_label: string | null;
  confidence: number;
  import_count: number;
  last_imported_at: string;
}

export default async function TutorStudentProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const supabaseAdmin = createAdminClient();
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    (profile.role !== "tutor" && profile.role !== "superadmin")
  ) {
    redirect("/dashboard");
  }

  if (profile.role !== "superadmin") {
    const hasAccess = await tutorHasStudentAccess(
      supabaseAdmin,
      user.id,
      studentId,
    );

    if (!hasAccess) {
      redirect("/students");
    }
  }

  const [studentProfileResult, overrideResult, passiveEvidenceResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", studentId)
      .single(),
    supabaseAdmin
      .from("tutor_student_progress_overrides")
      .select("axis_overrides, insights_override")
      .eq("tutor_id", user.id)
      .eq("student_id", studentId)
      .maybeSingle(),
    supabaseAdmin
      .from("passive_vocabulary_evidence")
      .select(
        "id, term, definition, item_type, source_type, source_label, confidence, import_count, last_imported_at",
      )
      .eq("student_id", studentId)
      .order("last_imported_at", { ascending: false })
      .range(0, 11),
  ]);

  if (studentProfileResult.error || !studentProfileResult.data) {
    redirect("/students");
  }

  const snapshot = await getStudentProgressSnapshot(studentId);
  const hasAnyRawData =
    snapshot.overview.totalAttempts > 0 ||
    snapshot.overview.totalWords > 0 ||
    snapshot.passiveSignals.uniqueItems > 0;
  const initialOverride = parseTutorProgressOverride(overrideResult.data);
  const passiveEvidenceItems =
    (passiveEvidenceResult.data ?? []) as PassiveEvidenceRow[];
  const studentName =
    studentProfileResult.data.full_name ||
    studentProfileResult.data.email ||
    "Student";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Button
            asChild
            variant="ghost"
            className="w-fit px-0 text-muted-foreground"
          >
            <Link href="/students">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to My Students
            </Link>
          </Button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {studentName}
              </h1>
              <Badge variant="outline">Tutor Progress View</Badge>
              <Badge variant="secondary">
                Target {snapshot.profile.cefrLevel}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Review this student&apos;s computed learning profile, then curate
              your own coaching version of the radar metrics and AI suggestions.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {snapshot.profile.targetLanguageLabel}
          </Badge>
          <Badge variant="outline">
            Source {snapshot.profile.sourceLanguageLabel}
          </Badge>
        </div>
      </div>

      <TutorStudentProgressWorkspace
        studentId={studentId}
        studentName={studentName}
        baseAxes={snapshot.axes}
        cefrLevel={snapshot.profile.cefrLevel}
        grammarNotice={snapshot.grammar.betaNotice}
        hasData={hasAnyRawData}
        initialOverride={initialOverride}
      />

      {!hasAnyRawData ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No raw progress data yet</CardTitle>
            <CardDescription>
              This student has not built enough quiz or vocabulary history to
              populate the raw overview cards yet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{snapshot.overview.avgScore}%</div>
              <Progress value={snapshot.overview.avgScore} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Mastery</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {snapshot.overview.avgMasteryLevel.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">out of 5 mastery levels</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Day Streak</CardTitle>
              <Flame className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{snapshot.overview.streakDays}</div>
              <p className="text-xs text-muted-foreground">
                consecutive day{snapshot.overview.streakDays !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unique Words</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{snapshot.overview.totalWords}</div>
              <p className="text-xs text-muted-foreground">
                {snapshot.overview.masteredWords} mastered words
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Grammar Topics</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">
                  {snapshot.overview.grammarCoveredCount}/
                  {snapshot.overview.grammarAvailableCount}
                </div>
                <Badge variant="secondary">Beta</Badge>
              </div>
              <Progress
                value={
                  snapshot.overview.grammarAvailableCount > 0
                    ? (snapshot.overview.grammarCoveredCount /
                        snapshot.overview.grammarAvailableCount) *
                      100
                    : 0
                }
                className="mt-2 h-2"
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Passive Evidence</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.passiveSignals.uniqueItems}
            </div>
            <p className="text-xs text-muted-foreground">
              words and phrases tracked as recognition only
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Equivalent Words</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.passiveSignals.equivalentWordCount}
            </div>
            <p className="text-xs text-muted-foreground">
              weighted contribution to passive-recognition estimates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.passiveSignals.avgConfidence.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              out of 5 across all passive evidence
            </p>
          </CardContent>
        </Card>
      </div>

      <ImportPassiveVocabularyCard
        targetLanguage={snapshot.profile.targetLanguage}
        sourceLanguage={snapshot.profile.sourceLanguage}
        studentId={studentId}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Passive Evidence</CardTitle>
          <CardDescription>
            Review the latest passive-recognition imports for {studentName}. These items stay out of review and can be edited or removed here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passiveEvidenceItems.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No passive evidence imported for this student yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {passiveEvidenceItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.term}</p>
                      {item.definition && (
                        <p className="truncate text-xs text-muted-foreground">
                          {item.definition}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <EditPassiveEvidenceDialog evidence={item} />
                      <DeletePassiveEvidenceButton
                        evidenceId={item.id}
                        term={item.term}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">
                      {item.item_type === "phrase" ? "Phrase" : "Word"}
                    </Badge>
                    <Badge variant="secondary">
                      Confidence {item.confidence}/5
                    </Badge>
                    <Badge variant="outline">
                      {item.source_type.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    {item.source_label && <p>Source: {item.source_label}</p>}
                    <p>
                      Imported {item.import_count} time
                      {item.import_count !== 1 ? "s" : ""}
                    </p>
                    <p>Last updated {formatAppDate(item.last_imported_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}