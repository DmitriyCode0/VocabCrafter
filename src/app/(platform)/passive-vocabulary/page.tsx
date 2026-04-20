import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookMarked,
  BookOpen,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ImportPassiveVocabularyCard } from "@/components/mastery/import-passive-vocabulary-card";
import { PassiveLibraryAdminPanel } from "@/components/mastery/passive-library-admin-panel";
import {
  PassiveEvidenceList,
  type PassiveEvidenceListItem,
} from "@/components/mastery/passive-evidence-list";
import { PassiveVocabularyStudentFilter } from "@/components/mastery/passive-vocabulary-student-filter";
import { PagePagination } from "@/components/shared/page-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getLearningLanguageLabel,
  normalizeLearningLanguage,
} from "@/lib/languages";
import {
  getPassiveVocabularyEquivalentWeight,
  PASSIVE_EQUIVALENT_WORDS_EXPLANATION,
  summarizePassiveVocabularyEvidence,
  type PassiveVocabularyEvidenceRow,
} from "@/lib/mastery/passive-vocabulary";
import { getCurrentPage, getPaginationRange } from "@/lib/pagination";
import type { Role } from "@/types/roles";
import type { CEFRLevel } from "@/types/quiz";

export const dynamic = "force-dynamic";

const EVIDENCE_PAGE_SIZE = 18;
const LIBRARY_PAGE_SIZE = 20;
const CEFR_LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

interface PassiveVocabularyStudentOption {
  id: string;
  full_name: string | null;
  email: string | null;
  cefr_level: string | null;
}

interface PassiveEvidenceQueryRow {
  id: string;
  term: string;
  definition: string | null;
  item_type: "word" | "phrase";
  source_type: "full_text" | "manual_list" | "curated_list";
  source_label: string | null;
  import_count: number;
  last_imported_at: string;
  passive_vocabulary_library: {
    cefr_level: string | null;
    part_of_speech: string | null;
  } | null;
}

interface PassiveVocabularyWorkspaceData {
  studentId: string;
  studentName: string;
  studentEmail: string;
  targetLanguage: ReturnType<typeof normalizeLearningLanguage>;
  targetLanguageLabel: string;
  cefrLevel: CEFRLevel;
  evidenceTotal: number;
  evidenceItems: PassiveEvidenceListItem[];
  summary: ReturnType<typeof summarizePassiveVocabularyEvidence>;
  aboveTargetCount: number;
}

function normalizeCefrLevel(value?: string | null): CEFRLevel {
  return CEFR_LEVELS.includes(value as CEFRLevel) ? (value as CEFRLevel) : "A1";
}

function buildStudentLabel(student: PassiveVocabularyStudentOption) {
  return student.full_name ?? student.email ?? "Student";
}

function countAboveTargetLevels(
  cefrCounts: ReturnType<typeof summarizePassiveVocabularyEvidence>["cefrCounts"],
  targetLevel: CEFRLevel,
) {
  const targetIndex = CEFR_LEVELS.indexOf(targetLevel);

  return CEFR_LEVELS.slice(targetIndex + 1).reduce(
    (sum, level) => sum + cefrCounts[level],
    0,
  );
}

async function fetchTutorStudentOptions(
  tutorId: string,
): Promise<PassiveVocabularyStudentOption[]> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tutor_students")
    .select(
      "student_id, profiles!tutor_students_student_id_fkey(id, full_name, email, cefr_level)",
    )
    .eq("tutor_id", tutorId)
    .eq("status", "active");

  if (error) {
    throw new Error("Failed to load connected students");
  }

  return (data ?? [])
    .flatMap((connection) => {
      const profile = connection.profiles;

      if (!profile || typeof profile.id !== "string") {
        return [];
      }

      return [
        {
          id: profile.id,
          full_name: profile.full_name ?? null,
          email: profile.email ?? null,
          cefr_level: profile.cefr_level ?? null,
        } satisfies PassiveVocabularyStudentOption,
      ];
    })
    .sort((left, right) =>
      buildStudentLabel(left).localeCompare(buildStudentLabel(right), undefined, {
        sensitivity: "base",
      }),
    );
}

async function fetchSuperadminStudentOptions() {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, cefr_level")
    .eq("role", "student")
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error("Failed to load students");
  }

  return (data ?? []) as PassiveVocabularyStudentOption[];
}

