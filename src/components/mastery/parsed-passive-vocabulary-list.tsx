"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { LearningLanguage, SourceLanguage } from "@/lib/languages";
import {
  getLearningLanguageLabel,
  getSourceLanguageLabel,
} from "@/lib/languages";
import type { PassiveVocabularyDraftItem } from "@/components/mastery/import-passive-vocabulary-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  sourceLanguage: SourceLanguage;
}

export function ParsedPassiveVocabularyList({
  items,
  onItemsChange,
  targetLanguage,
  sourceLanguage,
}: ParsedPassiveVocabularyListProps) {
  const [newTerm, setNewTerm] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [newItemType, setNewItemType] = useState<"word" | "phrase">("word");
  const targetLanguageLabel = getLearningLanguageLabel(targetLanguage);
  const sourceLanguageLabel = getSourceLanguageLabel(sourceLanguage);

  function updateItem(
    index: number,
    field: keyof PassiveVocabularyDraftItem,
    value: string,
  ) {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value,
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
        definition: newDefinition.trim(),
        itemType: newItemType,
      },
    ]);
    setNewTerm("");
    setNewDefinition("");
    setNewItemType("word");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} recognition item{items.length !== 1 ? "s" : ""}
          parsed. Mark each one as a word or phrase before saving.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">{targetLanguageLabel}</TableHead>
              <TableHead className="w-[34%]">{sourceLanguageLabel}</TableHead>
              <TableHead className="w-[18%]">Type</TableHead>
              <TableHead className="w-[14%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={`${item.term}-${index}`}>
                <TableCell>
                  <Input
                    value={item.term}
                    onChange={(event) =>
                      updateItem(index, "term", event.target.value)
                    }
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={item.definition}
                    onChange={(event) =>
                      updateItem(index, "definition", event.target.value)
                    }
                    placeholder="Optional meaning"
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={item.itemType}
                    onValueChange={(value) =>
                      updateItem(index, "itemType", value)
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="word">Word</SelectItem>
                      <SelectItem value="phrase">Phrase</SelectItem>
                    </SelectContent>
                  </Select>
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
                  placeholder={`Add ${targetLanguageLabel.toLowerCase()} word or phrase...`}
                  className="h-8"
                  onKeyDown={(event) => event.key === "Enter" && addItem()}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newDefinition}
                  onChange={(event) => setNewDefinition(event.target.value)}
                  placeholder={`Optional ${sourceLanguageLabel.toLowerCase()} meaning...`}
                  className="h-8"
                  onKeyDown={(event) => event.key === "Enter" && addItem()}
                />
              </TableCell>
              <TableCell>
                <Select
                  value={newItemType}
                  onValueChange={(value) =>
                    setNewItemType(value as typeof newItemType)
                  }
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="word">Word</SelectItem>
                    <SelectItem value="phrase">Phrase</SelectItem>
                  </SelectContent>
                </Select>
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
