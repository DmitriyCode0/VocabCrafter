"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  GraduationCap,
  PlusCircle,
  Users,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import type { Role } from "@/types/roles";

interface ClassesClientProps {
  role: Role;
  classes: Record<string, unknown>[];
}

export function ClassesClient({ role, classes }: ClassesClientProps) {
  const isTutor = role === "tutor" || role === "superadmin";

  if (isTutor) {
    return <TutorClasses classes={classes} />;
  }

  return <StudentClasses classes={classes} />;
}

function TutorClasses({ classes }: { classes: Record<string, unknown>[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cefrLevel, setCefrLevel] = useState("B1");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          cefrLevel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create class");
      }

      setCreateOpen(false);
      setName("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create class");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground">
            Create and manage your classes, invite students, and assign quizzes.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Class</DialogTitle>
              <DialogDescription>
                Set up a class for your students. You&apos;ll get a join code to
                share.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class-name">Class Name</Label>
                <Input
                  id="class-name"
                  placeholder="e.g., English B1 - Monday Group"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-desc">Description (optional)</Label>
                <Textarea
                  id="class-desc"
                  placeholder="Brief description of the class..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>CEFR Level</Label>
                <Select value={cefrLevel} onValueChange={setCefrLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["A1", "A2", "B1", "B2", "C1"].map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Class"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No classes yet</CardTitle>
            <CardDescription>
              Create your first class to start managing students and assigning
              vocabulary activities.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard key={cls.id as string} cls={cls} isTutor />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentClasses({ classes }: { classes: Record<string, unknown>[] }) {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setIsJoining(true);
    setError(null);

    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: joinCode.trim().toUpperCase() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join class");
      }

      setJoinOpen(false);
      setJoinCode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join class");
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Classes</h1>
          <p className="text-muted-foreground">
            Join classes and access assigned quizzes from your tutors.
          </p>
        </div>
        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Join Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Join a Class</DialogTitle>
              <DialogDescription>
                Enter the join code your tutor shared with you.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-code">Join Code</Label>
                <Input
                  id="join-code"
                  placeholder="e.g., A1B2C3D4"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="uppercase"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                onClick={handleJoin}
                disabled={!joinCode.trim() || isJoining}
              >
                {isJoining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join Class"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No classes yet</CardTitle>
            <CardDescription>
              Ask your tutor for a join code to get started with assigned
              quizzes and activities.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard key={cls.id as string} cls={cls} isTutor={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({
  cls,
  isTutor,
}: {
  cls: Record<string, unknown>;
  isTutor: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(cls.join_code as string);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Link href={`/classes/${cls.id}`}>
      <Card className="h-full transition-colors hover:border-primary cursor-pointer">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{cls.name as string}</CardTitle>
            <Badge variant="secondary">{cls.cefr_level as string}</Badge>
          </div>
          {!!cls.description && (
            <CardDescription className="line-clamp-2">
              {cls.description as string}
            </CardDescription>
          )}
          <div className="flex items-center gap-3 pt-1">
            {isTutor && (
              <>
                <span className="text-xs text-muted-foreground">
                  {(cls.student_count as number) ?? 0} students
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 px-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyCode();
                  }}
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {cls.join_code as string}
                </Button>
              </>
            )}
            {!isTutor && (
              <span className="text-xs text-muted-foreground">
                {cls.is_active ? "Active" : "Inactive"}
              </span>
            )}
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
