"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { setGrammarArticleEditorPermission } from "./actions";

interface GrammarArticleEditorPermissionToggleProps {
  userId: string;
  enabled: boolean;
}

export function GrammarArticleEditorPermissionToggle({
  userId,
  enabled,
}: GrammarArticleEditorPermissionToggleProps) {
  const { messages } = useAppI18n();
  const [checked, setChecked] = useState(enabled);
  const [isPending, startTransition] = useTransition();

  function handleCheckedChange(nextChecked: boolean) {
    const previousChecked = checked;
    setChecked(nextChecked);

    startTransition(async () => {
      try {
        await setGrammarArticleEditorPermission(userId, nextChecked);
        toast.success(
          nextChecked
            ? messages.adminUsers.articleEditorGranted
            : messages.adminUsers.articleEditorRevoked,
        );
      } catch {
        setChecked(previousChecked);
        toast.error(messages.adminUsers.articleEditorUpdateFailed);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={checked}
        onCheckedChange={handleCheckedChange}
        disabled={isPending}
        aria-label={messages.adminUsers.columns.articleEditor}
      />
      <span className="text-xs text-muted-foreground">
        {checked
          ? messages.adminUsers.articleEditorGrantedLabel
          : messages.adminUsers.articleEditorRevokedLabel}
      </span>
    </div>
  );
}