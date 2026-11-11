"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Check,
  Users,
  ClipboardList,
  Loader2,
  Trash2,
  Calendar,
  LogOut,
  X,
  BookOpen,
  MessageSquare,
  Plus,
  Sparkles,
  UserPlus,
} from "lucide-react";
import type { Role } from "@/types/roles";
import { CreateAssignmentDialog } from "@/components/assignments/create-assignment-dialog";
import { formatAppDate } from "@/lib/dates";
import {
  extractPassiveVocabularyTermsFromText,
  inferPassiveVocabularyItemType,
} from "@/lib/mastery/passive-vocabulary";
import type { StudentThreeStateVocabularySummary } from "@/lib/progress/profile-metrics";

interface ClassDetailClientProps {
  classData: Record<string, unknown>;
  members: Record<string, unknown>[];
  assignments: Record<string, unknown>[];
  quizzes: Record<string, unknown>[];
  availableTutorStudents?: Array<{
    id: string;
    name: string;
    cefr_level: string | null;
  }>;
  threeStateSummaries?: Record<string, StudentThreeStateVocabularySummary>;
  role: Role;
  userId: string;
}

export function ClassDetailClient({
  classData,
  members,
  assignments,
  quizzes,
  availableTutorStudents = [],
  threeStateSummaries = {},
  role,
  userId,
}: ClassDetailClientProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [removingStudent, setRemovingStudent] = useState<string | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<string | null>(
    null,
  );

  // Add connected student state
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<string>("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // Speaking session vocabulary sync state
  const [sessionVocabText, setSessionVocabText] = useState("");
  const [isSyncingVocab, setIsSyncingVocab] = useState(false);

  const isTutor =
    (role === "tutor" || role === "superadmin") &&
    classData.tutor_id === userId;

  const discussionQuizzes = quizzes.filter((q) => q.type === "discussion");

  function copyCode() {
    navigator.clipboard.writeText(classData.join_code as string);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/classes/${classData.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/classes");
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to delete class:", err);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleLeave() {
    setIsLeaving(true);
    try {
      const res = await fetch(`/api/classes/${classData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      });
      if (res.ok) {
        router.push("/classes");
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to leave class:", err);
    } finally {
      setIsLeaving(false);
    }
  }

  async function handleAddStudent() {
    if (!selectedStudentToAdd) return;
    setIsAddingStudent(true);
    try {
      const res = await fetch(`/api/classes/${classData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_student",
          studentId: selectedStudentToAdd,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to add student");
      }
      toast.success("Participant added to speaking class");
      setSelectedStudentToAdd("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setIsAddingStudent(false);
    }
  }

  async function handleRemoveStudent(studentId: string) {
    setRemovingStudent(studentId);
    try {
      const res = await fetch(`/api/classes/${classData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_student", studentId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to remove student:", err);
    } finally {
      setRemovingStudent(null);
    }
  }

  async function handleDeleteAssignment(assignmentId: string) {
    setDeletingAssignment(assignmentId);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to delete assignment:", err);
    } finally {
      setDeletingAssignment(null);
    }
  }

  async function handleSyncVocabularyToAllMembers() {
    const memberIds = members
      .map((m) => m.student_id as string)
      .filter(Boolean);
    if (memberIds.length === 0) {
      toast.error("Add participants to the class first");
      return;
    }

    const extracted = extractPassiveVocabularyTermsFromText(sessionVocabText);
    if (extracted.length === 0) {
      toast.error("Enter vocabulary words or text from the speaking session");
      return;
    }

    const items = extracted.map((term) => ({
      term,
      itemType: inferPassiveVocabularyItemType(term),
    }));

    setIsSyncingVocab(true);
    try {
      const results = await Promise.all(
        memberIds.map((studentId) =>
          fetch("/api/mastery/passive-import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId,
              sourceType: "full_text",
              sourceLabel: `Speaking Class: ${classData.name as string}`,
              items,
            }),
          }),
        ),
      );

      const succeeded = results.filter((r) => r.ok).length;
      if (succeeded === 0) {
        throw new Error("Failed to sync vocabulary to class members");
      }

      toast.success(
        `Synced ${items.length} words to ${succeeded} class ${succeeded === 1 ? "participant" : "participants"}!`,
      );
      setSessionVocabText("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to sync vocabulary",
      );
    } finally {
      setIsSyncingVocab(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link href="/classes">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {classData.name as string}
            </h1>
            <Badge variant="secondary">{classData.cefr_level as string}</Badge>
          </div>
          {!!classData.description && (
            <p className="text-muted-foreground ml-10">
              {classData.description as string}
            </p>
          )}
        </div>
        {isTutor && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyCode}>
              {copied ? (
                <Check className="mr-2 h-3 w-3" />
              ) : (
                <Copy className="mr-2 h-3 w-3" />
              )}
              Join Code: {classData.join_code as string}
            </Button>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Speaking Class</DialogTitle>
                  <DialogDescription>
                    This will permanently delete the class, remove all members,
                    and delete all class assignments. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {!isTutor && (
          <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <LogOut className="mr-2 h-3 w-3" />
                Leave Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Leave Class</DialogTitle>
                <DialogDescription>
                  You will be removed from this class and won&apos;t see its
                  assignments anymore. You can rejoin with the class code.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLeaveOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleLeave}
                  disabled={isLeaving}
                >
                  {isLeaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Leaving...
                    </>
                  ) : (
                    "Leave"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Speaking & Quiz Activities
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={classData.is_active ? "default" : "secondary"}>
              {classData.is_active ? "Active" : "Inactive"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Tutor Speaking Session Workspace & Post-Session Vocabulary Sync */}
      {isTutor ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Live Discussion Prompts Card */}
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">
                    Speaking Prompts & Discussion Decks
                  </CardTitle>
                </div>
                <Button size="sm" asChild>
                  <Link href="/quizzes/new">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    New Discussion Deck
                  </Link>
                </Button>
              </div>
              <CardDescription>
                Open your Live Discussion decks during a Google Meet speaking
                club or assign them to this group.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {discussionQuizzes.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  No Live Discussion quizzes yet. Click &ldquo;New Discussion
                  Deck&rdquo; and choose &ldquo;Live Discussion&rdquo; to
                  generate CEFR speaking questions around your target words.
                </div>
              ) : (
                <div className="space-y-2">
                  {discussionQuizzes.slice(0, 5).map((quiz) => (
                    <div
                      key={quiz.id as string}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {quiz.title as string}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Level {(quiz.cefr_level as string) || "B1"}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/quizzes/${quiz.id as string}`}>
                          Open Prompts
                          <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Post-Session Vocabulary Sync Card */}
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">
                  Post-Session Vocabulary Sync
                </CardTitle>
              </div>
              <CardDescription>
                Paste the vocabulary, phrases, or notes covered in today&apos;s
                speaking session to push them into all {members.length}{" "}
                participants&apos; Passive Vocabulary at once.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={sessionVocabText}
                onChange={(e) => setSessionVocabText(e.target.value)}
                placeholder="Paste target words, expressions, or discussion notes from the speaking session..."
                rows={4}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {sessionVocabText.trim()
                    ? `${extractPassiveVocabularyTermsFromText(sessionVocabText).length} words detected`
                    : "Words will be matched against the shared dictionary"}
                </span>
                <Button
                  size="sm"
                  disabled={
                    isSyncingVocab ||
                    !sessionVocabText.trim() ||
                    members.length === 0
                  }
                  onClick={handleSyncVocabularyToAllMembers}
                >
                  {isSyncingVocab ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Sync to All {members.length} Participants
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Members & Unified 3-State Vocabulary Matrix */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">
              Participants & 3-State Vocabulary
            </CardTitle>
            <CardDescription>
              {members.length === 0
                ? "No students have joined yet. Add your connected students directly or share the join code."
                : `${members.length} active participant${members.length !== 1 ? "s" : ""} enrolled`}
            </CardDescription>
          </div>

          {isTutor && availableTutorStudents.length > 0 ? (
            <div className="flex items-center gap-2">
              <Select
                value={selectedStudentToAdd}
                onValueChange={setSelectedStudentToAdd}
              >
                <SelectTrigger className="w-[210px] h-9 text-xs">
                  <SelectValue placeholder="Add connected student..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTutorStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.cefr_level ? `(${s.cefr_level})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!selectedStudentToAdd || isAddingStudent}
                onClick={handleAddStudent}
              >
                {isAddingStudent ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Add
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        {members.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Level</TableHead>
                  {isTutor ? (
                    <>
                      <TableHead>Learning</TableHead>
                      <TableHead>Passive (% to next lvl)</TableHead>
                      <TableHead>Active (% to next lvl)</TableHead>
                    </>
                  ) : (
                    <TableHead>Email</TableHead>
                  )}
                  <TableHead>Joined</TableHead>
                  {isTutor && <TableHead className="w-24 text-right" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const profile = member.profiles as Record<
                    string,
                    unknown
                  > | null;
                  const studentId =
                    (profile?.id as string) ?? (member.student_id as string);
                  const summary = threeStateSummaries[studentId];

                  return (
                    <TableRow key={member.id as string}>
                      <TableCell className="font-medium">
                        {(profile?.full_name as string) ||
                          (profile?.email as string) ||
                          "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {summary
                            ? summary.nextCefrLevel
                              ? `${summary.currentCefrLevel} → ${summary.nextCefrLevel}`
                              : summary.currentCefrLevel
                            : (profile?.cefr_level as string) || "—"}
                        </Badge>
                      </TableCell>
                      {isTutor ? (
                        <>
                          <TableCell className="font-semibold text-amber-600 dark:text-amber-400">
                            {summary ? summary.learningCount : 0}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-sky-600 dark:text-sky-400">
                              {summary ? summary.passiveEquivalentCount : 0}
                            </span>
                            {summary ? (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                ({summary.passivePercentToNextLevel}%
                                {summary.nextCefrLevel
                                  ? ` to ${summary.nextCefrLevel}`
                                  : ""}
                                )
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {summary ? summary.activeCount : 0}
                            </span>
                            {summary ? (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                ({summary.activePercentToNextLevel}%
                                {summary.nextCefrLevel
                                  ? ` to ${summary.nextCefrLevel}`
                                  : ""}
                                )
                              </span>
                            ) : null}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell>
                          {(profile?.email as string) || "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground text-sm">
                        {formatAppDate(member.joined_at as string)}
                      </TableCell>
                      {isTutor && (
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              asChild
                            >
                              <Link href={`/mastery?student=${studentId}`}>
                                <BookOpen className="mr-1 h-3 w-3" />
                                Mastery
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveStudent(studentId)}
                              disabled={removingStudent === studentId}
                            >
                              {removingStudent === studentId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* Group Activities & Assignments section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">
              Assigned Speaking & Vocabulary Activities
            </CardTitle>
            <CardDescription>
              {assignments.length === 0
                ? "Assign a discussion deck or vocabulary quiz for this group."
                : `${assignments.length} activity${assignments.length !== 1 ? "ies" : ""} assigned`}
            </CardDescription>
          </div>
          {isTutor && (
            <CreateAssignmentDialog
              classId={classData.id as string}
              quizzes={quizzes.map((q) => ({
                id: q.id as string,
                title: q.title as string,
                type: q.type as string,
                cefr_level: q.cefr_level as string,
              }))}
            />
          )}
        </CardHeader>
        {assignments.length > 0 && (
          <CardContent>
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const quiz = assignment.quizzes as Record<
                  string,
                  unknown
                > | null;
                return (
                  <div
                    key={assignment.id as string}
                    className="flex items-center justify-between p-3 rounded-md bg-muted"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {assignment.title as string}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Quiz: {(quiz?.title as string) || "—"} &middot;{" "}
                        {(quiz?.type as string) || "—"}
                      </p>
                      {!!assignment.instructions && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {assignment.instructions as string}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-right shrink-0">
                      <div>
                        {!!assignment.due_date && (
                          <p className="text-xs text-muted-foreground">
                            Due: {formatAppDate(assignment.due_date as string)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatAppDate(assignment.created_at as string)}
                        </p>
                      </div>
                      {isTutor && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            handleDeleteAssignment(assignment.id as string)
                          }
                          disabled={
                            deletingAssignment === (assignment.id as string)
                          }
                        >
                          {deletingAssignment === (assignment.id as string) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
