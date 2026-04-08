"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PiggyBank, Wallet } from "lucide-react";
import { toast } from "sonner";
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
  parseLessonCurrencyInput,
  type LessonBalanceSummaryItem,
} from "@/lib/lessons";

interface LessonBalanceManagerProps {
  summaries: LessonBalanceSummaryItem[];
  canManage?: boolean;
}

function UpdateLessonPriceDialog({
  participant,
}: {
  participant: LessonBalanceSummaryItem;
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

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update lesson price");
      }

      toast.success(`Updated lesson price for ${participant.participantName}.`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update lesson price",
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
          setPriceInput(formatLessonCurrencyInput(participant.lessonPriceCents));
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Set Lesson Price
        </Button>
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

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

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
        <Button type="button" size="sm" variant={isDebit ? "outline" : "default"}>
          {isDebit ? "Deduct Balance" : "Top Up Balance"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isDebit ? "Deduct balance" : "Top up balance"}</DialogTitle>
          <DialogDescription>
            {isDebit
              ? `Record a manual balance deduction for ${participant.participantName}.`
              : `Record a new balance top-up for ${participant.participantName}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`top-up-${participant.participantId}`}>Amount</Label>
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
            ) : (
              isDebit ? "Save Deduction" : "Save Top-up"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LessonBalanceManager({
  summaries,
  canManage = false,
}: LessonBalanceManagerProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {summaries.map((summary) => (
        <Card key={summary.participantId}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{summary.participantName}</CardTitle>
                <CardDescription>{summary.participantLabel}</CardDescription>
              </div>
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Balance
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatLessonCurrency(summary.balanceCents)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lesson Price
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatLessonCurrency(summary.lessonPriceCents)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lessons Left
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {summary.lessonsLeft ?? "-"}
                </p>
              </div>
            </div>

            {canManage ? (
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total Amount Paid
                </p>
                <p
                  className={`mt-1 text-sm font-medium ${
                    summary.totalAmountPaidCents >= 0
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {formatLessonCurrency(summary.totalAmountPaidCents)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Net amount paid across all top-ups and corrections.
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Balance History
                </p>
                <span className="text-xs text-muted-foreground">
                  {summary.historyEntries.length} change
                  {summary.historyEntries.length === 1 ? "" : "s"}
                </span>
              </div>

              {summary.historyEntries.length > 0 ? (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {summary.historyEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-md border border-border/70 bg-muted/20 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{entry.label}</p>
                          {entry.description ? (
                            <p className="text-xs text-muted-foreground">
                              {entry.description}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {entry.type === "lesson"
                              ? formatAppDate(entry.occurredAt)
                              : formatAppDateTime(entry.occurredAt)}
                          </p>
                        </div>
                        <p
                          className={`text-sm font-medium ${
                            entry.amountCents >= 0
                              ? "text-green-700 dark:text-green-400"
                              : "text-red-700 dark:text-red-400"
                          }`}
                        >
                          {formatLessonCurrency(entry.amountCents)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <PiggyBank className="h-4 w-4" />
                  No balance changes yet.
                </div>
              )}
            </div>

            {canManage ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <UpdateLessonPriceDialog participant={summary} />
                <TopUpBalanceDialog participant={summary} />
                <TopUpBalanceDialog participant={summary} direction="debit" />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}