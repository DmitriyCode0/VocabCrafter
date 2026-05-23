import { redirect } from "next/navigation";
import { ImportPassiveVocabularyCard } from "@/components/mastery/import-passive-vocabulary-card";
import { PassiveVocabularyStudentFilter } from "@/components/mastery/passive-vocabulary-student-filter";
import {
  StudentVocabularyBrowser,
  type StudentVocabularyBrowserItem,
} from "@/components/mastery/student-vocabulary-browser";
import { Badge } from "@/components/ui/badge";
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
  getPassiveVocabularyForms,
  getPassiveVocabularyEnglishDefinitions,
  getPassiveVocabularyUkrainianSearchForms,
  getPassiveVocabularyUkrainianTranslation,
  normalizePassiveVocabularyLibraryAttributes,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";
import type {
  StudentVocabularyCurrentState,
  StudentVocabularyGroupOverride,
} from "@/lib/mastery/student-vocabulary-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/roles";
import type { CEFRLevel } from "@/types/quiz";

export const dynamic = "force-dynamic";

interface PassiveVocabularyStudentOption {
  id: string;
  full_name: string | null;
  email: string | null;
  cefr_level: string | null;
}

interface StudentVocabularyRow {
  id: string;
  library_item_id: string | null;
  term: string;
  normalized_term: string;
  item_type: "word" | "phrase";
  current_state: StudentVocabularyCurrentState;
  group_override: StudentVocabularyGroupOverride | null;
  custom_definition: string | null;
  updated_at: string;
  passive_vocabulary_library: {
    approval_status: "unconfirmed" | "confirmed" | "rejected";
    cefr_level: string | null;
    part_of_speech: string | null;
    attributes: unknown;
  } | null;
}

interface StudentVocabularyWorkspace {
  studentId: string;
  studentName: string;
  studentEmail: string;
  cefrLevel: CEFRLevel;
  targetLanguage: ReturnType<typeof normalizeLearningLanguage>;
  targetLanguageLabel: string;
  items: StudentVocabularyBrowserItem[];
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
  return ["A1", "A2", "B1", "B2", "C1", "C2"].includes(value ?? "")
    ? (value as CEFRLevel)
    : "A1";
}

