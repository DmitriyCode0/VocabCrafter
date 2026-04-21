"use client";

import { useState } from "react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

interface GrammarTopicOption {
  topicKey: string;
  displayName: string;
}

interface GrammarTopicLevelGroup {
  level: string;
  topics: GrammarTopicOption[];
}

interface GrammarTopicSelectorProps {
  levels: GrammarTopicLevelGroup[];
  selectedTopics: string[];
  onTopicsChange: (topics: string[]) => void;
}

export function GrammarTopicSelector({
  levels,
  selectedTopics,
  onTopicsChange,
}: GrammarTopicSelectorProps) {
  const { messages } = useAppI18n();
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(
    () => new Set(levels[0] ? [levels[0].level] : []),
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
      onTopicsChange([topic]);
    }
  }

  if (levels.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {messages.createQuiz.grammarTopics.title}{" "}
          <span className="text-muted-foreground font-normal">
            ({messages.createQuiz.grammarTopics.optional})
          </span>
        </p>
        {selectedTopics.length > 0 && (
          <Badge variant="secondary">
            {messages.createQuiz.grammarTopics.selectedCount(
              selectedTopics.length,
            )}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {messages.createQuiz.grammarTopics.description}
      </p>

      <div className="rounded-md border divide-y">
        {levels.map(({ level, topics }) => {
          const isExpanded = expandedLevels.has(level);
          const selectedCount = topics.filter((t) =>
            selectedTopics.includes(t.topicKey),
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
                {selectedCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={() => onTopicsChange([])}
                  >
                    {messages.createQuiz.grammarTopics.clear}
                  </Button>
                )}
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 grid gap-2 sm:grid-cols-2">
                  {topics.map((topic) => (
                    <label
                      key={topic.topicKey}
                      className="flex items-start gap-2 cursor-pointer rounded-md p-1.5 hover:bg-muted text-sm"
                    >
                      <Checkbox
                        checked={selectedTopics.includes(topic.topicKey)}
                        onCheckedChange={() => toggleTopic(topic.topicKey)}
                        className="mt-0.5"
                      />
                      <span>{topic.displayName}</span>
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
