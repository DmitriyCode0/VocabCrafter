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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  UserPlus,
  Users,
  Copy,
  Check,
  Trash2,
  Loader2,
  Clock,
  Link2,
} from "lucide-react";
import { ACTIVITY_LABELS } from "@/lib/constants";
import Link from "next/link";

interface StudentProfile {
  id?: string;
  full_name?: string | null;
  email?: string;
  avatar_url?: string | null;
  cefr_level?: string;
}

interface QuizInfo {
  title?: string;
  type?: string;
  cefr_level?: string;
}

interface StudentsClientProps {
  connections: Record<string, unknown>[];
  recentAttempts: Record<string, unknown>[];
  tutorId: string;
}

export function StudentsClient({
  connections,
  recentAttempts,
  tutorId,
}: StudentsClientProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeConnections = connections.filter(
    (c) => c.status === "active" && c.student_id !== tutorId,
  );
  const pendingConnections = connections.filter((c) => c.status === "pending");

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedCode(data.connectCode);
        router.refresh();
      }
    } catch (err) {
      console.error("Generate code error:", err);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (generatedCode) {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleCopyExisting(code: string) {
    await navigator.clipboard.writeText(code);
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
          <h1 className="text-2xl font-bold tracking-tight">My Students</h1>
          <p className="text-muted-foreground">
            Manage direct student connections and monitor their activity.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setGeneratedCode(null);
              setCopied(false);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Connect Student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect a Student</DialogTitle>
              <DialogDescription>
                Generate a connect code and share it with your student. They
                will enter it to establish a direct connection with you.
              </DialogDescription>
            </DialogHeader>

            {generatedCode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 p-6 bg-muted rounded-lg">
                  <span className="text-3xl font-mono font-bold tracking-widest">
                    {generatedCode}
                  </span>
                  <Button variant="ghost" size="icon" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Share this code with your student. It can only be used once.
                </p>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Click below to generate a unique connect code for your
                  student.
                </p>
              </div>
            )}

            <DialogFooter>
              {!generatedCode ? (
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Code"
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setGeneratedCode(null);
                  }}
                >
                  Done
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending connections */}
      {pendingConnections.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Pending Codes
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pendingConnections.map((conn) => (
              <Card key={conn.id as string} className="border-dashed">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-mono">
                      {conn.connect_code as string}
                    </CardTitle>
                    <Badge variant="outline">Pending</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Created{" "}
                      {new Date(
                        conn.created_at as string,
                      ).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleCopyExisting(conn.connect_code as string)
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Connected students */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          Connected Students ({activeConnections.length})
        </h2>

        {activeConnections.length === 0 ? (
          <Card>
            <CardHeader className="items-center text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-2" />
              <CardTitle className="text-lg">No connected students</CardTitle>
              <CardDescription>
                Generate a connect code and share it with your students to
                establish a direct connection.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeConnections.map((conn) => {
              const student = conn.profiles as StudentProfile | null;
              const studentAttempts = recentAttempts.filter(
                (a) => a.student_id === conn.student_id,
              );

              return (
                <Card key={conn.id as string}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {student?.full_name ||
                          student?.email ||
                          "Unknown"}
                      </CardTitle>
                      {student?.cefr_level && (
                        <Badge variant="secondary">
                          {student.cefr_level}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {student?.email}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Connected{" "}
                      {conn.connected_at
                        ? new Date(
                            conn.connected_at as string,
                          ).toLocaleDateString()
                        : "—"}
                    </div>

                    {studentAttempts.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Recent Activity
                        </p>
                        {studentAttempts.slice(0, 3).map((a) => {
                          const quiz = a.quizzes as QuizInfo | null;
                          const pct =
                            a.score != null && a.max_score != null
                              ? Math.round(
                                  (Number(a.score) / Number(a.max_score)) * 100,
                                )
                              : null;
                          return (
                            <div
                              key={a.id as string}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="truncate max-w-[140px]">
                                {quiz?.title ?? "Quiz"}
                              </span>
                              <div className="flex items-center gap-1">
                                {pct !== null && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1 ${
                                      pct >= 80
                                        ? "text-green-600"
                                        : pct >= 50
                                          ? "text-orange-600"
                                          : "text-red-600"
                                    }`}
                                  >
                                    {pct}%
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/history?student=${conn.student_id as string}`}
                        >
                          View History
                        </Link>
                      </Button>
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
    </div>
  );
}
