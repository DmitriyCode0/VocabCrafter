import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PagePagination } from "@/components/shared/page-pagination";
import { DeleteMasteryWordButton } from "@/components/mastery/delete-mastery-word-button";
import { ImportVocabularyCard } from "@/components/mastery/import-vocabulary-card";
import { formatAppDate } from "@/lib/dates";
import { getCurrentPage, getPaginationRange } from "@/lib/pagination";
import {
  BookMarked,
  BookOpen,
  Clock,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  normalizeLearningLanguage,
} from "@/lib/languages";
import {
  PASSIVE_EQUIVALENT_WORDS_EXPLANATION,
  summarizePassiveVocabularyEvidence,
} from "@/lib/mastery/passive-vocabulary";
import { hasConfirmedPassiveVocabularyLibraryEntry } from "@/lib/mastery/dictionary-approval";
import {
  createStudentVocabularyStateKey,
  createStudentVocabularyStateKeyFromTerm,
  getStudentLearningVocabularyKeySet,
} from "@/lib/mastery/student-vocabulary-state";

export const dynamic = "force-dynamic";

const VOCABULARY_PAGE_SIZE = 24;

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

interface WordMasteryRow {
  id: string;
  term: string;
  definition: string | null;
  mastery_level: number;
  correct_count: number;
  incorrect_count: number;
  streak: number;
  last_practiced: string | null;
  next_review: string | null;
}

interface PassiveEvidenceRow {
  id: string;
  term: string;
  definition: string | null;
  normalized_term: string;
  item_type: "word" | "phrase";
  source_type: "full_text" | "manual_list" | "curated_list";
  source_label: string | null;
  import_count: number;
  last_imported_at: string;
  passive_vocabulary_library: {
    approval_status: "unconfirmed" | "confirmed" | "rejected";
  } | null;
}

interface LearningStateRow {
  term: string;
  normalized_term: string;
  item_type: "word" | "phrase";
  moved_to_learning_at: string | null;
  learning_archived_at: string | null;
}

function hasPendingPassiveEvidence(
  libraryItem: PassiveEvidenceRow["passive_vocabulary_library"],
) {
  return !libraryItem || libraryItem.approval_status === "unconfirmed";
}

interface StudentVocabularyPageProps {
  searchParams: Promise<{ page?: string }>;
}

