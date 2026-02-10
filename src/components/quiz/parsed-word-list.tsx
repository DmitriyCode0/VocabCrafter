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
import type { QuizTerm } from "@/types/quiz";

interface ParsedWordListProps {
  terms: QuizTerm[];
  onTermsChange: (terms: QuizTerm[]) => void;
}

export function ParsedWordList({ terms, onTermsChange }: ParsedWordListProps) {
  const [newTerm, setNewTerm] = useState("");
  const [newDefinition, setNewDefinition] = useState("");

  function updateTerm(index: number, field: "term" | "definition", value: string) {
    const updated = [...terms];
    updated[index] = { ...updated[index], [field]: value };
    onTermsChange(updated);
  }

  function removeTerm(index: number) {
    onTermsChange(terms.filter((_, i) => i !== index));
  }

  function addTerm() {
    if (!newTerm.trim() || !newDefinition.trim()) return;
    onTermsChange([...terms, { term: newTerm.trim(), definition: newDefinition.trim() }]);
    setNewTerm("");
    setNewDefinition("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {terms.length} term{terms.length !== 1 ? "s" : ""} parsed. Edit, remove, or add more below.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">English</TableHead>
              <TableHead className="w-[40%]">Ukrainian</TableHead>
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
                    onChange={(e) => updateTerm(index, "definition", e.target.value)}
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
                  placeholder="Add English term..."
                  className="h-8"
                  onKeyDown={(e) => e.key === "Enter" && addTerm()}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={newDefinition}
                  onChange={(e) => setNewDefinition(e.target.value)}
                  placeholder="Add Ukrainian translation..."
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
