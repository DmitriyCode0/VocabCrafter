"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { buildGrammarPromptDetails } from "@/lib/grammar/rules";
import { formatGrammarRulesSection } from "@/lib/grammar/prompt-sections";
import type { GrammarTopicPromptConfig } from "@/lib/grammar/prompt-overrides";
import type { GrammarChallenge } from "@/types/quiz";
import {
  resetGrammarTopicPromptOverride,
  saveGrammarTopicPromptOverride,
} from "./actions";

interface GrammarRulesAdminProps {
  englishCatalog: { level: string; topics: GrammarTopicPromptConfig[] }[];
  spanishCatalog: { level: string; topics: GrammarTopicPromptConfig[] }[];
}

type LanguageTab = "english" | "spanish";

function flattenTopics(catalog: { level: string; topics: GrammarTopicPromptConfig[] }[]) {
  return catalog.flatMap(({ level, topics }) =>
    topics.map((topic) => ({
      ...topic,
      level,
    })),
  );
}

export function GrammarRulesAdmin({
  englishCatalog,
  spanishCatalog,
}: GrammarRulesAdminProps) {
  const router = useRouter();
  const [activeLanguage, setActiveLanguage] = useState<LanguageTab>("english");
  const [search, setSearch] = useState("");
  const [topicsState, setTopicsState] = useState({
    english: flattenTopics(englishCatalog),
    spanish: flattenTopics(spanishCatalog),
  });
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | null>(
    topicsState.english[0]?.topicKey ?? topicsState.spanish[0]?.topicKey ?? null,
  );
  const [draftRule, setDraftRule] = useState("");
  const [draftGuidance, setDraftGuidance] = useState("");
  const [previewDifficulty, setPreviewDifficulty] =
    useState<GrammarChallenge>("Standard");
  const [isPending, startTransition] = useTransition();

  const visibleTopics = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = topicsState[activeLanguage];

    if (!query) {
      return source;
    }

    return source.filter((topic) => {
      return (
        topic.topicKey.toLowerCase().includes(query) ||
        topic.level.toLowerCase().includes(query) ||
        topic.effectiveRule.toLowerCase().includes(query) ||
        topic.effectiveGuidance.toLowerCase().includes(query)
      );
    });
  }, [activeLanguage, search, topicsState]);

  const selectedTopic = useMemo(() => {
    return topicsState[activeLanguage].find(
      (topic) => topic.topicKey === selectedTopicKey,
    );
  }, [activeLanguage, selectedTopicKey, topicsState]);

  const exactFinalPrompt = useMemo(() => {
    if (!selectedTopic) {
      return "";
    }

    const effectiveDetails = buildGrammarPromptDetails(draftRule, draftGuidance);

    return formatGrammarRulesSection([selectedTopic.topicKey], previewDifficulty, {
      [selectedTopic.topicKey]: effectiveDetails || selectedTopic.topicKey,
    }).trim();
  }, [draftGuidance, draftRule, previewDifficulty, selectedTopic]);

  useEffect(() => {
    if (!visibleTopics.some((topic) => topic.topicKey === selectedTopicKey)) {
      setSelectedTopicKey(visibleTopics[0]?.topicKey ?? null);
    }
  }, [selectedTopicKey, visibleTopics]);

  useEffect(() => {
    if (!selectedTopic) {
      setDraftRule("");
      setDraftGuidance("");
      return;
    }

    setDraftRule(selectedTopic.effectiveRule);
    setDraftGuidance(selectedTopic.effectiveGuidance);
  }, [selectedTopic]);

  function updateTopicState(nextTopic: GrammarTopicPromptConfig) {
    setTopicsState((current) => ({
      ...current,
      [activeLanguage]: current[activeLanguage].map((topic) =>
        topic.topicKey === nextTopic.topicKey
          ? { ...topic, ...nextTopic }
          : topic,
      ),
    }));
  }

  function handleSave() {
    if (!selectedTopic) {
      return;
    }

    startTransition(async () => {
      try {
        const nextTopic = await saveGrammarTopicPromptOverride({
          topicKey: selectedTopic.topicKey,
          ruleText: draftRule,
          guidanceText: draftGuidance,
        });

        updateTopicState(nextTopic);
        toast.success("Grammar topic prompt saved");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save topic rules",
        );
      }
    });
  }

  function handleReset() {
    if (!selectedTopic) {
      return;
    }

    startTransition(async () => {
      try {
        const nextTopic = await resetGrammarTopicPromptOverride(
          selectedTopic.topicKey,
        );
        updateTopicState(nextTopic);
        toast.success("Topic rules reset to defaults");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reset topic rules",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grammar Rules</h1>
        <p className="text-muted-foreground">
          Review and override the prompt rules sent to AI for each grammar topic.
        </p>
      </div>

      <Tabs
        value={activeLanguage}
        onValueChange={(value) => setActiveLanguage(value as LanguageTab)}
        className="gap-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="english">English Topics</TabsTrigger>
            <TabsTrigger value="spanish">Spanish Topics</TabsTrigger>
          </TabsList>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search topics, rules, or guidance"
            className="w-full lg:max-w-sm"
          />
        </div>

        <TabsContent value="english">
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Topics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
                {visibleTopics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No grammar topics match your search.
                  </p>
                ) : (
                  visibleTopics.map((topic) => (
                    <button
                      key={topic.topicKey}
                      type="button"
                      onClick={() => setSelectedTopicKey(topic.topicKey)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        topic.topicKey === selectedTopicKey
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{topic.topicKey}</p>
                          <p className="text-xs text-muted-foreground">
                            Level {topic.level}
                          </p>
                        </div>
                        {topic.hasOverride && (
                          <Badge variant="secondary">Override</Badge>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {selectedTopic?.topicKey ?? "Select a topic"}
                    </CardTitle>
                    {selectedTopic && (
                      <p className="text-sm text-muted-foreground">
                        Level {selectedTopic.level}
                      </p>
                    )}
                  </div>
                  {selectedTopic?.hasOverride && (
                    <Badge variant="outline">Custom override active</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {!selectedTopic ? (
                  <p className="text-sm text-muted-foreground">
                    Select a topic from the list to edit its prompt instructions.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="rule-text">Rule text</Label>
                      <Textarea
                        id="rule-text"
                        value={draftRule}
                        onChange={(event) => setDraftRule(event.target.value)}
                        rows={10}
                      />
                      <p className="text-xs text-muted-foreground">
                        This is the primary rule/explanation shown to the model.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="guidance-text">
                        Additional generation guidance
                      </Label>
                      <Textarea
                        id="guidance-text"
                        value={draftGuidance}
                        onChange={(event) =>
                          setDraftGuidance(event.target.value)
                        }
                        rows={8}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use this for stricter generation constraints, edge cases,
                        and anti-hallucination rules.
                      </p>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm font-medium">Prompt preview</p>
                      <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {selectedTopic.topicKey}

                        {draftRule.trim() || draftGuidance.trim()
                          ? [draftRule.trim(), draftGuidance.trim()]
                              .filter(Boolean)
                              .join("\n\nAdditional generation guidance:\n")
                          : "No rule text configured."}
                      </pre>
                    </div>

                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm font-medium">Exact final AI prompt</p>
                          <p className="text-xs text-muted-foreground">
                            This is the exact grammar section injected into generation and evaluation prompts.
                          </p>
                        </div>
                        <div className="w-full lg:w-52">
                          <Select
                            value={previewDifficulty}
                            onValueChange={(value) =>
                              setPreviewDifficulty(value as GrammarChallenge)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Preview difficulty" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Simple">Simple</SelectItem>
                              <SelectItem value="Standard">Standard</SelectItem>
                              <SelectItem value="Complex">Complex</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {exactFinalPrompt || "No final prompt generated."}
                      </pre>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button onClick={handleSave} disabled={isPending}>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={isPending || !selectedTopic.hasOverride}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset To Default
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="spanish">
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Topics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
                {visibleTopics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No grammar topics match your search.
                  </p>
                ) : (
                  visibleTopics.map((topic) => (
                    <button
                      key={topic.topicKey}
                      type="button"
                      onClick={() => setSelectedTopicKey(topic.topicKey)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        topic.topicKey === selectedTopicKey
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{topic.topicKey}</p>
                          <p className="text-xs text-muted-foreground">
                            Level {topic.level}
                          </p>
                        </div>
                        {topic.hasOverride && (
                          <Badge variant="secondary">Override</Badge>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {selectedTopic?.topicKey ?? "Select a topic"}
                    </CardTitle>
                    {selectedTopic && (
                      <p className="text-sm text-muted-foreground">
                        Level {selectedTopic.level}
                      </p>
                    )}
                  </div>
                  {selectedTopic?.hasOverride && (
                    <Badge variant="outline">Custom override active</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {!selectedTopic ? (
                  <p className="text-sm text-muted-foreground">
                    Select a topic from the list to edit its prompt instructions.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="rule-text-spanish">Rule text</Label>
                      <Textarea
                        id="rule-text-spanish"
                        value={draftRule}
                        onChange={(event) => setDraftRule(event.target.value)}
                        rows={10}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="guidance-text-spanish">
                        Additional generation guidance
                      </Label>
                      <Textarea
                        id="guidance-text-spanish"
                        value={draftGuidance}
                        onChange={(event) =>
                          setDraftGuidance(event.target.value)
                        }
                        rows={8}
                      />
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm font-medium">Prompt preview</p>
                      <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {selectedTopic.topicKey}

                        {draftRule.trim() || draftGuidance.trim()
                          ? [draftRule.trim(), draftGuidance.trim()]
                              .filter(Boolean)
                              .join("\n\nAdditional generation guidance:\n")
                          : "No rule text configured."}
                      </pre>
                    </div>

                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm font-medium">Exact final AI prompt</p>
                          <p className="text-xs text-muted-foreground">
                            This is the exact grammar section injected into generation and evaluation prompts.
                          </p>
                        </div>
                        <div className="w-full lg:w-52">
                          <Select
                            value={previewDifficulty}
                            onValueChange={(value) =>
                              setPreviewDifficulty(value as GrammarChallenge)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Preview difficulty" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Simple">Simple</SelectItem>
                              <SelectItem value="Standard">Standard</SelectItem>
                              <SelectItem value="Complex">Complex</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {exactFinalPrompt || "No final prompt generated."}
                      </pre>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button onClick={handleSave} disabled={isPending}>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={isPending || !selectedTopic.hasOverride}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset To Default
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}