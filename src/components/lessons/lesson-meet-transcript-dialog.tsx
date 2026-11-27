"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ClipboardPaste,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  BookOpen,
  GraduationCap,
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
import type {
  LessonMeetTranscriptView,
  TranscriptLearningCandidateItem,
} from "@/lib/lesson-transcript-vocab-analyzer";
import type { LessonTranscriptSummary } from "@/lib/lessons";

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

interface EditableLearningSelection {
  checked: boolean;
  ukrainianTranslation: string;
  englishDefinition: string;
  partOfSpeech: string | null;
}

function buildInitialSelections(
  candidates: TranscriptLearningCandidateItem[],
): Record<string, EditableLearningSelection> {
  const next: Record<string, EditableLearningSelection> = {};
  for (const item of candidates) {
    next[item.normalizedTerm] = {
      checked: item.status === "pending" && item.confidence === "high",
      ukrainianTranslation: item.ukrainianTranslation ?? "",
      englishDefinition: item.englishDefinition ?? "",
      partOfSpeech: item.partOfSpeech ?? null,
    };
  }
  return next;
}

function buildSummaryFromTranscript(
  t: LessonMeetTranscriptView,
): LessonTranscriptSummary {
  const pendingLearningCount = t.learningCandidates.filter(
    (c) => c.status === "pending",
  ).length;
  return {
    analysisStatus: t.analysisStatus,
    activeAppliedCount: t.activeAppliedCount,
    passiveAppliedCount: t.passiveAppliedCount,
    learningApprovedCount: t.learningApprovedCount,
    pendingLearningCount,
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
  const [approving, setApproving] = useState(false);
  const [transcript, setTranscript] =
    useState<LessonMeetTranscriptView | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const [activeTab, setActiveTab] = useState<string>("learning");
  const [selections, setSelections] = useState<
    Record<string, EditableLearningSelection>
  >({});

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
          setSelections(buildInitialSelections(loaded.learningCandidates));
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
      setSelections(buildInitialSelections(synced.learningCandidates));
      setActiveTab("learning");
      onSummaryUpdated?.(lessonId, buildSummaryFromTranscript(synced));
      toast.success(
        `Applied ${synced.activeAppliedCount} Active and ${synced.passiveAppliedCount} Passive words automatically.`,
      );
    } catch {
      setErrorMessage("Network error while syncing Meet transcript.");
      toast.error("Network error while syncing Meet transcript.");
    } finally {
      setSyncingMode(null);
    }
  }

  async function handleApproveSelectedLearning() {
    if (!transcript) return;
    const pendingCandidates = transcript.learningCandidates.filter(
      (c) => c.status === "pending",
    );
    const itemsToApprove = pendingCandidates
      .filter((c) => selections[c.normalizedTerm]?.checked)
      .map((c) => ({
        term: c.term,
        ukrainianTranslation:
          selections[c.normalizedTerm]?.ukrainianTranslation ??
          c.ukrainianTranslation,
        englishDefinition:
          selections[c.normalizedTerm]?.englishDefinition ??
          c.englishDefinition,
        partOfSpeech:
          selections[c.normalizedTerm]?.partOfSpeech ?? c.partOfSpeech,
      }));

    setApproving(true);
    try {
      const res = await fetch(
        `/api/lessons/${lessonId}/meet-transcript/approve-learning`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: itemsToApprove }),
        },
      );

      const data = (await res.json()) as {
        transcript?: LessonMeetTranscriptView;
        addedCount?: number;
        skippedExistingCount?: number;
        error?: string;
      };

      if (!res.ok || !data.transcript) {
        toast.error(data.error ?? "Failed to approve learning words.");
        return;
      }

      setTranscript(data.transcript);
      setSelections(buildInitialSelections(data.transcript.learningCandidates));
      onSummaryUpdated?.(lessonId, buildSummaryFromTranscript(data.transcript));

      toast.success(
        itemsToApprove.length > 0
          ? `Added ${data.addedCount ?? itemsToApprove.length} word(s) to ${studentName}'s Learning deck.`
          : "Dismissed remaining suggestions.",
      );
    } catch {
      toast.error("Network error while saving Learning words.");
    } finally {
      setApproving(false);
    }
  }

  const pendingCandidates =
    transcript?.learningCandidates.filter((c) => c.status === "pending") ?? [];
  const selectedLearningCount = pendingCandidates.filter(
    (c) => selections[c.normalizedTerm]?.checked,
  ).length;
  const effectiveSummary = transcript
    ? buildSummaryFromTranscript(transcript)
    : summary ?? null;
  const hasPendingBadge = (effectiveSummary?.pendingLearningCount ?? 0) > 0;

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
              {effectiveSummary?.pendingLearningCount}
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
              student first to sync vocabulary into Active, Passive, and
              Learning decks.
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
                Automatic Active &amp; Passive Sync
              </div>
              <div>
                Active and Passive vocabulary update silently. Only Learning
                candidates require your approval before entering SRS.
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
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                  <div className="text-xs text-muted-foreground">
                    Auto-Applied Active
                  </div>
                  <div className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {transcript.activeAppliedCount}
                  </div>
                </div>
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5">
                  <div className="text-xs text-muted-foreground">
                    Auto-Applied Passive
                  </div>
                  <div className="text-xl font-bold tabular-nums text-sky-700 dark:text-sky-300">
                    {transcript.passiveAppliedCount}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                  <div className="text-xs text-muted-foreground">
                    Learning Review
                  </div>
                  <div className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                    {pendingCandidates.length} pending
                    {transcript.learningApprovedCount > 0
                      ? ` · ${transcript.learningApprovedCount} added`
                      : ""}
                  </div>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="learning">
                    Learning ({transcript.learningCandidates.length})
                  </TabsTrigger>
                  <TabsTrigger value="active">
                    Active ({transcript.autoAppliedActive.length})
                  </TabsTrigger>
                  <TabsTrigger value="passive">
                    Passive ({transcript.autoAppliedPassive.length})
                  </TabsTrigger>
                  <TabsTrigger value="paste">Paste / Replace</TabsTrigger>
                </TabsList>

                <TabsContent value="learning" className="mt-3 space-y-3">
                  {transcript.learningCandidates.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No new Learning words were flagged in this lesson.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {transcript.learningCandidates.map((item) => {
                          const state = selections[item.normalizedTerm];
                          const isPending = item.status === "pending";
                          return (
                            <div
                              key={item.normalizedTerm}
                              className="rounded-lg border border-border/70 bg-card p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                  {isPending ? (
                                    <Checkbox
                                      checked={Boolean(state?.checked)}
                                      onCheckedChange={(checked) =>
                                        setSelections((prev) => ({
                                          ...prev,
                                          [item.normalizedTerm]: {
                                            ...prev[item.normalizedTerm],
                                            checked: checked === true,
                                          },
                                        }))
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
                                    <p className="text-xs text-muted-foreground">
                                      {item.reasonUk}
                                    </p>
                                    {item.exampleSentence ? (
                                      <p className="text-xs italic text-muted-foreground">
                                        “{item.exampleSentence}”
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                <Badge
                                  variant={
                                    item.status === "approved"
                                      ? "default"
                                      : item.status === "dismissed"
                                        ? "outline"
                                        : "secondary"
                                  }
                                >
                                  {item.status}
                                </Badge>
                              </div>

                              <div className="mt-2.5 pl-6">
                                <Input
                                  value={
                                    state?.ukrainianTranslation ??
                                    item.ukrainianTranslation ??
                                    ""
                                  }
                                  disabled={!isPending}
                                  placeholder="Ukrainian translation..."
                                  onChange={(e) =>
                                    setSelections((prev) => ({
                                      ...prev,
                                      [item.normalizedTerm]: {
                                        ...prev[item.normalizedTerm],
                                        ukrainianTranslation: e.target.value,
                                      },
                                    }))
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {pendingCandidates.length > 0 ? (
                        <div className="flex items-center justify-between gap-2 border-t pt-3">
                          <span className="text-xs text-muted-foreground">
                            {selectedLearningCount} of {pendingCandidates.length}{" "}
                            selected to add to SRS Learning deck
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            disabled={approving}
                            onClick={handleApproveSelectedLearning}
                          >
                            {approving ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <GraduationCap className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            {selectedLearningCount > 0
                              ? `Add ${selectedLearningCount} to Learning`
                              : "Dismiss All Pending"}
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="active" className="mt-3 space-y-2">
                  {transcript.autoAppliedActive.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No notable Active vocabulary items extracted yet.
                    </div>
                  ) : (
                    transcript.autoAppliedActive.map((item) => (
                      <div
                        key={item.normalizedTerm}
                        className="rounded-lg border border-border/70 bg-card p-2.5 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{item.term}</span>
                            {item.ukrainianTranslation ? (
                              <span className="text-xs text-muted-foreground">
                                — {item.ukrainianTranslation}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {item.graduatedFromLearning ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">
                                Used from Learning
                              </Badge>
                            ) : null}
                            <Badge variant="outline">Active applied</Badge>
                          </div>
                        </div>
                        {item.evidenceQuote ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            “{item.evidenceQuote}”
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="passive" className="mt-3 space-y-2">
                  {transcript.autoAppliedPassive.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No additional Passive vocabulary items recorded.
                    </div>
                  ) : (
                    transcript.autoAppliedPassive.map((item) => (
                      <div
                        key={item.normalizedTerm}
                        className="rounded-lg border border-border/70 bg-card p-2.5 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{item.term}</span>
                            {item.ukrainianTranslation ? (
                              <span className="text-xs text-muted-foreground">
                                — {item.ukrainianTranslation}
                              </span>
                            ) : null}
                          </div>
                          <Badge variant="outline">
                            <BookOpen className="mr-1 h-3 w-3" />
                            Passive applied
                          </Badge>
                        </div>
                        {item.contextQuote ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            “{item.contextQuote}”
                          </p>
                        ) : null}
                      </div>
                    ))
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
      </DialogContent>
    </Dialog>
  );
}
