"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Captions,
  CheckCheck,
  FileText,
  Globe2,
  Loader2,
  ScanText,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { extractParsedStudentActiveVocabularyTermsFromClassroomTranscriptSegments } from "@/lib/classroom-transcripts";
import { cn } from "@/lib/utils";

const APP_LANGUAGE_LOCALES = {
  en: "en-GB",
  uk: "uk-UA",
} as const;

export interface ClassroomTranscriptResult {
  id: string;
  recordingId: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
  languageCode: string | null;
  diarizationStatus: string;
  reviewStatus: string;
  fullText: string | null;
  errorMessage: string | null;
  activeEvidenceSyncedAt: string | null;
  segments: Array<{
    speakerRole: "tutor" | "student" | "unknown" | "system";
    content: string;
  }>;
}

interface ClassroomTranscriptResultsCardProps {
  appLanguage: "en" | "uk";
  connectionId: string;
  transcripts: ClassroomTranscriptResult[];
  className?: string;
}

function formatTranscriptDateTime(value: string, appLanguage: "en" | "uk") {
  return new Intl.DateTimeFormat(APP_LANGUAGE_LOCALES[appLanguage], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getDiarizationLabel(status: string, appLanguage: "en" | "uk") {
  switch (status) {
    case "ready":
      return appLanguage === "uk" ? "Готово" : "Ready";
    case "processing":
      return appLanguage === "uk" ? "Обробка" : "Processing";
    case "failed":
      return appLanguage === "uk" ? "Помилка" : "Failed";
    default:
      return appLanguage === "uk" ? "Чернетка" : "Draft";
  }
}

function getReviewLabel(status: string, appLanguage: "en" | "uk") {
  switch (status) {
    case "reviewed":
      return appLanguage === "uk" ? "Перевірено" : "Reviewed";
    case "pending":
      return appLanguage === "uk" ? "Очікує перевірки" : "Pending review";
    default:
      return appLanguage === "uk" ? "Не перевірено" : "Unreviewed";
  }
}

function getBadgeVariant(status: string) {
  switch (status) {
    case "ready":
    case "reviewed":
      return "secondary" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function getPreviewText(fullText: string | null) {
  if (!fullText) {
    return null;
  }

  const normalized = fullText.replace(/\s+/g, " ").trim();

  if (normalized.length <= 220) {
    return normalized;
  }

  return `${normalized.slice(0, 217).trimEnd()}...`;
}

function getWordCount(fullText: string | null) {
  if (!fullText) {
    return 0;
  }

  return fullText.trim().split(/\s+/).filter(Boolean).length;
}

function TranscriptReviewDialog({
  appLanguage,
  connectionId,
  transcript,
}: {
  appLanguage: "en" | "uk";
  connectionId: string;
  transcript: ClassroomTranscriptResult;
}) {
  const router = useRouter();
  const [parsedTerms, setParsedTerms] = useState<string[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [isDeletingTranscript, setIsDeletingTranscript] = useState(false);

  const canApprove =
    !transcript.activeEvidenceSyncedAt && selectedTerms.length > 0;
  const parsedTermsSet = useMemo(() => new Set(selectedTerms), [selectedTerms]);

  function handleParseTerms() {
    const nextTerms =
      extractParsedStudentActiveVocabularyTermsFromClassroomTranscriptSegments(
        transcript.segments,
      );

    if (nextTerms.length === 0) {
      toast.error(
        appLanguage === "uk"
          ? "У студентських репліках не знайдено слів для active vocab"
          : "No student terms were found for active vocabulary",
      );
      return;
    }

    setParsedTerms(nextTerms);
    setSelectedTerms(nextTerms);
  }

  function handleToggleTerm(term: string, checked: boolean) {
    setSelectedTerms((currentTerms) => {
      if (checked) {
        return currentTerms.includes(term)
          ? currentTerms
          : [...currentTerms, term];
      }

      return currentTerms.filter((currentTerm) => currentTerm !== term);
    });
  }

  function handleRemoveTerm(term: string) {
    setParsedTerms((currentTerms) =>
      currentTerms.filter((currentTerm) => currentTerm !== term),
    );
    setSelectedTerms((currentTerms) =>
      currentTerms.filter((currentTerm) => currentTerm !== term),
    );
  }

  async function submitApproval() {
    if (!canApprove) {
      return;
    }

    setIsApproving(true);

    try {
      const response = await fetch(
        `/api/classroom/${connectionId}/transcripts/${transcript.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ approvedTerms: selectedTerms }),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        activeEvidence?: { importedCount: number };
      } | null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            (appLanguage === "uk"
              ? "Не вдалося підтвердити слова"
              : "Failed to approve transcript terms"),
        );
      }

      toast.success(
        appLanguage === "uk"
          ? `Підтверджено ${data?.activeEvidence?.importedCount ?? selectedTerms.length} слів для active vocab`
          : `Approved ${data?.activeEvidence?.importedCount ?? selectedTerms.length} terms for active vocabulary`,
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : appLanguage === "uk"
            ? "Не вдалося підтвердити слова"
            : "Failed to approve transcript terms",
      );
    } finally {
      setIsApproving(false);
    }
  }

  async function handleDeleteTranscript() {
    setIsDeletingTranscript(true);

    try {
      const response = await fetch(
        `/api/classroom/${connectionId}/transcripts/${transcript.id}`,
        {
          method: "DELETE",
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            (appLanguage === "uk"
              ? "Не вдалося видалити транскрипт"
              : "Failed to delete transcript"),
        );
      }

      toast.success(
        appLanguage === "uk" ? "Транскрипт видалено" : "Transcript deleted",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : appLanguage === "uk"
            ? "Не вдалося видалити транскрипт"
            : "Failed to delete transcript",
      );
    } finally {
      setIsDeletingTranscript(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          {appLanguage === "uk" ? "Відкрити транскрипт" : "Open transcript"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {appLanguage === "uk"
              ? "Транскрипт classroom-сесії"
              : "Classroom session transcript"}
          </DialogTitle>
          <DialogDescription>
            {formatTranscriptDateTime(transcript.recordedAt, appLanguage)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={getBadgeVariant(transcript.diarizationStatus)}>
            {getDiarizationLabel(transcript.diarizationStatus, appLanguage)}
          </Badge>
          <Badge variant={getBadgeVariant(transcript.reviewStatus)}>
            {getReviewLabel(transcript.reviewStatus, appLanguage)}
          </Badge>
          <Badge
            variant={
              transcript.activeEvidenceSyncedAt ? "secondary" : "outline"
            }
          >
            {transcript.activeEvidenceSyncedAt
              ? appLanguage === "uk"
                ? "Активний словник синхронізовано"
                : "Active vocabulary synced"
              : appLanguage === "uk"
                ? "Очікує підтвердження"
                : "Awaiting tutor approval"}
          </Badge>
        </div>

        <div
          className={cn(
            "max-h-[36vh] overflow-y-auto rounded-2xl border bg-muted/20 p-4 text-sm leading-6",
            "whitespace-pre-wrap text-foreground",
          )}
        >
          {transcript.fullText}
        </div>

        <div className="rounded-2xl border bg-background/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                {appLanguage === "uk"
                  ? "Підібрані слова для active vocab"
                  : "Parsed terms for active vocabulary"}
              </p>
              <p className="text-xs text-muted-foreground">
                {appLanguage === "uk"
                  ? "Parse відбувається тільки зі студентських реплік, з дедуплікацією та сортуванням за абеткою."
                  : "Parsing uses only student utterances, then deduplicates and sorts alphabetically."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleParseTerms}
              disabled={Boolean(transcript.activeEvidenceSyncedAt)}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              {appLanguage === "uk" ? "Parse" : "Parse"}
            </Button>
          </div>

          {parsedTerms.length > 0 ? (
            <div className="mt-4 max-h-[28vh] space-y-2 overflow-y-auto pr-1">
              {parsedTerms.map((term) => {
                const isChecked = parsedTermsSet.has(term);

                return (
                  <div
                    key={term}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-2"
                  >
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(value) =>
                          handleToggleTerm(term, value === true)
                        }
                        disabled={Boolean(transcript.activeEvidenceSyncedAt)}
                      />
                      <span className="truncate text-sm text-foreground">
                        {term}
                      </span>
                    </label>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveTerm(term)}
                      disabled={Boolean(transcript.activeEvidenceSyncedAt)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                      <span className="sr-only">
                        {appLanguage === "uk"
                          ? `Видалити ${term}`
                          : `Remove ${term}`}
                      </span>
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {transcript.activeEvidenceSyncedAt
                ? appLanguage === "uk"
                  ? "Цей транскрипт уже підтверджено для active vocab."
                  : "This transcript has already been approved for active vocabulary."
                : appLanguage === "uk"
                  ? "Натисніть Parse, щоб переглянути та відредагувати список слів перед підтвердженням."
                  : "Click Parse to review and edit the word list before approval."}
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDeleteTranscript()}
            disabled={isDeletingTranscript || isApproving}
          >
            {isDeletingTranscript ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {appLanguage === "uk" ? "Видалити транскрипт" : "Delete transcript"}
          </Button>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => void submitApproval()}
              disabled={!canApprove || isApproving || isDeletingTranscript}
            >
              {isApproving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="mr-2 h-4 w-4" />
              )}
              {appLanguage === "uk" ? "Підтвердити" : "Approve"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClassroomTranscriptResultsCard({
  appLanguage,
  connectionId,
  transcripts,
  className,
}: ClassroomTranscriptResultsCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Captions className="h-5 w-5 text-primary" />
          {appLanguage === "uk"
            ? "Результати транскрипції"
            : "Transcript Results"}
        </CardTitle>
        <CardDescription>
          {appLanguage === "uk"
            ? "Переглядайте збережені classroom-транскрипти після обробки OGG-записів у Gemini."
            : "Inspect saved classroom transcripts after OGG recordings are processed through Gemini."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {transcripts.length === 0 ? (
          <p className="text-muted-foreground">
            {appLanguage === "uk"
              ? "Готові транскрипти з’являться тут після обробки збереженого classroom-запису."
              : "Completed transcripts will appear here after a saved classroom recording is processed."}
          </p>
        ) : (
          transcripts.map((transcript) => {
            const previewText = getPreviewText(transcript.fullText);
            const wordCount = getWordCount(transcript.fullText);

            return (
              <div
                key={transcript.id}
                className="rounded-2xl border bg-muted/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {formatTranscriptDateTime(
                        transcript.recordedAt,
                        appLanguage,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {appLanguage === "uk"
                        ? `Оновлено ${formatTranscriptDateTime(transcript.updatedAt, appLanguage)}`
                        : `Updated ${formatTranscriptDateTime(transcript.updatedAt, appLanguage)}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={getBadgeVariant(transcript.diarizationStatus)}
                    >
                      <ScanText className="mr-1.5 h-3.5 w-3.5" />
                      {getDiarizationLabel(
                        transcript.diarizationStatus,
                        appLanguage,
                      )}
                    </Badge>
                    <Badge variant={getBadgeVariant(transcript.reviewStatus)}>
                      {getReviewLabel(transcript.reviewStatus, appLanguage)}
                    </Badge>
                    <Badge
                      variant={
                        transcript.activeEvidenceSyncedAt
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {transcript.activeEvidenceSyncedAt
                        ? appLanguage === "uk"
                          ? "Синхронізовано"
                          : "Evidence synced"
                        : appLanguage === "uk"
                          ? "Без синхронізації"
                          : "Not synced"}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Globe2 className="h-3.5 w-3.5" />
                    {transcript.languageCode?.toUpperCase() ??
                      (appLanguage === "uk" ? "Авто" : "Auto")}
                  </span>
                  {wordCount > 0 ? (
                    <span>
                      {wordCount.toLocaleString()}{" "}
                      {appLanguage === "uk" ? "слів" : "words"}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 rounded-2xl border bg-background/80 p-3 text-sm">
                  {previewText ? (
                    <p className="text-muted-foreground">{previewText}</p>
                  ) : transcript.errorMessage ? (
                    <p className="text-destructive">
                      {transcript.errorMessage}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      {appLanguage === "uk"
                        ? "Повний текст ще не збережено для цього запису."
                        : "The full transcript text has not been saved for this recording yet."}
                    </p>
                  )}
                </div>

                {transcript.fullText ? (
                  <div className="mt-3 flex justify-end">
                    <TranscriptReviewDialog
                      appLanguage={appLanguage}
                      connectionId={connectionId}
                      transcript={transcript}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
