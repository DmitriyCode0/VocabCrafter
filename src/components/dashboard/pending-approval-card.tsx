"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppLanguage } from "@/lib/i18n/app-language";
import { formatDateForAppLanguage } from "@/lib/i18n/format";
import type { Profile } from "@/types/database";
import type { Role } from "@/types/roles";
import { cn } from "@/lib/utils";

interface PendingApprovalCardProps {
  profile: Profile;
  appLanguage: AppLanguage;
}

export function PendingApprovalCard({
  profile,
  appLanguage,
}: PendingApprovalCardProps) {
  const router = useRouter();
  const supabase = createClient();
  const { messages } = useAppI18n();
  const copy = messages.dashboard.pendingApproval;
  const isRejected = profile.approval_status === "rejected";

  const [note, setNote] = useState(profile.registration_note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    if (savingNote || isRejected) return;

    setSavingNote(true);
    const { error } = await supabase
      .from("profiles")
      .update({ registration_note: note.trim() || null })
      .eq("id", profile.id);

    setSavingNote(false);
    if (error) {
      toast.error(copy.noteSaveFailedToast);
      return;
    }

    toast.success(copy.noteSavedToast);
    router.refresh();
  }

  async function handleCheckStatus() {
    if (checkingStatus) return;
    setCheckingStatus(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("approval_status")
      .eq("id", profile.id)
      .single();

    setCheckingStatus(false);

    if (!error && data?.approval_status === "approved") {
      toast.success(copy.approvedToast);
      router.refresh();
      return;
    }

    toast.info(copy.stillPendingToast);
    router.refresh();
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-2xl space-y-4">
      <Card
        className={cn(
          "border shadow-sm",
          isRejected
            ? "border-destructive/40 bg-destructive/[0.04]"
            : "border-amber-500/40 bg-amber-500/[0.04]",
        )}
      >
        <CardHeader className="space-y-3 text-center">
          <div
            className={cn(
              "mx-auto flex h-12 w-12 items-center justify-center rounded-full border",
              isRejected
                ? "border-destructive/40 bg-destructive/12 text-destructive"
                : "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
            )}
          >
            {isRejected ? (
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Clock className="h-6 w-6" aria-hidden="true" />
            )}
          </div>

          <div className="flex justify-center">
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-semibold",
                isRejected
                  ? "border-destructive/40 bg-destructive/15 text-destructive"
                  : "border-amber-500/45 bg-amber-500/15 text-amber-700 dark:text-amber-300",
              )}
            >
              {isRejected ? copy.rejectedBadge : copy.pendingBadge}
            </Badge>
          </div>

          <CardTitle className="text-2xl font-bold">
            {isRejected ? copy.rejectedTitle : copy.pendingTitle}
          </CardTitle>
          <CardDescription className="mx-auto max-w-lg text-sm leading-relaxed">
            {isRejected ? copy.rejectedDescription : copy.pendingDescription}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-xl border border-border/65 bg-background/70 p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {copy.summaryTitle}
            </h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">
                  {copy.nameLabel}
                </dt>
                <dd className="font-medium text-foreground">
                  {profile.full_name || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {copy.emailLabel}
                </dt>
                <dd className="truncate font-medium text-foreground">
                  {profile.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {copy.requestedRoleLabel}
                </dt>
                <dd className="font-medium text-foreground">
                  {messages.common.roleNames[profile.role as Role]}
                </dd>
              </div>
              {profile.role === "student" ? (
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {copy.levelLabel}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {profile.cefr_level}
                  </dd>
                </div>
              ) : (
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {copy.submittedLabel}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatDateForAppLanguage(appLanguage, profile.created_at)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {!isRejected ? (
            <form onSubmit={handleSaveNote} className="space-y-2.5">
              <Label htmlFor="pending-registration-note">
                {copy.noteLabel}
              </Label>
              <Textarea
                id="pending-registration-note"
                rows={2}
                maxLength={300}
                placeholder={copy.notePlaceholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={savingNote}
                >
                  <Save className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                  {savingNote ? copy.savingNote : copy.saveNoteButton}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleCheckStatus}
                  disabled={checkingStatus}
                >
                  <RefreshCw
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      checkingStatus && "animate-spin",
                    )}
                    aria-hidden="true"
                  />
                  {checkingStatus
                    ? copy.checkingStatus
                    : copy.checkStatusButton}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCheckStatus}
                disabled={checkingStatus}
              >
                <RefreshCw
                  className={cn(
                    "mr-2 h-3.5 w-3.5",
                    checkingStatus && "animate-spin",
                  )}
                  aria-hidden="true"
                />
                {checkingStatus ? copy.checkingStatus : copy.checkStatusButton}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
