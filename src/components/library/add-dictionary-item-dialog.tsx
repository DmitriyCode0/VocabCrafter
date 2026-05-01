"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppI18n } from "@/components/providers/app-language-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addManualPassiveVocabularyLibraryItems } from "@/app/(platform)/library/actions";
import { PASSIVE_VOCABULARY_PARTS_OF_SPEECH, type PassiveVocabularyPartOfSpeech } from "@/lib/mastery/passive-vocabulary";

interface AddDictionaryItemDialogProps {
  role: "tutor" | "superadmin";
  onAdded: () => Promise<void>;
}

export function AddDictionaryItemDialog({
  role,
  onAdded,
}: AddDictionaryItemDialogProps) {
  const { messages } = useAppI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Single mode state
  const [term, setTerm] = useState("");
  const [itemType, setItemType] = useState<"word" | "phrase">("word");
  const [partOfSpeech, setPartOfSpeech] = useState<PassiveVocabularyPartOfSpeech | "auto">("auto");

  // Batch mode state
  const [batchText, setBatchText] = useState("");
  const [batchItemType, setBatchItemType] = useState<"word" | "phrase">("word");
  const [batchPartOfSpeech, setBatchPartOfSpeech] = useState<PassiveVocabularyPartOfSpeech | "auto">("auto");

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;

    setIsSubmitting(true);
    try {
      await addManualPassiveVocabularyLibraryItems([{
        term: term.trim(),
        itemType,
        ...(partOfSpeech !== "auto" && { partOfSpeech }),
      }]);
      toast.success(
        messages.library.dictionary.reEnrichedSuccess?.(term) ??
          `Successfully added "${term}" to dictionary.`,
      );
      setIsOpen(false);
      setTerm("");
      setItemType("word");
      setPartOfSpeech("auto");
      await onAdded();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : messages.library.dictionary.reEnrichFailed ??
              "Failed to add dictionary item.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim()) return;

    // Split by comma or newline
    const terms = batchText
      .split(/[\n,]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (terms.length === 0) return;

    setIsSubmitting(true);
    try {
      await addManualPassiveVocabularyLibraryItems(terms.map(t => ({
        term: t,
        itemType: batchItemType,
        ...(batchPartOfSpeech !== "auto" && { partOfSpeech: batchPartOfSpeech }),
      })));
      toast.success(`Successfully added ${terms.length} items to dictionary.`);
      setIsOpen(false);
      setBatchText("");
      setBatchItemType("word");
      setBatchPartOfSpeech("auto");
      await onAdded();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to add batch items.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Add Word
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add to Dictionary</DialogTitle>
          <DialogDescription>
            Manually add new words or phrases to the passive vocabulary library.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single Word</TabsTrigger>
            <TabsTrigger value="batch">Batch Import</TabsTrigger>
          </TabsList>

          <TabsContent value="single">
            <form onSubmit={handleSubmitSingle}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="term">Term</Label>
                  <Input
                    id="term"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="e.g. ubiquitous"
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="item-type">Type</Label>
                    <Select
                      value={itemType}
                      onValueChange={(value) => setItemType(value as "word" | "phrase")}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="item-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="word">Word</SelectItem>
                        <SelectItem value="phrase">Phrase</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="part-of-speech">Part of Speech</Label>
                    <Select
                      value={partOfSpeech}
                      onValueChange={(value) => setPartOfSpeech(value as PassiveVocabularyPartOfSpeech | "auto")}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="part-of-speech">
                        <SelectValue placeholder="Auto (AI)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (AI)</SelectItem>
                        {PASSIVE_VOCABULARY_PARTS_OF_SPEECH.map((pos) => (
                          <SelectItem key={pos} value={pos}>
                            {pos.charAt(0).toUpperCase() + pos.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!term.trim() || isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="batch">
            <form onSubmit={handleSubmitBatch}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="batchText">Terms (comma or newline separated)</Label>
                  <Textarea
                    id="batchText"
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder="apple, banana&#10;orange&#10;ubiquitous"
                    disabled={isSubmitting}
                    className="min-h-[120px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="batch-item-type">Type</Label>
                    <Select
                      value={batchItemType}
                      onValueChange={(value) => setBatchItemType(value as "word" | "phrase")}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="batch-item-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="word">Word</SelectItem>
                        <SelectItem value="phrase">Phrase</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="batch-part-of-speech">Part of Speech</Label>
                    <Select
                      value={batchPartOfSpeech}
                      onValueChange={(value) => setBatchPartOfSpeech(value as PassiveVocabularyPartOfSpeech | "auto")}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="batch-part-of-speech">
                        <SelectValue placeholder="Auto (AI)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (AI)</SelectItem>
                        {PASSIVE_VOCABULARY_PARTS_OF_SPEECH.map((pos) => (
                          <SelectItem key={pos} value={pos}>
                            {pos.charAt(0).toUpperCase() + pos.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!batchText.trim() || isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Items
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
