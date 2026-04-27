"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { GrammarTopicCardContent } from "@/components/library/grammar-topic-card-content";
import { buildGrammarTopicArticleHref } from "@/lib/grammar/library-topic-routes";
import type { GrammarTopicPromptConfig } from "@/lib/grammar/prompt-overrides";
import type { LearningLanguage } from "@/lib/languages";

export interface LibraryGrammarBrowserSection {
  id: LearningLanguage;
  title: string;
  levels: {
    level: string;
    topics: GrammarTopicPromptConfig[];
  }[];
}

interface LibraryGrammarBrowserProps {
  sections: LibraryGrammarBrowserSection[];
}

const LEVEL_FILTER_OPTIONS = ["all", "A1", "A2", "B1", "B2", "C1"] as const;

export function LibraryGrammarBrowser({ sections }: LibraryGrammarBrowserProps) {
  const { messages } = useAppI18n();
  const [selectedLanguage, setSelectedLanguage] =
    useState<LearningLanguage | "all">("all");
  const [selectedLevel, setSelectedLevel] = useState<(typeof LEVEL_FILTER_OPTIONS)[number]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  const filteredSections = sections
    .filter(
      (section) => selectedLanguage === "all" || section.id === selectedLanguage,
    )
    .map((section) => ({
      ...section,
      levels: section.levels
        .filter(
          (level) => selectedLevel === "all" || level.level === selectedLevel,
        )
        .map((level) => ({
          ...level,
          topics: level.topics.filter((topic) => {
            if (!deferredSearchQuery) {
              return true;
            }

            const haystack = `${topic.displayName} ${topic.topicKey}`.toLowerCase();
            return haystack.includes(deferredSearchQuery);
          }),
        }))
        .filter((level) => level.topics.length > 0),
    }))
    .filter((section) => section.levels.length > 0);

  const filteredTopicCount = filteredSections.reduce(
    (total, section) =>
      total +
      section.levels.reduce((sectionTotal, level) => sectionTotal + level.topics.length, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto] md:items-end">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {messages.library.searchTopicsAriaLabel}
            </label>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={messages.library.searchTopicsPlaceholder}
              aria-label={messages.library.searchTopicsAriaLabel}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {messages.library.languageFilterLabel}
            </p>
            <Select
              value={selectedLanguage}
              onValueChange={(value) =>
                setSelectedLanguage(value as LearningLanguage | "all")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{messages.library.allLanguages}</SelectItem>
                <SelectItem value="english">
                  {messages.common.studyLanguageNames.english}
                </SelectItem>
                <SelectItem value="spanish">
                  {messages.common.studyLanguageNames.spanish}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {messages.library.levelFilterLabel}
            </p>
            <Select
              value={selectedLevel}
              onValueChange={(value) =>
                setSelectedLevel(value as (typeof LEVEL_FILTER_OPTIONS)[number])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{messages.library.allLevels}</SelectItem>
                {LEVEL_FILTER_OPTIONS.filter((level) => level !== "all").map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:justify-self-end">
            <Badge variant="secondary" className="h-9 px-3 text-sm">
              {messages.library.topicCount(filteredTopicCount)}
            </Badge>
          </div>
        </div>
      </div>

      {filteredSections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-6 py-10 text-center text-sm text-muted-foreground">
          {messages.library.noMatchingTopics}
        </div>
      ) : (
        <div className="space-y-8">
          {filteredSections.map((section) => (
            <section key={section.id} className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {messages.library.topicCount(
                      section.levels.reduce(
                        (total, level) => total + level.topics.length,
                        0,
                      ),
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {section.levels.map((level) => (
                  <div key={`${section.id}-${level.level}`} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{level.level}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {messages.library.topicCount(level.topics.length)}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {level.topics.map((topic) => (
                        <Link
                          key={topic.topicKey}
                          href={buildGrammarTopicArticleHref(
                            topic.learningLanguage,
                            topic.level,
                            topic.topicKey,
                          )}
                          className="block h-full"
                        >
                          <Card className="h-full transition-colors hover:border-foreground/20 hover:bg-muted/20">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <CardTitle className="text-base leading-tight">
                                    {topic.displayName}
                                  </CardTitle>
                                  {topic.displayName !== topic.topicKey ? (
                                    <CardDescription>{topic.topicKey}</CardDescription>
                                  ) : null}
                                </div>
                                {topic.isCustom ? (
                                  <Badge variant="secondary">
                                    {messages.library.customTopicBadge}
                                  </Badge>
                                ) : null}
                              </div>
                            </CardHeader>
                            <CardContent>
                              <GrammarTopicCardContent
                                topic={topic}
                                fallbackMessage={messages.library.futureDevelopment}
                                openArticleLabel={messages.library.openArticle}
                              />
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}