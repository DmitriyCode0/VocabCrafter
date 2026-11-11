"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronDown,
  FileText,
  Loader2,
  Minus,
  Pencil,
  PiggyBank,
  Plus,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { formatAppDate, formatAppDateTime } from "@/lib/dates";
import {
  formatLessonCurrency,
  formatLessonCurrencyInput,
  formatLessonTimeRange,
  getLessonDisplayTitle,
  parseLessonCurrencyInput,
  type LessonBalanceSummaryItem,
} from "@/lib/lessons";
import { cn } from "@/lib/utils";

interface LessonBalanceManagerProps {
  summaries: LessonBalanceSummaryItem[];
  canManage?: boolean;
}

interface LessonReportLessonItem {
  id: string;
  title: string | null;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
}

function buildLessonReport(
  participantName: string,
  lessons: LessonReportLessonItem[],
) {
  if (lessons.length === 0) {
    return `No completed lessons found for ${participantName}.`;
  }

  return [
    participantName,
    "",
    ...lessons.map((lesson, index) => {
      const dateLabel = formatAppDate(`${lesson.lesson_date}T00:00:00`);
      const timeLabel = formatLessonTimeRange(
        lesson.start_time,
        lesson.end_time,
      );
      const titleLabel = getLessonDisplayTitle(lesson.title);

      return `${index + 1}. ${dateLabel} | ${timeLabel} | ${titleLabel}`;
    }),
  ].join("\n");
}

