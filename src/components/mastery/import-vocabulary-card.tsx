"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookPlus, RotateCcw } from "lucide-react";
import type { QuizTerm } from "@/types/quiz";
import type { LearningLanguage, SourceLanguage } from "@/lib/languages";
import { WordInput } from "@/components/quiz/word-input";
import { ParsedWordList } from "@/components/quiz/parsed-word-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ImportVocabularyCardProps {
  targetLanguage: LearningLanguage;
  sourceLanguage: SourceLanguage;
}

export function ImportVocabularyCard({
  targetLanguage,
  sourceLanguage,
}: ImportVocabularyCardProps) {
  const router = useRouter();
  const [terms, setTerms] = useState<QuizTerm[]>([]);
  const [isParseLoading, setIsParseLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [inputResetKey, setInputResetKey] = useState(0);

  async function handleImport() {
    if (terms.length === 0) {
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch("/api/mastery/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        importedCount?: number;
        createdCount?: number;
        updatedCount?: number;
        defaultLevel?: number;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to import vocabulary");
      }

      const importedCount = data?.importedCount ?? terms.length;
      const createdCount = data?.createdCount ?? importedCount;
      const updatedCount = data?.updatedCount ?? 0;
      const successMessage =
        updatedCount > 0
          ? `Imported ${importedCount} words. Added ${createdCount} new and refreshed ${updatedCount} existing entries at level ${data?.defaultLevel ?? 2}.`
          : `Imported ${importedCount} words into Vocab Mastery at level ${data?.defaultLevel ?? 2}.`;

      toast.success(successMessage);
      setTerms([]);
      setInputResetKey((current) => current + 1);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import vocabulary",
      );
    } finally {
      setIsImporting(false);
    }
  }

  function handleStartOver() {
    setTerms([]);
    setInputResetKey((current) => current + 1);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookPlus className="h-5 w-5 text-primary" />
              Import Vocabulary
            </CardTitle>
            <CardDescription>
              Paste a word list or raw text, review the parsed terms, and save
              them straight into your vocabulary library without creating a
              quiz.
            </CardDescription>
          </div>
          <Badge variant="secondary">Default Level 2</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {terms.length === 0 ? (
          <WordInput
            key={inputResetKey}
            onParsed={setTerms}
            isLoading={isParseLoading}
            setIsLoading={setIsParseLoading}
            targetLanguage={targetLanguage}
            sourceLanguage={sourceLanguage}
          />
        ) : (
          <>
            <ParsedWordList
              terms={terms}
              onTermsChange={setTerms}
              targetLanguage={targetLanguage}
              sourceLanguage={sourceLanguage}
            />

            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                Imported words start at level 2 so they are immediately ready
                for spaced-repetition review later.
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
                  disabled={isImporting || terms.length === 0}
                  className="w-full sm:w-auto"
                >
                  {isImporting ? "Importing..." : "Import to Vocab Mastery"}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