export async function StudentVocabularyPageContent({
  searchParams,
}: StudentVocabularyPageProps) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const currentPage = getCurrentPage(resolvedSearchParams.page);
  const { from, to } = getPaginationRange(currentPage, VOCABULARY_PAGE_SIZE);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .single();

  const targetLanguage = normalizeLearningLanguage(profile?.preferred_language);

  const supabaseAdmin = createAdminClient();
  const nowIso = new Date().toISOString();

  const [
    totalWordsResult,
    masteredCountResult,
    dueForReviewResult,
    levelRowsResult,
    masteryTermsResult,
    wordsResult,
    passiveEvidenceRowsResult,
    learningStateRowsResult,
    learningVocabularyKeySet,
  ] = await Promise.all([
    supabaseAdmin
      .from("word_mastery")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id),
    supabaseAdmin
      .from("word_mastery")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id)
      .gte("mastery_level", 5),
    supabaseAdmin
      .from("word_mastery")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id)
      .neq("mastery_level", 4)
      .not("next_review", "is", null)
      .lte("next_review", nowIso),
    supabaseAdmin
      .from("word_mastery")
      .select("mastery_level")
      .eq("student_id", user.id),
    supabaseAdmin.from("word_mastery").select("term").eq("student_id", user.id),
    supabaseAdmin
      .from("word_mastery")
      .select("*")
      .eq("student_id", user.id)
      .order("mastery_level", { ascending: true })
      .order("last_practiced", { ascending: false })
      .range(from, to),
    supabaseAdmin
      .from("passive_vocabulary_evidence")
      .select(
        "id, term, definition, normalized_term, item_type, source_type, source_label, import_count, last_imported_at, passive_vocabulary_library(approval_status)",
      )
      .eq("student_id", user.id),
    supabaseAdmin
      .from("student_vocabulary_items")
      .select(
        "term, normalized_term, item_type, moved_to_learning_at, learning_archived_at",
      )
      .eq("student_id", user.id)
      .eq("current_state", "learning")
      .order("moved_to_learning_at", { ascending: false }),
    getStudentLearningVocabularyKeySet({
      adminClient: supabaseAdmin,
      studentId: user.id,
    }),
  ]);

  const masteryWordCount = totalWordsResult.count ?? 0;
  const masteredCount = masteredCountResult.count ?? 0;
  const dueForReview = dueForReviewResult.count ?? 0;
  const levelRows = levelRowsResult.data ?? [];
  const masteryTermRows = (masteryTermsResult.data ?? []) as Array<{
    term: string;
  }>;
  const visibleWords = (wordsResult.data ?? []) as WordMasteryRow[];
  const allPassiveEvidenceRows =
    (passiveEvidenceRowsResult.data ?? []) as PassiveEvidenceRow[];
  const learningStateRows =
    (learningStateRowsResult.data ?? []) as LearningStateRow[];
  const masteryWordKeySet = new Set(
    masteryTermRows
      .map((row) => createStudentVocabularyStateKeyFromTerm(row.term))
      .filter((key): key is string => key !== null),
  );
  const queuedLearningRows = learningStateRows.filter(
    (row) =>
      row.learning_archived_at == null &&
      !masteryWordKeySet.has(
        createStudentVocabularyStateKey(row.normalized_term, row.item_type),
      ),
  );
  const totalWords = masteryWordCount + queuedLearningRows.length;
  const visiblePassiveEvidenceRows = allPassiveEvidenceRows.filter((row) =>
    hasConfirmedPassiveVocabularyLibraryEntry(row.passive_vocabulary_library) &&
      !learningVocabularyKeySet.has(
        createStudentVocabularyStateKey(row.normalized_term, row.item_type),
      ),
  );
  const pendingPassiveEvidenceCount = allPassiveEvidenceRows.filter((row) =>
    hasPendingPassiveEvidence(row.passive_vocabulary_library) &&
      !learningVocabularyKeySet.has(
        createStudentVocabularyStateKey(row.normalized_term, row.item_type),
      ),
  ).length;
  const passiveEvidenceTotal = visiblePassiveEvidenceRows.length;
  const passiveEvidenceSummary = summarizePassiveVocabularyEvidence(
    visiblePassiveEvidenceRows.map((item) => ({
      term: item.term,
      definition: item.definition,
      item_type: item.item_type,
      source_type: item.source_type,
      source_label: item.source_label,
      import_count: item.import_count,
      last_imported_at: item.last_imported_at,
    })),
  );

  const avgLevel =
    levelRows.length + queuedLearningRows.length > 0
      ? (
          levelRows.reduce((sum, row) => sum + (row.mastery_level ?? 0), 0) /
          (levelRows.length + queuedLearningRows.length)
        ).toFixed(1)
      : "0";

  const levelCounts = new Map<number, number>();
  if (queuedLearningRows.length > 0) {
    levelCounts.set(0, queuedLearningRows.length);
  }
  for (const row of levelRows) {
    const level = row.mastery_level ?? 0;
    levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
  }

  const wordsByLevel = new Map<number, WordMasteryRow[]>();
  for (const word of visibleWords) {
    const level = word.mastery_level;
    if (!wordsByLevel.has(level)) {
      wordsByLevel.set(level, []);
    }
    wordsByLevel.get(level)!.push(word);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mastery</h1>
        <p className="text-muted-foreground">
          Track your word mastery with spaced-repetition levels.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Words</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWords}</div>
            <p className="text-xs text-muted-foreground">tracked vocabulary</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mastered</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {masteredCount}
            </div>
            <Progress
              value={totalWords > 0 ? (masteredCount / totalWords) * 100 : 0}
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Due for Review
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {dueForReview}
            </div>
            <p className="text-xs text-muted-foreground">words to practice</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Level</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgLevel}</div>
            <p className="text-xs text-muted-foreground">out of 5</p>
          </CardContent>
        </Card>
      </div>

      <ImportVocabularyCard
        targetLanguage={targetLanguage}
      />

      <Card id="passive-recognition">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookMarked className="h-5 w-5 text-primary" />
            Vocabulary
          </CardTitle>
          <CardDescription>
            Review active and passive evidence in the unified vocabulary
            workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/vocabulary">Open Vocabulary</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Passive Evidence
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passiveEvidenceTotal}</div>
            <p className="text-xs text-muted-foreground">
              confirmed words and phrases tracked as recognition only
            </p>
            {pendingPassiveEvidenceCount > 0 ? (
              <p className="mt-1 text-xs text-amber-700">
                {pendingPassiveEvidenceCount} pending review and hidden from
                vocabulary estimates
              </p>
            ) : null}
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
              {passiveEvidenceSummary.equivalentWordCount}
            </div>
            <p className="text-xs text-muted-foreground">
              level-adjusted recognition-weighted total used in
              passive-vocabulary estimates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">What It Means</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {PASSIVE_EQUIVALENT_WORDS_EXPLANATION}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mastery Levels</CardTitle>
          <CardDescription>
            Words progress through 6 levels as you practice them correctly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {LEVEL_LABELS.map((label, index) => (
              <Badge
                key={index}
                variant="outline"
                className={`${LEVEL_COLORS[index]} border-0 px-3 py-1`}
              >
                {index}: {label} ({levelCounts.get(index) ?? 0})
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {totalWords === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">No vocabulary tracked yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Import vocabulary or complete quizzes to start building your word
              mastery profile.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {queuedLearningRows.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`${LEVEL_COLORS[0]} border-0`}
                    >
                      Level 0
                    </Badge>
                    Queued for Learning
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {queuedLearningRows.length} word
                    {queuedLearningRows.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <CardDescription>
                  Added to learning through quiz creation and waiting for first
                  practice results.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {queuedLearningRows.map((word) => (
                    <div
                      key={`${word.item_type}:${word.normalized_term}`}
                      className="flex flex-col gap-1 rounded-lg border p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {word.term}
                        </span>
                        <Badge variant="outline" className="text-xs px-1.5">
                          Waiting
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {word.item_type === "phrase"
                          ? "Phrase queued for practice"
                          : "Word queued for practice"}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>First quiz attempt pending</span>
                        {word.moved_to_learning_at ? (
                          <span>{formatAppDate(word.moved_to_learning_at)}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {Array.from(wordsByLevel.entries())
            .sort(([leftLevel], [rightLevel]) => leftLevel - rightLevel)
            .map(([level, levelWords]) => (
              <Card key={level}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`${LEVEL_COLORS[level]} border-0`}
                      >
                        Level {level}
                      </Badge>
                      {LEVEL_LABELS[level]}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {levelWords.length} word
                      {levelWords.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {levelWords.map((word) => {
                      const totalAttempts =
                        word.correct_count + word.incorrect_count;
                      const accuracy =
                        totalAttempts > 0
                          ? Math.round(
                              (word.correct_count / totalAttempts) * 100,
                            )
                          : 0;
                      const isDue =
                        word.mastery_level !== 4 &&
                        word.next_review &&
                        new Date(word.next_review) <= new Date();

                      return (
                        <div
                          key={word.id}
                          className="flex flex-col gap-1 rounded-lg border p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="truncate text-sm font-medium">
                              {word.term}
                            </span>
                            <DeleteMasteryWordButton
                              wordId={word.id}
                              term={word.term}
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            {word.streak > 0 && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1.5"
                              >
                                🔥 {word.streak}
                              </Badge>
                            )}
                            {isDue && (
                              <Badge
                                variant="destructive"
                                className="text-xs px-1.5"
                              >
                                Due
                              </Badge>
                            )}
                          </div>
                          {word.definition && (
                            <p className="truncate text-xs text-muted-foreground">
                              {word.definition}
                            </p>
                          )}
                          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {word.correct_count}✓ {word.incorrect_count}✗ (
                              {accuracy}%)
                            </span>
                            {word.last_practiced && (
                              <span>{formatAppDate(word.last_practiced)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}

          {masteryWordCount > 0 ? (
            <PagePagination
              pathname="/mastery"
              currentPage={currentPage}
              pageSize={VOCABULARY_PAGE_SIZE}
              totalItems={masteryWordCount}
              searchParams={resolvedSearchParams}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
