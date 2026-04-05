"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookMarked, RotateCcw } from "lucide-react";
import type { LearningLanguage, SourceLanguage } from "@/lib/languages";
import { WordInput } from "@/components/quiz/word-input";
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
import { ParsedPassiveVocabularyList } from "@/components/mastery/parsed-passive-vocabulary-list";

export interface PassiveVocabularyDraftItem {
  term: string;
  definition: string;
  itemType: "word" | "phrase";
}

interface ImportPassiveVocabularyCardProps {
  targetLanguage: LearningLanguage;
  sourceLanguage: SourceLanguage;
  studentId?: string;
}

function inferItemType(term: string): "word" | "phrase" {
  return /\s/.test(term.trim()) ? "phrase" : "word";
}

export function ImportPassiveVocabularyCard({
  targetLanguage,
  sourceLanguage,
  studentId,
}: ImportPassiveVocabularyCardProps) {
  const router = useRouter();
  const [items, setItems] = useState<PassiveVocabularyDraftItem[]>([]);
  const [sourceType, setSourceType] = useState<"full_text" | "manual_list" | "curated_list">("full_text");
  const [sourceLabel, setSourceLabel] = useState("");
  const [confidence, setConfidence] = useState("4");
  const [isParseLoading, setIsParseLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [inputResetKey, setInputResetKey] = useState(0);

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
          sourceType,
          sourceLabel: sourceLabel.trim() || undefined,
          confidence: Number(confidence),
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
        throw new Error(data?.error || "Failed to import passive vocabulary evidence");
      }

      toast.success(
        `Imported ${data?.importedCount ?? items.length} passive-recognition items. Added ${data?.createdCount ?? 0} new and updated ${data?.updatedCount ?? 0} existing entries.`,
      );
      setItems([]);
      setSourceLabel("");
      setInputResetKey((current) => current + 1);
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
    setSourceLabel("");
    setInputResetKey((current) => current + 1);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookMarked className="h-5 w-5 text-primary" />
              Import Passive Recognition
            </CardTitle>
            <CardDescription>
              Parse words or phrases from a full text and save them as
              recognition evidence only. These items improve passive vocabulary
              estimation but do not create review tasks or active mastery.
            </CardDescription>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-[520px]">
            <div className="space-y-2">
              <Label htmlFor="passive-source-type" className="text-xs text-muted-foreground">
                Evidence source
              </Label>
              <Select value={sourceType} onValueChange={(value) => setSourceType(value as typeof sourceType)}>
                <SelectTrigger id="passive-source-type" className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_text">Full Text</SelectItem>
                  <SelectItem value="manual_list">Manual List</SelectItem>
                  <SelectItem value="curated_list">Curated List</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="passive-confidence" className="text-xs text-muted-foreground">
                Confidence
              </Label>
              <Select value={confidence} onValueChange={setConfidence}>
                <SelectTrigger id="passive-confidence" className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - weak signal</SelectItem>
                  <SelectItem value="2">2 - tentative</SelectItem>
                  <SelectItem value="3">3 - moderate</SelectItem>
                  <SelectItem value="4">4 - strong</SelectItem>
                  <SelectItem value="5">5 - confirmed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-3 lg:col-span-1">
              <Label htmlFor="passive-source-label" className="text-xs text-muted-foreground">
                Text or lesson label
              </Label>
              <Input
                id="passive-source-label"
                value={sourceLabel}
                onChange={(event) => setSourceLabel(event.target.value)}
                placeholder="Short story, article, lesson 12..."
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <WordInput
            key={inputResetKey}
            onParsed={(terms) =>
              setItems(
                terms.map((term) => ({
                  term: term.term,
                  definition: term.definition,
                  itemType: inferItemType(term.term),
                })),
              )
            }
            isLoading={isParseLoading}
            setIsLoading={setIsParseLoading}
            targetLanguage={targetLanguage}
            sourceLanguage={sourceLanguage}
          />
        ) : (
          <>
            <ParsedPassiveVocabularyList
              items={items}
              onItemsChange={setItems}
              targetLanguage={targetLanguage}
              sourceLanguage={sourceLanguage}
            />

            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                These items increase passive-recognition estimates only. They do
                not get due dates, review sessions, or active mastery levels.
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