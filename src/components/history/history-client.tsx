"use client";

import React, {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  User,
} from "lucide-react";
import { ACTIVITY_LABELS } from "@/lib/constants";
import {
  getGrammarTopicDisplayName,
  getPrimaryGrammarTopic,
} from "@/lib/utils";
import { formatAppDateTime } from "@/lib/dates";
import {
  HISTORY_PAGE_SIZE,
  type HistoryAttempt,
  type HistoryStudent,
} from "@/lib/history/fetch-history-page-data";
import type { TranslationScoreSaveResult } from "@/components/review/editable-translation-results";
import type { Role } from "@/types/roles";
import { AttemptDetail } from "./attempt-detail";

interface HistoryClientProps {
  role: Role;
  initialAttempts: HistoryAttempt[];
  initialHasMore: boolean;
  students: HistoryStudent[];
  userId?: string;
  initialStudentFilter?: string;
}

interface HistoryResponse {
  attempts: HistoryAttempt[];
  hasMore: boolean;
}

interface HistoryErrorResponse {
  error?: string;
}

function mergeAttempts(
  existingAttempts: HistoryAttempt[],
  nextAttempts: HistoryAttempt[],
) {
  const seenIds = new Set(existingAttempts.map((attempt) => attempt.id));

  return [
    ...existingAttempts,
    ...nextAttempts.filter((attempt) => !seenIds.has(attempt.id)),
  ];
}

function updateAttemptTranslationScore(
  attempts: HistoryAttempt[],
  attemptId: string,
  result: TranslationScoreSaveResult,
) {
  return attempts.map((attempt) => {
    if (attempt.id !== attemptId) {
      return attempt;
    }

    const currentAnswers =
      attempt.answers && typeof attempt.answers === "object"
        ? (attempt.answers as Record<string, unknown>)
        : {};
    const currentResults = Array.isArray(currentAnswers.results)
      ? [...(currentAnswers.results as Record<string, unknown>[])]
      : [];

    if (currentResults[result.questionIndex]) {
      currentResults[result.questionIndex] = {
        ...currentResults[result.questionIndex],
        score: result.score,
      };
    }

    return {
      ...attempt,
      score: result.overallScore,
      max_score: result.maxScore,
      answers: {
        ...currentAnswers,
        results: currentResults,
      },
    };
  });
}

