"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Loader2 } from "lucide-react";
import { ACTIVITY_LABELS } from "@/lib/constants";

interface ClassOption {
  id: string;
  name: string;
  cefr_level: string;
}

interface QuizOption {
  id: string;
  title: string;
  type: string;
  cefr_level: string;
}

interface CreateAssignmentDialogProps {
  /** Pre-select a class (e.g. when opened from class detail page) */
  classId?: string;
  /** Pre-loaded classes (skip client fetch) */
  classes?: ClassOption[];
  /** Pre-loaded quizzes (skip client fetch) */
  quizzes?: QuizOption[];
}

export function CreateAssignmentDialog({
  classId: initialClassId,
  classes: preloadedClasses,
  quizzes: preloadedQuizzes,
}: CreateAssignmentDialogProps) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [quizId, setQuizId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassOption[]>(
    preloadedClasses ?? [],
  );
  const [quizzes, setQuizzes] = useState<QuizOption[]>(
    preloadedQuizzes ?? [],
  );
  const [loadingData, setLoadingData] = useState(false);

  // Fetch classes and quizzes when dialog opens (if not preloaded)
  useEffect(() => {
    if (!open) return;
    if (preloadedClasses && preloadedQuizzes) return;

    async function fetchData() {
      setLoadingData(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        if (!preloadedClasses) {
          const { data } = await supabase
            .from("classes")
            .select("id, name, cefr_level")
            .eq("tutor_id", user.id)
            .eq("is_active", true)
            .order("name");
          setClasses((data as ClassOption[]) ?? []);
        }

        if (!preloadedQuizzes) {
          const { data } = await supabase
            .from("quizzes")
            .select("id, title, type, cefr_level")
            .eq("creator_id", user.id)
            .order("created_at", { ascending: false });
          setQuizzes((data as QuizOption[]) ?? []);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [open, preloadedClasses, preloadedQuizzes, supabase]);

  // Auto-fill title when quiz is selected
  useEffect(() => {
    if (quizId && !title) {
      const quiz = quizzes.find((q) => q.id === quizId);
      if (quiz) {
        setTitle(quiz.title);
      }
    }
  }, [quizId, quizzes, title]);

  function resetForm() {
    setTitle("");
    setClassId(initialClassId ?? "");
    setQuizId("");
    setInstructions("");
    setDueDate("");
    setError(null);
  }

  async function handleCreate() {
    if (!title.trim() || !classId || !quizId) return;
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          quizId,
          title: title.trim(),
          instructions: instructions.trim() || undefined,
          dueDate: dueDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create assignment");
      }

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create assignment",
      );
    } finally {
      setIsCreating(false);
    }
  }

  const hasClasses = classes.length > 0;
  const hasQuizzes = quizzes.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Assignment</DialogTitle>
          <DialogDescription>
            Assign a quiz to a class. All students in the class will see it on
            their assignments page.
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasClasses || !hasQuizzes ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {!hasClasses && <p>You need to create a class first.</p>}
            {!hasQuizzes && <p>You need to create a quiz first.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Class picker */}
            <div className="space-y-2">
              <Label>Class</Label>
              <Select
                value={classId}
                onValueChange={setClassId}
                disabled={!!initialClassId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a class..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.cefr_level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quiz picker */}
            <div className="space-y-2">
              <Label>Quiz</Label>
              <Select value={quizId} onValueChange={setQuizId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a quiz..." />
                </SelectTrigger>
                <SelectContent>
                  {quizzes.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.title} (
                      {ACTIVITY_LABELS[q.type] || q.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Assignment Title</Label>
              <Input
                placeholder="e.g., Week 5 Vocabulary Practice"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <Label>Instructions (optional)</Label>
              <Input
                placeholder="Any special instructions for students..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>

            {/* Due date */}
            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={
              !title.trim() || !classId || !quizId || isCreating || loadingData
            }
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Assignment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
