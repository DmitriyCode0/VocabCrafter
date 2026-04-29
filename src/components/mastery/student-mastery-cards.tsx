"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EditMasteryWordDialog } from "@/components/mastery/edit-mastery-word-dialog";
import { DeleteMasteryWordButton } from "@/components/mastery/delete-mastery-word-button";
import { useAppI18n } from "@/components/providers/app-language-provider";

const LEVEL_COLORS = [
  "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
] as const;

interface StudentMasterySummary {
  studentId: string;
  name: string;
  totalWords: number;
  mastered: number;
  avgLevel: number;
  levelCounts: number[];
  passiveEvidenceCount: number;
  equivalentWords: number;
}

interface StudentWord {
  id: string;
  term: string;
  definition: string | null;
  mastery_level: number;
  correct_count: number;
  incorrect_count: number;
  translation_correct_count: number;
  streak: number;
  last_practiced: string | null;
}

export function StudentMasteryCards({
  students,
}: {
  students: StudentMasterySummary[];
}) {
  const { messages } = useAppI18n();
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(
    null,
  );
  const [wordsByStudent, setWordsByStudent] = useState<
    Record<string, StudentWord[]>
  >({});
  const [loadingByStudent, setLoadingByStudent] = useState<
    Record<string, boolean>
  >({});
  const [errorByStudent, setErrorByStudent] = useState<Record<string, string>>(
    {},
  );
  const levelLabels = [
    messages.tutorMastery.levelLabels.new,
    messages.tutorMastery.levelLabels.seen,
    messages.tutorMastery.levelLabels.learning,
    messages.tutorMastery.levelLabels.familiar,
    messages.tutorMastery.levelLabels.practiced,
    messages.tutorMastery.levelLabels.mastered,
  ] as const;

  async function loadStudentDetails(
    studentId: string,
    { includeWords }: { includeWords: boolean },
  ) {
    setLoadingByStudent((current) => ({ ...current, [studentId]: true }));
    setErrorByStudent((current) => {
      const next = { ...current };
      delete next[studentId];
      return next;
    });

    try {
      const wordsResponse = includeWords
        ? await fetch(`/api/mastery/students/${studentId}/words`, {
            cache: "no-store",
          })
        : null;

      if (wordsResponse) {
        const data = (await wordsResponse.json().catch(() => null)) as {
          words?: StudentWord[];
          error?: string;
        } | null;

        if (!wordsResponse.ok) {
          throw new Error(data?.error || "Failed to load words");
        }

        setWordsByStudent((current) => ({
          ...current,
          [studentId]: data?.words ?? [],
        }));
      }
    } catch (error) {
      setErrorByStudent((current) => ({
        ...current,
        [studentId]:
          error instanceof Error ? error.message : "Failed to load words",
      }));
    } finally {
      setLoadingByStudent((current) => ({ ...current, [studentId]: false }));
    }
  }

  async function handleToggle(
    studentId: string,
    { totalWords }: { totalWords: number },
  ) {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
      return;
    }

    setExpandedStudentId(studentId);

    if ((totalWords === 0 || wordsByStudent[studentId]) || loadingByStudent[studentId]) {
      return;
    }

    await loadStudentDetails(studentId, {
      includeWords: totalWords > 0 && !wordsByStudent[studentId],
    });
  }

  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        {messages.tutorMastery.cards.noStudentsOnPage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {students.map((student) => {
        const isExpanded = expandedStudentId === student.studentId;
        const isLoading = loadingByStudent[student.studentId] === true;
        const words = wordsByStudent[student.studentId] ?? [];
        const error = errorByStudent[student.studentId];
        const canExpand = student.totalWords > 0;

        return (
          <div
            key={student.studentId}
            className="rounded-lg border bg-card px-4 py-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h3 className="text-base font-semibold">{student.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {messages.tutorMastery.cards.summaryLine(
                    student.totalWords,
                    student.avgLevel,
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {messages.tutorMastery.cards.passiveSummary(
                    student.passiveEvidenceCount,
                    student.equivalentWords,
                  )}
                </p>
              </div>

              {canExpand ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void handleToggle(student.studentId, {
                      totalWords: student.totalWords,
                    })
                  }
                  aria-expanded={isExpanded}
                >
                  {isExpanded
                    ? messages.tutorMastery.cards.hideDetails
                    : messages.tutorMastery.cards.showDetails}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {messages.tutorMastery.cards.noWordsYet}
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {levelLabels.map((label, index) => {
                  const count = student.levelCounts[index] ?? 0;
                  if (count === 0) {
                    return null;
                  }

                  return (
                    <Badge
                      key={`${student.studentId}-${index}`}
                      variant="outline"
                      className={`${LEVEL_COLORS[index]} border-0 text-xs`}
                    >
                      {label}: {count}
                    </Badge>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 xl:min-w-64">
                <span className="shrink-0 text-sm text-muted-foreground">
                  {student.mastered}/{student.totalWords}
                </span>
                <Progress
                  value={
                    student.totalWords > 0
                      ? (student.mastered / student.totalWords) * 100
                      : 0
                  }
                  className="h-2 w-full"
                />
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 border-t pt-4">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {messages.tutorMastery.cards.loadingDetails}
                  </div>
                ) : error ? (
                  <div className="flex items-center gap-3 text-sm text-destructive">
                    <span>{error}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void loadStudentDetails(student.studentId, {
                          includeWords: student.totalWords > 0,
                        })
                      }
                    >
                      {messages.tutorMastery.cards.retry}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {messages.tutorMastery.cards.masteryWordsTitle}
                      </p>
                      {words.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {messages.tutorMastery.cards.noWordsFound}
                        </p>
                      ) : (
                        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                          {words.map((word) => (
                            <div
                              key={word.id}
                              className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-sm"
                            >
                              <span className="mr-2 truncate">{word.term}</span>
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className={`${LEVEL_COLORS[word.mastery_level]} border-0 text-xs shrink-0`}
                                >
                                  {word.mastery_level}
                                </Badge>
                                <EditMasteryWordDialog word={word} />
                                <DeleteMasteryWordButton
                                  wordId={word.id}
                                  term={word.term}
                                  title={
                                    messages.tutorMastery.cards.deleteTitle
                                  }
                                  description={messages.tutorMastery.cards.deleteDescription(
                                    word.term,
                                  )}
                                  successMessage={messages.tutorMastery.cards.deleteSuccess(
                                    word.term,
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
