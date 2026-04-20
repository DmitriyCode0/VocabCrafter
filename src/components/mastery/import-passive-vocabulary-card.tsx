"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookMarked, FileText, RotateCcw, Upload } from "lucide-react";
import {
  TARGET_LANGUAGE_OPTIONS,
  type LearningLanguage,
} from "@/lib/languages";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ParsedPassiveVocabularyList } from "@/components/mastery/parsed-passive-vocabulary-list";
import {
  extractPassiveVocabularyTermsFromText,
  inferPassiveVocabularyItemType,
  normalizePassiveVocabularyText,
  type PassiveVocabularyItemType,
} from "@/lib/mastery/passive-vocabulary";

export interface PassiveVocabularyDraftItem {
  term: string;
  itemType?: PassiveVocabularyItemType;
}

type ImportPassiveVocabularyMode = "evidence" | "library";

interface ImportPassiveVocabularyCardProps {
  targetLanguage: LearningLanguage;
  studentId?: string;
  cardId?: string;
  mode?: ImportPassiveVocabularyMode;
}

const ACCEPTED_TEXT_FILE_TYPES = ".txt,.md,.markdown,.text";

export function ImportPassiveVocabularyCard({
  targetLanguage,
  studentId,
  cardId,
  mode = "evidence",
}: ImportPassiveVocabularyCardProps) {
  const router = useRouter();
  const isLibraryMode = mode === "library";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<PassiveVocabularyDraftItem[]>([]);
  const [rawText, setRawText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTargetLanguage, setSelectedTargetLanguage] =
    useState<LearningLanguage>(targetLanguage);

  useEffect(() => {
    setSelectedTargetLanguage(targetLanguage);
  }, [targetLanguage]);

  async function handleTextFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const fileText = await file.text();
      setRawText((current) =>
        current.trim().length > 0
          ? `${current.trim()}\n\n${fileText.trim()}`
          : fileText.trim(),
      );

      if (!sourceLabel.trim()) {
        setSourceLabel(file.name.replace(/\.[^.]+$/, ""));
      }
    } catch {
      toast.error("Failed to read text file");
    }
  }

  function parseBatchListItems() {
    const dedupedItems = new Map<string, PassiveVocabularyDraftItem>();

    for (const rawLine of rawText.split(/\r?\n/)) {
      const trimmedTerm = rawLine.trim().replace(/\s+/g, " ");
      const normalizedTerm = normalizePassiveVocabularyText(trimmedTerm);

      if (!normalizedTerm) {
        continue;
      }

      const itemType = inferPassiveVocabularyItemType(trimmedTerm);
      dedupedItems.set(`${itemType}:${normalizedTerm}`, {
        term: trimmedTerm,
        itemType,
      });
    }

    return Array.from(dedupedItems.values());
  }

  function handleExtractWords() {
    const extractedTerms = extractPassiveVocabularyTermsFromText(rawText);

    if (extractedTerms.length === 0) {
      toast.error("No words found in the provided text");
      return;
    }

    setItems(extractedTerms.map((term) => ({ term })));
  }

  function handleUseBatchList() {
    const parsedItems = parseBatchListItems();

    if (parsedItems.length === 0) {
      toast.error("No items found in the provided batch list");
      return;
    }

    setItems(parsedItems);
  }

  async function handleImport() {
    if (items.length === 0) {
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch(
        isLibraryMode ? "/api/mastery/passive-library" : "/api/mastery/passive-import",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isLibraryMode
              ? {
                  targetLanguage: selectedTargetLanguage,
                  sourceLabel: sourceLabel.trim() || undefined,
                  items,
                }
              : {
                  studentId,
                  sourceType: "full_text",
                  sourceLabel: sourceLabel.trim() || undefined,
                  items,
                },
          ),
        },
      );

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        processedCount?: number;
        importedCount?: number;
        createdCount?: number;
        updatedCount?: number;
        existingCount?: number;
      } | null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            (isLibraryMode
              ? "Failed to import shared vocabulary items"
              : "Failed to import passive vocabulary evidence"),
        );
      }

      if (isLibraryMode) {
        toast.success(
          `Processed ${data?.processedCount ?? items.length} terms into ${data?.importedCount ?? 0} dictionary entries. Added ${data?.createdCount ?? 0} new and matched ${data?.existingCount ?? 0} existing entries.`,
        );
      } else {
        toast.success(
          `Imported ${data?.importedCount ?? items.length} passive-recognition items. Added ${data?.createdCount ?? 0} new and updated ${data?.updatedCount ?? 0} existing entries.`,
        );
      }
      setItems([]);
      setRawText("");
      setSourceLabel("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isLibraryMode
            ? "Failed to import shared vocabulary items"
            : "Failed to import passive vocabulary evidence",
      );
    } finally {
      setIsImporting(false);
    }
  }

  function handleStartOver() {
    setItems([]);
    setRawText("");
    setSourceLabel("");
  }

  const activeTargetLanguage = isLibraryMode
    ? selectedTargetLanguage
    : targetLanguage;

  return (
    <Card id={cardId}>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookMarked className="h-5 w-5 text-primary" />
              {isLibraryMode
                ? "Import Shared Vocabulary"
                : "Import Passive Vocabulary"}
            </CardTitle>
            <CardDescription>
              {isLibraryMode
                ? "Paste text to extract unique words, or paste one term per line to enrich the shared dictionary in batches."
                : "Paste a text. It will be split into unique individual words and saved as passive vocabulary."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TEXT_FILE_TYPES}
          className="hidden"
          onChange={handleTextFileSelection}
        />

        {items.length === 0 ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {isLibraryMode && (
                <div className="space-y-2">
                  <Label>Target language</Label>
                  <Select
                    value={selectedTargetLanguage}
                    onValueChange={(value) =>
                      setSelectedTargetLanguage(value as LearningLanguage)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_LANGUAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor={`${cardId ?? mode}-source-label`}>
                  Source label (optional)
                </Label>
                <Input
                  id={`${cardId ?? mode}-source-label`}
                  value={sourceLabel}
                  onChange={(event) => setSourceLabel(event.target.value)}
                  placeholder="e.g., Oxford 3000 / lesson 4 / book chapter"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${cardId ?? mode}-passive-raw-text`}>
                {isLibraryMode ? "Source text or batch list" : "Known text"}
              </Label>
              <Textarea
                id={`${cardId ?? mode}-passive-raw-text`}
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder={
                  isLibraryMode
                    ? "Paste source text here, or one dictionary term per line..."
                    : "Paste the text here..."
                }
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Text File
              </Button>
              <Button
                type="button"
                onClick={handleExtractWords}
                disabled={!rawText.trim()}
                className="w-full sm:w-auto"
              >
                <FileText className="mr-2 h-4 w-4" />
                Extract Unique Words
              </Button>
              {isLibraryMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseBatchList}
                  disabled={!rawText.trim()}
                  className="w-full sm:w-auto"
                >
                  <BookMarked className="mr-2 h-4 w-4" />
                  Use One Entry Per Line
                </Button>
              )}
              <p className="text-sm text-muted-foreground">
                {isLibraryMode
                  ? "Unique-word extraction skips AI parsing. For phrasal verbs or idioms, use one entry per line so multi-word entries stay intact."
                  : "This does not use the AI parser. It simply splits the text into individual words and deduplicates them."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <ParsedPassiveVocabularyList
              items={items}
              onItemsChange={setItems}
              targetLanguage={activeTargetLanguage}
            />

            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                {isLibraryMode
                  ? "These terms create or reuse shared dictionary entries. New ones will be enriched with canonical form, CEFR level, part of speech, and Ukrainian translation."
                  : "These words increase passive-recognition estimates only. They do not get due dates, review sessions, meanings, or active mastery levels."}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={handleStartOver}
                  disabled={isImporting}
                  className="w-full sm:w-auto"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isImporting || items.length === 0}
                  className="w-full sm:w-auto"
                >
                  {isImporting
                    ? "Importing..."
                    : isLibraryMode
                      ? "Import to Shared Library"
                      : "Import Passive Evidence"}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
