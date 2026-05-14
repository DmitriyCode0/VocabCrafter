"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PencilLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/hooks/use-user";
import { normalizeEnglishVariantPreference } from "@/lib/languages";
import { confirmPassiveVocabularyLibraryItem } from "@/app/(platform)/library/actions";
import {
  PASSIVE_VOCABULARY_CEFR_LEVELS,
  PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
  getPassiveVocabularyEditableForms,
  getPassiveVocabularyEnglishDefinitions,
  getPassiveVocabularyTranscriptions,
  getPassiveVocabularyUkrainianTranslation,
  formatPassiveVocabularyPartOfSpeech,
  type PassiveVocabularyLibraryAttributes,
} from "@/lib/mastery/passive-vocabulary";
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";
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
    approval_status?: "unconfirmed" | "confirmed" | "rejected";
    attributes: PassiveVocabularyLibraryAttributes | null;
  };
  onSaved?: () => void | Promise<void>;
}

type EditablePassiveLibraryItem = EditPassiveLibraryDialogProps["item"];

export function EditPassiveLibraryDialog({
  item,
  onSaved,
}: EditPassiveLibraryDialogProps) {
  const router = useRouter();
  const { profile } = useUser();
  const [open, setOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<EditablePassiveLibraryItem>(item);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<
    "unconfirmed" | "confirmed" | "rejected"
  >(item.approval_status ?? "unconfirmed");
  const [canonicalTerm, setCanonicalTerm] = useState(item.canonical_term);
  const [cefrLevel, setCefrLevel] = useState(item.cefr_level ?? "unknown");
  const [partOfSpeech, setPartOfSpeech] = useState(
    item.item_type === "phrase" ? "phrase" : (item.part_of_speech ?? "unknown"),
  );
  const [ukrainianTranslation, setUkrainianTranslation] = useState(
    getPassiveVocabularyUkrainianTranslation(item.attributes) ?? "",
  );
  const [englishDefinitionsText, setEnglishDefinitionsText] = useState(
    getPassiveVocabularyEnglishDefinitions(item.attributes).join("\n"),
  );
  const initialTranscriptions = getPassiveVocabularyTranscriptions(item.attributes);
  const [americanTranscription, setAmericanTranscription] = useState(
    initialTranscriptions.american ?? "",
  );
  const [britishTranscription, setBritishTranscription] = useState(
    initialTranscriptions.british ?? "",
  );
  const [formsText, setFormsText] = useState(
    getPassiveVocabularyEditableForms(
      item.canonical_term,
      item.part_of_speech as typeof PASSIVE_VOCABULARY_PARTS_OF_SPEECH[number] | null,
      item.attributes?.forms,
    )
      .join("\n"),
  );
  const availablePartsOfSpeech =
    currentItem.item_type === "phrase"
      ? (["phrase"] as const)
      : PASSIVE_VOCABULARY_PARTS_OF_SPEECH.filter(
          (value) => value !== "phrase",
        );
  const englishVariantPreference = normalizeEnglishVariantPreference(
    profile?.english_variant_preference,
  );
  const preferredEnglishVariantLabel =
    englishVariantPreference === "british" ? "British English" : "American English";
  const preferredTranscription =
    englishVariantPreference === "british"
      ? britishTranscription || americanTranscription
      : americanTranscription || britishTranscription;

  function resetForm(nextItem: EditablePassiveLibraryItem) {
    setCanonicalTerm(nextItem.canonical_term);
    setCefrLevel(nextItem.cefr_level ?? "unknown");
    setPartOfSpeech(
      nextItem.item_type === "phrase"
        ? "phrase"
        : (nextItem.part_of_speech ?? "unknown"),
    );
    setUkrainianTranslation(
      getPassiveVocabularyUkrainianTranslation(nextItem.attributes) ?? "",
    );
    setEnglishDefinitionsText(
      getPassiveVocabularyEnglishDefinitions(nextItem.attributes).join("\n"),
    );
    const nextTranscriptions = getPassiveVocabularyTranscriptions(
      nextItem.attributes,
    );
    setAmericanTranscription(nextTranscriptions.american ?? "");
    setBritishTranscription(nextTranscriptions.british ?? "");
    const editableForms = getPassiveVocabularyEditableForms(
      nextItem.canonical_term,
      nextItem.part_of_speech as typeof PASSIVE_VOCABULARY_PARTS_OF_SPEECH[number] | null,
      nextItem.attributes?.forms,
    );
    setFormsText(editableForms.join("\n"));
  }

  useEffect(() => {
    setCurrentItem(item);
    setApprovalStatus(item.approval_status ?? "unconfirmed");
  }, [item]);

  useEffect(() => {
    if (!open) {
      return;
    }

    resetForm(currentItem);
  }, [currentItem, open]);

  async function handleGenerateMetadata() {
    if (currentItem.item_type !== "word") {
      return;
    }

    setIsGeneratingMetadata(true);

    try {
      const response = await fetch(
        `/api/mastery/passive-library/${currentItem.id}/re-enrich`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        mergedSourceItemId?: string | null;
        item?: EditablePassiveLibraryItem;
      } | null;

      if (!response.ok || !data?.item) {
        throw new Error(
          data?.error || "Failed to generate dictionary metadata",
        );
      }

      setCurrentItem(data.item);
      resetForm(data.item);

      if (data.mergedSourceItemId) {
        toast.success(
          `Generated metadata and merged "${currentItem.canonical_term}" into "${data.item.canonical_term}"`,
        );
        setOpen(false);

        if (onSaved) {
          await onSaved();
        } else {
          router.refresh();
        }

        return;
      }

      toast.success(`Generated metadata for "${data.item.canonical_term}"`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate dictionary metadata",
      );
    } finally {
      setIsGeneratingMetadata(false);
    }
  }

  async function handleSave() {
    const englishDefinitions = Array.from(
      new Set(
        englishDefinitionsText
          .split(/\r?\n/)
          .map((value) => value.trim().replace(/\s+/g, " "))
          .filter(Boolean),
      ),
    );
    const supportsEditableForms =
      currentItem.item_type === "word" &&
      (partOfSpeech === "noun" ||
        partOfSpeech === "adjective" ||
        partOfSpeech === "verb" ||
        partOfSpeech === "pronoun");
    const forms = supportsEditableForms
      ? Array.from(
          new Set(
            formsText
              .split(/\r?\n/)
              .map((value) => value.trim().replace(/\s+/g, " "))
              .filter(Boolean),
          ),
        )
      : [];

    setIsSaving(true);

    try {
      const response = await fetch(`/api/mastery/passive-library/${currentItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalTerm,
          cefrLevel: cefrLevel === "unknown" ? null : cefrLevel,
          partOfSpeech: partOfSpeech === "unknown" ? null : partOfSpeech,
          ukrainianTranslation,
          englishDefinitions,
          americanTranscription,
          britishTranscription,
          forms,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update passive library item");
      }

      toast.success(`Updated ${currentItem.canonical_term}`);
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

  async function handleConfirm() {
    setIsConfirming(true);

    try {
      await confirmPassiveVocabularyLibraryItem(currentItem.id);
      setApprovalStatus("confirmed");
      toast.success(`Confirmed "${currentItem.canonical_term}"`);
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
          : "Failed to confirm dictionary item",
      );
    } finally {
      setIsConfirming(false);
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
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={`library-term-${item.id}`}
                value={canonicalTerm}
                onChange={(event) => setCanonicalTerm(event.target.value)}
              />
              <BrowserTtsButton
                text={canonicalTerm}
                browserOnly
                englishVariantPreference={englishVariantPreference}
                label="Pronounce"
                className="w-full sm:w-auto"
              />
            </div>
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

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`library-english-definitions-${item.id}`}>
              English meanings
            </Label>
            <p className="text-xs text-muted-foreground">
              One meaning per line. The first entry becomes the primary meaning.
            </p>
            <Textarea
              id={`library-english-definitions-${item.id}`}
              value={englishDefinitionsText}
              onChange={(event) => setEnglishDefinitionsText(event.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`library-transcription-american-${item.id}`}>
              American IPA transcription
            </Label>
            <Input
              id={`library-transcription-american-${item.id}`}
              value={americanTranscription}
              onChange={(event) => setAmericanTranscription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`library-transcription-british-${item.id}`}>
              British IPA transcription
            </Label>
            <Input
              id={`library-transcription-british-${item.id}`}
              value={britishTranscription}
              onChange={(event) => setBritishTranscription(event.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">
              Preferred transcription for your current setting ({preferredEnglishVariantLabel}): {preferredTranscription || "—"}
            </p>
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

          {(currentItem.item_type === "word" &&
            (partOfSpeech === "noun" ||
              partOfSpeech === "adjective" ||
              partOfSpeech === "verb" ||
              partOfSpeech === "pronoun")) ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`library-forms-${item.id}`}>
              Editable forms
            </Label>
            <p className="text-xs text-muted-foreground">
              {partOfSpeech === "noun"
                ? "Use one line for the plural form only. Searches for that form resolve to the canonical noun."
                : partOfSpeech === "adjective"
                  ? "Use one line each for the comparative and superlative forms. Searches for those forms resolve to the canonical adjective."
                : partOfSpeech === "verb"
                  ? "Use one line each for V2, V3, V-ing, and V-(e)s. Searches for those forms resolve to the canonical verb."
                  : "Use one line each for the object pronoun, possessive adjective, possessive pronoun, and reflexive pronoun. Searches for those forms resolve to the canonical subject pronoun."}
            </p>
            <Textarea
              id={`library-forms-${item.id}`}
              value={formsText}
              onChange={(event) => setFormsText(event.target.value)}
              rows={partOfSpeech === "verb" || partOfSpeech === "pronoun" ? 4 : 2}
              className="font-mono text-xs"
            />
          </div>
          ) : null}
        </div>

        <DialogFooter>
          {currentItem.item_type === "word" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleGenerateMetadata()}
              disabled={isSaving || isGeneratingMetadata || isConfirming}
            >
              {isGeneratingMetadata ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isGeneratingMetadata ? "Generating..." : "Generate Metadata"}
            </Button>
          ) : null}
          {approvalStatus !== "confirmed" ? (
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={isSaving || isGeneratingMetadata || isConfirming}
            >
              {isConfirming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {isConfirming ? "Confirming..." : "Confirm"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving || isGeneratingMetadata || isConfirming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isGeneratingMetadata || isConfirming}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
