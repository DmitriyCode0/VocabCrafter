"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatAppDateTime } from "@/lib/dates";

interface ManualTranscriptRecording {
  id: string;
  createdAt: string;
  status: string;
  durationSeconds: number | null;
  activeEvidenceSyncedAt: string | null;
}

interface ManualTranscriptSubmitCardProps {
  recordings: ManualTranscriptRecording[];
  transcriptEndpoint: string;
  transcribeEndpoint: string;
  contextLabel?: string;
  sourceLabelFallback?: string;
  cardDescription?: string;
  emptyStateHint?: string;
}

interface TranscriptSegmentPayload {
  speakerRole: "student" | "tutor" | "unknown" | "system";
  content: string;
}

interface ManualTranscriptResponse {
  activeEvidence?: {
    importedCount?: number;
    createdCount?: number;
    updatedCount?: number;
  };
  sourceLabel?: string;
  error?: string;
}

const SPEAKER_PREFIXES = new Map<
  string,
  TranscriptSegmentPayload["speakerRole"]
>([
  ["student", "student"],
  ["s", "student"],
  ["tutor", "tutor"],
  ["t", "tutor"],
  ["unknown", "unknown"],
  ["u", "unknown"],
  ["system", "system"],
]);

function getRecordingStatusLabel(status: string) {
  switch (status) {
    case "ready":
      return "ready";
    case "processing":
      return "processing";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return status || "idle";
  }
}

function getDefaultRecordingId(recordings: ManualTranscriptRecording[]) {
  return recordings[0]?.id ?? "";
}

function parseTranscriptSegments(value: string) {
  const segments: TranscriptSegmentPayload[] = [];

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const prefixedLineMatch = line.match(/^([a-z]+)\s*:\s*(.+)$/i);

    if (prefixedLineMatch) {
      const speakerPrefix = prefixedLineMatch[1].toLowerCase();
      const mappedSpeakerRole = SPEAKER_PREFIXES.get(speakerPrefix);
      const content = prefixedLineMatch[2].trim();

      if (mappedSpeakerRole && content) {
        segments.push({ speakerRole: mappedSpeakerRole, content });
        continue;
      }
    }

    segments.push({ speakerRole: "student", content: line });
  }

  return segments;
}

function formatRecordingOption(recording: ManualTranscriptRecording) {
  const durationLabel =
    typeof recording.durationSeconds === "number"
      ? ` · ${recording.durationSeconds}s`
      : "";

  return `${formatAppDateTime(recording.createdAt)} · ${getRecordingStatusLabel(recording.status)}${durationLabel}`;
}

