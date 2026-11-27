"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ExternalLink, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GoogleCalendarSyncCardProps {
  available: boolean;
  connectHref: string;
  connection: {
    googleEmail: string | null;
    calendarId: string;
    connectedAt: string;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
    hasTranscriptScope?: boolean;
  } | null;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function GoogleCalendarSyncCard({
  available,
  connectHref,
  connection,
}: GoogleCalendarSyncCardProps) {
  const router = useRouter();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const lastSyncedAtLabel = formatDateTime(connection?.lastSyncedAt);
  const connectedAtLabel = formatDateTime(connection?.connectedAt);

  async function handleDisconnect() {
    setIsDisconnecting(true);

    try {
      const response = await fetch("/api/google-calendar/disconnect", {
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to disconnect Google Calendar");
      }

      toast.success("Google Calendar sync disconnected.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to disconnect Google Calendar",
      );
    } finally {
      setIsDisconnecting(false);
    }
  }

  const isConnected = Boolean(available && connection);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card/60 px-4 py-3 shadow-xs transition-colors",
        isConnected && "border-primary/30 bg-primary/[0.05]",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground",
              isConnected && "border-primary/30 bg-primary/15 text-primary",
            )}
          >
            <CalendarDays className="h-4 w-4" />
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight">
                Google Calendar Sync
              </h3>
              <Badge
                variant={isConnected ? "default" : "outline"}
                className={cn(
                  "gap-1.5 text-[11px]",
                  isConnected &&
                    "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20",
                )}
              >
                {isConnected ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                ) : null}
                {available
                  ? connection
                    ? "Connected"
                    : "Disconnected"
                  : "Unavailable"}
              </Badge>
            </div>

            {!available ? (
              <p className="text-xs text-muted-foreground">
                Google Calendar sync is not configured in this environment yet.
              </p>
            ) : connection ? (
              <p className="truncate text-xs text-muted-foreground">
                <span>{connection.googleEmail || "Google account"}</span>
                <span> · Calendar: {connection.calendarId}</span>
                {lastSyncedAtLabel ? (
                  <span> · Last sync {lastSyncedAtLabel}</span>
                ) : connectedAtLabel ? (
                  <span> · Connected {connectedAtLabel}</span>
                ) : null}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Mirror lesson creation, reschedules, and cancellations to your
                Google Calendar automatically.
              </p>
            )}
          </div>
        </div>

        {available ? (
          connection ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={connectHref}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Reconnect
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                <Link2Off className="mr-1.5 h-3.5 w-3.5" />
                {isDisconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          ) : (
            <Button size="sm" asChild className="shrink-0">
              <a href={connectHref}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Connect Google Calendar
              </a>
            </Button>
          )
        ) : null}
      </div>

      {available && connection && connection.hasTranscriptScope === false ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <span>
            Click Reconnect to grant Google Drive read-only permission for
            automatic Google Meet transcript sync.
          </span>
          <Button variant="outline" size="sm" asChild className="h-7 text-xs">
            <a href={connectHref}>Reconnect</a>
          </Button>
        </div>
      ) : null}

      {available && connection?.lastSyncError ? (
        <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          {connection.lastSyncError}
        </div>
      ) : null}
    </div>
  );
}
