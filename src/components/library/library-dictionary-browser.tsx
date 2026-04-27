"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { formatAppDate } from "@/lib/dates";
import {
  formatPassiveVocabularyPartOfSpeech,
  getPassiveVocabularyUkrainianTranslation,
  type PassiveVocabularyLibraryAttributes,
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";
import type { PassiveVocabularyLibraryAdminItem } from "@/lib/mastery/passive-vocabulary-library";
import {
  approvePassiveVocabularyLibrarySuggestion,
  rejectPassiveVocabularyLibrarySuggestion,
} from "@/app/(platform)/library/actions";
import { EditPassiveLibraryDialog } from "@/components/mastery/edit-passive-library-dialog";
import { SuggestPassiveLibraryChangeDialog } from "@/components/library/suggest-passive-library-change-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CEFRLevel } from "@/types/quiz";

const PAGE_SIZE = 20;
const CEFR_FILTER_VALUES: Array<"all" | "unknown" | CEFRLevel> = [
  "all",
  "unknown",
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
];

export interface LibraryDictionaryPendingSuggestion {
  id: string;
  library_item_id: string;
  proposed_canonical_term: string;
  proposed_cefr_level: PassiveVocabularyLibraryCefrLevel | null;
  proposed_part_of_speech: PassiveVocabularyPartOfSpeech | null;
  proposed_attributes: PassiveVocabularyLibraryAttributes;
  suggestion_note: string | null;
  created_at: string;
}

export interface LibraryDictionarySuggestionReviewItem {
  id: string;
  library_item_id: string;
  proposed_canonical_term: string;
  proposed_cefr_level: PassiveVocabularyLibraryCefrLevel | null;
  proposed_part_of_speech: PassiveVocabularyPartOfSpeech | null;
  proposed_attributes: PassiveVocabularyLibraryAttributes;
  suggestion_note: string | null;
  created_at: string;
  submitter_name: string;
  submitter_email: string | null;
  current_term: string;
  current_item_type: "word" | "phrase";
  current_cefr_level: PassiveVocabularyLibraryCefrLevel | null;
  current_part_of_speech: PassiveVocabularyPartOfSpeech | null;
  current_attributes: PassiveVocabularyLibraryAttributes;
}

interface PassiveLibraryResponse {
  items: PassiveVocabularyLibraryAdminItem[];
  hasMore: boolean;
}

interface LibraryDictionaryBrowserProps {
  role: "tutor" | "superadmin";
  initialItems: PassiveVocabularyLibraryAdminItem[];
  initialHasMore: boolean;
  pendingSuggestions?: LibraryDictionarySuggestionReviewItem[];
  myPendingSuggestions?: LibraryDictionaryPendingSuggestion[];
}

function mergeLibraryItems(
  currentItems: PassiveVocabularyLibraryAdminItem[],
  nextItems: PassiveVocabularyLibraryAdminItem[],
) {
  const itemById = new Map<string, PassiveVocabularyLibraryAdminItem>();

  for (const item of currentItems) {
    itemById.set(item.id, item);
  }

  for (const item of nextItems) {
    itemById.set(item.id, item);
  }

  return Array.from(itemById.values()).sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  );
}

