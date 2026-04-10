"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ExternalLink, Link2Off } from "lucide-react";
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

interface GoogleCalendarSyncCardProps {
  available: boolean;
  connectHref: string;
  connection: {
    googleEmail: string | null;
    calendarId: string;
    connectedAt: string;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
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
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Google Calendar Sync
            </CardTitle>
            <CardDescription className="mt-1">
              Automatically mirror lesson create, reschedule, and delete changes
              to your Google Calendar.
            </CardDescription>
          </div>

          <Badge variant={connection ? "default" : "outline"}>
            {available
              ? connection
                ? "Connected"
                : "Disconnected"
              : "Unavailable"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {!available ? (
          <p className="text-muted-foreground">
            Google Calendar sync is not configured in this environment yet.
          </p>
        ) : connection ? (
          <>
            <div className="space-y-1 text-muted-foreground">
              <p>
                Connected account: {connection.googleEmail || "Google account"}
              </p>
              <p>Calendar: {connection.calendarId}</p>
              {connectedAtLabel ? <p>Connected: {connectedAtLabel}</p> : null}
              {lastSyncedAtLabel ? <p>Last successful sync: {lastSyncedAtLabel}</p> : null}
            </div>

            {connection.lastSyncError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                {connection.lastSyncError}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href={connectHref}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Reconnect
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                <Link2Off className="mr-2 h-4 w-4" />
                {isDisconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Connect your Google account once, then new lessons, date changes,
              and deletions will sync automatically.
            </p>

            <Button asChild>
              <Link href={connectHref}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect Google Calendar
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}