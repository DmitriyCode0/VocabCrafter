"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, PencilLine, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatAppDate } from "@/lib/dates";
import {
  PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
  formatPassiveVocabularyPartOfSpeech,
  normalizePassiveVocabularyText,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";
import type {
  StudentVocabularyCurrentState,
  StudentVocabularyGroupOverride,
} from "@/lib/mastery/student-vocabulary-state";
import type { CEFRLevel } from "@/types/quiz";

const PAGE_SIZE = 20;
const CEFR_FILTER_VALUES = [
  "all",
  "unknown",
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
] as const;
const APPROVAL_FILTER_VALUES = [
  "all",
  "unconfirmed",
  "confirmed",
  "rejected",
] as const;
const GROUP_FILTER_VALUES = [
  "all",
  "learning",
  "passive_only",
  "active_and_passive",
] as const;

type StudentVocabularyApprovalFilter = (typeof APPROVAL_FILTER_VALUES)[number];
type StudentVocabularyCefrFilter = (typeof CEFR_FILTER_VALUES)[number];
type StudentVocabularyGroupFilter = (typeof GROUP_FILTER_VALUES)[number];

interface StudentVocabularyFacetCounts {
  cefr: Record<StudentVocabularyCefrFilter, number>;
  approval: Record<StudentVocabularyApprovalFilter, number>;
  group: Record<StudentVocabularyGroupFilter, number>;
  partOfSpeech: Record<PassiveVocabularyPartOfSpeech, number>;
}

export interface StudentVocabularyBrowserItem {
  id: string;
  term: string;
  normalizedTerm: string;
  itemType: "word" | "phrase";
  currentState: StudentVocabularyCurrentState;
  groupOverride: StudentVocabularyGroupOverride | null;
  customDefinition: string | null;
  updatedAt: string;
  approvalStatus: "unconfirmed" | "confirmed" | "rejected";
  cefrLevel: CEFRLevel | null;
  partOfSpeech: PassiveVocabularyPartOfSpeech | null;
  sharedTranslation: string | null;
  sharedDefinitions: string[];
  searchForms: string[];
  ukrainianSearchForms: string[];
}

interface StudentVocabularyBrowserProps {
  initialItems: StudentVocabularyBrowserItem[];
  role: "student" | "tutor" | "superadmin";
}

interface EditStudentVocabularyDialogProps {
  item: StudentVocabularyBrowserItem;
  disabled: boolean;
  onSaved: (itemId: string, customDefinition: string | null) => Promise<void>;
}

function getApprovalStatusLabel(
  status: StudentVocabularyBrowserItem["approvalStatus"],
) {
  if (status === "confirmed") {
    return "Confirmed";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Unconfirmed";
}

function getApprovalStatusBadgeClassName(
  status: StudentVocabularyBrowserItem["approvalStatus"],
) {
  if (status === "confirmed") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }

  return "border-slate-300 bg-slate-50 text-slate-700";
}

function createEmptyFacetCounts(): StudentVocabularyFacetCounts {
  return {
    cefr: {
      all: 0,
      unknown: 0,
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
      C2: 0,
    },
    approval: {
      all: 0,
      unconfirmed: 0,
      confirmed: 0,
      rejected: 0,
    },
    group: {
      all: 0,
      learning: 0,
      passive_only: 0,
      active_and_passive: 0,
    },
    partOfSpeech: Object.fromEntries(
      PASSIVE_VOCABULARY_PARTS_OF_SPEECH.map((value) => [value, 0]),
    ) as StudentVocabularyFacetCounts["partOfSpeech"],
  };
}

function matchesSearch(item: StudentVocabularyBrowserItem, query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return true;
  }

  const loweredQuery = trimmedQuery.toLowerCase();
  const normalizedQuery = normalizePassiveVocabularyText(trimmedQuery);
  const searchValues = [
    item.term,
    item.normalizedTerm,
    item.customDefinition,
    item.sharedTranslation,
    ...item.sharedDefinitions,
    ...item.searchForms,
    ...item.ukrainianSearchForms,
  ].filter((value): value is string => Boolean(value));

  return searchValues.some((value) => {
    if (value.toLowerCase().includes(loweredQuery)) {
      return true;
    }

    return normalizePassiveVocabularyText(value).includes(normalizedQuery);
  });
}

