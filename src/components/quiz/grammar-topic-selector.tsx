"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getTopicsForLevel } from "@/lib/grammar/topics";

interface GrammarTopicSelectorProps {
  cefrLevel: string;
  selectedTopics: string[];
  onTopicsChange: (topics: string[]) => void;
}

export function GrammarTopicSelector({
  cefrLevel,
  selectedTopics,
  onTopicsChange,
}: GrammarTopicSelectorProps) {
  const levels = getTopicsForLevel(cefrLevel);
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(
    () => new Set([cefrLevel]),
  );

  function toggleLevel(level: string) {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  function toggleTopic(topic: string) {
    if (selectedTopics.includes(topic)) {
      onTopicsChange(selectedTopics.filter((t) => t !== topic));
    } else {
      onTopicsChange([...selectedTopics, topic]);
    }
  }

  function toggleAll(levelTopics: string[]) {
    const allSelected = levelTopics.every((t) => selectedTopics.includes(t));
    if (allSelected) {
      onTopicsChange(selectedTopics.filter((t) => !levelTopics.includes(t)));
    } else {
      const toAdd = levelTopics.filter((t) => !selectedTopics.includes(t));
      onTopicsChange([...selectedTopics, ...toAdd]);
    }
  }

  if (levels.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Grammar Focus{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </p>
        {selectedTopics.length > 0 && (
          <Badge variant="secondary">{selectedTopics.length} selected</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Select grammar topics to focus on in the generated sentences.
      </p>

      <div className="rounded-md border divide-y">
        {levels.map(({ level, topics }) => {
          const isExpanded = expandedLevels.has(level);
          const selectedCount = topics.filter((t) =>
            selectedTopics.includes(t),
          ).length;

          return (
            <div key={level}>
              <div className="flex items-center justify-between p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => toggleLevel(level)}
                >
                  {isExpanded ? (
                    <ChevronDown className="mr-1 h-4 w-4" />
                  ) : (
                    <ChevronRight className="mr-1 h-4 w-4" />
                  )}
                  {level}
                  {selectedCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedCount}
                    </Badge>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground"
                  onClick={() => toggleAll(topics)}
                >
                  {topics.every((t) => selectedTopics.includes(t))
                    ? "Deselect all"
                    : "Select all"}
                </Button>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 grid gap-2 sm:grid-cols-2">
                  {topics.map((topic) => (
                    <label
                      key={topic}
                      className="flex items-start gap-2 cursor-pointer rounded-md p-1.5 hover:bg-muted text-sm"
                    >
                      <Checkbox
                        checked={selectedTopics.includes(topic)}
                        onCheckedChange={() => toggleTopic(topic)}
                        className="mt-0.5"
                      />
                      <span>{topic}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
