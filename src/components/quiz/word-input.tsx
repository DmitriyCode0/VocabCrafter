"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import type { QuizTerm } from "@/types/quiz";
import {
  getLearningLanguageLabel,
  getSourceLanguageLabel,
  type LearningLanguage,
  type SourceLanguage,
} from "@/lib/languages";

interface WordInputProps {
  onParsed: (terms: QuizTerm[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  targetLanguage: LearningLanguage;
  sourceLanguage: SourceLanguage;
}

export function WordInput({
  onParsed,
  isLoading,
  setIsLoading,
  targetLanguage,
  sourceLanguage,
}: WordInputProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const targetLanguageLabel = getLearningLanguageLabel(targetLanguage);
  const sourceLanguageLabel = getSourceLanguageLabel(sourceLanguage);

  async function handleParse() {
    if (!text.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/parse-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          targetLanguage,
          sourceLanguage,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to parse words");
      }

      const data = await res.json();
      onParsed(data.terms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse words");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="word-input">Paste your vocabulary</Label>
        <Textarea
          id="word-input"
          placeholder={`Paste words, sentences, or text here...\n\nExamples:\n- Raw text in ${sourceLanguageLabel}: sample text or short phrases\n- Word list: comma-separated vocabulary\n- Tab-separated: target word + ${sourceLanguageLabel.toLowerCase()} meaning`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          disabled={isLoading}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Paste raw text, word lists, or tab-separated vocabulary. AI will
          extract useful {targetLanguageLabel} words and create{" "}
          {sourceLanguageLabel.toLowerCase()} meanings.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleParse}
        disabled={!text.trim() || isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Parsing vocabulary...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Parse with AI
          </>
        )}
      </Button>
    </div>
  );
}
