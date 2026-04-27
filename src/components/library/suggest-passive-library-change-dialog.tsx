"use client";

import { useEffect, useState, useTransition } from "react";
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
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";
import { createPassiveVocabularyLibrarySuggestion } from "@/app/(platform)/library/actions";
import { useAppI18n } from "@/components/providers/app-language-provider";
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

interface PendingSuggestionDraft {
  proposed_canonical_term: string;
  proposed_cefr_level: PassiveVocabularyLibraryCefrLevel | null;
  proposed_part_of_speech: PassiveVocabularyPartOfSpeech | null;
  proposed_attributes: PassiveVocabularyLibraryAttributes;
  suggestion_note: string | null;
}

interface SuggestPassiveLibraryChangeDialogProps {
  item: {
    id: string;
    canonical_term: string;
    item_type: "word" | "phrase";
    cefr_level: PassiveVocabularyLibraryCefrLevel | null;
    part_of_speech: PassiveVocabularyPartOfSpeech | null;
    attributes: PassiveVocabularyLibraryAttributes | null;
  };
  pendingSuggestion?: PendingSuggestionDraft | null;
}

type SuggestionCefrState = PassiveVocabularyLibraryCefrLevel | "unknown";
type SuggestionPartOfSpeechState = PassiveVocabularyPartOfSpeech | "unknown";

export function SuggestPassiveLibraryChangeDialog({
  item,
  pendingSuggestion,
}: SuggestPassiveLibraryChangeDialogProps) {
  const router = useRouter();
  const { messages } = useAppI18n();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [canonicalTerm, setCanonicalTerm] = useState(item.canonical_term);
  const [cefrLevel, setCefrLevel] = useState<SuggestionCefrState>(
    (item.cefr_level as PassiveVocabularyLibraryCefrLevel | null) ?? "unknown",
  );
  const [partOfSpeech, setPartOfSpeech] = useState<SuggestionPartOfSpeechState>(
    item.item_type === "phrase"
      ? "phrase"
      : ((item.part_of_speech as PassiveVocabularyPartOfSpeech | null) ??
          "unknown"),
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
  const [suggestionNote, setSuggestionNote] = useState("");
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

    const sourceAttributes = pendingSuggestion?.proposed_attributes ?? item.attributes;

    setCanonicalTerm(
      pendingSuggestion?.proposed_canonical_term ?? item.canonical_term,
    );
    setCefrLevel(
      pendingSuggestion?.proposed_cefr_level ?? item.cefr_level ?? "unknown",
    );
    setPartOfSpeech(
      item.item_type === "phrase"
        ? "phrase"
        : (pendingSuggestion?.proposed_part_of_speech ??
            item.part_of_speech ??
            "unknown"),
    );
    setUkrainianTranslation(
      getPassiveVocabularyUkrainianTranslation(sourceAttributes) ?? "",
    );
    setAttributesJson(
      JSON.stringify(
        getPassiveVocabularyCustomAttributes(sourceAttributes),
        null,
        2,
      ),
    );
    setSuggestionNote(pendingSuggestion?.suggestion_note ?? "");
  }, [item, open, pendingSuggestion]);

  function handleSave() {
    let parsedAttributes: PassiveVocabularyLibraryAttributes;

    try {
      const parsed = JSON.parse(attributesJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error();
      }
      parsedAttributes = parsed as PassiveVocabularyLibraryAttributes;
    } catch {
      toast.error(messages.library.dictionary.invalidAttributes);
      return;
    }

    startTransition(async () => {
      try {
        await createPassiveVocabularyLibrarySuggestion({
          libraryItemId: item.id,
          canonicalTerm,
          cefrLevel:
            item.item_type === "phrase" || cefrLevel === "unknown"
              ? null
              : (cefrLevel as "A1" | "A2" | "B1" | "B2" | "C1" | "C2"),
          partOfSpeech:
            item.item_type === "phrase" || partOfSpeech === "unknown"
              ? null
              : partOfSpeech,
          ukrainianTranslation,
          attributes: parsedAttributes,
          suggestionNote,
        });
        toast.success(
          pendingSuggestion
            ? messages.library.dictionary.updatedSuggestion(item.canonical_term)
            : messages.library.dictionary.submittedSuggestion(item.canonical_term),
        );
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : messages.library.dictionary.submitSuggestionFailed,
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PencilLine className="mr-2 h-4 w-4" />
          {pendingSuggestion
            ? messages.library.dictionary.updateSuggestionAction
            : messages.library.dictionary.suggestChangeAction}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{messages.library.dictionary.suggestionDialogTitle}</DialogTitle>
          <DialogDescription>
            {messages.library.dictionary.suggestionDialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`suggest-library-term-${item.id}`}>
              {messages.library.dictionary.canonicalTermLabel}
            </Label>
            <Input
              id={`suggest-library-term-${item.id}`}
              value={canonicalTerm}
              onChange={(event) => setCanonicalTerm(event.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`suggest-library-translation-${item.id}`}>
              {messages.library.dictionary.ukrainianTranslationLabel}
            </Label>
            <Input
              id={`suggest-library-translation-${item.id}`}
              placeholder={messages.library.dictionary.translationPlaceholder}
              value={ukrainianTranslation}
              onChange={(event) => setUkrainianTranslation(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{messages.library.dictionary.cefrLevelLabel}</Label>
            <Select
              value={item.item_type === "phrase" ? "unknown" : cefrLevel}
              onValueChange={(value) =>
                setCefrLevel(value as SuggestionCefrState)
              }
              disabled={item.item_type === "phrase"}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">
                  {messages.library.dictionary.unknownValue}
                </SelectItem>
                {PASSIVE_VOCABULARY_CEFR_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{messages.library.dictionary.partOfSpeechLabel}</Label>
            <Select
              value={partOfSpeech}
              onValueChange={(value) =>
                setPartOfSpeech(value as SuggestionPartOfSpeechState)
              }
              disabled={item.item_type === "phrase"}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {item.item_type !== "phrase" && (
                  <SelectItem value="unknown">
                    {messages.library.dictionary.unknownValue}
                  </SelectItem>
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
            <Label htmlFor={`suggest-library-note-${item.id}`}>
              {messages.library.dictionary.noteLabel}
            </Label>
            <Textarea
              id={`suggest-library-note-${item.id}`}
              rows={3}
              placeholder={messages.library.dictionary.notePlaceholder}
              value={suggestionNote}
              onChange={(event) => setSuggestionNote(event.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`suggest-library-attributes-${item.id}`}>
              {messages.library.dictionary.additionalAttributesLabel}
            </Label>
            <Textarea
              id={`suggest-library-attributes-${item.id}`}
              value={attributesJson}
              onChange={(event) => setAttributesJson(event.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {messages.common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending
              ? messages.library.dictionary.submittingAction
              : pendingSuggestion
                ? messages.library.dictionary.updateSuggestionAction
                : messages.library.dictionary.submitSuggestionAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}