export function ManualTranscriptSubmitCard({
  recordings,
  transcriptEndpoint,
  transcribeEndpoint,
  contextLabel = "lesson",
  sourceLabelFallback,
  cardDescription,
  emptyStateHint,
}: ManualTranscriptSubmitCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedRecordingId, setSelectedRecordingId] = useState(
    getDefaultRecordingId(recordings),
  );
  const [languageCode, setLanguageCode] = useState("en");
  const [transcriptText, setTranscriptText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoTranscribing, setIsAutoTranscribing] = useState(false);

  const eligibleRecordings = useMemo(
    () =>
      recordings.filter(
        (recording) =>
          recording.status !== "recording" && !recording.activeEvidenceSyncedAt,
      ),
    [recordings],
  );
  const selectedRecording = eligibleRecordings.find(
    (recording) => recording.id === selectedRecordingId,
  );
  const hasEligibleRecording = eligibleRecordings.length > 0;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setSelectedRecordingId(getDefaultRecordingId(eligibleRecordings));
      setLanguageCode("en");
      setTranscriptText("");
      setIsAutoTranscribing(false);
    }
  }

  function showSuccessToast(data: ManualTranscriptResponse, prefix: string) {
    const importedCount = data?.activeEvidence?.importedCount ?? 0;
    const createdCount = data?.activeEvidence?.createdCount ?? 0;
    const updatedCount = data?.activeEvidence?.updatedCount ?? 0;
    const sourceLabel =
      data?.sourceLabel || sourceLabelFallback || `the selected ${contextLabel}`;

    toast.success(
      `${prefix} ${sourceLabel}. Active evidence imported ${importedCount} words, with ${createdCount} new and ${updatedCount} updated.`,
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRecordingId) {
      toast.error(`Choose a ${contextLabel} recording first`);
      return;
    }

    const segments = parseTranscriptSegments(transcriptText);

    if (segments.length === 0) {
      toast.error("Paste at least one transcript line");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(transcriptEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId: selectedRecordingId,
          languageCode: languageCode.trim() || undefined,
          diarizationStatus: "ready",
          reviewStatus: "reviewed",
          segments,
        }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as ManualTranscriptResponse | null;

      if (!response.ok) {
        throw new Error(
          data?.error || `Failed to save ${contextLabel} transcript`,
        );
      }

      showSuccessToast(data ?? {}, "Saved transcript for");
      handleOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to save ${contextLabel} transcript`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAutoTranscribe() {
    if (!selectedRecordingId) {
      toast.error(`Choose a ${contextLabel} recording first`);
      return;
    }

    setIsAutoTranscribing(true);

    try {
      const response = await fetch(transcribeEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId: selectedRecordingId,
          languageCode: languageCode.trim() || undefined,
        }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as ManualTranscriptResponse | null;

      if (!response.ok) {
        throw new Error(
          data?.error || `Failed to transcribe ${contextLabel} recording`,
        );
      }

      showSuccessToast(data ?? {}, "Transcribed recording for");
      handleOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to transcribe ${contextLabel} recording`,
      );
    } finally {
      setIsAutoTranscribing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-primary" />
          Transcript Tools
        </CardTitle>
        <CardDescription>
          {cardDescription ||
            `Tutor-only tools for turning ${contextLabel} recordings into transcripts and active evidence.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Paste diarized lines like{" "}
          <span className="font-medium text-foreground">
            student: I went to the market
          </span>{" "}
          or
          <span className="font-medium text-foreground">
            {" "}
            tutor: Why did you go?
          </span>
          . Lines without a prefix are treated as student speech.
        </p>
        <p>
          You can either paste a reviewed transcript or ask Gemini to transcribe
          the selected recording. Only recordings that have not already synced
          active evidence are offered, so the same lesson is not double-counted.
        </p>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasEligibleRecording}
            >
              Open Transcript Tools
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Transcript Tools</DialogTitle>
              <DialogDescription>
                Save a reviewed transcript manually or generate one from the
                selected recording with Gemini.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="manual-transcript-recording">Recording</Label>
                <Select
                  value={selectedRecordingId}
                  onValueChange={setSelectedRecordingId}
                >
                  <SelectTrigger id="manual-transcript-recording">
                    <SelectValue placeholder="Choose a recording" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleRecordings.map((recording) => (
                      <SelectItem key={recording.id} value={recording.id}>
                        {formatRecordingOption(recording)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRecording ? (
                  <p className="text-xs text-muted-foreground">
                    Selected recording from{" "}
                    {formatAppDateTime(selectedRecording.createdAt)}.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-transcript-language">
                  Language code
                </Label>
                <Input
                  id="manual-transcript-language"
                  value={languageCode}
                  onChange={(event) => setLanguageCode(event.target.value)}
                  maxLength={16}
                  placeholder="en"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-transcript-text">Transcript lines</Label>
                <Textarea
                  id="manual-transcript-text"
                  value={transcriptText}
                  onChange={(event) => setTranscriptText(event.target.value)}
                  placeholder={
                    "student: I visited my grandmother yesterday\ntutor: What did you cook together?\nstudent: We made soup and bread"
                  }
                  className="min-h-64"
                />
                <p className="text-xs text-muted-foreground">
                  Each non-empty line becomes one segment. Prefix with student:,
                  tutor:, system:, or unknown: when needed.
                </p>
                <p className="text-xs text-muted-foreground">
                  AI transcription uses one AI call from the tutor account and
                  marks the transcript as pending review.
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting || isAutoTranscribing}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleAutoTranscribe()}
                  disabled={
                    isSubmitting ||
                    isAutoTranscribing ||
                    !hasEligibleRecording ||
                    !selectedRecordingId
                  }
                >
                  {isAutoTranscribing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Transcribing recording
                    </>
                  ) : (
                    "Transcribe with AI"
                  )}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting || isAutoTranscribing || !hasEligibleRecording
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving transcript
                    </>
                  ) : (
                    "Save transcript"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {!hasEligibleRecording ? (
          <p className="text-xs text-amber-600">
            {emptyStateHint ||
              `No eligible recording is available yet. Stop a recording first, or use a ${contextLabel} recording that has not already synced active evidence.`}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
