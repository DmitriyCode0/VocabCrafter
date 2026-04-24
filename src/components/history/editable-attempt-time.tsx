"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AttemptTimeSaveResult {
  timeSpentSeconds: number;
}

function formatDurationInput(totalSeconds?: number | null) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds ?? 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseDurationInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(":");

  if (parts.length === 0 || parts.length > 3) {
    return null;
  }

  if (parts.some((part) => part.length === 0 || !/^\d+$/.test(part))) {
    return null;
  }

  const numericParts = parts.map((part) => Number(part));

  if (numericParts.some((part) => !Number.isFinite(part) || part < 0)) {
    return null;
  }

  if (numericParts.length === 1) {
    return numericParts[0];
  }

  if (numericParts.length === 2) {
    const [minutes, seconds] = numericParts;

    if (seconds >= 60) {
      return null;
    }

    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = numericParts;

  if (minutes >= 60 || seconds >= 60) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

interface EditableAttemptTimeProps {
  attemptId: string;
  initialTimeSpentSeconds?: number | null;
  onTimeSaved?: (result: AttemptTimeSaveResult) => void;
}

export function EditableAttemptTime({
  attemptId,
  initialTimeSpentSeconds = 0,
  onTimeSaved,
}: EditableAttemptTimeProps) {
  const router = useRouter();
  const [value, setValue] = useState(() =>
    formatDurationInput(initialTimeSpentSeconds),
  );
  const [isSaving, setIsSaving] = useState(false);
  const parsedSeconds = useMemo(() => parseDurationInput(value), [value]);

  async function handleSave() {
    if (parsedSeconds === null) {
      toast.error("Enter time as seconds, mm:ss, or h:mm:ss.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/tutor/attempts/${attemptId}/time`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeSpentSeconds: parsedSeconds }),
      });

      const data = (await response.json().catch(() => null)) as
        | { timeSpentSeconds?: number; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update app time");
      }

      const savedSeconds =
        typeof data?.timeSpentSeconds === "number"
          ? data.timeSpentSeconds
          : parsedSeconds;

      setValue(formatDurationInput(savedSeconds));
      onTimeSaved?.({ timeSpentSeconds: savedSeconds });

      toast.success("App time updated.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update app time",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock3 className="h-4 w-4 text-muted-foreground" />
            Logged App Time
          </div>
          <p className="text-xs text-muted-foreground">
            Update the saved app time using seconds, mm:ss, or h:mm:ss.
          </p>
        </div>
        <Badge variant="outline">
          {parsedSeconds === null ? "Invalid format" : formatDurationInput(parsedSeconds)}
        </Badge>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="bg-background sm:max-w-[180px]"
          aria-label="Logged app time"
          placeholder="0:00"
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || parsedSeconds === null}
        >
          {isSaving ? "Saving..." : "Save Time"}
        </Button>
      </div>
    </div>
  );
}