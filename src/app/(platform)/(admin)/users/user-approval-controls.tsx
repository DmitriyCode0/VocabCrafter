"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppI18n } from "@/components/providers/app-language-provider";
import type { ApprovalStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import { setUserApprovalStatus } from "./actions";

interface UserApprovalControlsProps {
  userId: string;
  currentStatus: ApprovalStatus;
  isSuperadminTarget?: boolean;
  variant?: "queue" | "table";
}

export function UserApprovalControls({
  userId,
  currentStatus,
  isSuperadminTarget = false,
  variant = "table",
}: UserApprovalControlsProps) {
  const { messages } = useAppI18n();
  const [status, setStatus] = useState<ApprovalStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(nextStatus: ApprovalStatus) {
    const previous = status;
    setStatus(nextStatus);

    startTransition(async () => {
      try {
        await setUserApprovalStatus(userId, nextStatus);
        if (nextStatus === "approved") {
          toast.success(messages.adminUsers.userApprovedToast);
        } else if (nextStatus === "rejected") {
          toast.success(messages.adminUsers.userRejectedToast);
        } else {
          toast.success(messages.adminUsers.userPendingToast);
        }
      } catch {
        setStatus(previous);
        toast.error(messages.adminUsers.approvalUpdateFailedToast);
      }
    });
  }

  if (variant === "queue") {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => handleUpdate("approved")}
          className="h-7 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
        >
          <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          {messages.adminUsers.approveButton}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleUpdate("rejected")}
          className="h-7 px-2.5 text-xs"
        >
          <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          {messages.adminUsers.rejectButton}
        </Button>
      </div>
    );
  }

  const badgeClass =
    status === "approved"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "pending"
        ? "border-amber-500/45 bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "border-destructive/40 bg-destructive/15 text-destructive";

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={cn("text-[11px]", badgeClass)}>
        {messages.adminUsers.statusLabels[status]}
      </Badge>
      {isSuperadminTarget ? null : status === "approved" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => handleUpdate("pending")}
          title={messages.adminUsers.revokeButton}
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
          {messages.adminUsers.revokeButton}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleUpdate("approved")}
          className="h-6 border-emerald-500/40 px-2 text-[11px] text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
        >
          <Check className="mr-1 h-3 w-3" aria-hidden="true" />
          {messages.adminUsers.approveButton}
        </Button>
      )}
    </div>
  );
}
