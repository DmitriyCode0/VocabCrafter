import Link from "next/link";
import { redirect } from "next/navigation";
import { BookMarked, BookOpen, Shield, TrendingUp, Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ActiveEvidenceList,
  type ActiveEvidenceListItem,
} from "@/components/mastery/active-evidence-list";
import { ImportPassiveVocabularyCard } from "@/components/mastery/import-passive-vocabulary-card";
import { PassiveLibraryAdminPanel } from "@/components/mastery/passive-library-admin-panel";
import { VocabularyViewTabs } from "@/components/mastery/vocabulary-view-tabs";
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
  summarizeActiveVocabularyEvidence,
  type ActiveVocabularySignalSummary,
} from "@/lib/mastery/active-vocabulary-evidence";
import {
  getPassiveVocabularyEquivalentWeight,
  normalizePassiveVocabularyLibraryAttributes,
  PASSIVE_EQUIVALENT_WORDS_EXPLANATION,
  summarizePassiveVocabularyEvidence,
  type PassiveVocabularyEvidenceRow,
  type PassiveVocabularyPartOfSpeech,
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

interface ActiveEvidenceQueryRow {
  id: string;
  term: string;
  source_type: "lesson_recording" | "manual_list" | "other";
  source_label: string | null;
  usage_count: number;
  first_used_at: string;
  last_used_at: string;
  passive_vocabulary_library: {
    cefr_level: string | null;
    part_of_speech: PassiveVocabularyPartOfSpeech | null;
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

interface ActiveVocabularyWorkspaceData {
  studentId: string;
  studentName: string;
  studentEmail: string;
  cefrLevel: CEFRLevel;
  evidenceTotal: number;
  evidenceItems: ActiveEvidenceListItem[];
  summary: ActiveVocabularySignalSummary;
  taggedItemsCount: number;
}

interface PassiveVocabularyPageProps {
  searchParams: Promise<{ student?: string; page?: string; tab?: string }>;
}

interface LegacyPassiveVocabularyRedirectProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function buildRedirectPath(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      nextParams.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        nextParams.append(key, item);
      }
    }
  }

  return nextParams.size > 0
    ? `${pathname}?${nextParams.toString()}`
    : pathname;
}

function normalizeCefrLevel(value?: string | null): CEFRLevel {
  return CEFR_LEVELS.includes(value as CEFRLevel) ? (value as CEFRLevel) : "A1";
}

function buildStudentLabel(student: PassiveVocabularyStudentOption) {
  return student.full_name ?? student.email ?? "Student";
}

function countAboveTargetLevels(
  cefrCounts: ReturnType<
    typeof summarizePassiveVocabularyEvidence
  >["cefrCounts"],
  targetLevel: CEFRLevel,
) {
  const targetIndex = CEFR_LEVELS.indexOf(targetLevel);

  return CEFR_LEVELS.slice(targetIndex + 1).reduce(
    (sum, level) => sum + cefrCounts[level],
    0,
  );
}

function countTaggedActiveVocabularyItems(
  cefrCounts: ActiveVocabularySignalSummary["cefrCounts"],
) {
  return CEFR_LEVELS.reduce((sum, level) => sum + cefrCounts[level], 0);
}

function resolveVocabularyTab(value?: string) {
  return value === "active" ? "active" : "passive";
}

