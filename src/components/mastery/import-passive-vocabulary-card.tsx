"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookMarked, FileText, RotateCcw, Upload } from "lucide-react";
import type { LearningLanguage } from "@/lib/languages";
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
import { Textarea } from "@/components/ui/textarea";
import { ParsedPassiveVocabularyList } from "@/components/mastery/parsed-passive-vocabulary-list";
import { extractPassiveVocabularyTermsFromText } from "@/lib/mastery/passive-vocabulary";

export interface PassiveVocabularyDraftItem {
  term: string;
}

interface ImportPassiveVocabularyCardProps {
  targetLanguage: LearningLanguage;
  studentId?: string;
  cardId?: string;
}

const ACCEPTED_TEXT_FILE_TYPES = ".txt,.md,.markdown,.text";

export function ImportPassiveVocabularyCard({
  targetLanguage,
  studentId,
  cardId,
}: ImportPassiveVocabularyCardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<PassiveVocabularyDraftItem[]>([]);
  const [rawText, setRawText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [isImporting, setIsImporting] = useState(false);

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

  function handleExtractWords() {
    const extractedTerms = extractPassiveVocabularyTermsFromText(rawText);

    if (extractedTerms.length === 0) {
      toast.error("No words found in the provided text");
      return;
    }

    setItems(extractedTerms.map((term) => ({ term })));
  }

  async function handleImport() {
    if (items.length === 0) {
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch("/api/mastery/passive-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          sourceType: "full_text",
          sourceLabel: sourceLabel.trim() || undefined,
          items,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        importedCount?: number;
        createdCount?: number;
        updatedCount?: number;
      } | null;

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to import passive vocabulary evidence",
        );
      }

      toast.success(
        `Imported ${data?.importedCount ?? items.length} passive-recognition items. Added ${data?.createdCount ?? 0} new and updated ${data?.updatedCount ?? 0} existing entries.`,
      );
      setItems([]);
      setRawText("");
      setSourceLabel("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
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

  return (
    <Card id={cardId}>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookMarked className="h-5 w-5 text-primary" />
              Import Passive Vocabulary
            </CardTitle>
            <CardDescription>
              Paste a text. It will be split into unique individual words and
              saved as passive vocabulary.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passive-raw-text">Known text</Label>
              <Textarea
                id="passive-raw-text"
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder="Paste the text here..."
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={handleExtractWords}
                disabled={!rawText.trim()}
                className="w-full sm:w-auto"
              >
                <FileText className="mr-2 h-4 w-4" />
                Extract Unique Words
              </Button>
              <p className="text-sm text-muted-foreground">
                This does not use the AI parser. It simply splits the text into
                individual words and deduplicates them.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ParsedPassiveVocabularyList
              items={items}
              onItemsChange={setItems}
              targetLanguage={targetLanguage}
            />

            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                These words increase passive-recognition estimates only. They do
                not get due dates, review sessions, meanings, or active mastery
                levels.
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
                  {isImporting ? "Importing..." : "Import Passive Evidence"}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
