"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookPlus, RotateCcw } from "lucide-react";
import type { QuizTerm } from "@/types/quiz";
import type { LearningLanguage, SourceLanguage } from "@/lib/languages";
import { WordInput } from "@/components/quiz/word-input";
import { ParsedWordList } from "@/components/quiz/parsed-word-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const IMPORT_LEVEL_OPTIONS = [
  { value: 0, label: "New" },
  { value: 1, label: "Seen" },
  { value: 2, label: "Learning" },
  { value: 3, label: "Familiar" },
  { value: 4, label: "Practiced" },
  { value: 5, label: "Mastered" },
] as const;

function getImportLevelLabel(level: number) {
  return (
    IMPORT_LEVEL_OPTIONS.find((option) => option.value === level)?.label ??
    `Level ${level}`
  );
}

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
  const [startingLevel, setStartingLevel] = useState(2);
  const [isParseLoading, setIsParseLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [inputResetKey, setInputResetKey] = useState(0);
  const startingLevelLabel = getImportLevelLabel(startingLevel);

  async function handleImport() {
    if (terms.length === 0) {
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch("/api/mastery/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms, startingLevel }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        importedCount?: number;
        createdCount?: number;
        updatedCount?: number;
        startingLevel?: number;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to import vocabulary");
      }

      const importedCount = data?.importedCount ?? terms.length;
      const createdCount = data?.createdCount ?? importedCount;
      const updatedCount = data?.updatedCount ?? 0;
      const appliedLevel = data?.startingLevel ?? startingLevel;
      const appliedLevelLabel = getImportLevelLabel(appliedLevel);
      const successMessage =
        updatedCount > 0
          ? `Imported ${importedCount} words. Added ${createdCount} new and refreshed ${updatedCount} existing entries up to ${appliedLevelLabel} (Level ${appliedLevel}).`
          : `Imported ${importedCount} words into Mastery at ${appliedLevelLabel} (Level ${appliedLevel}).`;

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookPlus className="h-5 w-5 text-primary" />
              Import Vocabulary
            </CardTitle>
            <CardDescription>
              Paste a word list, raw text, or screenshots, review the parsed
              terms, and save them straight into your vocabulary library without
              creating a quiz.
            </CardDescription>
          </div>

          <div className="w-full space-y-2 sm:w-[220px]">
            <Label
              htmlFor="import-starting-level"
              className="text-xs text-muted-foreground"
            >
              Starting mastery level
            </Label>
            <Select
              value={String(startingLevel)}
              onValueChange={(value) => setStartingLevel(Number(value))}
            >
              <SelectTrigger
                id="import-starting-level"
                className="w-full bg-background"
              >
                <SelectValue placeholder="Select a level" />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    Level {option.value} - {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                Imported words will start at {startingLevelLabel} (Level{" "}
                {startingLevel}). Existing entries are only promoted up to this
                level and never downgraded.
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
                  {isImporting ? "Importing..." : "Import to Mastery"}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
