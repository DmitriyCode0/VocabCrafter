"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Loader2, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { formatAppDate } from "@/lib/dates";
import {
  formatPassiveVocabularyPartOfSpeech,
  getPassiveVocabularyUkrainianTranslation,
} from "@/lib/mastery/passive-vocabulary";
import type { CEFRLevel } from "@/types/quiz";
import type { PassiveVocabularyLibraryAdminItem } from "@/lib/mastery/passive-vocabulary-library";
import { EditPassiveLibraryDialog } from "@/components/mastery/edit-passive-library-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 20;
const CEFR_FILTER_OPTIONS: Array<{ value: "all" | "unknown" | CEFRLevel; label: string }> = [
  { value: "all", label: "All" },
  { value: "unknown", label: "Unknown" },
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "C1", label: "C1" },
  { value: "C2", label: "C2" },
];

interface PassiveLibraryAdminPanelProps {
  initialItems: PassiveVocabularyLibraryAdminItem[];
  initialHasMore: boolean;
}

interface PassiveLibraryResponse {
  items: PassiveVocabularyLibraryAdminItem[];
  hasMore: boolean;
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

export function PassiveLibraryAdminPanel({
  initialItems,
  initialHasMore,
}: PassiveLibraryAdminPanelProps) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cefrFilter, setCefrFilter] = useState<"all" | "unknown" | CEFRLevel>("all");
  const [initialLoading, setInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryingItemId, setRetryingItemId] = useState<string | null>(null);
  const [isBulkRetrying, setIsBulkRetrying] = useState(false);
  const [bulkRetryProgress, setBulkRetryProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const initialFilterEffectRef = useRef(true);
  const initialLoadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const queryKey = `${searchQuery}:${cefrFilter}`;
  const latestQueryKeyRef = useRef(queryKey);

  latestQueryKeyRef.current = queryKey;

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
            : "Failed to load passive vocabulary library items",
        );
      }

      return payload as PassiveLibraryResponse;
    },
    [cefrFilter, searchQuery],
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
          : "Failed to load passive vocabulary library items",
      );
    } finally {
      if (latestQueryKeyRef.current === requestQueryKey) {
        initialLoadingRef.current = false;
        setInitialLoading(false);
      }
    }
  }, [fetchLibraryPage, queryKey]);

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
          : "Failed to load more passive vocabulary library items",
      );
    } finally {
      if (latestQueryKeyRef.current === requestQueryKey) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [fetchLibraryPage, hasMore, items.length, queryKey]);

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
        throw new Error(payload?.error || "Failed to re-enrich passive vocabulary item");
      }

      return {
        mergedSourceItemId: payload?.mergedSourceItemId ?? null,
        item: payload?.item ?? item,
      };
    },
    [],
  );

  const handleRetry = useCallback(
    async (item: PassiveVocabularyLibraryAdminItem) => {
      setRetryingItemId(item.id);

      try {
        const payload = await reEnrichItem(item);

        toast.success(
          payload.mergedSourceItemId
            ? `Re-enriched ${item.canonical_term} and merged it into the canonical lemma`
            : `Re-enriched ${payload.item?.canonical_term ?? item.canonical_term}`,
        );
        await reloadItems();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to re-enrich passive vocabulary item",
        );
      } finally {
        setRetryingItemId(null);
      }
    },
    [reEnrichItem, reloadItems],
  );

  const hasActiveFilters = searchQuery.length > 0 || cefrFilter !== "all";
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
        toast.success(`Retried ${successCount} loaded item${successCount !== 1 ? "s" : ""}`);
      } else if (successCount > 0) {
        toast.success(
          `Retried ${successCount} item${successCount !== 1 ? "s" : ""}; ${failureCount} still need review`,
        );
      } else {
        toast.error("None of the loaded items could be re-enriched");
      }

      await reloadItems();
    } finally {
      setIsBulkRetrying(false);
      setBulkRetryProgress(null);
    }
  }, [loadedNeedsReviewItems, reEnrichItem, reloadItems]);

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
        onSubmit={handleSearchSubmit}
      >
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-2xl">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search canonical terms"
            aria-label="Search passive vocabulary library"
          />
          <Button type="submit" className="sm:w-auto" disabled={isBulkRetrying}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            Loaded {items.length} item{items.length !== 1 ? "s" : ""}
            {searchQuery ? ` for \"${searchQuery}\"` : ""}
          </span>

          {loadedNeedsReviewItems.length > 0 && (
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
              Retry loaded needs review
            </Button>
          )}

          {bulkRetryProgress && (
            <span>
              Repairing {bulkRetryProgress.completed}/{bulkRetryProgress.total}
            </span>
          )}
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {CEFR_FILTER_OPTIONS.map((option) => (
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
          Loading library items...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {loadError
            ? "The library request failed. Try the search button again."
            : hasActiveFilters
              ? "No library items match the current search and CEFR filter."
              : "No library items yet."}
        </div>
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>CEFR</TableHead>
                <TableHead>Part of Speech</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[200px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isRetrying = retryingItemId === item.id;
                const ukrainianTranslation = getPassiveVocabularyUkrainianTranslation(
                  item.attributes,
                );

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{item.canonical_term}</p>
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
                              ? "Re-enrich"
                              : "Retry AI"}
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
                          onSaved={reloadItems}
                        />
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
              Loading 20 more library items...
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
                Retry
              </Button>
            </div>
          )}

          {!hasMore && !isLoadingMore && !loadError && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              You&apos;ve reached the end of the library list.
            </p>
          )}
        </div>
      )}
    </div>
  );
}