async function loadPassiveVocabularyWorkspace(
  studentId: string,
  evidencePage: number,
) {
  const supabaseAdmin = createAdminClient();
  const evidenceRange = getPaginationRange(evidencePage, EVIDENCE_PAGE_SIZE);
  const [studentProfileResult, evidenceCountResult, summaryRowsResult, evidenceRowsResult] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("full_name, email, preferred_language, cefr_level")
        .eq("id", studentId)
        .single(),
      supabaseAdmin
        .from("passive_vocabulary_evidence")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId),
      supabaseAdmin
        .from("passive_vocabulary_evidence")
        .select(
          "term, definition, item_type, source_type, source_label, import_count, last_imported_at, passive_vocabulary_library(cefr_level, part_of_speech)",
        )
        .eq("student_id", studentId),
      supabaseAdmin
        .from("passive_vocabulary_evidence")
        .select(
          "id, term, definition, item_type, source_type, source_label, import_count, last_imported_at, passive_vocabulary_library(cefr_level, part_of_speech)",
        )
        .eq("student_id", studentId)
        .order("last_imported_at", { ascending: false })
        .range(evidenceRange.from, evidenceRange.to),
    ]);

  if (studentProfileResult.error || !studentProfileResult.data) {
    return null;
  }

  const cefrLevel = normalizeCefrLevel(studentProfileResult.data.cefr_level);
  const mapSummaryRow = (row: PassiveEvidenceQueryRow): PassiveVocabularyEvidenceRow => ({
    term: row.term,
    definition: row.definition,
    item_type: row.item_type,
    source_type: row.source_type,
    source_label: row.source_label,
    import_count: row.import_count,
    last_imported_at: row.last_imported_at,
    library_cefr_level:
      (row.passive_vocabulary_library?.cefr_level as
        | PassiveVocabularyEvidenceRow["library_cefr_level"]
        | null) ?? null,
    library_part_of_speech:
      (row.passive_vocabulary_library?.part_of_speech as
        | PassiveVocabularyEvidenceRow["library_part_of_speech"]
        | null) ?? null,
  });
  const summary = summarizePassiveVocabularyEvidence(
    ((summaryRowsResult.data ?? []) as PassiveEvidenceQueryRow[]).map(mapSummaryRow),
    cefrLevel,
  );
  const evidenceItems = ((evidenceRowsResult.data ?? []) as PassiveEvidenceQueryRow[]).map(
    (row): PassiveEvidenceListItem => ({
      id: row.id,
      term: row.term,
      definition: row.definition,
      item_type: row.item_type,
      source_type: row.source_type,
      source_label: row.source_label,
      import_count: row.import_count,
      last_imported_at: row.last_imported_at,
      library_cefr_level: row.passive_vocabulary_library?.cefr_level ?? null,
      library_part_of_speech:
        row.passive_vocabulary_library?.part_of_speech ?? null,
      recognitionWeight: getPassiveVocabularyEquivalentWeight(row.item_type, {
        libraryCefrLevel:
          (row.passive_vocabulary_library?.cefr_level as
            | PassiveVocabularyEvidenceRow["library_cefr_level"]
            | null) ?? null,
        studentCefrLevel: cefrLevel,
      }),
    }),
  );

  return {
    studentId,
    studentName:
      studentProfileResult.data.full_name ||
      studentProfileResult.data.email ||
      "Student",
    studentEmail: studentProfileResult.data.email,
    targetLanguage: normalizeLearningLanguage(
      studentProfileResult.data.preferred_language,
    ),
    targetLanguageLabel: getLearningLanguageLabel(
      studentProfileResult.data.preferred_language,
    ),
    cefrLevel,
    evidenceTotal: evidenceCountResult.count ?? 0,
    evidenceItems,
    summary,
    aboveTargetCount: countAboveTargetLevels(summary.cefrCounts, cefrLevel),
  } satisfies PassiveVocabularyWorkspaceData;
}

function resolveSelectedStudentId(
  requestedStudentId: string | undefined,
  students: PassiveVocabularyStudentOption[],
  fallbackStudentId: string | null,
) {
  if (requestedStudentId && students.some((student) => student.id === requestedStudentId)) {
    return requestedStudentId;
  }

  return fallbackStudentId;
}

function getHeaderDescription(role: Role) {
  if (role === "superadmin") {
    return "Review student passive-recognition imports and manage the shared vocabulary library that powers CEFR-aware passive estimates.";
  }

  if (role === "tutor") {
    return "Choose a student, import passive-recognition evidence, and review how much of it sits above or below the learner's current CEFR target.";
  }

  return "Import recognition-only vocabulary from text you already understand and review the words contributing to your passive-vocabulary estimate.";
}