function buildVocabularyHref({
  tab,
  studentId,
}: {
  tab: "active" | "passive";
  studentId?: string | null;
}) {
  const nextParams = new URLSearchParams();

  if (tab === "active") {
    nextParams.set("tab", "active");
  }

  if (studentId) {
    nextParams.set("student", studentId);
  }

  return nextParams.size > 0
    ? `/vocabulary?${nextParams.toString()}`
    : "/vocabulary";
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
      buildStudentLabel(left).localeCompare(
        buildStudentLabel(right),
        undefined,
        {
          sensitivity: "base",
        },
      ),
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
  const [
    studentProfileResult,
    evidenceCountResult,
    summaryRowsResult,
    evidenceRowsResult,
  ] = await Promise.all([
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
  const mapSummaryRow = (
    row: PassiveEvidenceQueryRow,
  ): PassiveVocabularyEvidenceRow => ({
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
    ((summaryRowsResult.data ?? []) as PassiveEvidenceQueryRow[]).map(
      mapSummaryRow,
    ),
    cefrLevel,
  );
  const evidenceItems = (
    (evidenceRowsResult.data ?? []) as PassiveEvidenceQueryRow[]
  ).map(
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

async function loadActiveVocabularyWorkspace(
  studentId: string,
  evidencePage: number,
) {
  const supabaseAdmin = createAdminClient();
  const evidenceRange = getPaginationRange(evidencePage, EVIDENCE_PAGE_SIZE);
  const [studentProfileResult, evidenceCountResult, summaryRowsResult, evidenceRowsResult] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("full_name, email, cefr_level")
        .eq("id", studentId)
        .single(),
      supabaseAdmin
        .from("active_vocabulary_evidence")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId),
      supabaseAdmin
        .from("active_vocabulary_evidence")
        .select(
          "id, term, source_type, source_label, usage_count, first_used_at, last_used_at, passive_vocabulary_library:passive_vocabulary_library!active_vocabulary_evidence_library_item_id_fkey(cefr_level, part_of_speech)",
        )
        .eq("student_id", studentId),
      supabaseAdmin
        .from("active_vocabulary_evidence")
        .select(
          "id, term, source_type, source_label, usage_count, first_used_at, last_used_at, passive_vocabulary_library:passive_vocabulary_library!active_vocabulary_evidence_library_item_id_fkey(cefr_level, part_of_speech)",
        )
        .eq("student_id", studentId)
        .order("last_used_at", { ascending: false })
        .range(evidenceRange.from, evidenceRange.to),
    ]);

  if (studentProfileResult.error || !studentProfileResult.data) {
    return null;
  }

  const summary = summarizeActiveVocabularyEvidence(
    ((summaryRowsResult.data ?? []) as ActiveEvidenceQueryRow[]).map((row) => ({
      id: row.id,
      term: row.term,
      source_type: row.source_type,
      source_label: row.source_label,
      usage_count: row.usage_count,
      first_used_at: row.first_used_at,
      last_used_at: row.last_used_at,
      library_cefr_level:
        (row.passive_vocabulary_library?.cefr_level as
          | "A1"
          | "A2"
          | "B1"
          | "B2"
          | "C1"
          | "C2"
          | null) ?? null,
      library_part_of_speech:
        row.passive_vocabulary_library?.part_of_speech ?? null,
    })),
  );

  const evidenceItems = ((evidenceRowsResult.data ?? []) as ActiveEvidenceQueryRow[]).map(
    (row): ActiveEvidenceListItem => ({
      id: row.id,
      term: row.term,
      source_type: row.source_type,
      source_label: row.source_label,
      usage_count: row.usage_count,
      first_used_at: row.first_used_at,
      last_used_at: row.last_used_at,
      library_cefr_level: row.passive_vocabulary_library?.cefr_level ?? null,
      library_part_of_speech:
        row.passive_vocabulary_library?.part_of_speech ?? null,
    }),
  );

  return {
    studentId,
    studentName:
      studentProfileResult.data.full_name ||
      studentProfileResult.data.email ||
      "Student",
    studentEmail: studentProfileResult.data.email,
    cefrLevel: normalizeCefrLevel(studentProfileResult.data.cefr_level),
    evidenceTotal: evidenceCountResult.count ?? 0,
    evidenceItems,
    summary,
    taggedItemsCount: countTaggedActiveVocabularyItems(summary.cefrCounts),
  } satisfies ActiveVocabularyWorkspaceData;
}

function resolveSelectedStudentId(
  requestedStudentId: string | undefined,
  students: PassiveVocabularyStudentOption[],
  fallbackStudentId: string | null,
) {
  if (
    requestedStudentId &&
    students.some((student) => student.id === requestedStudentId)
  ) {
    return requestedStudentId;
  }

  return fallbackStudentId;
}

function getHeaderDescription(role: Role) {
  if (role === "superadmin") {
    return "Review student active and passive evidence and manage the shared vocabulary library that powers CEFR-aware passive estimates.";
  }

  if (role === "tutor") {
    return "Choose a student and switch between active and passive evidence in one vocabulary workspace.";
  }

  return "Review the words you use in lessons and the words you recognize from text in one vocabulary workspace.";
}

export async function PassiveVocabularyPageContent({
  searchParams,
}: PassiveVocabularyPageProps) {
  const resolvedSearchParams = await searchParams;
  const evidencePage = getCurrentPage(resolvedSearchParams.page);
  const activeTab = resolveVocabularyTab(resolvedSearchParams.tab);
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
  const activeWorkspace =
    activeTab === "active" && selectedStudentId
      ? await loadActiveVocabularyWorkspace(selectedStudentId, evidencePage)
      : null;
  const passiveWorkspace =
    activeTab === "passive" && selectedStudentId
      ? await loadPassiveVocabularyWorkspace(selectedStudentId, evidencePage)
      : null;

  const supabaseAdmin = createAdminClient();
  const [
    libraryCountResult,
    completedLibraryCountResult,
    needsReviewLibraryCountResult,
    libraryRowsResult,
  ] =
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
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vocabulary</h1>
          <p className="text-muted-foreground">{getHeaderDescription(role)}</p>
        </div>
        <VocabularyViewTabs
          activeHref={buildVocabularyHref({
            tab: "active",
            studentId: selectedStudentId,
          })}
          passiveHref={buildVocabularyHref({
            tab: "passive",
            studentId: selectedStudentId,
          })}
          activeTab={activeTab}
        />
      </div>

      {role !== "student" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose Student</CardTitle>
            <CardDescription>
              Tutors and admins can switch between students the same way they do
              on the history page.
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

                {!activeWorkspace && !passiveWorkspace && (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {studentOptions.slice(0, 12).map((student) => (
                      <Button
                        key={student.id}
                        asChild
                        variant="outline"
                        className="justify-start"
                      >
                        <Link
                          href={buildVocabularyHref({
                            tab: activeTab,
                            studentId: student.id,
                          })}
                        >
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

      {activeWorkspace && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">
                  {activeWorkspace.studentName}
                </h2>
                {role !== "student" && (
                  <Badge variant="outline">Student Workspace</Badge>
                )}
                <Badge variant="secondary">Target {activeWorkspace.cefrLevel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Lesson-derived active vocabulary evidence for {activeWorkspace.studentEmail}.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Used Words
                </CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeWorkspace.summary.uniqueItems}
                </div>
                <p className="text-xs text-muted-foreground">
                  unique words tracked from student production
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Uses
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeWorkspace.summary.totalUsageCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  aggregated production hits across all tracked words
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Tagged Items
                </CardTitle>
                <BookMarked className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeWorkspace.taggedItemsCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  evidence rows already linked to shared library CEFR metadata
                </p>
              </CardContent>
            </Card>
          </div>

          <Card id="active-evidence">
            <CardHeader>
              <CardTitle className="text-base">Active Evidence</CardTitle>
              <CardDescription>
                Review lesson-derived production words and remove entries that should not stay attached to the student.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActiveEvidenceList
                items={activeWorkspace.evidenceItems}
                emptyMessage="No active evidence tracked yet."
                canDelete={role !== "student"}
                deleteTitle="Delete active evidence"
                getDeleteDescription={(term) =>
                  `${term} will be removed from this student's active evidence.`
                }
                getDeleteSuccessMessage={(term) =>
                  `Deleted ${term} from the student's active evidence`
                }
              />

              <PagePagination
                pathname="/vocabulary"
                currentPage={evidencePage}
                pageSize={EVIDENCE_PAGE_SIZE}
                totalItems={activeWorkspace.evidenceTotal}
                searchParams={resolvedSearchParams}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {passiveWorkspace && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">
                  {passiveWorkspace.studentName}
                </h2>
                {role !== "student" && (
                  <Badge variant="outline">Student Workspace</Badge>
                )}
                <Badge variant="secondary">Target {passiveWorkspace.cefrLevel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {passiveWorkspace.targetLanguageLabel} passive-recognition evidence for{" "}
                {passiveWorkspace.studentEmail}.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Imported Items
                </CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {passiveWorkspace.summary.uniqueItems}
                </div>
                <p className="text-xs text-muted-foreground">
                  {passiveWorkspace.summary.wordCount} words and{" "}
                  {passiveWorkspace.summary.phraseCount} phrases
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Equivalent Words
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {passiveWorkspace.summary.equivalentWordCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  {passiveWorkspace.summary.rawEquivalentWordCount} raw items before
                  level weighting
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Above Target
                </CardTitle>
                <BookMarked className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {passiveWorkspace.aboveTargetCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  library-tagged words above the current {passiveWorkspace.cefrLevel}{" "}
                  target
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  What It Means
                </CardTitle>
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
            targetLanguage={passiveWorkspace.targetLanguage}
            studentId={role === "student" ? undefined : passiveWorkspace.studentId}
            cardId="passive-recognition"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recent Passive Evidence
              </CardTitle>
              <CardDescription>
                Review imported passive-recognition items, including the shared
                library CEFR and part-of-speech metadata when available.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PassiveEvidenceList
                items={passiveWorkspace.evidenceItems}
                emptyMessage="No passive evidence imported yet."
              />

              <PagePagination
                pathname="/vocabulary"
                currentPage={evidencePage}
                pageSize={EVIDENCE_PAGE_SIZE}
                totalItems={passiveWorkspace.evidenceTotal}
                searchParams={resolvedSearchParams}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {role === "superadmin" && activeTab === "passive" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Shared Vocabulary Library</h2>
            <Badge variant="destructive">Superadmin Only</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Library Items
                </CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {libraryCountResult?.count ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Fully Tagged
                </CardTitle>
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
                <CardTitle className="text-sm font-medium">
                  Needs Review
                </CardTitle>
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
            targetLanguage={passiveWorkspace?.targetLanguage ?? "english"}
            mode="library"
            cardId="shared-library-import"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Library Table</CardTitle>
              <CardDescription>
                Every passive import feeds this shared library. Superadmins can
                correct canonical forms, CEFR levels, parts of speech, and
                future attributes here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PassiveLibraryAdminPanel
                initialItems={(libraryRowsResult?.data ?? []).map((item) => ({
                  id: item.id,
                  canonical_term: item.canonical_term,
                  normalized_term: item.normalized_term,
                  item_type: item.item_type,
                  cefr_level: item.cefr_level as
                    | "A1"
                    | "A2"
                    | "B1"
                    | "B2"
                    | "C1"
                    | "C2"
                    | null,
                  part_of_speech:
                    item.part_of_speech as PassiveVocabularyPartOfSpeech | null,
                  attributes: normalizePassiveVocabularyLibraryAttributes(
                    item.attributes,
                  ),
                  enrichment_status: item.enrichment_status,
                  enrichment_error: item.enrichment_error,
                  updated_at: item.updated_at,
                }))}
                initialHasMore={
                  (libraryCountResult?.count ?? 0) > LIBRARY_PAGE_SIZE
                }
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default async function PassiveVocabularyPage({
  searchParams,
}: LegacyPassiveVocabularyRedirectProps) {
  const resolvedSearchParams = await searchParams;

  redirect(buildRedirectPath("/vocabulary", resolvedSearchParams));
}
