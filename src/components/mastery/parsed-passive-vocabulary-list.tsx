"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { LearningLanguage } from "@/lib/languages";
import { getLearningLanguageLabel } from "@/lib/languages";
import type { PassiveVocabularyDraftItem } from "@/components/mastery/import-passive-vocabulary-card";
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

interface ParsedPassiveVocabularyListProps {
  items: PassiveVocabularyDraftItem[];
  onItemsChange: (items: PassiveVocabularyDraftItem[]) => void;
  targetLanguage: LearningLanguage;
}

export function ParsedPassiveVocabularyList({
  items,
  onItemsChange,
  targetLanguage,
}: ParsedPassiveVocabularyListProps) {
  const [newTerm, setNewTerm] = useState("");
  const targetLanguageLabel = getLearningLanguageLabel(targetLanguage);

  function updateItem(index: number, value: string) {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      term: value,
    } as PassiveVocabularyDraftItem;
    onItemsChange(updated);
  }

  function removeItem(index: number) {
    onItemsChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function addItem() {
    if (!newTerm.trim()) {
      return;
    }

    onItemsChange([
      ...items,
      {
        term: newTerm.trim(),
      },
    ]);
    setNewTerm("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} unique word{items.length !== 1 ? "s" : ""}
          extracted. Review the list before saving.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[86%]">{targetLanguageLabel}</TableHead>
              <TableHead className="w-[14%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={`${item.term}-${index}`}>
                <TableCell>
                  <Input
                    value={item.term}
                    onChange={(event) => updateItem(index, event.target.value)}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                    <span className="sr-only">Remove {item.term}</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            <TableRow>
              <TableCell>
                <Input
                  value={newTerm}
                  onChange={(event) => setNewTerm(event.target.value)}
                  placeholder={`Add ${targetLanguageLabel.toLowerCase()} word...`}
                  className="h-8"
                  onKeyDown={(event) => event.key === "Enter" && addItem()}
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addItem}
                  disabled={!newTerm.trim()}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Add item</span>
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
