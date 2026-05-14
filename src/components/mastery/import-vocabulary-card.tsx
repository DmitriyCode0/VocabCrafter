"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookPlus, FileText, RotateCcw } from "lucide-react";
import type { LearningLanguage } from "@/lib/languages";
import { ParsedPassiveVocabularyList } from "@/components/mastery/parsed-passive-vocabulary-list";
import {
  extractPassiveVocabularyTermsFromText,
  type PassiveVocabularyItemType,
} from "@/lib/mastery/passive-vocabulary";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ActiveVocabularyDraftItem {
  term: string;
  itemType?: PassiveVocabularyItemType;
}

interface ImportVocabularyCardProps {
  targetLanguage: LearningLanguage;
  studentId?: string;
}

export function ImportVocabularyCard({
  targetLanguage,
  studentId,
}: ImportVocabularyCardProps) {
  const router = useRouter();
  const [items, setItems] = useState<ActiveVocabularyDraftItem[]>([]);
  const [rawText, setRawText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [isImporting, setIsImporting] = useState(false);

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
      const response = await fetch("/api/mastery/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          sourceLabel: sourceLabel.trim() || undefined,
          items,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        processedCount?: number;
        importedCount?: number;
        createdCount?: number;
        updatedCount?: number;
        confirmedCount?: number;
        pendingCount?: number;
        rejectedCount?: number;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to apply active vocabulary");
      }

      const processedCount = data?.processedCount ?? items.length;
      const importedCount = data?.importedCount ?? 0;
      const createdCount = data?.createdCount ?? importedCount;
      const updatedCount = data?.updatedCount ?? 0;
      const confirmedCount = data?.confirmedCount ?? importedCount;
      const pendingCount = data?.pendingCount ?? 0;
      const rejectedCount = data?.rejectedCount ?? 0;

      toast.success(
        `Processed ${processedCount} words. ${importedCount} matched the shared dictionary, ${confirmedCount} are visible now, ${pendingCount} are pending review, ${createdCount} are new evidence rows, and ${updatedCount} existing rows were refreshed${rejectedCount > 0 ? `. ${rejectedCount} rejected terms were skipped.` : "."}`,
      );
      setItems([]);
      setRawText("");
      setSourceLabel("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to apply active vocabulary",
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
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookPlus className="h-5 w-5 text-primary" />
            Add Active Vocabulary
          </CardTitle>
          <CardDescription>
            Paste a text, split it into unique words locally, review the list,
            and apply it through the shared Dictionary. Confirmed words become
            visible immediately. Pending words stay hidden until superadmin
            review.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="active-import-source-label">
                Source label (optional)
              </Label>
              <Input
                id="active-import-source-label"
                value={sourceLabel}
                onChange={(event) => setSourceLabel(event.target.value)}
                placeholder="e.g., lesson summary / article / workbook page"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="active-import-raw-text">Source text</Label>
              <Textarea
                id="active-import-raw-text"
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder="Paste the text here..."
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                individual words, sorts them alphabetically, and deduplicates
                them.
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
                Apply this list to active vocabulary through the
                shared Dictionary. Confirmed words show up immediately; pending
                words stay hidden until reviewed.
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
                  {isImporting ? "Applying..." : "Apply to Active Vocabulary"}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