export function LibraryDictionaryBrowser({
  role,
  initialItems,
  initialHasMore,
  pendingSuggestions = [],
  myPendingSuggestions = [],
}: LibraryDictionaryBrowserProps) {
  const router = useRouter();
  const { messages } = useAppI18n();
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cefrFilter, setCefrFilter] = useState<"all" | "unknown" | CEFRLevel>(
    "all",
  );
  const [initialLoading, setInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryingItemId, setRetryingItemId] = useState<string | null>(null);
  const [isBulkRetrying, setIsBulkRetrying] = useState(false);
  const [bulkRetryProgress, setBulkRetryProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [reviewingSuggestionId, setReviewingSuggestionId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const initialFilterEffectRef = useRef(true);
  const initialLoadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const queryKey = `${searchQuery}:${cefrFilter}`;
  const latestQueryKeyRef = useRef(queryKey);

  latestQueryKeyRef.current = queryKey;

  const pendingSuggestionByItemId = useMemo(
    () =>
      new Map(
        myPendingSuggestions.map((suggestion) => [
          suggestion.library_item_id,
          suggestion,
        ]),
      ),
    [myPendingSuggestions],
  );
  const cefrFilterOptions = useMemo(
    () =>
      CEFR_FILTER_VALUES.map((value) => ({
        value,
        label:
          value === "all"
            ? messages.library.dictionary.allFilter
            : value === "unknown"
              ? messages.library.dictionary.unknownValue
              : value,
      })),
    [messages.library.dictionary.allFilter, messages.library.dictionary.unknownValue],
  );

  const fetchLibraryPage = useCallback(
    async (offset: number) => {
      const searchParams = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });

      if (searchQuery) {
        searchParams.set("q", searchQuery);
      }

      if (cefrFilter !== "all") {
        searchParams.set("cefr", cefrFilter);
      }

      const response = await fetch(
        `/api/mastery/passive-library?${searchParams.toString()}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as
        | PassiveLibraryResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : messages.library.dictionary.requestFailed,
        );
      }

      return payload as PassiveLibraryResponse;
    },
    [cefrFilter, messages.library.dictionary.requestFailed, searchQuery],
  );

  const reloadItems = useCallback(async () => {
    if (initialLoadingRef.current) {
      return;
    }

    const requestQueryKey = queryKey;

    initialLoadingRef.current = true;
    setInitialLoading(true);
    setLoadError(null);
    setHasMore(false);

    try {
      const nextPage = await fetchLibraryPage(0);

      if (latestQueryKeyRef.current !== requestQueryKey) {
        return;
      }

      startTransition(() => {
        setItems(nextPage.items);
        setHasMore(nextPage.hasMore);
      });
    } catch (error) {
      if (latestQueryKeyRef.current !== requestQueryKey) {
        return;
      }

      setItems([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : messages.library.dictionary.requestFailed,
      );
    } finally {
      if (latestQueryKeyRef.current === requestQueryKey) {
        initialLoadingRef.current = false;
        setInitialLoading(false);
      }
    }
  }, [fetchLibraryPage, messages.library.dictionary.requestFailed, queryKey]);

  const loadMoreItems = useCallback(async () => {
    if (!hasMore || initialLoadingRef.current || loadingMoreRef.current) {
      return;
    }

    const requestQueryKey = queryKey;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const nextPage = await fetchLibraryPage(items.length);

      if (latestQueryKeyRef.current !== requestQueryKey) {
        return;
      }

      startTransition(() => {
        setItems((currentItems) => mergeLibraryItems(currentItems, nextPage.items));
        setHasMore(nextPage.hasMore);
      });
    } catch (error) {
      if (latestQueryKeyRef.current !== requestQueryKey) {
        return;
      }

      setLoadError(
        error instanceof Error
          ? error.message
          : messages.library.dictionary.requestFailed,
      );
    } finally {
      if (latestQueryKeyRef.current === requestQueryKey) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [fetchLibraryPage, hasMore, items.length, messages.library.dictionary.requestFailed, queryKey]);

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const nextQuery = searchInput.trim();

      if (nextQuery === searchQuery) {
        void reloadItems();
        return;
      }

      setSearchQuery(nextQuery);
    },
    [reloadItems, searchInput, searchQuery],
  );

  useEffect(() => {
    if (initialFilterEffectRef.current) {
      initialFilterEffectRef.current = false;
      return;
    }

    void reloadItems();
  }, [cefrFilter, reloadItems, searchQuery]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreItems();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMoreItems]);

  const reEnrichItem = useCallback(
    async (item: PassiveVocabularyLibraryAdminItem) => {
      const response = await fetch(
        `/api/mastery/passive-library/${item.id}/re-enrich`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            mergedSourceItemId?: string | null;
            item?: PassiveVocabularyLibraryAdminItem;
          }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error || messages.library.dictionary.reEnrichFailed,
        );
      }

      return {
        mergedSourceItemId: payload?.mergedSourceItemId ?? null,
        item: payload?.item ?? item,
      };
    },
    [messages.library.dictionary.reEnrichFailed],
  );

  const handleRetry = useCallback(
    async (item: PassiveVocabularyLibraryAdminItem) => {
      setRetryingItemId(item.id);

      try {
        const payload = await reEnrichItem(item);

        toast.success(
          payload.mergedSourceItemId
            ? messages.library.dictionary.reEnrichedMerged(item.canonical_term)
            : messages.library.dictionary.reEnrichedSuccess(
                payload.item?.canonical_term ?? item.canonical_term,
              ),
        );
        await reloadItems();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : messages.library.dictionary.reEnrichFailed,
        );
      } finally {
        setRetryingItemId(null);
      }
    },
    [messages.library.dictionary, reEnrichItem, reloadItems],
  );

  const loadedNeedsReviewItems = items.filter(
    (item) => item.item_type === "word" && item.enrichment_status !== "completed",
  );

  const handleBulkRetry = useCallback(async () => {
    if (loadedNeedsReviewItems.length === 0) {
      return;
    }

    setIsBulkRetrying(true);
    setBulkRetryProgress({ completed: 0, total: loadedNeedsReviewItems.length });

    let successCount = 0;
    let failureCount = 0;

    try {
      for (let index = 0; index < loadedNeedsReviewItems.length; index += 1) {
        try {
          await reEnrichItem(loadedNeedsReviewItems[index]);
          successCount += 1;
        } catch {
          failureCount += 1;
        }

        setBulkRetryProgress({
          completed: index + 1,
          total: loadedNeedsReviewItems.length,
        });
      }

      if (failureCount === 0) {
        toast.success(messages.library.dictionary.bulkRetrySuccess(successCount));
      } else if (successCount > 0) {
        toast.success(
          messages.library.dictionary.bulkRetryPartial(successCount, failureCount),
        );
      } else {
        toast.error(messages.library.dictionary.bulkRetryFailed);
      }

      await reloadItems();
    } finally {
      setIsBulkRetrying(false);
      setBulkRetryProgress(null);
    }
  }, [loadedNeedsReviewItems, messages.library.dictionary, reEnrichItem, reloadItems]);

  const handleApproveSuggestion = useCallback(
    async (suggestion: LibraryDictionarySuggestionReviewItem) => {
      setReviewingSuggestionId(suggestion.id);

      try {
        await approvePassiveVocabularyLibrarySuggestion(suggestion.id);
        toast.success(
          messages.library.dictionary.approvedSuggestion(suggestion.current_term),
        );
        await reloadItems();
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : messages.library.dictionary.approveSuggestionFailed,
        );
      } finally {
        setReviewingSuggestionId(null);
      }
    },
    [messages.library.dictionary, reloadItems, router],
  );

  const handleRejectSuggestion = useCallback(
    async (suggestion: LibraryDictionarySuggestionReviewItem) => {
      setReviewingSuggestionId(suggestion.id);

      try {
        await rejectPassiveVocabularyLibrarySuggestion(suggestion.id);
        toast.success(
          messages.library.dictionary.rejectedSuggestion(suggestion.current_term),
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : messages.library.dictionary.rejectSuggestionFailed,
        );
      } finally {
        setReviewingSuggestionId(null);
      }
    },
    [messages.library.dictionary, router],
  );

  const hasActiveFilters = searchQuery.length > 0 || cefrFilter !== "all";

  return (
    <div className="space-y-6">
      {role === "superadmin" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              {messages.library.dictionary.pendingTutorSuggestionsTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {messages.library.dictionary.pendingTutorSuggestionsDescription}
            </p>
          </div>

          {pendingSuggestions.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                {messages.library.dictionary.noPendingTutorSuggestions}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {pendingSuggestions.map((suggestion) => {
                const currentTranslation = getPassiveVocabularyUkrainianTranslation(
                  suggestion.current_attributes,
                );
                const proposedTranslation = getPassiveVocabularyUkrainianTranslation(
                  suggestion.proposed_attributes,
                );
                const isReviewing = reviewingSuggestionId === suggestion.id;

                return (
                  <Card key={suggestion.id}>
                    <CardHeader>
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {messages.library.dictionary.suggestionCardTitle(
                              suggestion.current_term,
                              suggestion.proposed_canonical_term,
                            )}
                          </CardTitle>
                          <CardDescription>
                            {messages.library.dictionary.suggestedBy(
                              suggestion.submitter_name,
                            )}
                            {suggestion.submitter_email
                              ? ` (${suggestion.submitter_email})`
                              : ""}{" "}
                            {formatAppDate(suggestion.created_at)}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">
                          {messages.library.dictionary.pendingStatus}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border px-3 py-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {messages.library.dictionary.currentLabel}
                          </p>
                          <p className="mt-2 font-medium">{suggestion.current_term}</p>
                          <p className="text-sm text-muted-foreground">
                            {currentTranslation ?? messages.library.dictionary.noUkrainianTranslation}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {messages.library.dictionary.cefrLabel}: {suggestion.current_cefr_level ?? messages.library.dictionary.unknownValue}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {messages.library.dictionary.partOfSpeechLabel}: {formatPassiveVocabularyPartOfSpeech(suggestion.current_part_of_speech)}
                          </p>
                        </div>

                        <div className="rounded-lg border bg-muted/20 px-3 py-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {messages.library.dictionary.proposedLabel}
                          </p>
                          <p className="mt-2 font-medium">{suggestion.proposed_canonical_term}</p>
                          <p className="text-sm text-muted-foreground">
                            {proposedTranslation ?? messages.library.dictionary.noUkrainianTranslation}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {messages.library.dictionary.cefrLabel}: {suggestion.proposed_cefr_level ?? messages.library.dictionary.unknownValue}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {messages.library.dictionary.partOfSpeechLabel}: {formatPassiveVocabularyPartOfSpeech(suggestion.proposed_part_of_speech)}
                          </p>
                        </div>
                      </div>

                      {suggestion.suggestion_note ? (
                        <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                          {suggestion.suggestion_note}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isReviewing}
                          onClick={() => void handleApproveSuggestion(suggestion)}
                        >
                          {isReviewing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          {messages.library.dictionary.approveAction}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isReviewing}
                          onClick={() => void handleRejectSuggestion(suggestion)}
                        >
                          <X className="mr-2 h-4 w-4" />
                          {messages.library.dictionary.rejectAction}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <div className="space-y-4">
        <form
          className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
          onSubmit={handleSearchSubmit}
        >
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-2xl">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={messages.library.dictionary.searchPlaceholder}
              aria-label={messages.library.dictionary.searchAriaLabel}
            />
            <Button type="submit" className="sm:w-auto" disabled={isBulkRetrying}>
              <Search className="mr-2 h-4 w-4" />
              {messages.library.dictionary.searchAction}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {messages.library.dictionary.loadedItems(items.length, searchQuery || undefined)}
            </span>

            {role === "superadmin" && loadedNeedsReviewItems.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBulkRetrying}
                onClick={() => void handleBulkRetry()}
              >
                {isBulkRetrying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                {messages.library.dictionary.retryLoadedNeedsReview}
              </Button>
            )}

            {bulkRetryProgress && (
              <span>
                {messages.library.dictionary.repairingProgress(
                  bulkRetryProgress.completed,
                  bulkRetryProgress.total,
                )}
              </span>
            )}
          </div>
        </form>

        <div className="flex flex-wrap gap-2">
          {cefrFilterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={cefrFilter === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setCefrFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {initialLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {messages.library.dictionary.loadingItems}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {loadError
              ? messages.library.dictionary.requestFailed
              : hasActiveFilters
                ? messages.library.dictionary.noFilteredItems
                : messages.library.dictionary.noItems}
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{messages.library.dictionary.termColumn}</TableHead>
                  <TableHead>{messages.library.dictionary.typeColumn}</TableHead>
                  <TableHead>{messages.library.dictionary.cefrColumn}</TableHead>
                  <TableHead>{messages.library.dictionary.partOfSpeechLabel}</TableHead>
                  <TableHead>{messages.library.dictionary.statusColumn}</TableHead>
                  <TableHead>{messages.library.dictionary.updatedColumn}</TableHead>
                  <TableHead className="w-[220px] text-right">
                    {messages.library.dictionary.actionsColumn}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isRetrying = retryingItemId === item.id;
                  const ukrainianTranslation = getPassiveVocabularyUkrainianTranslation(
                    item.attributes,
                  );
                  const pendingSuggestion = pendingSuggestionByItemId.get(item.id);

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.canonical_term}</p>
                            {role === "tutor" && pendingSuggestion ? (
                              <Badge variant="outline">
                                {messages.library.dictionary.pendingSuggestionBadge}
                              </Badge>
                            ) : null}
                          </div>
                          {ukrainianTranslation && (
                            <p className="text-xs text-muted-foreground">
                              {ukrainianTranslation}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.item_type}</TableCell>
                      <TableCell>{item.cefr_level ?? "—"}</TableCell>
                      <TableCell>
                        {formatPassiveVocabularyPartOfSpeech(item.part_of_speech)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.enrichment_status === "completed"
                              ? "secondary"
                              : item.enrichment_status === "failed"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {item.enrichment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatAppDate(item.updated_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          {role === "superadmin" ? (
                            <>
                              {item.item_type === "word" && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isRetrying || isBulkRetrying}
                                  onClick={() => void handleRetry(item)}
                                >
                                  {isRetrying ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                  )}
                                  {item.enrichment_status === "completed"
                                    ? messages.library.dictionary.reEnrichAction
                                    : messages.library.dictionary.retryAiAction}
                                </Button>
                              )}

                              <EditPassiveLibraryDialog
                                item={{
                                  id: item.id,
                                  canonical_term: item.canonical_term,
                                  item_type: item.item_type,
                                  cefr_level: item.cefr_level,
                                  part_of_speech: item.part_of_speech,
                                  attributes: item.attributes,
                                }}
                                onSaved={async () => {
                                  await reloadItems();
                                  router.refresh();
                                }}
                              />
                            </>
                          ) : (
                            <SuggestPassiveLibraryChangeDialog
                              item={{
                                id: item.id,
                                canonical_term: item.canonical_term,
                                item_type: item.item_type,
                                cefr_level: item.cefr_level,
                                part_of_speech: item.part_of_speech,
                                attributes: item.attributes,
                              }}
                              pendingSuggestion={pendingSuggestion ?? null}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div ref={sentinelRef} className="h-1" aria-hidden />

            {isLoadingMore && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {messages.library.dictionary.loadingMoreItems(PAGE_SIZE)}
              </div>
            )}

            {loadError && (
              <div className="flex items-center justify-center gap-3 py-4 text-sm text-destructive">
                <span>{loadError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (items.length === 0) {
                      void reloadItems();
                      return;
                    }

                    void loadMoreItems();
                  }}
                >
                  {messages.library.dictionary.retryAction}
                </Button>
              </div>
            )}

            {!hasMore && !isLoadingMore && !loadError && (
              <p className="py-2 text-center text-sm text-muted-foreground">
                {messages.library.dictionary.endOfList}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}