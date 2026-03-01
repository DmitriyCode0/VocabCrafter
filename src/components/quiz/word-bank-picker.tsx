"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, BookOpen } from "lucide-react";
import type { QuizTerm } from "@/types/quiz";

interface WordBankPickerProps {
  onSelect: (terms: QuizTerm[]) => void;
}

interface WordBankItem {
  id: string;
  name: string;
  terms: QuizTerm[];
  created_at: string;
}

export function WordBankPicker({ onSelect }: WordBankPickerProps) {
  const [banks, setBanks] = useState<WordBankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBanks();
  }, []);

  async function fetchBanks() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/word-banks");
      if (!res.ok) throw new Error("Failed to fetch word banks");

      const data = await res.json();
      setBanks(data.wordBanks || []);
    } catch {
      setError("Failed to load saved word banks.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);

    try {
      const res = await fetch(`/api/word-banks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setBanks(banks.filter((b) => b.id !== id));
    } catch {
      setError("Failed to delete word bank.");
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (banks.length === 0) {
    return (
      <div className="py-8 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          No saved word banks yet. Parse new words and save them to create your
          first bank.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select a saved word bank to use its vocabulary.
      </p>
      <div className="grid gap-3">
        {banks.map((bank) => (
          <Card
            key={bank.id}
            className="cursor-pointer transition-colors hover:border-primary"
            onClick={() => onSelect(bank.terms)}
          >
            <CardHeader className="flex-row items-center justify-between p-4">
              <div>
                <CardTitle className="text-base">{bank.name}</CardTitle>
                <CardDescription>
                  {bank.terms.length} term{bank.terms.length !== 1 ? "s" : ""}{" "}
                  &middot;{" "}
                  {new Date(bank.created_at).toLocaleDateString("en-US")}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(bank.id);
                }}
                disabled={deletingId === bank.id}
              >
                {deletingId === bank.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
