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
  Copy,
  Check,
  Users,
  ClipboardList,
  Loader2,
  Trash2,
  Calendar,
  LogOut,
  X,
} from "lucide-react";
import type { Role } from "@/types/roles";
import { CreateAssignmentDialog } from "@/components/assignments/create-assignment-dialog";

interface ClassDetailClientProps {
  classData: Record<string, unknown>;
  members: Record<string, unknown>[];
  assignments: Record<string, unknown>[];
  quizzes: Record<string, unknown>[];
  role: Role;
  userId: string;
}

export function ClassDetailClient({
  classData,
  members,
  assignments,
  quizzes,
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
  const [deletingAssignment, setDeletingAssignment] = useState<string | null>(null);

  const isTutor =
    (role === "tutor" || role === "superadmin") &&
    classData.tutor_id === userId;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
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
              {classData.join_code as string}
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
                  <DialogTitle>Delete Class</DialogTitle>
                  <DialogDescription>
                    This will permanently delete the class, remove all members,
                    and delete all assignments. This cannot be undone.
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
                <Button
                  variant="outline"
                  onClick={() => setLeaveOpen(false)}
                >
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
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assignments</CardTitle>
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

      {/* Members section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students</CardTitle>
          <CardDescription>
            {members.length === 0
              ? "No students have joined yet. Share the join code."
              : `${members.length} student${members.length !== 1 ? "s" : ""} enrolled`}
          </CardDescription>
        </CardHeader>
        {members.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Joined</TableHead>
                  {isTutor && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const profile = member.profiles as Record<
                    string,
                    unknown
                  > | null;
                  return (
                    <TableRow key={member.id as string}>
                      <TableCell className="font-medium">
                        {(profile?.full_name as string) || "—"}
                      </TableCell>
                      <TableCell>{(profile?.email as string) || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(profile?.cefr_level as string) || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(
                          member.joined_at as string,
                        ).toLocaleDateString("en-US")}
                      </TableCell>
                      {isTutor && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              handleRemoveStudent(
                                (profile?.id as string) ?? (member.student_id as string),
                              )
                            }
                            disabled={
                              removingStudent ===
                              ((profile?.id as string) ?? (member.student_id as string))
                            }
                          >
                            {removingStudent ===
                            ((profile?.id as string) ?? (member.student_id as string)) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </Button>
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

      {/* Assignments section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Assignments</CardTitle>
            <CardDescription>
              {assignments.length === 0
                ? "No assignments yet."
                : `${assignments.length} assignment${assignments.length !== 1 ? "s" : ""}`}
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
                            Due:{" "}
                            {new Date(
                              assignment.due_date as string,
                            ).toLocaleDateString("en-US")}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(
                            assignment.created_at as string,
                          ).toLocaleDateString("en-US")}
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


