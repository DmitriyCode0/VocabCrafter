"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";
import { toast } from "sonner";
import {
  PASSIVE_VOCABULARY_CEFR_LEVELS,
  PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
  getPassiveVocabularyCustomAttributes,
  getPassiveVocabularyUkrainianTranslation,
  formatPassiveVocabularyPartOfSpeech,
  type PassiveVocabularyLibraryAttributes,
} from "@/lib/mastery/passive-vocabulary";
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
import { Textarea } from "@/components/ui/textarea";

interface EditPassiveLibraryDialogProps {
  item: {
    id: string;
    canonical_term: string;
    item_type: "word" | "phrase";
    cefr_level: string | null;
    part_of_speech: string | null;
    attributes: PassiveVocabularyLibraryAttributes | null;
  };
  onSaved?: () => void | Promise<void>;
}

export function EditPassiveLibraryDialog({
  item,
  onSaved,
}: EditPassiveLibraryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [canonicalTerm, setCanonicalTerm] = useState(item.canonical_term);
  const [cefrLevel, setCefrLevel] = useState(item.cefr_level ?? "unknown");
  const [partOfSpeech, setPartOfSpeech] = useState(
    item.item_type === "phrase" ? "phrase" : (item.part_of_speech ?? "unknown"),
  );
  const [ukrainianTranslation, setUkrainianTranslation] = useState(
    getPassiveVocabularyUkrainianTranslation(item.attributes) ?? "",
  );
  const [attributesJson, setAttributesJson] = useState(
    JSON.stringify(
      getPassiveVocabularyCustomAttributes(item.attributes),
      null,
      2,
    ),
  );
  const availablePartsOfSpeech =
    item.item_type === "phrase"
      ? (["phrase"] as const)
      : PASSIVE_VOCABULARY_PARTS_OF_SPEECH.filter(
          (value) => value !== "phrase",
        );

  useEffect(() => {
    if (!open) {
      return;
    }

    setCanonicalTerm(item.canonical_term);
    setCefrLevel(item.cefr_level ?? "unknown");
    setPartOfSpeech(
      item.item_type === "phrase"
        ? "phrase"
        : (item.part_of_speech ?? "unknown"),
    );
    setUkrainianTranslation(
      getPassiveVocabularyUkrainianTranslation(item.attributes) ?? "",
    );
    setAttributesJson(
      JSON.stringify(
        getPassiveVocabularyCustomAttributes(item.attributes),
        null,
        2,
      ),
    );
  }, [item, open]);

  async function handleSave() {
    let parsedAttributes: PassiveVocabularyLibraryAttributes;

    try {
      const parsed = JSON.parse(attributesJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error();
      }
      parsedAttributes = parsed as PassiveVocabularyLibraryAttributes;
    } catch {
      toast.error("Attributes must be a valid JSON object");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/mastery/passive-library/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalTerm,
          cefrLevel: cefrLevel === "unknown" ? null : cefrLevel,
          partOfSpeech: partOfSpeech === "unknown" ? null : partOfSpeech,
          ukrainianTranslation,
          attributes: parsedAttributes,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update passive library item");
      }

      toast.success(`Updated ${item.canonical_term}`);
      setOpen(false);

      if (onSaved) {
        await onSaved();
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update passive library item",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <PencilLine className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Edit {item.canonical_term}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit passive library item</DialogTitle>
          <DialogDescription>
            Superadmins control the shared vocabulary library used by passive
            imports across the app.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`library-term-${item.id}`}>Canonical term</Label>
            <Input
              id={`library-term-${item.id}`}
              value={canonicalTerm}
              onChange={(event) => setCanonicalTerm(event.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`library-translation-${item.id}`}>
              Ukrainian translation
            </Label>
            <Input
              id={`library-translation-${item.id}`}
              placeholder="Add a concise Ukrainian dictionary equivalent"
              value={ukrainianTranslation}
              onChange={(event) => setUkrainianTranslation(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>CEFR level</Label>
            <Select value={cefrLevel} onValueChange={setCefrLevel}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                {PASSIVE_VOCABULARY_CEFR_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Part of speech</Label>
            <Select
              value={partOfSpeech}
              onValueChange={setPartOfSpeech}
              disabled={item.item_type === "phrase"}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {item.item_type !== "phrase" && (
                  <SelectItem value="unknown">Unknown</SelectItem>
                )}
                {availablePartsOfSpeech.map((value) => (
                  <SelectItem key={value} value={value}>
                    {formatPassiveVocabularyPartOfSpeech(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`library-attributes-${item.id}`}>
              Additional attributes JSON
            </Label>
            <Textarea
              id={`library-attributes-${item.id}`}
              value={attributesJson}
              onChange={(event) => setAttributesJson(event.target.value)}
              rows={8}
              className="font-mono text-xs"
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