function UpdateLessonPriceDialog({
  participant,
  trigger,
}: {
  participant: LessonBalanceSummaryItem;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [priceInput, setPriceInput] = useState(
    formatLessonCurrencyInput(participant.lessonPriceCents),
  );
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const lessonPriceCents = parseLessonCurrencyInput(priceInput);

    if (lessonPriceCents === null) {
      toast.error("Please enter a valid lesson price");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/lessons/financials/${participant.participantId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonPriceCents }),
        },
      );

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update lesson price");
      }

      toast.success(`Updated lesson price for ${participant.participantName}.`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update lesson price",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setPriceInput(
            formatLessonCurrencyInput(participant.lessonPriceCents),
          );
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Price
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set lesson price</DialogTitle>
          <DialogDescription>
            Update the default price used to estimate how many lessons are left
            for {participant.participantName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`lesson-price-${participant.participantId}`}>
            Lesson price
          </Label>
          <Input
            id={`lesson-price-${participant.participantId}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={priceInput}
            onChange={(event) => setPriceInput(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Price"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TopUpBalanceDialog({
  participant,
  direction = "credit",
}: {
  participant: LessonBalanceSummaryItem;
  direction?: "credit" | "debit";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isDebit = direction === "debit";
  const lessonPresets = isDebit ? [1, 2, 4] : [1, 4, 8, 10];

  async function handleSave() {
    const amountCents = parseLessonCurrencyInput(amountInput);

    if (amountCents === null || amountCents <= 0) {
      toast.error("Please enter a valid top-up amount");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/lessons/financials/${participant.participantId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents,
            direction,
            note: note.trim() || null,
          }),
        },
      );

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save balance change");
      }

      toast.success(
        isDebit
          ? `Deducted ${formatLessonCurrency(amountCents)} from ${participant.participantName}.`
          : `Added ${formatLessonCurrency(amountCents)} to ${participant.participantName}.`,
      );
      setOpen(false);
      setAmountInput("");
      setNote("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to top up balance",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setAmountInput("");
          setNote("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={isDebit ? "outline" : "default"}
          className={cn(!isDebit && "flex-1 font-medium")}
        >
          {isDebit ? (
            <>
              <Minus className="mr-1.5 h-3.5 w-3.5" />
              Deduct
            </>
          ) : (
            <>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Top Up
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDebit ? "Deduct balance" : "Top up balance"}
          </DialogTitle>
          <DialogDescription>
            {isDebit
              ? `Record a manual balance deduction for ${participant.participantName}.`
              : `Record a new balance top-up for ${participant.participantName}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {participant.lessonPriceCents > 0 ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Quick package presets ({formatLessonCurrency(participant.lessonPriceCents)} / lesson)
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {lessonPresets.map((count) => {
                  const totalCents = participant.lessonPriceCents * count;
                  const formattedInput = formatLessonCurrencyInput(totalCents);
                  const isActive = amountInput === formattedInput;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() =>
                        setAmountInput(formattedInput)
                      }
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-muted/30 text-foreground hover:bg-accent",
                      )}
                    >
                      {isDebit ? "-" : "+"}
                      {count} lesson{count === 1 ? "" : "s"} ·{" "}
                      {formatLessonCurrency(totalCents)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`top-up-${participant.participantId}`}>
              Amount
            </Label>
            <Input
              id={`top-up-${participant.participantId}`}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`top-up-note-${participant.participantId}`}>
              Note
            </Label>
            <Textarea
              id={`top-up-note-${participant.participantId}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder={
                isDebit
                  ? "Optional note about the correction or mistaken top-up..."
                  : "Optional note, invoice reference, or payment comment..."
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isDebit ? (
              "Save Deduction"
            ) : (
              "Save Top-up"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateLessonReportDialog({
  participant,
}: {
  participant: LessonBalanceSummaryItem;
}) {
  const [open, setOpen] = useState(false);
  const [limitInput, setLimitInput] = useState("5");
  const [reportText, setReportText] = useState("");
  const [lessonCount, setLessonCount] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    const limit = Number(limitInput);

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      toast.error("Please enter a whole number between 1 and 50");
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(
        `/api/lessons/reports/${participant.participantId}?limit=${limit}`,
      );

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        lessons?: LessonReportLessonItem[];
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to generate lesson report");
      }

      const lessons = data?.lessons ?? [];
      setLessonCount(lessons.length);
      setReportText(buildLessonReport(participant.participantName, lessons));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate lesson report",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reportText);
      toast.success(`Copied report for ${participant.participantName}.`);
    } catch {
      toast.error("Failed to copy lesson report");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setLimitInput("5");
          setReportText("");
          setLessonCount(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate lesson report</DialogTitle>
          <DialogDescription>
            Choose how many of the latest completed lessons to include for {participant.participantName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`lesson-report-limit-${participant.participantId}`}>
              Number of lessons
            </Label>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {[4, 5, 8, 10, 12].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLimitInput(String(preset))}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    limitInput === String(preset)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-muted/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Last {preset}
                </button>
              ))}
            </div>
            <Input
              id={`lesson-report-limit-${participant.participantId}`}
              type="number"
              inputMode="numeric"
              min="1"
              max="50"
              step="1"
              value={limitInput}
              onChange={(event) => setLimitInput(event.target.value)}
            />
          </div>

          {reportText ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`lesson-report-output-${participant.participantId}`}>
                  Report
                </Label>
                <span className="text-xs text-muted-foreground">
                  {lessonCount === 0
                    ? "No completed lessons found"
                    : `Showing ${lessonCount} latest completed lesson${lessonCount === 1 ? "" : "s"}`}
                </span>
              </div>
              <Textarea
                id={`lesson-report-output-${participant.participantId}`}
                value={reportText}
                readOnly
                rows={Math.max(6, Math.min((lessonCount ?? 0) + 3, 12))}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {reportText ? (
            <Button type="button" variant="outline" onClick={handleCopy}>
              Copy Report
            </Button>
          ) : null}
          <Button type="button" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : reportText ? (
              "Regenerate"
            ) : (
              "Generate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleArchiveStudentDialog({
  participant,
  isArchived,
}: {
  participant: LessonBalanceSummaryItem;
  isArchived: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggle() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: participant.participantId,
          action: isArchived ? "restore" : "archive",
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update archive status");
      }

      toast.success(
        isArchived
          ? `Restored ${participant.participantName} to active students.`
          : `Moved ${participant.participantName} to archive.`,
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update archive status",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isArchived ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restore
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={`Archive ${participant.participantName}`}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Archive className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isArchived ? "Restore student" : "Archive student"}
          </DialogTitle>
          <DialogDescription>
            {isArchived
              ? `Restore ${participant.participantName} back to active students list, schedule, and classroom.`
              : `Archive ${participant.participantName}? They will be hidden from your active schedule and classroom, but all balance history, recorded payments, and completed lessons are permanently preserved in the Archived Students section.`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isArchived ? "default" : "destructive"}
            onClick={handleToggle}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isArchived ? "Restoring..." : "Archiving..."}
              </>
            ) : isArchived ? (
              "Restore to Active"
            ) : (
              "Archive Student"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentBalanceCard({
  summary,
  canManage,
  isArchived,
}: {
  summary: LessonBalanceSummaryItem;
  canManage: boolean;
  isArchived: boolean;
}) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "payments" | "lessons"
  >("all");

  const isNegativeBalance =
    summary.balanceCents < 0 ||
    (summary.lessonsLeft !== null && summary.lessonsLeft < 0);
  const isLowBalance =
    !isNegativeBalance &&
    summary.lessonsLeft !== null &&
    summary.lessonsLeft <= 1;

  const filteredHistory = summary.historyEntries.filter((entry) => {
    if (historyFilter === "payments") {
      return entry.type === "payment" || entry.type === "deduction";
    }
    if (historyFilter === "lessons") {
      return entry.type === "lesson";
    }
    return true;
  });

  const visibleHistory = isHistoryExpanded
    ? filteredHistory
    : filteredHistory.slice(0, 3);

  const priceTileContent = (
    <div
      className={cn(
        "group relative rounded-lg border bg-muted/30 p-3 text-left transition-colors",
        canManage &&
          "cursor-pointer hover:border-primary/40 hover:bg-muted/50",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Lesson Price
        </p>
        {canManage ? (
          <Pencil className="h-3 w-3 text-muted-foreground opacity-60 transition-opacity group-hover:text-foreground group-hover:opacity-100" />
        ) : null}
      </div>
      <p className="mt-1 text-lg font-semibold">
        {formatLessonCurrency(summary.lessonPriceCents)}
      </p>
    </div>
  );

  return (
    <Card
      className={cn(
        "flex flex-col justify-between",
        isArchived &&
          "border-dashed opacity-85 transition-opacity hover:opacity-100",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">
                {summary.participantName}
              </CardTitle>
              {isArchived ? (
                <Badge variant="outline" className="text-xs">
                  Archived
                </Badge>
              ) : isNegativeBalance ? (
                <Badge
                  variant="outline"
                  className="border-red-500/30 bg-red-500/10 text-[11px] text-red-400"
                >
                  Payment due
                </Badge>
              ) : isLowBalance ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-400"
                >
                  Low balance
                </Badge>
              ) : summary.lessonsLeft !== null && summary.lessonsLeft >= 2 ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-400"
                >
                  Covered
                </Badge>
              ) : null}
            </div>
            <CardDescription className="text-xs">
              {summary.participantLabel}
            </CardDescription>
          </div>

          {canManage ? (
            <ToggleArchiveStudentDialog
              participant={summary}
              isArchived={isArchived}
            />
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between space-y-3.5">
        <div className="space-y-3.5">
          <div className="grid grid-cols-3 gap-2.5">
            <div
              className={cn(
                "rounded-lg border p-3",
                summary.balanceCents < 0
                  ? "border-red-500/30 bg-red-500/10"
                  : summary.balanceCents > 0
                    ? "border-emerald-500/25 bg-emerald-500/5"
                    : "bg-muted/30",
              )}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Balance
              </p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold",
                  summary.balanceCents < 0 && "text-red-400",
                  summary.balanceCents > 0 && "text-emerald-400",
                )}
              >
                {formatLessonCurrency(summary.balanceCents)}
              </p>
            </div>

            {canManage ? (
              <UpdateLessonPriceDialog
                participant={summary}
                trigger={priceTileContent}
              />
            ) : (
              priceTileContent
            )}

            <div
              className={cn(
                "rounded-lg border p-3",
                summary.lessonsLeft !== null && summary.lessonsLeft < 0
                  ? "border-red-500/30 bg-red-500/10"
                  : summary.lessonsLeft !== null && summary.lessonsLeft <= 1
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "bg-muted/30",
              )}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Lessons Left
              </p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold",
                  summary.lessonsLeft !== null &&
                    summary.lessonsLeft < 0 &&
                    "text-red-400",
                  summary.lessonsLeft !== null &&
                    (summary.lessonsLeft === 0 || summary.lessonsLeft === 1) &&
                    "text-amber-400",
                )}
              >
                {summary.lessonsLeft ?? "-"}
              </p>
            </div>
          </div>

          {canManage ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Lifetime paid</span>
              <span
                className={cn(
                  "font-semibold",
                  summary.totalAmountPaidCents >= 0
                    ? "text-emerald-400"
                    : "text-red-400",
                )}
              >
                {formatLessonCurrency(summary.totalAmountPaidCents)}
              </span>
            </div>
          ) : null}

          <div className="rounded-lg border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Balance History ({filteredHistory.length})
              </p>
              {summary.historyEntries.length > 0 ? (
                <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5 text-[11px]">
                  {(
                    [
                      { key: "all", label: "All" },
                      { key: "payments", label: "Payments" },
                      { key: "lessons", label: "Lessons" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setHistoryFilter(tab.key)}
                      className={cn(
                        "rounded px-1.5 py-0.5 transition-colors",
                        historyFilter === tab.key
                          ? "bg-background font-medium text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {filteredHistory.length > 0 ? (
              <div className="mt-2.5 space-y-1.5">
                <div
                  className={cn(
                    "space-y-1.5",
                    isHistoryExpanded && "max-h-56 overflow-y-auto pr-1",
                  )}
                >
                  {visibleHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-medium">
                            {entry.description || entry.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {entry.type === "lesson"
                            ? `Lesson · ${formatAppDate(entry.occurredAt)}`
                            : `${entry.label} · ${formatAppDateTime(entry.occurredAt)}`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-semibold tabular-nums",
                          entry.amountCents >= 0
                            ? "text-emerald-400"
                            : "text-red-400",
                        )}
                      >
                        {entry.amountCents > 0 ? "+" : ""}
                        {formatLessonCurrency(entry.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>

                {filteredHistory.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setIsHistoryExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-center gap-1 pt-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span>
                      {isHistoryExpanded
                        ? "Show less"
                        : `View all ${filteredHistory.length} records`}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isHistoryExpanded && "rotate-180",
                      )}
                    />
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <PiggyBank className="h-4 w-4" />
                No balance records in this view.
              </div>
            )}
          </div>
        </div>

        {canManage ? (
          <div className="flex items-center gap-2 border-t pt-3">
            <TopUpBalanceDialog participant={summary} />
            <TopUpBalanceDialog participant={summary} direction="debit" />
            <GenerateLessonReportDialog participant={summary} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function LessonBalanceManager({
  summaries,
  canManage = false,
}: LessonBalanceManagerProps) {
  const [showArchived, setShowArchived] = useState(false);

  const activeSummaries = summaries.filter((s) => !s.archivedAt);
  const archivedSummaries = summaries.filter((s) => Boolean(s.archivedAt));

  return (
    <div className="space-y-8">
      {activeSummaries.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {activeSummaries.map((summary) => (
            <StudentBalanceCard
              key={summary.participantId}
              summary={summary}
              canManage={canManage}
              isArchived={false}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No active students. You can restore an archived student below or
            connect a new student.
          </CardContent>
        </Card>
      )}

      {archivedSummaries.length > 0 ? (
        <div className="pt-6 border-t space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">
                Archived Students ({archivedSummaries.length})
              </h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowArchived((prev) => !prev)}
            >
              {showArchived ? "Hide Archived" : "Show Archived"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Inactive students hidden from your active schedule and classroom list. Their balances, lesson prices, and payment histories remain preserved.
          </p>

          {showArchived ? (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {archivedSummaries.map((summary) => (
                <StudentBalanceCard
                  key={summary.participantId}
                  summary={summary}
                  canManage={canManage}
                  isArchived={true}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
