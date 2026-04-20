"use client";

import { useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_CEFR_LEVELS } from "@/lib/languages";
import { toast } from "sonner";
import { changeUserCefrLevel } from "./actions";
import type { CEFRLevel } from "@/types/quiz";

interface CefrLevelSelectorProps {
  userId: string;
  currentCefrLevel?: string | null;
  allowedLevels: CEFRLevel[];
}

function getInitialCefrLevel(
  currentCefrLevel: string | null | undefined,
  allowedLevels: CEFRLevel[],
) {
  if (ALL_CEFR_LEVELS.includes(currentCefrLevel as CEFRLevel)) {
    return currentCefrLevel as CEFRLevel;
  }

  return allowedLevels[0] ?? "A1";
}

export function CefrLevelSelector({
  userId,
  currentCefrLevel,
  allowedLevels,
}: CefrLevelSelectorProps) {
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>(() =>
    getInitialCefrLevel(currentCefrLevel, allowedLevels),
  );
  const [isPending, startTransition] = useTransition();

  const selectableLevels = allowedLevels.includes(cefrLevel)
    ? allowedLevels
    : [cefrLevel, ...allowedLevels.filter((level) => level !== cefrLevel)];

  function handleChange(value: string) {
    const newCefrLevel = value as CEFRLevel;
    const previousLevel = cefrLevel;

    setCefrLevel(newCefrLevel);

    startTransition(async () => {
      try {
        await changeUserCefrLevel(userId, newCefrLevel);
        toast.success(`CEFR updated to ${newCefrLevel}`);
      } catch {
        setCefrLevel(previousLevel);
        toast.error("Failed to update CEFR level");
      }
    });
  }

  return (
    <Select
      value={cefrLevel}
      onValueChange={handleChange}
      disabled={isPending || selectableLevels.length === 0}
    >
      <SelectTrigger className="h-7 w-24 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {selectableLevels.map((level) => (
          <SelectItem key={level} value={level} className="text-xs">
            {level}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}