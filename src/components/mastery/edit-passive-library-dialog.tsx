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
  PASSIVE_VOCABULARY_NOUN_COUNTABILITY,
  PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
  PASSIVE_VOCABULARY_VERB_PATTERN,
  PASSIVE_VOCABULARY_VERB_REGULARITY,
  PASSIVE_VOCABULARY_VERB_STATE,
  getPassiveVocabularyCanonicalHeadword,
  getPassiveVocabularyEditableForms,
  getPassiveVocabularyEnglishDefinitions,
  getPassiveVocabularyNounCountability,
  getPassiveVocabularyTranscriptions,
  getPassiveVocabularyUkrainianTranslation,
  getPassiveVocabularyVerbPattern,
  getPassiveVocabularyVerbRegularity,
  getPassiveVocabularyVerbState,
  formatPassiveVocabularyPartOfSpeech,
  type PassiveVocabularyNounCountability,
  type PassiveVocabularyLibraryAttributes,
  type PassiveVocabularyVerbPattern,
  type PassiveVocabularyVerbRegularity,
  type PassiveVocabularyVerbState,
} from "@/lib/mastery/passive-vocabulary";
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const PASSIVE_VOCABULARY_VERB_PATTERN_LABELS: Record<
  PassiveVocabularyVerbPattern,
  string
> = {
  "v-ing": "V-ing",
  "to-v": "to V",
};