function buildStudentLabel(student: PassiveVocabularyStudentOption) {
  return student.full_name ?? student.email ?? "Student";
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

async function loadStudentVocabularyWorkspace(
  studentId: string,
): Promise<StudentVocabularyWorkspace | null> {
  const supabaseAdmin = createAdminClient();
  const [studentProfileResult, rowsResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, email, preferred_language, cefr_level")
      .eq("id", studentId)
      .single(),
    supabaseAdmin
      .from("student_vocabulary_items")
      .select(
        "id, library_item_id, term, normalized_term, item_type, current_state, group_override, custom_definition, updated_at, passive_vocabulary_library(approval_status, cefr_level, part_of_speech, attributes)",
      )
      .eq("student_id", studentId),
  ]);

  if (studentProfileResult.error || !studentProfileResult.data) {
    return null;
  }

  const rows = (rowsResult.data ?? []) as StudentVocabularyRow[];
  const libraryItemIds = Array.from(
    new Set(rows.flatMap((row) => (row.library_item_id ? [row.library_item_id] : []))),
  );
  const [formsResult, ukrainianFormsResult] =
    libraryItemIds.length > 0
      ? await Promise.all([
          supabaseAdmin
            .from("passive_vocabulary_library_forms")
            .select("library_item_id, form_term")
            .in("library_item_id", libraryItemIds),
          supabaseAdmin
            .from("passive_vocabulary_library_ukrainian_forms")
            .select("library_item_id, form_term")
            .in("library_item_id", libraryItemIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  if (formsResult.error || ukrainianFormsResult.error) {
    console.error("Failed to load student vocabulary search forms", {
      studentId,
      formsError: formsResult.error,
      ukrainianFormsError: ukrainianFormsResult.error,
    });
  }

  const formsByLibraryId = new Map<string, string[]>();
  for (const row of formsResult.error ? [] : (formsResult.data ?? [])) {
    const existing = formsByLibraryId.get(row.library_item_id) ?? [];
    existing.push(row.form_term);
    formsByLibraryId.set(row.library_item_id, existing);
  }

  const ukrainianFormsByLibraryId = new Map<string, string[]>();
  for (const row of ukrainianFormsResult.error ? [] : (ukrainianFormsResult.data ?? [])) {
    const existing = ukrainianFormsByLibraryId.get(row.library_item_id) ?? [];
    existing.push(row.form_term);
    ukrainianFormsByLibraryId.set(row.library_item_id, existing);
  }

  const items = rows
    .map((row) => {
      const normalizedAttributes = normalizePassiveVocabularyLibraryAttributes(
        row.passive_vocabulary_library?.attributes,
      );
      const attributeForms = getPassiveVocabularyForms(
        normalizedAttributes,
        row.term,
      );
      const attributeUkrainianForms = getPassiveVocabularyUkrainianSearchForms(
        normalizedAttributes,
        getPassiveVocabularyUkrainianTranslation(normalizedAttributes),
      );

      return {
        id: row.id,
        term: row.term,
        normalizedTerm: row.normalized_term,
        itemType: row.item_type,
        currentState: row.current_state,
        groupOverride: row.group_override,
        customDefinition: row.custom_definition,
        updatedAt: row.updated_at,
        approvalStatus: row.passive_vocabulary_library?.approval_status ?? "unconfirmed",
        cefrLevel:
          (row.passive_vocabulary_library?.cefr_level as CEFRLevel | null) ?? null,
        partOfSpeech:
          (row.passive_vocabulary_library?.part_of_speech as PassiveVocabularyPartOfSpeech | null) ?? null,
        sharedTranslation: getPassiveVocabularyUkrainianTranslation(
          normalizedAttributes,
        ),
        sharedDefinitions: getPassiveVocabularyEnglishDefinitions(
          normalizedAttributes,
        ),
        searchForms: Array.from(
          new Set([
            ...(row.library_item_id
              ? (formsByLibraryId.get(row.library_item_id) ?? [])
              : []),
            ...attributeForms,
          ]),
        ),
        ukrainianSearchForms: Array.from(
          new Set([
            ...(row.library_item_id
              ? (ukrainianFormsByLibraryId.get(row.library_item_id) ?? [])
              : []),
            ...attributeUkrainianForms,
          ]),
        ),
      } satisfies StudentVocabularyBrowserItem;
    })
    .sort((left, right) =>
      left.normalizedTerm.localeCompare(right.normalizedTerm, undefined, {
        numeric: true,
        sensitivity: "base",
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
    targetLanguage: normalizeLearningLanguage(
      studentProfileResult.data.preferred_language,
    ),
    targetLanguageLabel: getLearningLanguageLabel(
      studentProfileResult.data.preferred_language,
    ),
    items,
  } satisfies StudentVocabularyWorkspace;
}

function getHeaderDescription(role: Role) {
  if (role === "tutor" || role === "superadmin") {
    return "Choose a student and review their My Dictionary with the same filter-first view used by the shared dictionary.";
  }

  return "Browse your dictionary, change vocabulary groups, keep your own definitions, and remove words you no longer want tracked.";
}

export async function PassiveVocabularyPageContent({
  searchParams,
}: PassiveVocabularyPageProps) {
  const resolvedSearchParams = await searchParams;
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
    ? await loadStudentVocabularyWorkspace(selectedStudentId)
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {role === "student" ? "My Dictionary" : "Vocabulary"}
        </h1>
        <p className="text-muted-foreground">{getHeaderDescription(role)}</p>
      </div>

      {role !== "student" ? (
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
                  ? "No connected students yet. Connect a student first to manage their dictionary."
                  : "No students found yet."}
              </div>
            ) : (
              <PassiveVocabularyStudentFilter
                students={studentOptions.map((student) => ({
                  id: student.id,
                  label: buildStudentLabel(student),
                }))}
                activeStudentId={selectedStudentId}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      {!workspace && role !== "student" ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Choose a student to view their dictionary.
        </div>
      ) : null}

      {workspace ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{workspace.studentName}</h2>
                {role !== "student" ? (
                  <Badge variant="outline">Student Workspace</Badge>
                ) : null}
                <Badge variant="secondary">Target {workspace.cefrLevel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {workspace.targetLanguageLabel} dictionary for {workspace.studentEmail}.
              </p>
            </div>
          </div>

          <ImportPassiveVocabularyCard
            targetLanguage={workspace.targetLanguage}
            studentId={role === "student" ? undefined : workspace.studentId}
            cardId="my-dictionary-import"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">My Dictionary</CardTitle>
              <CardDescription>
                Search, filter, regroup, edit your own definitions, and delete
                student-owned vocabulary without changing the shared dictionary.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StudentVocabularyBrowser
                key={workspace.studentId}
                initialItems={workspace.items}
                role={role === "student" ? "student" : role}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default async function PassiveVocabularyPage({
  searchParams,
}: LegacyPassiveVocabularyRedirectProps) {
  const resolvedSearchParams = await searchParams;

  redirect(buildRedirectPath("/vocabulary", resolvedSearchParams));
}