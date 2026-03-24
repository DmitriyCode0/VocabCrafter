"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditMasteryWordDialogProps {
  word: {
    id: string;
    term: string;
    mastery_level: number;
    correct_count: number;
    incorrect_count: number;
    translation_correct_count: number;
    streak: number;
  };
}

export function EditMasteryWordDialog({ word }: EditMasteryWordDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [masteryLevel, setMasteryLevel] = useState(String(word.mastery_level));
  const [correctCount, setCorrectCount] = useState(String(word.correct_count));
  const [incorrectCount, setIncorrectCount] = useState(
    String(word.incorrect_count),
  );
  const [translationCorrectCount, setTranslationCorrectCount] = useState(
    String(word.translation_correct_count),
  );
  const [streak, setStreak] = useState(String(word.streak));

  async function handleSave() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/mastery/words/${word.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masteryLevel: Number(masteryLevel),
          correctCount: Number(correctCount),
          incorrectCount: Number(incorrectCount),
          translationCorrectCount: Number(translationCorrectCount),
          streak: Number(streak),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to update word");
      }

      toast.success(`Updated ${word.term}`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update word",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
          <PencilLine className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Edit {word.term}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit mastery values</DialogTitle>
          <DialogDescription>{word.term}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Mastery Level</Label>
            <Select value={masteryLevel} onValueChange={setMasteryLevel}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5].map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    Level {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`correct-${word.id}`}>Correct Count</Label>
            <Input
              id={`correct-${word.id}`}
              type="number"
              min="0"
              value={correctCount}
              onChange={(event) => setCorrectCount(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`incorrect-${word.id}`}>Incorrect Count</Label>
            <Input
              id={`incorrect-${word.id}`}
              type="number"
              min="0"
              value={incorrectCount}
              onChange={(event) => setIncorrectCount(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`translation-${word.id}`}>
              Translation Correct Count
            </Label>
            <Input
              id={`translation-${word.id}`}
              type="number"
              min="0"
              value={translationCorrectCount}
              onChange={(event) =>
                setTranslationCorrectCount(event.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`streak-${word.id}`}>Streak</Label>
            <Input
              id={`streak-${word.id}`}
              type="number"
              min="0"
              value={streak}
              onChange={(event) => setStreak(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
