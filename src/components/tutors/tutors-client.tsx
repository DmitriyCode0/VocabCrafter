"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Users, Loader2, Trash2 } from "lucide-react";

interface TutorProfile {
  id?: string;
  full_name?: string | null;
  email?: string;
  avatar_url?: string | null;
}

interface TutorsClientProps {
  connections: Record<string, unknown>[];
}

export function TutorsClient({ connections }: TutorsClientProps) {
  const router = useRouter();
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectCode, setConnectCode] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleConnect() {
    if (!connectCode.trim()) return;
    setIsConnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectCode: connectCode.trim().toUpperCase(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect");
      }

      setConnectOpen(false);
      setConnectCode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDelete(connectionId: string) {
    setDeletingId(connectionId);
    try {
      const res = await fetch(`/api/connections?id=${connectionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Delete connection error:", err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tutors</h1>
          <p className="text-muted-foreground">
            Connect with tutors who can monitor your progress and provide
            feedback.
          </p>
        </div>
        <Dialog
          open={connectOpen}
          onOpenChange={(open) => {
            setConnectOpen(open);
            if (!open) {
              setConnectCode("");
              setError(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Connect to Tutor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect to a Tutor</DialogTitle>
              <DialogDescription>
                Enter the connect code your tutor shared with you to establish a
                direct connection.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="connect-code">Connect Code</Label>
                <Input
                  id="connect-code"
                  placeholder="e.g., A1B2C3D4"
                  value={connectCode}
                  onChange={(e) =>
                    setConnectCode(e.target.value.toUpperCase())
                  }
                  className="uppercase font-mono text-lg tracking-widest"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                onClick={handleConnect}
                disabled={!connectCode.trim() || isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No connected tutors</CardTitle>
            <CardDescription>
              Ask your tutor for a connect code to link your accounts. Connected
              tutors can see your quiz activity and give you feedback.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((conn) => {
            const tutor = conn.profiles as TutorProfile | null;
            return (
              <Card key={conn.id as string}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {tutor?.full_name ||
                        tutor?.email ||
                        "Tutor"}
                    </CardTitle>
                    <Badge variant="default">Connected</Badge>
                  </div>
                  <CardDescription>
                    {tutor?.email}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Since{" "}
                      {conn.connected_at
                        ? new Date(
                            conn.connected_at as string,
                          ).toLocaleDateString()
                        : "—"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(conn.id as string)}
                      disabled={deletingId === (conn.id as string)}
                    >
                      {deletingId === (conn.id as string) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
