"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function formatHours(value: number) {
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours} h ${minutes} min`;
}

function formatInputValue(value: number) {
  return value === 0 ? "0" : String(value);
}

interface TutorTimeAdjustmentCardProps {
  studentId: string;
  initialTimeAdjustmentHours: number;
  currentTotalLearningHours: number;
}

export function TutorTimeAdjustmentCard({
  studentId,
  initialTimeAdjustmentHours,
  currentTotalLearningHours,
}: TutorTimeAdjustmentCardProps) {
  const router = useRouter();
  const [value, setValue] = useState(() =>
    formatInputValue(initialTimeAdjustmentHours),
  );
  const [isSaving, setIsSaving] = useState(false);

  const parsedValue = Number(value);
  const isValid = Number.isFinite(parsedValue);

  async function handleSave(nextValue: number) {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/tutor/students/${studentId}/time-logged`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeAdjustmentHours: nextValue }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update time logged");
      }

      setValue(formatInputValue(nextValue));
      toast.success("Time logged updated.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update time logged",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Adjust Time Logged</CardTitle>
        </div>
        <CardDescription>
          Add or subtract hours to correct the tracked total without changing saved lesson or quiz records.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Tutor adjustment</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              inputMode="decimal"
              className="sm:max-w-[160px]"
              aria-label="Tutor time adjustment in hours"
              placeholder="0"
            />
            <Button
              size="sm"
              onClick={() => handleSave(parsedValue)}
              disabled={!isValid || isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSave(0)}
              disabled={isSaving || initialTimeAdjustmentHours === 0}
            >
              Reset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use positive values to add external study time and negative values to reduce an overstated total.
          </p>
        </div>

        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground lg:min-w-[220px]">
          <p className="font-medium text-foreground">Current total</p>
          <p className="mt-1">{formatHours(currentTotalLearningHours)}</p>
        </div>
      </CardContent>
    </Card>
  );
}