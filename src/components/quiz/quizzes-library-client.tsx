"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QuizCard, type QuizListItem } from "@/components/quiz/quiz-card";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { ACTIVITY_LABELS, REVIEW_ACTIVITY_TITLE_PREFIX } from "@/lib/constants";
import {
  getGrammarTopicDisplayName,
  getPrimaryGrammarTopic,
} from "@/lib/utils";

const PAGE_SIZE = 12;
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const QUIZ_TYPES = [
  "gap_fill",
  "translation",
  "mcq",
  "flashcards",
  "text_translation",
  "discussion",
] as const;

type SourceFilter = "all" | "custom" | "reviews";

interface QuizzesLibraryClientProps {
  quizzes: QuizListItem[];
}

export function QuizzesLibraryClient({ quizzes }: QuizzesLibraryClientProps) {
  const { messages } = useAppI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCefr, setSelectedCefr] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: quizzes.length };
    for (const q of quizzes) {
      counts[q.type] = (counts[q.type] ?? 0) + 1;
    }
    return counts;
  }, [quizzes]);

  const filteredQuizzes = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return quizzes.filter((quiz) => {
      if (selectedType !== "all" && quiz.type !== selectedType) {
        return false;
      }

      if (selectedCefr !== "all" && quiz.cefr_level !== selectedCefr) {
        return false;
      }

      const isReview = quiz.title
        .toLowerCase()
        .startsWith(REVIEW_ACTIVITY_TITLE_PREFIX.toLowerCase());
      if (sourceFilter === "custom" && isReview) {
        return false;
      }
      if (sourceFilter === "reviews" && !isReview) {
        return false;
      }

      if (normalizedSearch) {
        const titleMatches = quiz.title
          .toLowerCase()
          .includes(normalizedSearch);
        const grammarTopicKey = getPrimaryGrammarTopic(quiz.config);
        const grammarTopic = grammarTopicKey
          ? getGrammarTopicDisplayName(quiz.config, grammarTopicKey)
          : "";
        const grammarMatches = grammarTopic
          .toLowerCase()
          .includes(normalizedSearch);

        const terms = Array.isArray(quiz.vocabulary_terms)
          ? (quiz.vocabulary_terms as { term?: string; definition?: string }[])
          : [];
        const termMatches = terms.some(
          (item) =>
            item?.term?.toLowerCase().includes(normalizedSearch) ||
            item?.definition?.toLowerCase().includes(normalizedSearch),
        );

        if (!titleMatches && !grammarMatches && !termMatches) {
          return false;
        }
      }

      return true;
    });
  }, [quizzes, searchQuery, selectedType, selectedCefr, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQuizzes = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredQuizzes.slice(start, start + PAGE_SIZE);
  }, [filteredQuizzes, safePage]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedType !== "all" ||
    selectedCefr !== "all" ||
    sourceFilter !== "all";

  function resetFilters() {
    setSearchQuery("");
    setSelectedType("all");
    setSelectedCefr("all");
    setSourceFilter("all");
    setCurrentPage(1);
  }

  function getTypeLabel(type: string) {
    return (
      messages.quizzes.typeLabels[
        type as keyof typeof messages.quizzes.typeLabels
      ] ||
      ACTIVITY_LABELS[type] ||
      type
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter & Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={messages.quizzes.filters.searchPlaceholder}
                className="pl-9 pr-9"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Source Filter + CEFR Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
                {(
                  [
                    ["all", messages.quizzes.filters.sourceAll],
                    ["custom", messages.quizzes.filters.sourceCustom],
                    ["reviews", messages.quizzes.filters.sourceReviews],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSourceFilter(key);
                      setCurrentPage(1);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      sourceFilter === key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="inline-flex flex-wrap rounded-lg border bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCefr("all");
                    setCurrentPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedCefr === "all"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {messages.quizzes.filters.allLevels}
                </button>
                {CEFR_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setSelectedCefr(level);
                      setCurrentPage(1);
                    }}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      selectedCefr === level
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Type Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={selectedType === "all" ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => {
                  setSelectedType("all");
                  setCurrentPage(1);
                }}
              >
                {messages.quizzes.filters.allTypes} ({typeCounts.all ?? 0})
              </Button>
              {QUIZ_TYPES.map((type) => {
                const count = typeCounts[type] ?? 0;
                if (count === 0 && selectedType !== type) {
                  return null;
                }
                return (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={selectedType === type ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => {
                      setSelectedType(type);
                      setCurrentPage(1);
                    }}
                  >
                    {getTypeLabel(type)} ({count})
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                {messages.quizzes.filters.showingCount(
                  filteredQuizzes.length,
                  quizzes.length,
                )}
              </span>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="font-medium text-primary hover:underline"
                >
                  {messages.quizzes.filters.clearFilters}
                </button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiz Grid */}
      {filteredQuizzes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-base font-medium">
              {messages.quizzes.filters.noMatchingQuizzesTitle}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {messages.quizzes.filters.noMatchingQuizzesDescription}
            </p>
            {hasActiveFilters ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={resetFilters}
              >
                {messages.quizzes.filters.clearFilters}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedQuizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {messages.pagination.page} {safePage} {messages.pagination.of}{" "}
                {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {messages.pagination.previous}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  {messages.pagination.next}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