function matchesCefr(
  item: StudentVocabularyBrowserItem,
  filter: StudentVocabularyCefrFilter,
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "unknown") {
    return item.cefrLevel === null;
  }

  return item.cefrLevel === filter;
}

function matchesApproval(
  item: StudentVocabularyBrowserItem,
  filter: StudentVocabularyApprovalFilter,
) {
  return filter === "all" ? true : item.approvalStatus === filter;
}

function matchesGroup(
  item: StudentVocabularyBrowserItem,
  filter: StudentVocabularyGroupFilter,
) {
  return filter === "all" ? true : item.currentState === filter;
}

function matchesPartOfSpeech(
  item: StudentVocabularyBrowserItem,
  posFilter: PassiveVocabularyPartOfSpeech[],
) {
  if (posFilter.length === 0) {
    return true;
  }

  if (!item.partOfSpeech) {
    return false;
  }

  return posFilter.includes(item.partOfSpeech);
}

function matchesFilters(
  item: StudentVocabularyBrowserItem,
  filters: {
    searchQuery: string;
    cefrFilter: StudentVocabularyCefrFilter;
    approvalFilter: StudentVocabularyApprovalFilter;
    groupFilter: StudentVocabularyGroupFilter;
    posFilter: PassiveVocabularyPartOfSpeech[];
  },
  omit?: "cefr" | "approval" | "group" | "pos",
) {
  return (
    matchesSearch(item, filters.searchQuery) &&
    (omit === "cefr" || matchesCefr(item, filters.cefrFilter)) &&
    (omit === "approval" || matchesApproval(item, filters.approvalFilter)) &&
    (omit === "group" || matchesGroup(item, filters.groupFilter)) &&
    (omit === "pos" || matchesPartOfSpeech(item, filters.posFilter))
  );
}

function buildFacetCounts(
  items: StudentVocabularyBrowserItem[],
  filters: {
    searchQuery: string;
    cefrFilter: StudentVocabularyCefrFilter;
    approvalFilter: StudentVocabularyApprovalFilter;
    groupFilter: StudentVocabularyGroupFilter;
    posFilter: PassiveVocabularyPartOfSpeech[];
  },
) {
  const counts = createEmptyFacetCounts();

  const cefrRows = items.filter((item) => matchesFilters(item, filters, "cefr"));
  counts.cefr.all = cefrRows.length;
  for (const item of cefrRows) {
    counts.cefr[item.cefrLevel ?? "unknown"] += 1;
  }

  const approvalRows = items.filter((item) =>
    matchesFilters(item, filters, "approval"),
  );
  counts.approval.all = approvalRows.length;
  for (const item of approvalRows) {
    counts.approval[item.approvalStatus] += 1;
  }

  const groupRows = items.filter((item) => matchesFilters(item, filters, "group"));
  counts.group.all = groupRows.length;
  for (const item of groupRows) {
    counts.group[item.currentState] += 1;
  }

  const posRows = items.filter((item) => matchesFilters(item, filters, "pos"));
  for (const item of posRows) {
    if (item.partOfSpeech) {
      counts.partOfSpeech[item.partOfSpeech] += 1;
    }
  }

  return counts;
}

function mergePatchedItem(
  currentItem: StudentVocabularyBrowserItem,
  nextItem: {
    current_state: StudentVocabularyCurrentState;
    group_override: StudentVocabularyGroupOverride | null;
    custom_definition: string | null;
    updated_at: string;
  },
): StudentVocabularyBrowserItem {
  return {
    ...currentItem,
    currentState: nextItem.current_state,
    groupOverride: nextItem.group_override,
    customDefinition: nextItem.custom_definition,
    updatedAt: nextItem.updated_at,
  };
}

