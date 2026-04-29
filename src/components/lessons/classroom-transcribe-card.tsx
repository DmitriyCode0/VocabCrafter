"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Captions, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAppDateTime } from "@/lib/dates";
import type { Role } from "@/types/roles";

interface ClassroomTranscribeRecording {
  id: string;
  createdAt: string;
  status: string;
  durationSeconds: number | null;
  hasStoredMedia: boolean;
}

interface ClassroomTranscribeCardProps {
  connectionId: string;
  role: Role;
  appLanguage: "en" | "uk";
  transcriptStatus: string;
  recordings: ClassroomTranscribeRecording[];
}

interface ClassroomTranscribeResponse {
  error?: string;
  transcript?: {
    id: string;
  };
}

function getTranscriptStatusLabel(status: string, appLanguage: "en" | "uk") {
  switch (status) {
    case "ready":
      return appLanguage === "uk" ? "Готово" : "Ready";
    case "processing":
      return appLanguage === "uk" ? "Обробляється" : "Processing";
    case "failed":
      return appLanguage === "uk" ? "Помилка" : "Failed";
    default:
      return appLanguage === "uk" ? "Без транскрипту" : "Idle";
  }
}

function getTranscriptBadgeVariant(status: string) {
  switch (status) {
    case "ready":
      return "secondary" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function formatRecordingOption(
  recording: ClassroomTranscribeRecording,
  appLanguage: "en" | "uk",
) {
  const durationLabel =
    typeof recording.durationSeconds === "number" &&
    recording.durationSeconds > 0
      ? appLanguage === "uk"
        ? ` · ${recording.durationSeconds} с`
        : ` · ${recording.durationSeconds}s`
      : "";

  return `${formatAppDateTime(recording.createdAt)}${durationLabel}`;
}

export function ClassroomTranscribeCard({
  connectionId,
  role,
  appLanguage,
  transcriptStatus,
  recordings,
}: ClassroomTranscribeCardProps) {
  const router = useRouter();
  const [selectedRecordingId, setSelectedRecordingId] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);

  const eligibleRecordings = useMemo(
    () =>
      recordings.filter(
        (recording) =>
          recording.hasStoredMedia &&
          recording.status !== "recording" &&
          recording.status !== "failed",
      ),
    [recordings],
  );

  useEffect(() => {
    if (
      !eligibleRecordings.some(
        (recording) => recording.id === selectedRecordingId,
      )
    ) {
      setSelectedRecordingId(eligibleRecordings[0]?.id ?? "");
    }
  }, [eligibleRecordings, selectedRecordingId]);

  async function handleTranscribe() {
    if (!selectedRecordingId) {
      toast.error(
        appLanguage === "uk"
          ? "Спочатку виберіть аудіозапис"
          : "Choose an audio recording first",
      );
      return;
    }

    setIsTranscribing(true);

    try {
      const response = await fetch(
        `/api/classroom/${connectionId}/transcribe-recording`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recordingId: selectedRecordingId,
            languageCode: languageCode.trim() || undefined,
          }),
        },
      );

      const data = (await response
        .json()
        .catch(() => null)) as ClassroomTranscribeResponse | null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            (appLanguage === "uk"
              ? "Не вдалося створити транскрипт"
              : "Failed to transcribe the recording"),
        );
      }

      toast.success(
        appLanguage === "uk"
          ? "Транскрипт створено. Перевірте терміни в Transcript Results перед підтвердженням."
          : "Transcript created. Review the terms in Transcript Results before approving them.",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : appLanguage === "uk"
            ? "Не вдалося створити транскрипт"
            : "Failed to transcribe the recording",
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  const selectedRecording = eligibleRecordings.find(
    (recording) => recording.id === selectedRecordingId,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Captions className="h-5 w-5 text-primary" />
              {appLanguage === "uk" ? "Транскрипт OGG" : "OGG Transcription"}
            </CardTitle>
            <CardDescription>
              {appLanguage === "uk"
                ? "Перетворіть збережений OGG-запис classroom на текст, потім підтвердьте потрібні слова у Transcript Results перед синхронізацією в active evidence."
                : "Turn a saved classroom OGG recording into text, then confirm the right words in Transcript Results before syncing them into active evidence."}
            </CardDescription>
          </div>
          <Badge variant={getTranscriptBadgeVariant(transcriptStatus)}>
            {appLanguage === "uk" ? "Статус" : "Status"}{" "}
            {getTranscriptStatusLabel(transcriptStatus, appLanguage)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>
          {appLanguage === "uk"
            ? "Транскрипція виконується на сервері після завантаження приватного запису з Supabase Storage. За потреби можна вказати код мови, інакше мова визначається автоматично. Після генерації перевірте та підтвердьте слова окремо."
            : "Transcription runs server-side after the private recording is fetched from Supabase Storage. You can provide a language code, or let the model infer it. Review and approve the extracted words separately afterwards."}
        </p>

        {role !== "tutor" ? (
          <p className="rounded-2xl border border-dashed bg-muted/20 px-4 py-3 text-sm">
            {appLanguage === "uk"
              ? "Лише викладач може запускати автоматичну транскрипцію classroom-записів."
              : "Only the tutor can start automatic classroom transcription."}
          </p>
        ) : eligibleRecordings.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/20 px-4 py-3 text-sm">
            {appLanguage === "uk"
              ? "Ще немає готового OGG-запису для транскрипції. Завершіть запис classroom, щоб він з’явився тут."
              : "There is no completed OGG recording ready for transcription yet. Stop a classroom recording first and it will appear here."}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="classroom-transcribe-recording">
                {appLanguage === "uk" ? "Аудіозапис" : "Recording"}
              </Label>
              <Select
                value={selectedRecordingId}
                onValueChange={setSelectedRecordingId}
              >
                <SelectTrigger
                  id="classroom-transcribe-recording"
                  className="w-full"
                >
                  <SelectValue
                    placeholder={
                      appLanguage === "uk"
                        ? "Виберіть аудіозапис"
                        : "Choose a recording"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {eligibleRecordings.map((recording) => (
                    <SelectItem key={recording.id} value={recording.id}>
                      {formatRecordingOption(recording, appLanguage)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRecording ? (
                <p className="text-xs text-muted-foreground">
                  {appLanguage === "uk"
                    ? `Вибрано запис від ${formatAppDateTime(selectedRecording.createdAt)}.`
                    : `Selected recording from ${formatAppDateTime(selectedRecording.createdAt)}.`}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="classroom-transcribe-language">
                {appLanguage === "uk"
                  ? "Код мови (необов’язково)"
                  : "Language code (optional)"}
              </Label>
              <Input
                id="classroom-transcribe-language"
                value={languageCode}
                onChange={(event) => setLanguageCode(event.target.value)}
                maxLength={16}
                placeholder={
                  appLanguage === "uk" ? "Наприклад, en" : "For example, en"
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => void handleTranscribe()}
                disabled={isTranscribing || !selectedRecordingId}
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {appLanguage === "uk"
                      ? "Створюємо транскрипт"
                      : "Transcribing"}
                  </>
                ) : appLanguage === "uk" ? (
                  "Перетворити на текст"
                ) : (
                  "Transcribe recording"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                {appLanguage === "uk"
                  ? "Маршрут використовує Gemini 2.5 Flash і зберігає сегменти як transcript із pending review."
                  : "This route uses Gemini 2.5 Flash and saves segmented transcript output with pending review."}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
