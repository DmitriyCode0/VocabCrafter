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

interface EditPassiveEvidenceDialogProps {
  evidence: {
    id: string;
    term: string;
    definition: string | null;
    item_type: "word" | "phrase";
    source_type: "full_text" | "manual_list" | "curated_list";
    source_label: string | null;
    confidence: number;
  };
}

export function EditPassiveEvidenceDialog({ evidence }: EditPassiveEvidenceDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [term, setTerm] = useState(evidence.term);
  const [definition, setDefinition] = useState(evidence.definition ?? "");
  const [itemType, setItemType] = useState<"word" | "phrase">(evidence.item_type);
  const [sourceType, setSourceType] = useState<"full_text" | "manual_list" | "curated_list">(evidence.source_type);
  const [sourceLabel, setSourceLabel] = useState(evidence.source_label ?? "");
  const [confidence, setConfidence] = useState(String(evidence.confidence));

  async function handleSave() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/mastery/passive-evidence/${evidence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term,
          definition: definition.trim() || null,
          itemType,
          sourceType,
          sourceLabel: sourceLabel.trim() || null,
          confidence: Number(confidence),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to update passive evidence");
      }

      toast.success(`Updated passive evidence for ${evidence.term}`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update passive evidence",
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
          <span className="sr-only">Edit {evidence.term}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit passive evidence</DialogTitle>
          <DialogDescription>
            Update how this word or phrase contributes to passive recognition.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`passive-term-${evidence.id}`}>Term or phrase</Label>
            <Input
              id={`passive-term-${evidence.id}`}
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`passive-definition-${evidence.id}`}>Meaning</Label>
            <Input
              id={`passive-definition-${evidence.id}`}
              value={definition}
              onChange={(event) => setDefinition(event.target.value)}
              placeholder="Optional definition"
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={itemType} onValueChange={(value) => setItemType(value as typeof itemType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="word">Word</SelectItem>
                <SelectItem value="phrase">Phrase</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Confidence</Label>
            <Select value={confidence} onValueChange={setConfidence}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Source type</Label>
            <Select value={sourceType} onValueChange={(value) => setSourceType(value as typeof sourceType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_text">Full Text</SelectItem>
                <SelectItem value="manual_list">Manual List</SelectItem>
                <SelectItem value="curated_list">Curated List</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`passive-source-label-${evidence.id}`}>Source label</Label>
            <Input
              id={`passive-source-label-${evidence.id}`}
              value={sourceLabel}
              onChange={(event) => setSourceLabel(event.target.value)}
              placeholder="Text title or lesson label"
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