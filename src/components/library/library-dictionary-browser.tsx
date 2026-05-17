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
import { Check, Loader2, Search, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { formatAppDate } from "@/lib/dates";
import {
  formatPassiveVocabularyPartOfSpeech,
  getPassiveVocabularyForms,
  getPassiveVocabularyUkrainianTranslation,
  PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
  type PassiveVocabularyLibraryAttributes,
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";
import type { PassiveVocabularyLibraryAdminItem } from "@/lib/mastery/passive-vocabulary-library";
import {
  approvePassiveVocabularyLibrarySuggestion,
  rejectPassiveVocabularyLibrarySuggestion,
  confirmPassiveVocabularyLibraryItem,
  rejectPassiveVocabularyLibraryItem,
  deletePassiveVocabularyLibraryItem,
  deletePassiveVocabularyLibraryItems,
} from "@/app/(platform)/library/actions";
import { EditPassiveLibraryDialog } from "@/components/mastery/edit-passive-library-dialog";
import { SuggestPassiveLibraryChangeDialog } from "@/components/library/suggest-passive-library-change-dialog";
import { AddDictionaryItemDialog } from "@/components/library/add-dictionary-item-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
const APPROVAL_FILTER_VALUES = [
  "all",
  "unconfirmed",
  "confirmed",
  "rejected",
] as const;

type DictionaryApprovalFilter = (typeof APPROVAL_FILTER_VALUES)[number];

const LIBRARY_TERM_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

export interface LibraryDictionaryFacetCounts {
  cefr: Record<"all" | "unknown" | CEFRLevel, number>;
  approval: Record<DictionaryApprovalFilter, number>;
  partOfSpeech: Record<PassiveVocabularyPartOfSpeech, number>;
}

function getApprovalStatusLabel(status: PassiveVocabularyLibraryAdminItem["approval_status"]) {
  if (status === "confirmed") {
    return "Confirmed";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Unconfirmed";
}

function getApprovalStatusBadgeClassName(
  status: PassiveVocabularyLibraryAdminItem["approval_status"],
) {
  if (status === "confirmed") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }

  return "border-slate-300 bg-slate-50 text-slate-700";
}

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
  facetCounts: LibraryDictionaryFacetCounts;
}

interface LibraryDictionaryBrowserProps {
  role: "tutor" | "superadmin";
  initialItems: PassiveVocabularyLibraryAdminItem[];
  initialHasMore: boolean;
  initialFacetCounts: LibraryDictionaryFacetCounts;
  totalItems: number;
  canDirectlyAdd: boolean;
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

  return sortLibraryItemsAlphabetically(Array.from(itemById.values()));
}

function compareLibraryItemsAlphabetically(
  left: PassiveVocabularyLibraryAdminItem,
  right: PassiveVocabularyLibraryAdminItem,
) {
  const normalizedTermComparison = LIBRARY_TERM_COLLATOR.compare(
    left.normalized_term,
    right.normalized_term,
  );

  if (normalizedTermComparison !== 0) {
    return normalizedTermComparison;
  }

  const canonicalTermComparison = LIBRARY_TERM_COLLATOR.compare(
    left.canonical_term,
    right.canonical_term,
  );

  if (canonicalTermComparison !== 0) {
    return canonicalTermComparison;
  }

  const itemTypeComparison = LIBRARY_TERM_COLLATOR.compare(
    left.item_type,
    right.item_type,
  );

  if (itemTypeComparison !== 0) {
    return itemTypeComparison;
  }

  return left.id.localeCompare(right.id);
}

function sortLibraryItemsAlphabetically(
  items: PassiveVocabularyLibraryAdminItem[],
) {
  return [...items].sort(compareLibraryItemsAlphabetically);
}

function getItemCefrFacetValue(
  cefrLevel: PassiveVocabularyLibraryAdminItem["cefr_level"],
): "unknown" | CEFRLevel {
  return cefrLevel ?? "unknown";
}

function updateFacetCountsForItemRemoval(
  currentFacetCounts: LibraryDictionaryFacetCounts | null,
  item: PassiveVocabularyLibraryAdminItem,
) {
  if (!currentFacetCounts) {
    return currentFacetCounts;
  }

  const nextFacetCounts: LibraryDictionaryFacetCounts = {
    cefr: { ...currentFacetCounts.cefr },
    approval: { ...currentFacetCounts.approval },
    partOfSpeech: { ...currentFacetCounts.partOfSpeech },
  };
  const cefrFacetValue = getItemCefrFacetValue(item.cefr_level);

  nextFacetCounts.cefr.all = Math.max(0, nextFacetCounts.cefr.all - 1);
  nextFacetCounts.cefr[cefrFacetValue] = Math.max(
    0,
    nextFacetCounts.cefr[cefrFacetValue] - 1,
  );
  nextFacetCounts.approval.all = Math.max(
    0,
    nextFacetCounts.approval.all - 1,
  );
  nextFacetCounts.approval[item.approval_status] = Math.max(
    0,
    nextFacetCounts.approval[item.approval_status] - 1,
  );

  if (item.part_of_speech) {
    nextFacetCounts.partOfSpeech[item.part_of_speech] = Math.max(
      0,
      nextFacetCounts.partOfSpeech[item.part_of_speech] - 1,
    );
  }

  return nextFacetCounts;
}

function updateFacetCountsForApprovalChange(
  currentFacetCounts: LibraryDictionaryFacetCounts | null,
  item: PassiveVocabularyLibraryAdminItem,
  nextApprovalStatus: PassiveVocabularyLibraryAdminItem["approval_status"],
  approvalFilter: DictionaryApprovalFilter,
) {
  if (!currentFacetCounts || item.approval_status === nextApprovalStatus) {
    return currentFacetCounts;
  }

  const nextFacetCounts: LibraryDictionaryFacetCounts = {
    cefr: { ...currentFacetCounts.cefr },
    approval: { ...currentFacetCounts.approval },
    partOfSpeech: { ...currentFacetCounts.partOfSpeech },
  };

  nextFacetCounts.approval[item.approval_status] = Math.max(
    0,
    nextFacetCounts.approval[item.approval_status] - 1,
  );
  nextFacetCounts.approval[nextApprovalStatus] += 1;

  if (approvalFilter !== "all" && approvalFilter !== nextApprovalStatus) {
    const cefrFacetValue = getItemCefrFacetValue(item.cefr_level);

    nextFacetCounts.cefr.all = Math.max(0, nextFacetCounts.cefr.all - 1);
    nextFacetCounts.cefr[cefrFacetValue] = Math.max(
      0,
      nextFacetCounts.cefr[cefrFacetValue] - 1,
    );

    if (item.part_of_speech) {
      nextFacetCounts.partOfSpeech[item.part_of_speech] = Math.max(
        0,
        nextFacetCounts.partOfSpeech[item.part_of_speech] - 1,
      );
    }
  }

  return nextFacetCounts;
}

export function LibraryDictionaryBrowser({
  role,
  initialItems,
  initialHasMore,
  initialFacetCounts,
  totalItems,
  canDirectlyAdd,
  pendingSuggestions = [],
  myPendingSuggestions = [],
}: LibraryDictionaryBrowserProps) {
  const { messages } = useAppI18n();
  const [items, setItems] = useState(() =>
    sortLibraryItemsAlphabetically(initialItems),
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [totalItemCount, setTotalItemCount] = useState(totalItems);
  const [reviewItems, setReviewItems] = useState(pendingSuggestions);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cefrFilter, setCefrFilter] = useState<"all" | "unknown" | CEFRLevel>(
    "all",
  );
  const [approvalFilter, setApprovalFilter] =
    useState<DictionaryApprovalFilter>("all");
  const [posFilter, setPosFilter] = useState<PassiveVocabularyPartOfSpeech[]>([]);
  const [facetCounts, setFacetCounts] =
    useState<LibraryDictionaryFacetCounts | null>(initialFacetCounts);
  const [showFilterCounts, setShowFilterCounts] = useState(true);
  const [initialLoading, setInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewingSuggestionId, setReviewingSuggestionId] = useState<string | null>(null);
  const [updatingApprovalItemId, setUpdatingApprovalItemId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const initialFilterEffectRef = useRef(true);
  const initialLoadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const queryKey = `${searchQuery}:${cefrFilter}:${approvalFilter}:${[...posFilter].sort().join(",")}`;
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
  const approvalFilterOptions = useMemo(
    () =>
      APPROVAL_FILTER_VALUES.map((value) => ({
        value,
        label:
          value === "all"
            ? "All statuses"
            : value === "unconfirmed"
              ? "Unconfirmed"
              : value === "confirmed"
                ? "Confirmed"
                : "Rejected",
      })),
    [],
  );
  const selectedItemIdSet = useMemo(
    () => new Set(selectedItemIds),
    [selectedItemIds],
  );
  const selectedItems = useMemo(
    () => items.filter((item) => selectedItemIdSet.has(item.id)),
    [items, selectedItemIdSet],
  );
  const canBatchManage = role === "superadmin" || (role === "tutor" && canDirectlyAdd);
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedItemIdSet.has(item.id));
  const formatFilterLabel = useCallback(
    (label: string, count: number | undefined) => {
      if (!showFilterCounts || facetCounts === null || typeof count !== "number") {
        return label;
      }

      return `${label} (${count})`;
    },
    [facetCounts, showFilterCounts],
  );

  useEffect(() => {
    setSelectedItemIds((current) =>
      current.filter((id) => items.some((item) => item.id === id)),
    );
  }, [items]);

  useEffect(() => {
    setReviewItems(pendingSuggestions);
  }, [pendingSuggestions]);

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
        if (cefrFilter === "unknown") {
          searchParams.set("cefr", "unknown");
        } else {
          searchParams.set("cefr", cefrFilter);
        }
      }

      if (posFilter.length > 0) {
        searchParams.set("pos", posFilter.join(","));
      }

      if (role === "superadmin" && approvalFilter !== "all") {
        searchParams.set("status", approvalFilter);
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
    [approvalFilter, cefrFilter, messages.library.dictionary.requestFailed, posFilter, role, searchQuery],
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

      setFacetCounts(nextPage.facetCounts);
      startTransition(() => {
        setItems(nextPage.items);
        setHasMore(nextPage.hasMore);
      });
    } catch (error) {
      if (latestQueryKeyRef.current !== requestQueryKey) {
        return;
      }

      setFacetCounts(null);
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

  const removeItemsLocally = useCallback(
    (removedItems: PassiveVocabularyLibraryAdminItem[]) => {
      if (removedItems.length === 0) {
        return;
      }

      const removedItemIds = new Set(removedItems.map((item) => item.id));

      setFacetCounts((currentFacetCounts) =>
        removedItems.reduce(
          (nextFacetCounts, item) =>
            updateFacetCountsForItemRemoval(nextFacetCounts, item),
          currentFacetCounts,
        ),
      );
      setTotalItemCount((currentTotal) =>
        Math.max(0, currentTotal - removedItems.length),
      );
      startTransition(() => {
        setItems((currentItems) =>
          currentItems.filter((item) => !removedItemIds.has(item.id)),
        );
      });
    },
    [],
  );

  const applyLocalApprovalStatus = useCallback(
    (
      item: PassiveVocabularyLibraryAdminItem,
      nextApprovalStatus: PassiveVocabularyLibraryAdminItem["approval_status"],
    ) => {
      const nowIso = new Date().toISOString();
      const nextItem: PassiveVocabularyLibraryAdminItem = {
        ...item,
        approval_status: nextApprovalStatus,
        rejection_reason:
          nextApprovalStatus === "confirmed" ? null : item.rejection_reason,
        reviewed_at: nowIso,
        updated_at: nowIso,
      };
      const shouldKeepVisible =
        role !== "superadmin"
          ? nextItem.approval_status === "confirmed"
          : approvalFilter === "all" || approvalFilter === nextItem.approval_status;

      setFacetCounts((currentFacetCounts) =>
        updateFacetCountsForApprovalChange(
          currentFacetCounts,
          item,
          nextApprovalStatus,
          approvalFilter,
        ),
      );
      startTransition(() => {
        setItems((currentItems) => {
          if (!shouldKeepVisible) {
            return currentItems.filter((currentItem) => currentItem.id !== item.id);
          }

          return sortLibraryItemsAlphabetically(
            currentItems.map((currentItem) =>
              currentItem.id === item.id ? nextItem : currentItem,
            ),
          );
        });
      });
    },
    [approvalFilter, role],
  );

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

      setFacetCounts(nextPage.facetCounts);
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
  }, [approvalFilter, cefrFilter, posFilter, reloadItems, searchQuery]);

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

  const handleApproveSuggestion = useCallback(
    async (suggestion: LibraryDictionarySuggestionReviewItem) => {
      setReviewingSuggestionId(suggestion.id);

      try {
        await approvePassiveVocabularyLibrarySuggestion(suggestion.id);
        toast.success(
          messages.library.dictionary.approvedSuggestion(suggestion.current_term),
        );
        setReviewItems((current) =>
          current.filter((item) => item.id !== suggestion.id),
        );
        await reloadItems();
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
    [messages.library.dictionary, reloadItems],
  );

  const handleRejectSuggestion = useCallback(
    async (suggestion: LibraryDictionarySuggestionReviewItem) => {
      setReviewingSuggestionId(suggestion.id);

      try {
        await rejectPassiveVocabularyLibrarySuggestion(suggestion.id);
        toast.success(
          messages.library.dictionary.rejectedSuggestion(suggestion.current_term),
        );
        setReviewItems((current) =>
          current.filter((item) => item.id !== suggestion.id),
        );
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
    [messages.library.dictionary],
  );

  const handleDeleteItem = async (item: PassiveVocabularyLibraryAdminItem) => {
    if (!window.confirm(`Are you sure you want to delete "${item.canonical_term}"?`)) {
      return;
    }

    setUpdatingApprovalItemId(item.id);

    try {
      await deletePassiveVocabularyLibraryItem(item.id);
      toast.success(`Deleted "${item.canonical_term}"`);
      removeItemsLocally([item]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete item");
    } finally {
      setUpdatingApprovalItemId(null);
    }
  };

  const handleConfirmItem = useCallback(
    async (item: PassiveVocabularyLibraryAdminItem) => {
      setUpdatingApprovalItemId(item.id);

      try {
        await confirmPassiveVocabularyLibraryItem(item.id);
        toast.success(`Confirmed "${item.canonical_term}"`);
        applyLocalApprovalStatus(item, "confirmed");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to confirm dictionary item",
        );
      } finally {
        setUpdatingApprovalItemId(null);
      }
    },
    [applyLocalApprovalStatus],
  );

  const handleRejectItem = useCallback(
    async (item: PassiveVocabularyLibraryAdminItem) => {
      const confirmed = window.confirm(
        `Reject "${item.canonical_term}" globally? Rejected words stay out of vocabulary metrics and non-superadmin dictionary views.`,
      );

      if (!confirmed) {
        return;
      }

      setUpdatingApprovalItemId(item.id);

      try {
        await rejectPassiveVocabularyLibraryItem(item.id);
        toast.success(`Rejected "${item.canonical_term}"`);
        applyLocalApprovalStatus(item, "rejected");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to reject dictionary item",
        );
      } finally {
        setUpdatingApprovalItemId(null);
      }
    },
    [applyLocalApprovalStatus],
  );

  const handleSelectVisible = useCallback((checked: boolean) => {
    if (!checked) {
      setSelectedItemIds([]);
      return;
    }

    setSelectedItemIds(items.map((item) => item.id));
  }, [items]);

  const handleToggleItemSelection = useCallback(
    (itemId: string, checked: boolean) => {
      setSelectedItemIds((current) => {
        if (checked) {
          return current.includes(itemId) ? current : [...current, itemId];
        }

        return current.filter((id) => id !== itemId);
      });
    },
    [],
  );

  const handleBatchDelete = useCallback(async () => {
    if (selectedItems.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedItems.length} selected item${selectedItems.length === 1 ? "" : "s"}?`,
    );
    if (!confirmed) {
      return;
    }

    setIsBatchDeleting(true);

    try {
      await deletePassiveVocabularyLibraryItems(selectedItems.map((item) => item.id));
      toast.success(
        `Deleted ${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"}`,
      );
      setSelectedItemIds([]);
      removeItemsLocally(selectedItems);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete selected dictionary items",
      );
    } finally {
      setIsBatchDeleting(false);
    }
  }, [removeItemsLocally, selectedItems]);

  const hasActiveFilters =
    searchQuery.length > 0 ||
    cefrFilter !== "all" ||
    posFilter.length > 0 ||
    approvalFilter !== "all";
  const canClearFilters = hasActiveFilters || searchInput.length > 0;

  const handleClearFilters = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setCefrFilter("all");
    setApprovalFilter("all");
    setPosFilter([]);
  }, []);

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

          {reviewItems.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                {messages.library.dictionary.noPendingTutorSuggestions}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {reviewItems.map((suggestion) => {
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
            {(role === "superadmin" || (role === "tutor" && canDirectlyAdd)) && (
              <AddDictionaryItemDialog onAdded={reloadItems} />
            )}
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={messages.library.dictionary.searchPlaceholder}
              aria-label={messages.library.dictionary.searchAriaLabel}
            />
            <Button type="submit" className="sm:w-auto">
              <Search className="mr-2 h-4 w-4" />
              {messages.library.dictionary.searchAction}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {totalItemCount} total words
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span>
              {messages.library.dictionary.loadedItems(items.length, searchQuery || undefined)}
            </span>
          </div>
        </form>

        {canBatchManage && items.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              Selected: {selectedItems.length}
            </Badge>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={selectedItems.length === 0 || isBatchDeleting}
              onClick={() => void handleBatchDelete()}
            >
              {isBatchDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete selected ({selectedItems.length})
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canClearFilters}
            onClick={handleClearFilters}
          >
            {messages.library.dictionary.clearAllFiltersAction}
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {messages.library.dictionary.showFilterCountsLabel}
            </span>
            <Switch
              checked={showFilterCounts}
              onCheckedChange={setShowFilterCounts}
              aria-label={messages.library.dictionary.showFilterCountsLabel}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {cefrFilterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={cefrFilter === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setCefrFilter(option.value)}
            >
              {formatFilterLabel(option.label, facetCounts?.cefr[option.value])}
            </Button>
          ))}
        </div>

        {role === "superadmin" ? (
          <div className="flex flex-wrap gap-2">
            {approvalFilterOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={approvalFilter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setApprovalFilter(option.value)}
              >
                {formatFilterLabel(
                  option.label,
                  facetCounts?.approval[option.value],
                )}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {PASSIVE_VOCABULARY_PARTS_OF_SPEECH.map((pos) => {
            const isSelected = posFilter.includes(pos);
            return (
              <Button
                key={pos}
                type="button"
                variant={isSelected ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  setPosFilter((current) =>
                    isSelected
                      ? current.filter((p) => p !== pos)
                      : [...current, pos]
                  );
                }}
              >
                {formatFilterLabel(pos, facetCounts?.partOfSpeech[pos])}
              </Button>
            );
          })}
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
                  {canBatchManage ? (
                    <TableHead className="w-[56px]">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={(checked) => handleSelectVisible(checked === true)}
                        aria-label="Select all loaded words"
                      />
                    </TableHead>
                  ) : null}
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
                  const isUpdatingApproval = updatingApprovalItemId === item.id;
                  const ukrainianTranslation = getPassiveVocabularyUkrainianTranslation(
                    item.attributes,
                  );
                  const storedSearchForms = getPassiveVocabularyForms(
                    item.attributes,
                    item.canonical_term,
                  );
                  const pendingSuggestion = pendingSuggestionByItemId.get(item.id);

                  return (
                    <TableRow key={item.id}>
                      {canBatchManage ? (
                        <TableCell>
                          <Checkbox
                            checked={selectedItemIdSet.has(item.id)}
                            onCheckedChange={(checked) =>
                              handleToggleItemSelection(item.id, checked === true)
                            }
                            aria-label={`Select ${item.canonical_term}`}
                          />
                        </TableCell>
                      ) : null}
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
                          {storedSearchForms.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 pt-1">
                              <span className="text-[11px] text-muted-foreground">
                                {messages.library.dictionary.searchFormsLabel}
                              </span>
                              {storedSearchForms.map((form) => (
                                <Badge
                                  key={`${item.id}-${form}`}
                                  variant="secondary"
                                  className="px-1.5 py-0 text-[11px] font-normal"
                                >
                                  {form}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{item.item_type}</TableCell>
                      <TableCell>{item.cefr_level ?? "—"}</TableCell>
                      <TableCell>
                        {formatPassiveVocabularyPartOfSpeech(item.part_of_speech)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getApprovalStatusBadgeClassName(
                            item.approval_status,
                          )}
                        >
                          {getApprovalStatusLabel(item.approval_status)}
                        </Badge>
                        {item.enrichment_status !== "completed" ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            AI metadata: {item.enrichment_status}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatAppDate(item.updated_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          {role === "superadmin" ? (
                            <>
                              {item.approval_status !== "confirmed" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isUpdatingApproval}
                                  onClick={() => void handleConfirmItem(item)}
                                >
                                  {isUpdatingApproval ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="mr-2 h-4 w-4" />
                                  )}
                                  Confirm
                                </Button>
                              ) : null}

                              {item.approval_status !== "rejected" ? (
                                <Button
                                  type="button"
                                                    variant="destructive"
                                  size="sm"
                                  disabled={isUpdatingApproval}
                                  onClick={() => void handleRejectItem(item)}
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Reject
                                </Button>
                              ) : null}

                              <EditPassiveLibraryDialog
                                item={{
                                  id: item.id,
                                  canonical_term: item.canonical_term,
                                  item_type: item.item_type,
                                  cefr_level: item.cefr_level,
                                  part_of_speech: item.part_of_speech,
                                  approval_status: item.approval_status,
                                  attributes: item.attributes,
                                }}
                                onSaved={async () => {
                                  await reloadItems();
                                }}
                              />

                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8"
                                disabled={isUpdatingApproval}
                                onClick={() => void handleDeleteItem(item)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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