function formatAttemptDuration(totalSeconds?: number | null) {
  if (!Number.isFinite(totalSeconds) || (totalSeconds ?? 0) <= 0) {
    return null;
  }

  const safeSeconds = Math.max(0, Math.round(totalSeconds ?? 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((value, index) =>
        index === 0 ? String(value) : String(value).padStart(2, "0"),
      )
      .join(":");
  }

  return [minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

const AttemptCard = React.memo(function AttemptCard({
  attempt,
  isTutor,
  userId,
  isExpanded,
  onToggleExpand,
  onTranslationScoreSaved,
}: {
  attempt: HistoryAttempt;
  isTutor: boolean;
  userId?: string;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onTranslationScoreSaved: (
    attemptId: string,
    result: TranslationScoreSaveResult,
  ) => void;
}) {
  const quiz = attempt.quizzes;
  const student = attempt.profiles;
  const scored = attempt.score != null && attempt.max_score != null;
  const pct = scored
    ? Math.round((Number(attempt.score) / Number(attempt.max_score)) * 100)
    : null;
  const isOwnAttempt = userId && attempt.student_id === userId;
  const grammarTopicKey = getPrimaryGrammarTopic(quiz?.config);
  const grammarTopic = grammarTopicKey
    ? getGrammarTopicDisplayName(quiz?.config, grammarTopicKey)
    : null;
  const loggedDuration = formatAttemptDuration(attempt.time_spent_seconds);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {isTutor && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                <User className="h-3.5 w-3.5" />
                <span className="max-w-[140px] truncate">
                  {isOwnAttempt
                    ? "You"
                    : student?.full_name || student?.email || "Unknown"}
                </span>
              </div>
            )}
            <CardTitle className="text-base truncate">
              {quiz?.title ?? "Quiz"}
            </CardTitle>
          </div>
          <div className="flex min-w-0 flex-wrap items-start gap-2 sm:justify-end">
            {quiz && (
              <Badge variant="outline">
                {ACTIVITY_LABELS[quiz.type ?? ""] || quiz.type}
              </Badge>
            )}
            {quiz?.type === "translation" && grammarTopic && (
              <Badge
                variant="outline"
                className="h-auto max-w-full justify-start whitespace-normal break-words border-amber-300 bg-amber-50 px-3 py-1 text-left leading-tight text-amber-900"
              >
                {grammarTopic}
              </Badge>
            )}
            {quiz?.cefr_level && (
              <Badge variant="secondary">{quiz.cefr_level}</Badge>
            )}
            {pct !== null && (
              <Badge
                variant={
                  pct >= 80
                    ? "default"
                    : pct >= 50
                      ? "secondary"
                      : "destructive"
                }
              >
                {pct}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {formatAppDateTime(attempt.completed_at)}
            {scored && (
              <span className="ml-2">
                Score: {Number(attempt.score)} / {Number(attempt.max_score)}
              </span>
            )}
            {loggedDuration && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                Time: {loggedDuration}
              </span>
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="self-start sm:self-auto"
            onClick={() => onToggleExpand(attempt.id)}
          >
            {isExpanded ? (
              <>
                Hide Details
                <ChevronUp className="ml-1 h-4 w-4" />
              </>
            ) : (
              <>
                Show Details
                <ChevronDown className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-4 border-t pt-4">
            <AttemptDetail
              attempt={attempt as Record<string, unknown>}
              canEditTranslationScores={isTutor && quiz?.type === "translation"}
              onTranslationScoreSaved={(result) =>
                onTranslationScoreSaved(attempt.id, result)
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export function HistoryClient({
  role,
  initialAttempts,
  initialHasMore,
  students,
  userId,
  initialStudentFilter,
}: HistoryClientProps) {
  const isTutor = role === "tutor" || role === "superadmin";
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<HistoryAttempt[]>(initialAttempts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [initialLoading, setInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStudent, setFilterStudent] = useState<string>(
    initialStudentFilter ?? "all",
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const initialFilterEffectRef = useRef(true);
  const initialLoadingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const activeStudentFilter = isTutor ? filterStudent : "all";
  const hasActiveFilters =
    filterType !== "all" || activeStudentFilter !== "all";
  const queryKey = `${filterType}:${activeStudentFilter}`;
  const latestQueryKeyRef = useRef(queryKey);
  const quizTypes = Object.keys(ACTIVITY_LABELS);

  latestQueryKeyRef.current = queryKey;

  const fetchAttemptsPage = useCallback(
    async (offset: number) => {
      const searchParams = new URLSearchParams({
        limit: String(HISTORY_PAGE_SIZE),
        offset: String(offset),
      });

      if (filterType !== "all") {
        searchParams.set("type", filterType);
      }

      if (activeStudentFilter !== "all") {
        searchParams.set("student", activeStudentFilter);
      }

      const response = await fetch(
        `/api/quiz-attempts?${searchParams.toString()}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as
        | HistoryResponse
        | HistoryErrorResponse;

      if (!response.ok) {
        const errorMessage = "error" in payload ? payload.error : undefined;

        throw new Error(errorMessage || "Failed to load history");
      }

      return payload as HistoryResponse;
    },
    [activeStudentFilter, filterType],
  );

  const reloadAttempts = useCallback(async () => {
    if (initialLoadingRef.current) {
      return;
    }

    const requestQueryKey = queryKey;

    initialLoadingRef.current = true;
    setInitialLoading(true);
    setLoadError(null);
    setExpandedId(null);
    setHasMore(false);

    try {
      const nextPage = await fetchAttemptsPage(0);

      if (latestQueryKeyRef.current !== requestQueryKey) {
        return;
      }

      startTransition(() => {
        setAttempts(nextPage.attempts);
        setHasMore(nextPage.hasMore);
      });
    } catch (error) {
      if (latestQueryKeyRef.current !== requestQueryKey) {
        return;
      }

      setAttempts([]);
      setLoadError(
        error instanceof Error ? error.message : "Failed to load history",
      );
    } finally {
      if (latestQueryKeyRef.current === requestQueryKey) {
        initialLoadingRef.current = false;
        setInitialLoading(false);
      }
    }
  }, [fetchAttemptsPage, queryKey]);

  const loadMoreAttempts = useCallback(async () => {
    if (!hasMore || initialLoadingRef.current || loadingMoreRef.current) {
      return;
    }

    const requestQueryKey = queryKey;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const nextPage = await fetchAttemptsPage(attempts.length);

      if (latestQueryKeyRef.current !== requestQueryKey) {
        return;
      }

      startTransition(() => {
        setAttempts((currentAttempts) =>
          mergeAttempts(currentAttempts, nextPage.attempts),
        );
        setHasMore(nextPage.hasMore);
      });
    } catch (error) {
      if (latestQueryKeyRef.current !== requestQueryKey) {
        return;
      }

      setLoadError(
        error instanceof Error ? error.message : "Failed to load more attempts",
      );
    } finally {
      if (latestQueryKeyRef.current === requestQueryKey) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [attempts.length, fetchAttemptsPage, hasMore, queryKey]);

  useEffect(() => {
    if (initialFilterEffectRef.current) {
      initialFilterEffectRef.current = false;
      return;
    }

    void reloadAttempts();
  }, [activeStudentFilter, filterType, reloadAttempts]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreAttempts();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMoreAttempts]);

  const handleToggleExpand = React.useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleTranslationScoreSaved = useCallback(
    (attemptId: string, result: TranslationScoreSaveResult) => {
      setAttempts((currentAttempts) =>
        updateAttemptTranslationScore(currentAttempts, attemptId, result),
      );
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isTutor ? "Activity History" : "My History"}
        </h1>
        <p className="text-muted-foreground">
          {isTutor
            ? "View your own and your students' quiz attempts."
            : "View all your past quiz attempts and results."}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Quiz type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {quizTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {ACTIVITY_LABELS[type] || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isTutor && students.length > 0 && (
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Student" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {userId && <SelectItem value={userId}>My Attempts</SelectItem>}
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name || s.email || "Unknown"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <span className="text-sm text-muted-foreground">
          Loaded {attempts.length} attempt{attempts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {initialLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history...
          </CardContent>
        </Card>
      ) : attempts.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <History className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">
              {loadError
                ? "Couldn't load history"
                : hasActiveFilters
                  ? "No matching attempts"
                  : "No attempts yet"}
            </CardTitle>
            <CardDescription>
              {loadError
                ? "The history request failed. Try again to reload the list."
                : hasActiveFilters
                  ? "Try a different filter to load more matching attempts."
                  : isTutor
                    ? "Your students' quiz attempts will appear here once they complete activities."
                    : "Complete quizzes to see your history here."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt) => (
            <AttemptCard
              key={attempt.id}
              attempt={attempt}
              isTutor={isTutor}
              userId={userId}
              isExpanded={expandedId === attempt.id}
              onToggleExpand={handleToggleExpand}
              onTranslationScoreSaved={handleTranslationScoreSaved}
            />
          ))}

          <div ref={sentinelRef} className="h-1" aria-hidden />

          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading more attempts...
            </div>
          )}

          {loadError && (
            <div className="flex items-center justify-center gap-3 py-4 text-sm text-destructive">
              <span>{loadError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (attempts.length === 0) {
                    void reloadAttempts();
                    return;
                  }

                  void loadMoreAttempts();
                }}
              >
                Retry
              </Button>
            </div>
          )}

          {!hasMore && !isLoadingMore && !loadError && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              You&apos;ve reached the end of the history list.
            </p>
          )}
        </div>
      )}

      {!initialLoading && attempts.length === 0 && loadError && (
        <div className="flex items-center justify-center gap-3 text-sm text-destructive">
          <span>{loadError}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void reloadAttempts()}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