function EditStudentVocabularyDialog({
  item,
  disabled,
  onSaved,
}: EditStudentVocabularyDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customDefinition, setCustomDefinition] = useState(
    item.customDefinition ?? "",
  );

  useEffect(() => {
    if (open) {
      setCustomDefinition(item.customDefinition ?? "");
    }
  }, [item.customDefinition, open]);

  async function handleSave() {
    setIsSaving(true);

    try {
      await onSaved(item.id, customDefinition.trim() || null);
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <PencilLine className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit My Definition</DialogTitle>
          <DialogDescription>
            Save your own definition for this word without changing the shared
            dictionary.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{item.term}</p>
            <p className="text-sm text-muted-foreground">
              Shared meaning: {item.sharedTranslation ?? item.sharedDefinitions[0] ?? "—"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`custom-definition-${item.id}`}>My definition</Label>
            <Textarea
              id={`custom-definition-${item.id}`}
              value={customDefinition}
              onChange={(event) => setCustomDefinition(event.target.value)}
              placeholder="Add your own definition or note"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StudentVocabularyBrowser({
  initialItems,
  role,
}: StudentVocabularyBrowserProps) {
  const [items, setItems] = useState(initialItems);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cefrFilter, setCefrFilter] =
    useState<StudentVocabularyCefrFilter>("all");
  const [approvalFilter, setApprovalFilter] =
    useState<StudentVocabularyApprovalFilter>("all");
  const [groupFilter, setGroupFilter] =
    useState<StudentVocabularyGroupFilter>("all");
  const [posFilter, setPosFilter] = useState<PassiveVocabularyPartOfSpeech[]>(
    [],
  );
  const [showFilterCounts, setShowFilterCounts] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [mutatingItemId, setMutatingItemId] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setCurrentPage(1);
  }, [items.length, searchQuery, cefrFilter, approvalFilter, groupFilter, posFilter]);

  const facetCounts = useMemo(
    () =>
      buildFacetCounts(items, {
        searchQuery,
        cefrFilter,
        approvalFilter,
        groupFilter,
        posFilter,
      }),
    [items, searchQuery, cefrFilter, approvalFilter, groupFilter, posFilter],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        matchesFilters(item, {
          searchQuery,
          cefrFilter,
          approvalFilter,
          groupFilter,
          posFilter,
        }),
      ),
    [items, searchQuery, cefrFilter, approvalFilter, groupFilter, posFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = filteredItems.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE,
  );
  const hasActiveFilters =
    searchQuery.length > 0 ||
    cefrFilter !== "all" ||
    approvalFilter !== "all" ||
    groupFilter !== "all" ||
    posFilter.length > 0;

  function formatFilterLabel(label: string, count: number | undefined) {
    if (!showFilterCounts || typeof count !== "number") {
      return label;
    }

    return `${label} (${count})`;
  }

  function clearFilters() {
    setSearchInput("");
    setSearchQuery("");
    setCefrFilter("all");
    setApprovalFilter("all");
    setGroupFilter("all");
    setPosFilter([]);
  }

  async function patchItem(
    itemId: string,
    body: { group?: StudentVocabularyCurrentState; customDefinition?: string | null },
  ) {
    setMutatingItemId(itemId);

    try {
      const response = await fetch(`/api/mastery/student-vocabulary/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            deleted?: boolean;
            item?: {
              current_state: StudentVocabularyCurrentState;
              group_override: StudentVocabularyGroupOverride | null;
              custom_definition: string | null;
              updated_at: string;
            } | null;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update dictionary item");
      }

      if (payload?.deleted || !payload?.item) {
        setItems((currentItems) =>
          currentItems.filter((item) => item.id !== itemId),
        );
        return;
      }

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId ? mergePatchedItem(item, payload.item!) : item,
        ),
      );
    } finally {
      setMutatingItemId(null);
    }
  }

  async function handleSaveCustomDefinition(
    itemId: string,
    customDefinition: string | null,
  ) {
    try {
      await patchItem(itemId, { customDefinition });
      toast.success("Saved your definition");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save your definition",
      );
      throw error;
    }
  }

  async function handleGroupChange(
    itemId: string,
    group: StudentVocabularyCurrentState,
  ) {
    try {
      await patchItem(itemId, { group });
      toast.success("Updated vocabulary group");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update group",
      );
    }
  }

  async function handleDelete(item: StudentVocabularyBrowserItem) {
    const confirmed = window.confirm(
      `Delete "${item.term}" from this student's dictionary? This also removes its linked practice and evidence rows for the student.`,
    );

    if (!confirmed) {
      return;
    }

    setMutatingItemId(item.id);

    try {
      const response = await fetch(`/api/mastery/student-vocabulary/${item.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete dictionary item");
      }

      setItems((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== item.id),
      );
      toast.success("Deleted from My Dictionary");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete dictionary item",
      );
    } finally {
      setMutatingItemId(null);
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
        onSubmit={(event) => {
          event.preventDefault();
          setSearchQuery(searchInput.trim());
        }}
      >
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-2xl">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search terms, forms, or translations"
            aria-label="Search vocabulary"
          />
          <Button type="submit" className="sm:w-auto">
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {items.length} total words
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span>{filteredItems.length} loaded items</span>
          {role !== "student" ? (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span>Shared-dictionary actions stay on /library/dictionary</span>
            </>
          ) : null}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasActiveFilters}
          onClick={clearFilters}
        >
          Clear all filters
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Show counts</span>
          <Switch
            checked={showFilterCounts}
            onCheckedChange={setShowFilterCounts}
            aria-label="Show filter counts"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CEFR_FILTER_VALUES.map((value) => (
          <Button
            key={value}
            type="button"
            variant={cefrFilter === value ? "default" : "outline"}
            size="sm"
            onClick={() => setCefrFilter(value)}
          >
            {formatFilterLabel(
              value === "all" ? "All" : value === "unknown" ? "Unknown" : value,
              facetCounts.cefr[value],
            )}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {APPROVAL_FILTER_VALUES.map((value) => (
          <Button
            key={value}
            type="button"
            variant={approvalFilter === value ? "default" : "outline"}
            size="sm"
            onClick={() => setApprovalFilter(value)}
          >
            {formatFilterLabel(
              value === "all" ? "All statuses" : getApprovalStatusLabel(value),
              facetCounts.approval[value],
            )}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {GROUP_FILTER_VALUES.map((value) => (
          <Button
            key={value}
            type="button"
            variant={groupFilter === value ? "default" : "outline"}
            size="sm"
            onClick={() => setGroupFilter(value)}
          >
            {formatFilterLabel(
              value === "all"
                ? "All groups"
                : value === "learning"
                  ? "Learning"
                  : value === "active_and_passive"
                    ? "Active"
                    : "Passive",
              facetCounts.group[value],
            )}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {PASSIVE_VOCABULARY_PARTS_OF_SPEECH.map((value) => {
          const isSelected = posFilter.includes(value);
          return (
            <Button
              key={value}
              type="button"
              variant={isSelected ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                setPosFilter((current) =>
                  isSelected
                    ? current.filter((item) => item !== value)
                    : [...current, value],
                )
              }
            >
              {formatFilterLabel(value, facetCounts.partOfSpeech[value])}
            </Button>
          );
        })}
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {hasActiveFilters
            ? "No words match the current filters."
            : "No vocabulary items are in this dictionary yet."}
        </div>
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>CEFR</TableHead>
                <TableHead>Part of speech</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => {
                const isMutating = mutatingItemId === item.id;
                const secondaryMeaning =
                  item.customDefinition ??
                  item.sharedTranslation ??
                  item.sharedDefinitions[0] ??
                  null;
                const visibleForms = item.searchForms.slice(0, 4);

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.term}</p>
                          {item.customDefinition ? (
                            <Badge variant="secondary">My definition</Badge>
                          ) : null}
                        </div>
                        {secondaryMeaning ? (
                          <p className="max-w-[360px] whitespace-normal text-xs text-muted-foreground">
                            {secondaryMeaning}
                          </p>
                        ) : null}
                        {visibleForms.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <span className="text-[11px] text-muted-foreground">
                              Forms
                            </span>
                            {visibleForms.map((form) => (
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
                    <TableCell>{item.itemType}</TableCell>
                    <TableCell>{item.cefrLevel ?? "—"}</TableCell>
                    <TableCell>
                      {formatPassiveVocabularyPartOfSpeech(item.partOfSpeech)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getApprovalStatusBadgeClassName(item.approvalStatus)}
                      >
                        {getApprovalStatusLabel(item.approvalStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.currentState}
                        onValueChange={(value) =>
                          void handleGroupChange(
                            item.id,
                            value as StudentVocabularyCurrentState,
                          )
                        }
                        disabled={isMutating}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passive_only">Passive</SelectItem>
                          <SelectItem value="active_and_passive">Active</SelectItem>
                          <SelectItem value="learning">Learning</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{formatAppDate(item.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {isMutating ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : null}
                        <EditStudentVocabularyDialog
                          item={item}
                          disabled={isMutating}
                          onSaved={handleSaveCustomDefinition}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isMutating}
                          onClick={() => void handleDelete(item)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(safeCurrentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(safeCurrentPage * PAGE_SIZE, filteredItems.length)} of{" "}
                {filteredItems.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}