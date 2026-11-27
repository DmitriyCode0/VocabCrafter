"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { LessonMeetTranscriptView } from "@/lib/lesson-transcript-vocab-analyzer";
import type { LessonTranscriptSummary } from "@/lib/lessons";
import { cn } from "@/lib/utils";

interface LessonMeetTranscriptDialogProps {
  lessonId: string;
  lessonTitle: string;
  lessonDate: string;
  studentId?: string | null;
  studentName: string;
  hasTranscriptScope?: boolean;
  connectHref?: string;
  summary?: LessonTranscriptSummary | null;
  onSummaryUpdated?: (
    lessonId: string,
    summary: LessonTranscriptSummary,
  ) => void;
}

type ReviewCategory = "learning" | "active" | "passive";

interface EditableReviewItem {
  term: string;
  normalizedTerm: string;
  itemType: "word" | "phrase";
  category: ReviewCategory;
  checked: boolean;
  status: "pending" | "approved" | "dismissed";
  partOfSpeech: string | null;
  cefrLevel: string | null;
  ukrainianTranslation: string;
  englishDefinition: string;
  transcription: string | null;
  quote: string | null;
  reasonUk: string | null;
  confidence: "high" | "medium" | null;
  dictionaryMatched: boolean;
  graduatedFromLearning: boolean;
  source: string | null;
}

function isBasicCefr(cefrLevel: string | null): boolean {
  return cefrLevel === "A1" || cefrLevel === "A2";
}

function buildInitialDraftItems(
  t: LessonMeetTranscriptView,
): EditableReviewItem[] {
  const seen = new Set<string>();
  const items: EditableReviewItem[] = [];

  for (const item of t.learningCandidates) {
    if (seen.has(item.normalizedTerm)) continue;
    seen.add(item.normalizedTerm);
    items.push({
      term: item.term,
      normalizedTerm: item.normalizedTerm,
      itemType: item.itemType,
      category: "learning",
      checked: item.status !== "dismissed",
      status: item.status,
      partOfSpeech: item.partOfSpeech ?? null,
      cefrLevel: item.cefrLevel ?? null,
      ukrainianTranslation: item.ukrainianTranslation ?? "",
      englishDefinition: item.englishDefinition ?? "",
      transcription: item.transcription ?? null,
      quote: item.exampleSentence ?? null,
      reasonUk: item.reasonUk ?? null,
      confidence: item.confidence ?? "medium",
      dictionaryMatched: item.dictionaryMatched,
      graduatedFromLearning: false,
      source: "ai_learning",
    });
  }

  for (const item of t.autoAppliedActive) {
    if (seen.has(item.normalizedTerm)) continue;
    seen.add(item.normalizedTerm);
    const status = item.status ?? "approved";
    items.push({
      term: item.term,
      normalizedTerm: item.normalizedTerm,
      itemType: item.itemType,
      category: "active",
      checked: status !== "dismissed",
      status,
      partOfSpeech: item.partOfSpeech ?? null,
      cefrLevel: item.cefrLevel ?? null,
      ukrainianTranslation: item.ukrainianTranslation ?? "",
      englishDefinition: "",
      transcription: item.transcription ?? null,
      quote: item.evidenceQuote ?? null,
      reasonUk: null,
      confidence: null,
      dictionaryMatched: item.dictionaryMatched,
      graduatedFromLearning: item.graduatedFromLearning,
      source: item.source ?? "transcript_scan",
    });
  }

  for (const item of t.autoAppliedPassive) {
    if (seen.has(item.normalizedTerm)) continue;
    seen.add(item.normalizedTerm);
    const status = item.status ?? "approved";
    items.push({
      term: item.term,
      normalizedTerm: item.normalizedTerm,
      itemType: item.itemType,
      category: "passive",
      checked: status !== "dismissed",
      status,
      partOfSpeech: item.partOfSpeech ?? null,
      cefrLevel: item.cefrLevel ?? null,
      ukrainianTranslation: item.ukrainianTranslation ?? "",
      englishDefinition: "",
      transcription: item.transcription ?? null,
      quote: item.contextQuote ?? null,
      reasonUk: null,
      confidence: null,
      dictionaryMatched: item.dictionaryMatched,
      graduatedFromLearning: false,
      source: item.source ?? "transcript_scan",
    });
  }

  return items;
}