export default async function PassiveVocabularyPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const evidencePage = getCurrentPage(resolvedSearchParams.page);
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

  if (!profile) {
    redirect("/login");
  }

  const role = profile.role as Role;
  const studentOptions =
    role === "student"
      ? []
      : role === "tutor"
        ? await fetchTutorStudentOptions(user.id)
        : await fetchSuperadminStudentOptions();
  const selectedStudentId =
    role === "student"
      ? user.id
      : resolveSelectedStudentId(
          resolvedSearchParams.student,
          studentOptions,
          studentOptions.length === 1 ? studentOptions[0].id : null,
        );
  const workspace = selectedStudentId
    ? await loadPassiveVocabularyWorkspace(selectedStudentId, evidencePage)
    : null;

  const supabaseAdmin = createAdminClient();
  const [libraryCountResult, completedLibraryCountResult, needsReviewLibraryCountResult, libraryRowsResult] =
    role === "superadmin"
      ? await Promise.all([
          supabaseAdmin
            .from("passive_vocabulary_library")
            .select("id", { count: "exact", head: true }),
          supabaseAdmin
            .from("passive_vocabulary_library")
            .select("id", { count: "exact", head: true })
            .eq("enrichment_status", "completed"),
          supabaseAdmin
            .from("passive_vocabulary_library")
            .select("id", { count: "exact", head: true })
            .neq("enrichment_status", "completed"),
          supabaseAdmin
            .from("passive_vocabulary_library")
            .select(
              "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, enrichment_status, enrichment_error, updated_at",
            )
            .order("updated_at", { ascending: false })
            .range(0, LIBRARY_PAGE_SIZE - 1),
        ])
      : [null, null, null, null];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Passive Vocabulary</h1>
        <p className="text-muted-foreground">{getHeaderDescription(role)}</p>
      </div>

      {role !== "student" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose Student</CardTitle>
            <CardDescription>
              Tutors and admins can switch between students the same way they do on the history page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {studentOptions.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {role === "tutor"
                  ? "No connected students yet. Connect a student first to import passive vocabulary for them."
                  : "No students found yet."}
              </div>
            ) : (
              <>
                <PassiveVocabularyStudentFilter
                  students={studentOptions.map((student) => ({
                    id: student.id,
                    label: buildStudentLabel(student),
                  }))}
                  activeStudentId={selectedStudentId}
                />

                {!workspace && (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {studentOptions.slice(0, 12).map((student) => (
                      <Button key={student.id} asChild variant="outline" className="justify-start">
                        <Link href={`/passive-vocabulary?student=${student.id}`}>
                          {buildStudentLabel(student)}
                        </Link>
                      </Button>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {workspace && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{workspace.studentName}</h2>
                {role !== "student" && <Badge variant="outline">Student Workspace</Badge>}
                <Badge variant="secondary">Target {workspace.cefrLevel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {workspace.targetLanguageLabel} passive-recognition evidence for {workspace.studentEmail}.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Imported Items</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{workspace.summary.uniqueItems}</div>
                <p className="text-xs text-muted-foreground">
                  {workspace.summary.wordCount} words and {workspace.summary.phraseCount} phrases
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
                  {workspace.summary.equivalentWordCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  {workspace.summary.rawEquivalentWordCount} raw items before level weighting
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Above Target</CardTitle>
                <BookMarked className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{workspace.aboveTargetCount}</div>
                <p className="text-xs text-muted-foreground">
                  library-tagged words above the current {workspace.cefrLevel} target
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">What It Means</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {PASSIVE_EQUIVALENT_WORDS_EXPLANATION}
                </p>
              </CardContent>
            </Card>
          </div>

          <ImportPassiveVocabularyCard
            targetLanguage={workspace.targetLanguage}
            studentId={role === "student" ? undefined : workspace.studentId}
            cardId="passive-recognition"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Passive Evidence</CardTitle>
              <CardDescription>
                Review imported passive-recognition items, including the shared library CEFR and part-of-speech metadata when available.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PassiveEvidenceList
                items={workspace.evidenceItems}
                emptyMessage="No passive evidence imported yet."
              />

              <PagePagination
                pathname="/passive-vocabulary"
                currentPage={evidencePage}
                pageSize={EVIDENCE_PAGE_SIZE}
                totalItems={workspace.evidenceTotal}
                searchParams={resolvedSearchParams}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {role === "superadmin" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Shared Vocabulary Library</h2>
            <Badge variant="destructive">Superadmin Only</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Library Items</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{libraryCountResult?.count ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Fully Tagged</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {completedLibraryCountResult?.count ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {needsReviewLibraryCountResult?.count ?? 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <ImportPassiveVocabularyCard
            targetLanguage={workspace?.targetLanguage ?? "english"}
            mode="library"
            cardId="shared-library-import"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Library Table</CardTitle>
              <CardDescription>
                Every passive import feeds this shared library. Superadmins can correct canonical forms, CEFR levels, parts of speech, and future attributes here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PassiveLibraryAdminPanel
                initialItems={
                  (libraryRowsResult?.data ?? []).map((item) => ({
                    id: item.id,
                    canonical_term: item.canonical_term,
                    normalized_term: item.normalized_term,
                    item_type: item.item_type,
                    cefr_level: item.cefr_level,
                    part_of_speech: item.part_of_speech,
                    attributes:
                      item.attributes && typeof item.attributes === "object" && !Array.isArray(item.attributes)
                        ? (item.attributes as Record<string, unknown>)
                        : {},
                    enrichment_status: item.enrichment_status,
                    enrichment_error: item.enrichment_error,
                    updated_at: item.updated_at,
                  }))
                }
                initialHasMore={(libraryCountResult?.count ?? 0) > LIBRARY_PAGE_SIZE}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}