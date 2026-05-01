"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setDictionaryEditorPermission } from "./actions";

interface DictionaryEditorPermissionToggleProps {
  userId: string;
  enabled: boolean;
}

export function DictionaryEditorPermissionToggle({
  userId,
  enabled,
}: DictionaryEditorPermissionToggleProps) {
  const [checked, setChecked] = useState(enabled);
  const [isPending, startTransition] = useTransition();

  function handleCheckedChange(nextChecked: boolean) {
    const previousChecked = checked;
    setChecked(nextChecked);

    startTransition(async () => {
      try {
        await setDictionaryEditorPermission(userId, nextChecked);
        toast.success(
          nextChecked
            ? "Dictionary editor access granted"
            : "Dictionary editor access revoked",
        );
      } catch {
        setChecked(previousChecked);
        toast.error("Failed to update dictionary editor permission");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={checked}
        onCheckedChange={handleCheckedChange}
        disabled={isPending}
        aria-label="Dictionary Editor"
      />
      <span className="text-xs text-muted-foreground">
        {checked
          ? "Dictionary editor access granted"
          : "Dictionary editor access revoked"}
      </span>
    </div>
  );
}