function buildSummaryFromTranscript(
  t: LessonMeetTranscriptView,
): LessonTranscriptSummary {
  const pendingLearningCount = t.learningCandidates.filter(
    (c) => c.status === "pending",
  ).length;
  const pendingActiveCount = t.autoAppliedActive.filter(
    (c) => c.status === "pending",
  ).length;
  const pendingPassiveCount = t.autoAppliedPassive.filter(
    (c) => c.status === "pending",
  ).length;

  return {
    analysisStatus: t.analysisStatus,
    activeAppliedCount: t.activeAppliedCount,
    passiveAppliedCount: t.passiveAppliedCount,
    learningApprovedCount: t.learningApprovedCount,
    pendingLearningCount,
    pendingReviewCount:
      pendingLearningCount + pendingActiveCount + pendingPassiveCount,
    analyzedAt: t.analyzedAt,
  };
}

export function LessonMeetTranscriptDialog({
  lessonId,
  lessonTitle,
  lessonDate,
  studentId,
  studentName,
  hasTranscriptScope = true,
  connectHref,
  summary,
  onSummaryUpdated,
}: LessonMeetTranscriptDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncingMode, setSyncingMode] = useState<"auto" | "manual" | null>(
    null,
  );
  const [applying, setApplying] = useState(false);
  const [transcript, setTranscript] =
    useState<LessonMeetTranscriptView | null>(null);
  const [draftItems, setDraftItems] = useState<EditableReviewItem[]>([]);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const [activeTab, setActiveTab] = useState<string>("learning");
  const [searchFilter, setSearchFilter] = useState("");
  const [showBasicActive, setShowBasicActive] = useState(false);
  const [showBasicPassive, setShowBasicPassive] = useState(false);
  const [quickAddTerm, setQuickAddTerm] = useState("");
  const [quickAddTranslation, setQuickAddTranslation] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadTranscript() {
      setLoading(true);
      setErrorMessage(null);
      setErrorCode(null);
      try {
        const res = await fetch(`/api/lessons/${lessonId}/meet-transcript`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          transcript?: LessonMeetTranscriptView | null;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setErrorMessage(data.error ?? "Failed to load transcript.");
          return;
        }
        const loaded = data.transcript ?? null;
        setTranscript(loaded);
        if (loaded) {
          setDraftItems(buildInitialDraftItems(loaded));
        }
      } catch {
        if (!cancelled) {
          setErrorMessage("Network error while loading transcript.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTranscript();
    return () => {
      cancelled = true;
    };
  }, [open, lessonId]);

  async function handleSync(mode: "auto" | "manual") {
    setSyncingMode(mode);
    setErrorCode(null);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/lessons/${lessonId}/meet-transcript/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "manual"
            ? { mode: "manual", rawText: manualText }
            : { mode: "auto" },
        ),
      });

      const data = (await res.json()) as {
        transcript?: LessonMeetTranscriptView;
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.transcript) {
        setErrorCode(data.code ?? null);
        setErrorMessage(data.error ?? "Failed to sync Meet transcript.");
        toast.error(data.error ?? "Failed to sync Meet transcript.");
        return;
      }

      const synced = data.transcript;
      setTranscript(synced);
      setDraftItems(buildInitialDraftItems(synced));
      setActiveTab("learning");
      onSummaryUpdated?.(lessonId, buildSummaryFromTranscript(synced));
      toast.success(
        `Extracted ${synced.learningCandidates.length} Learning, ${synced.autoAppliedActive.length} Active, and ${synced.autoAppliedPassive.length} Passive candidates for review.`,
      );
    } catch {
      setErrorMessage("Network error while syncing Meet transcript.");
      toast.error("Network error while syncing Meet transcript.");
    } finally {
      setSyncingMode(null);
    }
  }

  async function handleApplyReviewedVocabulary() {
    if (!transcript) return;

    const serializeItem = (item: EditableReviewItem) => ({
      term: item.term,
      ukrainianTranslation: item.ukrainianTranslation.trim() || null,
      englishDefinition: item.englishDefinition.trim() || null,
      partOfSpeech: item.partOfSpeech,
      cefrLevel: item.cefrLevel,
      quote: item.quote,
      source: item.source,
      graduatedFromLearning: item.graduatedFromLearning,
    });

    const activeItems = draftItems
      .filter((i) => i.category === "active" && i.checked)
      .map(serializeItem);
    const passiveItems = draftItems
      .filter((i) => i.category === "passive" && i.checked)
      .map(serializeItem);
    const learningItems = draftItems
      .filter((i) => i.category === "learning" && i.checked)
      .map(serializeItem);

    setApplying(true);
    try {
      const res = await fetch(
        `/api/lessons/${lessonId}/meet-transcript/approve-learning`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activeItems, passiveItems, learningItems }),
        },
      );

      const data = (await res.json()) as {
        transcript?: LessonMeetTranscriptView;
        activeAppliedCount?: number;
        passiveAppliedCount?: number;
        addedCount?: number;
        error?: string;
      };

      if (!res.ok || !data.transcript) {
        toast.error(data.error ?? "Failed to apply lesson vocabulary.");
        return;
      }

      setTranscript(data.transcript);
      setDraftItems(buildInitialDraftItems(data.transcript));
      onSummaryUpdated?.(lessonId, buildSummaryFromTranscript(data.transcript));

      toast.success(
        `Saved to ${studentName}: ${learningItems.length} Learning · ${activeItems.length} Active · ${passiveItems.length} Passive.`,
      );
    } catch {
      toast.error("Network error while applying vocabulary.");
    } finally {
      setApplying(false);
    }
  }

  function toggleItemChecked(normalizedTerm: string, nextChecked?: boolean) {
    setDraftItems((prev) =>
      prev.map((item) =>
        item.normalizedTerm === normalizedTerm
          ? { ...item, checked: nextChecked ?? !item.checked }
          : item,
      ),
    );
  }

  function updateItemTranslation(normalizedTerm: string, value: string) {
    setDraftItems((prev) =>
      prev.map((item) =>
        item.normalizedTerm === normalizedTerm
          ? { ...item, ukrainianTranslation: value }
          : item,
      ),
    );
  }

  function moveItemCategory(
    normalizedTerm: string,
    nextCategory: ReviewCategory,
  ) {
    setDraftItems((prev) =>
      prev.map((item) =>
        item.normalizedTerm === normalizedTerm
          ? { ...item, category: nextCategory, checked: true }
          : item,
      ),
    );
  }

  function bulkUpdateCategory(
    category: ReviewCategory,
    mode: "all" | "none" | "b1_plus",
  ) {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.category !== category) return item;
        if (mode === "all") return { ...item, checked: true };
        if (mode === "none") return { ...item, checked: false };
        return { ...item, checked: !isBasicCefr(item.cefrLevel) };
      }),
    );
  }

  function handleQuickAddWord(targetCategory: ReviewCategory) {
    const clean = quickAddTerm
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (clean.length < 2) return;

    const translation = quickAddTranslation.trim();

    setDraftItems((prev) => {
      const existing = prev.find((i) => i.normalizedTerm === clean);
      if (existing) {
        return prev.map((i) =>
          i.normalizedTerm === clean
            ? {
                ...i,
                category: targetCategory,
                checked: true,
                ukrainianTranslation: translation || i.ukrainianTranslation,
              }
            : i,
        );
      }

      return [
        {
          term: clean,
          normalizedTerm: clean,
          itemType: clean.includes(" ") ? "phrase" : "word",
          category: targetCategory,
          checked: true,
          status: "pending",
          partOfSpeech: null,
          cefrLevel: null,
          ukrainianTranslation: translation,
          englishDefinition: "",
          transcription: null,
          quote: null,
          reasonUk:
            targetCategory === "learning"
              ? "Додано викладачем вручну"
              : null,
          confidence: "high",
          dictionaryMatched: false,
          graduatedFromLearning: false,
          source: "manual",
        },
        ...prev,
      ];
    });

    setQuickAddTerm("");
    setQuickAddTranslation("");
  }

  const isReviewEditable =
    Boolean(transcript) && transcript?.analysisStatus === "analyzed";

  const { learningItems, activeItems, passiveItems } = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    const matchesQuery = (item: EditableReviewItem) =>
      !query ||
      item.term.toLowerCase().includes(query) ||
      item.ukrainianTranslation.toLowerCase().includes(query);

    return {
      learningItems: draftItems.filter(
        (i) => i.category === "learning" && matchesQuery(i),
      ),
      activeItems: draftItems.filter(
        (i) => i.category === "active" && matchesQuery(i),
      ),
      passiveItems: draftItems.filter(
        (i) => i.category === "passive" && matchesQuery(i),
      ),
    };
  }, [draftItems, searchFilter]);

  const counts = useMemo(() => {
    let learningSelected = 0;
    let learningTotal = 0;
    let activeSelected = 0;
    let activeTotal = 0;
    let passiveSelected = 0;
    let passiveTotal = 0;

    for (const item of draftItems) {
      if (item.category === "learning") {
        learningTotal += 1;
        if (item.checked) learningSelected += 1;
      } else if (item.category === "active") {
        activeTotal += 1;
        if (item.checked) activeSelected += 1;
      } else {
        passiveTotal += 1;
        if (item.checked) passiveSelected += 1;
      }
    }

    return {
      learningSelected,
      learningTotal,
      activeSelected,
      activeTotal,
      passiveSelected,
      passiveTotal,
    };
  }, [draftItems]);

  const effectiveSummary = transcript
    ? buildSummaryFromTranscript(transcript)
    : (summary ?? null);
  const pendingCount =
    effectiveSummary?.pendingReviewCount ??
    effectiveSummary?.pendingLearningCount ??
    0;
  const hasPendingBadge =
    effectiveSummary?.analysisStatus === "analyzed" || pendingCount > 0;

  function renderCompactVocabSection(
    category: "active" | "passive",
    items: EditableReviewItem[],
    showBasic: boolean,
    setShowBasic: (next: boolean) => void,
  ) {
    const advancedOrNew = items.filter((item) => !isBasicCefr(item.cefrLevel));
    const basicItems = items.filter((item) => isBasicCefr(item.cefrLevel));
    const basicSelectedCount = basicItems.filter((i) => i.checked).length;

    const renderChip = (item: EditableReviewItem) => {
      const otherCategory: ReviewCategory =
        category === "active" ? "passive" : "active";
      const chipColor = item.checked
        ? category === "active"
          ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
          : "border-sky-500/40 bg-sky-500/10 text-foreground"
        : "border-dashed border-border/70 bg-muted/30 text-muted-foreground opacity-65";

      return (
        <div
          key={item.normalizedTerm}
          title={[
            item.ukrainianTranslation || null,
            item.quote ? `“${item.quote}”` : null,
          ]
            .filter(Boolean)
            .join(" — ")}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors",
            chipColor,
          )}
        >
          <button
            type="button"
            disabled={!isReviewEditable}
            onClick={() => toggleItemChecked(item.normalizedTerm)}
            className="flex items-center gap-1.5 text-left font-medium focus-visible:outline-none"
          >
            <span>{item.term}</span>
            {item.cefrLevel ? (
              <span className="rounded bg-background/70 px-1 py-0.2 text-[10px] font-semibold text-muted-foreground">
                {item.cefrLevel}
              </span>
            ) : null}
            {item.graduatedFromLearning ? (
              <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                From Learning
              </span>
            ) : null}
            {item.source === "reading_aloud" ? (
              <span className="rounded bg-sky-500/20 px-1 py-0.2 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                Read aloud
              </span>
            ) : null}
          </button>

          {isReviewEditable ? (
            <div className="ml-1 flex items-center gap-0.5 border-l border-border/50 pl-1">
              <button
                type="button"
                title="Move to Learning"
                onClick={() =>
                  moveItemCategory(item.normalizedTerm, "learning")
                }
                className="rounded px-1 text-[10px] font-semibold text-amber-600 hover:bg-amber-500/20 dark:text-amber-300"
              >
                →L
              </button>
              <button
                type="button"
                title={`Move to ${otherCategory === "active" ? "Active" : "Passive"}`}
                onClick={() =>
                  moveItemCategory(item.normalizedTerm, otherCategory)
                }
                className="rounded px-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                →{otherCategory === "active" ? "A" : "P"}
              </button>
            </div>
          ) : null}
        </div>
      );
    };

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={`Filter ${category} words...`}
              className="h-8 pl-8 text-xs"
            />
          </div>
          {isReviewEditable ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => bulkUpdateCategory(category, "all")}
              >
                Select all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => bulkUpdateCategory(category, "b1_plus")}
              >
                B1+ &amp; new only
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => bulkUpdateCategory(category, "none")}
              >
                Clear
              </Button>
            </div>
          ) : null}
        </div>

        {isReviewEditable ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={quickAddTerm}
              onChange={(e) => setQuickAddTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleQuickAddWord(category);
                }
              }}
              placeholder={`+ Add ${category} word or phrase...`}
              className="h-8 flex-1 min-w-[180px] text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              disabled={quickAddTerm.trim().length < 2}
              onClick={() => handleQuickAddWord(category)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No new {category} vocabulary items extracted for this lesson.
          </div>
        ) : (
          <>
            {advancedOrNew.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {advancedOrNew.map(renderChip)}
              </div>
            ) : null}

            {basicItems.length > 0 ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                <button
                  type="button"
                  onClick={() => setShowBasic(!showBasic)}
                  className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    {showBasic ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    Basic words (A1–A2) · {basicSelectedCount} /{" "}
                    {basicItems.length} selected
                  </span>
                  <span className="text-[11px]">
                    {showBasic ? "Hide" : "Show"}
                  </span>
                </button>
                {showBasic ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {basicItems.map(renderChip)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          title="Google Meet transcript & AI vocabulary"
          className={
            hasPendingBadge
              ? "h-7 border-amber-500/40 bg-amber-500/10 px-2 text-xs text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
              : effectiveSummary
                ? "h-7 border-sky-500/30 bg-sky-500/10 px-2 text-xs text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
                : "h-7 px-2 text-xs"
          }
        >
          <FileText className="mr-1 h-3.5 w-3.5" />
          Transcript
          {hasPendingBadge ? (
            <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
              Review
            </span>
          ) : effectiveSummary ? (
            <CheckCircle2 className="ml-1 h-3 w-3 text-emerald-500" />
          ) : null}
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Meet Transcript &amp; Vocabulary
          </DialogTitle>
          <DialogDescription>
            {lessonTitle} · {lessonDate} · Student: {studentName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {!studentId ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              This is a one-time lesson without an assigned student. Assign a
              student first to sync vocabulary into Learning, Active, and
              Passive decks.
            </div>
          ) : null}

          {!hasTranscriptScope && studentId ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
              <span>
                Google Drive read access is needed to pull Meet transcripts
                automatically.
              </span>
              {connectHref ? (
                <Button asChild size="sm" variant="outline">
                  <a href={connectHref}>Reconnect Google</a>
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 p-3">
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">
                Full Tutor Review Before Saving
              </div>
              <div>
                New words from the lesson are classified into Learning (up to
                20), Active, and Passive. Nothing saves until you click Apply.
              </div>
            </div>
            <div className="flex items-center gap-2">
              {transcript?.googleDriveWebViewLink ? (
                <Button asChild variant="ghost" size="sm">
                  <a
                    href={transcript.googleDriveWebViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Google Doc
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={!studentId || syncingMode !== null}
                onClick={() => handleSync("auto")}
              >
                {syncingMode === "auto" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                {transcript ? "Re-sync from Meet" : "Sync from Google Meet"}
              </Button>
            </div>
          </div>

          {errorMessage ? (
            <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <div>{errorMessage}</div>
              {errorCode === "NEEDS_DRIVE_SCOPE" && connectHref ? (
                <Button asChild size="sm" variant="outline">
                  <a href={connectHref}>Reconnect Google Calendar</a>
                </Button>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading lesson transcript...
            </div>
          ) : null}

          {!loading && transcript ? (
            <div className="space-y-4">
              {transcript.lessonSummaryUk ? (
                <div className="rounded-lg border border-border/70 bg-card p-3 text-sm">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Lesson Summary
                  </div>
                  <p className="text-foreground">{transcript.lessonSummaryUk}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                  <div className="text-xs text-muted-foreground">
                    Learning (SRS)
                  </div>
                  <div className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                    {isReviewEditable
                      ? `${counts.learningSelected} / ${counts.learningTotal}`
                      : `${transcript.learningApprovedCount} saved`}
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                  <div className="text-xs text-muted-foreground">
                    New Active
                  </div>
                  <div className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {isReviewEditable
                      ? `${counts.activeSelected} / ${counts.activeTotal}`
                      : `${transcript.activeAppliedCount} saved`}
                  </div>
                </div>
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5">
                  <div className="text-xs text-muted-foreground">
                    New Passive
                  </div>
                  <div className="text-xl font-bold tabular-nums text-sky-700 dark:text-sky-300">
                    {isReviewEditable
                      ? `${counts.passiveSelected} / ${counts.passiveTotal}`
                      : `${transcript.passiveAppliedCount} saved`}
                  </div>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="learning">
                    Learning ({counts.learningTotal})
                  </TabsTrigger>
                  <TabsTrigger value="active">
                    Active ({counts.activeTotal})
                  </TabsTrigger>
                  <TabsTrigger value="passive">
                    Passive ({counts.passiveTotal})
                  </TabsTrigger>
                  <TabsTrigger value="paste">Paste / Replace</TabsTrigger>
                </TabsList>

                <TabsContent value="learning" className="mt-3 space-y-3">
                  {isReviewEditable ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        <Input
                          value={quickAddTerm}
                          onChange={(e) => setQuickAddTerm(e.target.value)}
                          placeholder="+ Add word or phrase to Learning..."
                          className="h-8 flex-1 min-w-[160px] text-xs"
                        />
                        <Input
                          value={quickAddTranslation}
                          onChange={(e) =>
                            setQuickAddTranslation(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleQuickAddWord("learning");
                            }
                          }}
                          placeholder="Ukrainian translation..."
                          className="h-8 w-44 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs"
                          disabled={quickAddTerm.trim().length < 2}
                          onClick={() => handleQuickAddWord("learning")}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          onClick={() => bulkUpdateCategory("learning", "all")}
                        >
                          All
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => bulkUpdateCategory("learning", "none")}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {learningItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No Learning words currently in this tab. Move any word
                      from Active/Passive with →L or add one manually above.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {learningItems.map((item) => (
                        <div
                          key={item.normalizedTerm}
                          className={cn(
                            "rounded-lg border p-3 transition-colors",
                            item.checked
                              ? "border-amber-500/35 bg-card"
                              : "border-border/50 bg-muted/20 opacity-65",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              {isReviewEditable ? (
                                <Checkbox
                                  checked={item.checked}
                                  onCheckedChange={(checked) =>
                                    toggleItemChecked(
                                      item.normalizedTerm,
                                      checked === true,
                                    )
                                  }
                                  className="mt-1"
                                />
                              ) : null}
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold">
                                    {item.term}
                                  </span>
                                  {item.transcription ? (
                                    <span className="text-xs text-muted-foreground">
                                      [{item.transcription}]
                                    </span>
                                  ) : null}
                                  {item.partOfSpeech ? (
                                    <Badge variant="outline">
                                      {item.partOfSpeech}
                                    </Badge>
                                  ) : null}
                                  {item.cefrLevel ? (
                                    <Badge variant="secondary">
                                      {item.cefrLevel}
                                    </Badge>
                                  ) : null}
                                  {item.dictionaryMatched ? (
                                    <Badge
                                      variant="outline"
                                      className="border-sky-500/30 text-sky-600 dark:text-sky-300"
                                    >
                                      Dict
                                    </Badge>
                                  ) : null}
                                </div>
                                {item.reasonUk ? (
                                  <p className="text-xs text-muted-foreground">
                                    {item.reasonUk}
                                  </p>
                                ) : null}
                                {item.quote ? (
                                  <p className="text-xs italic text-muted-foreground">
                                    “{item.quote}”
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            {isReviewEditable ? (
                              <div className="flex shrink-0 items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-[11px] text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                                  onClick={() =>
                                    moveItemCategory(
                                      item.normalizedTerm,
                                      "active",
                                    )
                                  }
                                >
                                  <ArrowRightLeft className="mr-1 h-3 w-3" />
                                  Active
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-[11px] text-sky-600 hover:bg-sky-500/10 dark:text-sky-400"
                                  onClick={() =>
                                    moveItemCategory(
                                      item.normalizedTerm,
                                      "passive",
                                    )
                                  }
                                >
                                  <BookOpen className="mr-1 h-3 w-3" />
                                  Passive
                                </Button>
                              </div>
                            ) : (
                              <Badge
                                variant={
                                  item.status === "approved"
                                    ? "default"
                                    : "outline"
                                }
                              >
                                {item.status}
                              </Badge>
                            )}
                          </div>

                          <div className="mt-2.5 pl-6">
                            <Input
                              value={item.ukrainianTranslation}
                              disabled={!isReviewEditable}
                              placeholder="Ukrainian translation..."
                              onChange={(e) =>
                                updateItemTranslation(
                                  item.normalizedTerm,
                                  e.target.value,
                                )
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="active" className="mt-3">
                  {renderCompactVocabSection(
                    "active",
                    activeItems,
                    showBasicActive,
                    setShowBasicActive,
                  )}
                </TabsContent>

                <TabsContent value="passive" className="mt-3">
                  {renderCompactVocabSection(
                    "passive",
                    passiveItems,
                    showBasicPassive,
                    setShowBasicPassive,
                  )}
                </TabsContent>

                <TabsContent value="paste" className="mt-3 space-y-2">
                  <Textarea
                    rows={7}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Paste a Google Meet transcript (plain text or VTT) to re-analyze this lesson..."
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={
                        !studentId ||
                        syncingMode !== null ||
                        manualText.trim().length < 20
                      }
                      onClick={() => handleSync("manual")}
                    >
                      {syncingMode === "manual" ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Analyze Pasted Transcript
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}

          {!loading && !transcript ? (
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <div className="text-sm font-medium">
                Or paste a transcript manually
              </div>
              <p className="text-xs text-muted-foreground">
                If Meet Transcription wasn&apos;t synced yet or came from another
                source, paste the text below and click Analyze.
              </p>
              <Textarea
                rows={6}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Paste your Google Meet transcript here..."
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={
                    !studentId ||
                    syncingMode !== null ||
                    manualText.trim().length < 20
                  }
                  onClick={() => handleSync("manual")}
                >
                  {syncingMode === "manual" ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Analyze Pasted Transcript
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {!loading && transcript && isReviewEditable ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="text-xs text-muted-foreground">
              Will save:{" "}
              <span className="font-semibold text-amber-600 dark:text-amber-300">
                {counts.learningSelected} Learning
              </span>{" "}
              ·{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                {counts.activeSelected} Active
              </span>{" "}
              ·{" "}
              <span className="font-semibold text-sky-600 dark:text-sky-300">
                {counts.passiveSelected} Passive
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={applying}
              onClick={handleApplyReviewedVocabulary}
            >
              {applying ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <GraduationCap className="mr-1.5 h-3.5 w-3.5" />
              )}
              Apply Reviewed Vocabulary
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
