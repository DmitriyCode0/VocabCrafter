"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import type { QuizTerm } from "@/types/quiz";
import {
  getLearningLanguageLabel,
  getSourceLanguageLabel,
  type LearningLanguage,
  type SourceLanguage,
} from "@/lib/languages";

interface ParsedWordListProps {
  terms: QuizTerm[];
  onTermsChange: (terms: QuizTerm[]) => void;
  targetLanguage: LearningLanguage;
  sourceLanguage: SourceLanguage;
}

export function ParsedWordList({
  terms,
  onTermsChange,
  targetLanguage,
  sourceLanguage,
}: ParsedWordListProps) {
  const { messages } = useAppI18n();
  const [newTerm, setNewTerm] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const targetLanguageLabel =
    messages.common.studyLanguageNames[targetLanguage] ||
    getLearningLanguageLabel(targetLanguage);
  const sourceLanguageLabel =
    messages.common.studyLanguageNames[sourceLanguage] ||
    getSourceLanguageLabel(sourceLanguage);

  function updateTerm(
    index: number,
    field: "term" | "definition",
    value: string,
  ) {
    const updated = [...terms];
    updated[index] = { ...updated[index], [field]: value };
    onTermsChange(updated);
  }

  function removeTerm(index: number) {
    onTermsChange(terms.filter((_, i) => i !== index));
  }

  function addTerm() {
    if (!newTerm.trim() || !newDefinition.trim()) return;
    onTermsChange([
      ...terms,
      { term: newTerm.trim(), definition: newDefinition.trim() },
    ]);
    setNewTerm("");
    setNewDefinition("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {messages.createQuiz.parsedWordList.parsedCount(terms.length)}
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">{targetLanguageLabel}</TableHead>
              <TableHead className="w-[40%]">{sourceLanguageLabel}</TableHead>
              <TableHead className="w-[20%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {terms.map((term, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Input
                    value={term.term}
                    onChange={(e) => updateTerm(index, "term", e.target.value)}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={term.definition}
                    onChange={(e) =>
                      updateTerm(index, "definition", e.target.value)
                    }
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTerm(index)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell>
                <Input
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  placeholder={messages.createQuiz.parsedWordList.addTermPlaceholder}
                  className="h-8"
                  onKeyDown={(e) => e.key === "Enter" && addTerm()}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newDefinition}
                  onChange={(e) => setNewDefinition(e.target.value)}
                  placeholder={
                    messages.createQuiz.parsedWordList.addMeaningPlaceholder
                  }
                  className="h-8"
                  onKeyDown={(e) => e.key === "Enter" && addTerm()}
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addTerm}
                  disabled={!newTerm.trim() || !newDefinition.trim()}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