export function EditPassiveLibraryDialog({
  item,
  onSaved,
}: EditPassiveLibraryDialogProps) {
  const router = useRouter();
  const { profile } = useUser();
  const [open, setOpen] = useState(false);
  const [currentItem, setCurrentItem] =
    useState<EditablePassiveLibraryItem>(item);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<
    "unconfirmed" | "confirmed" | "rejected"
  >(item.approval_status ?? "unconfirmed");
  const [canonicalTerm, setCanonicalTerm] = useState(
    getPassiveVocabularyCanonicalHeadword(
      item.canonical_term,
      item.part_of_speech as
        | (typeof PASSIVE_VOCABULARY_PARTS_OF_SPEECH)[number]
        | null,
    ),
  );
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
  const initialTranscriptions = getPassiveVocabularyTranscriptions(
    item.attributes,
  );
  const [americanTranscription, setAmericanTranscription] = useState(
    initialTranscriptions.american ?? "",
  );
  const [britishTranscription, setBritishTranscription] = useState(
    initialTranscriptions.british ?? "",
  );
  const [nounCountability, setNounCountability] = useState<
    PassiveVocabularyNounCountability[]
  >(getPassiveVocabularyNounCountability(item.attributes));
  const [verbRegularity, setVerbRegularity] = useState<
    PassiveVocabularyVerbRegularity[]
  >(getPassiveVocabularyVerbRegularity(item.attributes));
  const [verbPattern, setVerbPattern] = useState<
    PassiveVocabularyVerbPattern[]
  >(getPassiveVocabularyVerbPattern(item.attributes));
  const [verbState, setVerbState] = useState<PassiveVocabularyVerbState[]>(
    getPassiveVocabularyVerbState(item.attributes),
  );
  const [formsText, setFormsText] = useState(
    getPassiveVocabularyEditableForms(
      item.canonical_term,
      item.part_of_speech as
        | (typeof PASSIVE_VOCABULARY_PARTS_OF_SPEECH)[number]
        | null,
      item.attributes?.forms,
      getPassiveVocabularyVerbRegularity(item.attributes),
    ).join("\n"),
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
    englishVariantPreference === "british"
      ? "British English"
      : "American English";
  const preferredTranscription =
    englishVariantPreference === "british"
      ? britishTranscription || americanTranscription
      : americanTranscription || britishTranscription;
  const hasOnlyUncountableNounCountability =
    currentItem.item_type === "word" &&
    partOfSpeech === "noun" &&
    nounCountability.length === 1 &&
    nounCountability[0] === "uncountable";
  const supportsEditableForms =
    currentItem.item_type === "word" &&
    (partOfSpeech === "adjective" ||
      partOfSpeech === "verb" ||
      partOfSpeech === "pronoun" ||
      (partOfSpeech === "noun" && !hasOnlyUncountableNounCountability));

  function resetForm(nextItem: EditablePassiveLibraryItem) {
    const canonicalHeadword = getPassiveVocabularyCanonicalHeadword(
      nextItem.canonical_term,
      nextItem.part_of_speech as
        | (typeof PASSIVE_VOCABULARY_PARTS_OF_SPEECH)[number]
        | null,
    );

    setCanonicalTerm(canonicalHeadword);
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
    setNounCountability(
      getPassiveVocabularyNounCountability(nextItem.attributes),
    );
    const nextVerbRegularity = getPassiveVocabularyVerbRegularity(
      nextItem.attributes,
    );
    setVerbRegularity(nextVerbRegularity);
    setVerbPattern(getPassiveVocabularyVerbPattern(nextItem.attributes));
    setVerbState(getPassiveVocabularyVerbState(nextItem.attributes));
    const editableForms = getPassiveVocabularyEditableForms(
      canonicalHeadword,
      nextItem.part_of_speech as
        | (typeof PASSIVE_VOCABULARY_PARTS_OF_SPEECH)[number]
        | null,
      nextItem.attributes?.forms,
      nextVerbRegularity,
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

  useEffect(() => {
    if (!hasOnlyUncountableNounCountability || formsText.length === 0) {
      return;
    }

    setFormsText("");
  }, [formsText, hasOnlyUncountableNounCountability]);

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
    const nextNounCountability =
      currentItem.item_type === "word" && partOfSpeech === "noun"
        ? nounCountability
        : [];
    const nextVerbRegularity =
      currentItem.item_type === "word" && partOfSpeech === "verb"
        ? verbRegularity
        : [];
    const nextVerbPattern =
      currentItem.item_type === "word" && partOfSpeech === "verb"
        ? verbPattern
        : [];
    const nextVerbState =
      currentItem.item_type === "word" && partOfSpeech === "verb"
        ? verbState
        : [];

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/mastery/passive-library/${currentItem.id}`,
        {
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
            nounCountability: nextNounCountability,
            verbPattern: nextVerbPattern,
            verbRegularity: nextVerbRegularity,
            verbState: nextVerbState,
            forms,
          }),
        },
      );

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

  function toggleNounCountability(
    value: PassiveVocabularyNounCountability,
    checked: boolean,
  ) {
    setNounCountability((current) => {
      const nextValues = checked
        ? new Set<PassiveVocabularyNounCountability>([...current, value])
        : new Set(current.filter((entry) => entry !== value));

      return PASSIVE_VOCABULARY_NOUN_COUNTABILITY.filter((entry) =>
        nextValues.has(entry),
      );
    });
  }

  function toggleVerbRegularity(
    value: PassiveVocabularyVerbRegularity,
    checked: boolean,
  ) {
    setVerbRegularity((current) => {
      const nextValues = checked
        ? new Set<PassiveVocabularyVerbRegularity>([...current, value])
        : new Set(current.filter((entry) => entry !== value));

      return PASSIVE_VOCABULARY_VERB_REGULARITY.filter((entry) =>
        nextValues.has(entry),
      );
    });
  }

  function toggleVerbPattern(
    value: PassiveVocabularyVerbPattern,
    checked: boolean,
  ) {
    setVerbPattern((current) => {
      const nextValues = checked
        ? new Set<PassiveVocabularyVerbPattern>([...current, value])
        : new Set(current.filter((entry) => entry !== value));

      return PASSIVE_VOCABULARY_VERB_PATTERN.filter((entry) =>
        nextValues.has(entry),
      );
    });
  }

  function toggleVerbState(
    value: PassiveVocabularyVerbState,
    checked: boolean,
  ) {
    setVerbState((current) => {
      const nextValues = checked
        ? new Set<PassiveVocabularyVerbState>([...current, value])
        : new Set(current.filter((entry) => entry !== value));

      return PASSIVE_VOCABULARY_VERB_STATE.filter((entry) =>
        nextValues.has(entry),
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <PencilLine className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Edit {item.canonical_term}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
              onChange={(event) =>
                setEnglishDefinitionsText(event.target.value)
              }
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
              Preferred transcription for your current setting (
              {preferredEnglishVariantLabel}): {preferredTranscription || "—"}
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

          {currentItem.item_type === "word" && partOfSpeech === "noun" ? (
            <div className="space-y-2 sm:col-span-2">
              <div className="flex flex-wrap gap-4 pt-1">
                {PASSIVE_VOCABULARY_NOUN_COUNTABILITY.map((value) => {
                  const id = `library-noun-countability-${item.id}-${value}`;

                  return (
                    <label
                      key={value}
                      htmlFor={id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={id}
                        checked={nounCountability.includes(value)}
                        onCheckedChange={(checked) =>
                          toggleNounCountability(value, checked === true)
                        }
                      />
                      <span className="capitalize">{value}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {currentItem.item_type === "word" && partOfSpeech === "verb" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Verb pattern</Label>
              <div className="flex flex-wrap gap-4 pt-1">
                {PASSIVE_VOCABULARY_VERB_PATTERN.map((value) => {
                  const id = `library-verb-pattern-${item.id}-${value}`;

                  return (
                    <label
                      key={value}
                      htmlFor={id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={id}
                        checked={verbPattern.includes(value)}
                        onCheckedChange={(checked) =>
                          toggleVerbPattern(value, checked === true)
                        }
                      />
                      <span>
                        {PASSIVE_VOCABULARY_VERB_PATTERN_LABELS[value]}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {currentItem.item_type === "word" && partOfSpeech === "verb" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Verb regularity</Label>
              <div className="flex flex-wrap gap-4 pt-1">
                {PASSIVE_VOCABULARY_VERB_REGULARITY.map((value) => {
                  const id = `library-verb-regularity-${item.id}-${value}`;

                  return (
                    <label
                      key={value}
                      htmlFor={id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={id}
                        checked={verbRegularity.includes(value)}
                        onCheckedChange={(checked) =>
                          toggleVerbRegularity(value, checked === true)
                        }
                      />
                      <span className="capitalize">{value}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {currentItem.item_type === "word" && partOfSpeech === "verb" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Verb state</Label>
              <div className="flex flex-wrap gap-4 pt-1">
                {PASSIVE_VOCABULARY_VERB_STATE.map((value) => {
                  const id = `library-verb-state-${item.id}-${value}`;

                  return (
                    <label
                      key={value}
                      htmlFor={id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={id}
                        checked={verbState.includes(value)}
                        onCheckedChange={(checked) =>
                          toggleVerbState(value, checked === true)
                        }
                      />
                      <span className="capitalize">{value}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {supportsEditableForms ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`library-forms-${item.id}`}>Editable forms</Label>
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
                rows={
                  partOfSpeech === "verb" || partOfSpeech === "pronoun" ? 4 : 2
                }
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
