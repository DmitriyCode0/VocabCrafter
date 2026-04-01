"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
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
import { LEVEL_ORDER } from "@/lib/grammar/topics";
import type { GrammarTopicPromptConfig } from "@/lib/grammar/prompt-overrides";
import type { GrammarChallenge } from "@/types/quiz";
import {
  createGrammarTopic,
  deleteGrammarTopic,
  resetGrammarTopicPromptOverride,
  saveGrammarTopicPromptOverride,
} from "./actions";

interface GrammarRulesAdminProps {
  englishCatalog: { level: string; topics: GrammarTopicPromptConfig[] }[];
  spanishCatalog: { level: string; topics: GrammarTopicPromptConfig[] }[];
}

type LanguageTab = "english" | "spanish";

function flattenTopics(
  catalog: { level: string; topics: GrammarTopicPromptConfig[] }[],
) {
  return catalog.flatMap(({ topics }) => topics);
}

function getLevelSortIndex(level: string) {
  const index = LEVEL_ORDER.indexOf(level);
  return index === -1 ? LEVEL_ORDER.length : index;
}

function sortTopics(topics: GrammarTopicPromptConfig[]) {
  return [...topics].sort((left, right) => {
    const levelDelta =
      getLevelSortIndex(left.level) - getLevelSortIndex(right.level);

    if (levelDelta !== 0) {
      return levelDelta;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

export function GrammarRulesAdmin({
  englishCatalog,
  spanishCatalog,
}: GrammarRulesAdminProps) {
  const router = useRouter();
  const [activeLanguage, setActiveLanguage] = useState<LanguageTab>("english");
  const [search, setSearch] = useState("");
  const [topicsState, setTopicsState] = useState({
    english: sortTopics(flattenTopics(englishCatalog)),
    spanish: sortTopics(flattenTopics(spanishCatalog)),
  });
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | null>(
    englishCatalog[0]?.topics[0]?.topicKey ??
      spanishCatalog[0]?.topics[0]?.topicKey ??
      null,
  );
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftLevel, setDraftLevel] = useState("A1");
  const [draftRule, setDraftRule] = useState("");
  const [draftGuidance, setDraftGuidance] = useState("");
  const [draftEvaluationInstructions, setDraftEvaluationInstructions] =
    useState("");
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
        topic.displayName.toLowerCase().includes(query) ||
        topic.topicKey.toLowerCase().includes(query) ||
        topic.level.toLowerCase().includes(query) ||
        topic.effectiveRule.toLowerCase().includes(query) ||
        topic.effectiveGuidance.toLowerCase().includes(query) ||
        topic.effectiveEvaluationInstructions.toLowerCase().includes(query)
      );
    });
  }, [activeLanguage, search, topicsState]);

  const selectedTopic = useMemo(() => {
    if (isCreatingTopic) {
      return null;
    }

    return topicsState[activeLanguage].find(
      (topic) => topic.topicKey === selectedTopicKey,
    );
  }, [activeLanguage, isCreatingTopic, selectedTopicKey, topicsState]);

  function loadTopicDraft(topic: GrammarTopicPromptConfig | null, language: LanguageTab) {
    if (!topic) {
      setDraftDisplayName("");
      setDraftLevel(topicsState[language][0]?.level ?? "A1");
      setDraftRule("");
      setDraftGuidance("");
      setDraftEvaluationInstructions("");
      return;
    }

    setDraftDisplayName(topic.displayName);
    setDraftLevel(topic.level);
    setDraftRule(topic.effectiveRule);
    setDraftGuidance(topic.effectiveGuidance);
    setDraftEvaluationInstructions(topic.effectiveEvaluationInstructions);
  }

  const exactFinalPrompt = useMemo(() => {
    const previewTopicKey = selectedTopic?.topicKey ?? "__preview_topic__";
    const previewDisplayName = draftDisplayName.trim() || "New Topic";
    const effectiveDetails = buildGrammarPromptDetails(draftRule, draftGuidance);

    return formatGrammarRulesSection(
      [previewTopicKey],
      previewDifficulty,
      {
        [previewTopicKey]: effectiveDetails || previewDisplayName,
      },
      {
        [previewTopicKey]: previewDisplayName,
      },
    ).trim();
  }, [draftDisplayName, draftGuidance, draftRule, previewDifficulty, selectedTopic]);

  function upsertTopicState(nextTopic: GrammarTopicPromptConfig) {
    setTopicsState((current) => {
      const languageKey = nextTopic.learningLanguage;
      const nextLanguageTopics = sortTopics(
        current[languageKey]
          .filter((topic) => topic.topicKey !== nextTopic.topicKey)
          .concat(nextTopic),
      );

      return {
        ...current,
        [languageKey]: nextLanguageTopics,
      };
    });
  }

  function removeTopicState(topicKey: string) {
    setTopicsState((current) => ({
      ...current,
      [activeLanguage]: current[activeLanguage].filter(
        (topic) => topic.topicKey !== topicKey,
      ),
    }));
  }

  function handleStartCreate() {
    setIsCreatingTopic(true);
    setSelectedTopicKey(null);
    loadTopicDraft(null, activeLanguage);
  }

  function handleCancelCreate() {
    const nextTopic = topicsState[activeLanguage][0] ?? null;
    setIsCreatingTopic(false);
    setSelectedTopicKey(nextTopic?.topicKey ?? null);
    loadTopicDraft(nextTopic, activeLanguage);
  }

  function handleSelectTopic(topicKey: string) {
    const nextTopic = topicsState[activeLanguage].find(
      (topic) => topic.topicKey === topicKey,
    );
    setIsCreatingTopic(false);
    setSelectedTopicKey(topicKey);
    loadTopicDraft(nextTopic ?? null, activeLanguage);
  }

  function handleSave() {
    const displayName = draftDisplayName.trim();
    const ruleText = draftRule.trim();

    if (!displayName) {
      toast.error("Topic name is required");
      return;
    }

    if (!ruleText) {
      toast.error("Rule text is required");
      return;
    }

    startTransition(async () => {
      try {
        const nextTopic = isCreatingTopic
          ? await createGrammarTopic({
              displayName,
              learningLanguage: activeLanguage,
              level: draftLevel,
              ruleText,
              guidanceText: draftGuidance,
              evaluationInstructions: draftEvaluationInstructions,
            })
          : await saveGrammarTopicPromptOverride({
              topicKey: selectedTopic!.topicKey,
              displayName,
              learningLanguage: activeLanguage,
              level: draftLevel,
              ruleText,
              guidanceText: draftGuidance,
              evaluationInstructions: draftEvaluationInstructions,
            });

        upsertTopicState(nextTopic);
        setSelectedTopicKey(nextTopic.topicKey);
        setIsCreatingTopic(false);
        loadTopicDraft(nextTopic, nextTopic.learningLanguage);
        toast.success(
          isCreatingTopic ? "Grammar topic created" : "Grammar topic saved",
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save topic",
        );
      }
    });
  }

  function handleReset() {
    if (!selectedTopic || selectedTopic.isCustom) {
      return;
    }

    startTransition(async () => {
      try {
        const nextTopic = await resetGrammarTopicPromptOverride(
          selectedTopic.topicKey,
        );

        upsertTopicState(nextTopic);
        loadTopicDraft(nextTopic, nextTopic.learningLanguage);
        toast.success("Topic reset to defaults");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reset topic",
        );
      }
    });
  }

  function handleDelete() {
    const topic = selectedTopic;

    if (!topic) {
      return;
    }

    const confirmed = window.confirm(
      topic.isCustom
        ? `Delete custom topic "${topic.displayName}"?`
        : `Delete built-in topic "${topic.displayName}"? This hides it from the app.`,
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteGrammarTopic(topic.topicKey);
        removeTopicState(topic.topicKey);
        const nextTopic = topicsState[activeLanguage].find(
          (item) => item.topicKey !== topic.topicKey,
        );
        setSelectedTopicKey(nextTopic?.topicKey ?? null);
        loadTopicDraft(nextTopic ?? null, activeLanguage);
        toast.success("Grammar topic deleted");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete topic",
        );
      }
    });
  }

  function renderTopicEditor() {
    const showTopic = selectedTopic;

    if (!showTopic && !isCreatingTopic) {
      return (
        <p className="text-sm text-muted-foreground">
          Select a topic from the list or create a new one.
        </p>
      );
    }

    return (
      <>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">
              {isCreatingTopic ? "New Topic" : draftDisplayName || "Untitled Topic"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isCreatingTopic
                ? `${activeLanguage} topic`
                : `Internal key: ${showTopic?.topicKey}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {showTopic?.isCustom && <Badge variant="secondary">Custom topic</Badge>}
            {showTopic?.hasOverride && !showTopic.isCustom && (
              <Badge variant="outline">Override active</Badge>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic-name">Topic name</Label>
          <Input
            id="topic-name"
            value={draftDisplayName}
            onChange={(event) => setDraftDisplayName(event.target.value)}
            placeholder="Passive Voice (Simple)"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic-level">CEFR level</Label>
          <Select value={draftLevel} onValueChange={setDraftLevel}>
            <SelectTrigger id="topic-level" className="w-full lg:w-48">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_ORDER.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rule-text">Rule text</Label>
          <Textarea
            id="rule-text"
            value={draftRule}
            onChange={(event) => setDraftRule(event.target.value)}
            rows={10}
          />
          <p className="text-xs text-muted-foreground">
            This is the primary grammar explanation sent to the model.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="guidance-text">Additional generation guidance</Label>
          <Textarea
            id="guidance-text"
            value={draftGuidance}
            onChange={(event) => setDraftGuidance(event.target.value)}
            rows={7}
          />
          <p className="text-xs text-muted-foreground">
            Use this for generation constraints, examples, and edge cases.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="evaluation-text">Evaluation instructions</Label>
          <Textarea
            id="evaluation-text"
            value={draftEvaluationInstructions}
            onChange={(event) =>
              setDraftEvaluationInstructions(event.target.value)
            }
            rows={6}
          />
          <p className="text-xs text-muted-foreground">
            These instructions are added only during answer evaluation.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium">Prompt preview</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {draftDisplayName.trim() || "New Topic"}

            {draftRule.trim() || draftGuidance.trim()
              ? [draftRule.trim(), draftGuidance.trim()]
                  .filter(Boolean)
                  .join("\n\nAdditional generation guidance:\n")
              : "No rule text configured."}
          </pre>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium">Evaluation preview</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {draftEvaluationInstructions.trim() ||
              "No extra evaluation instructions configured."}
          </pre>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium">Exact final generation prompt</p>
              <p className="text-xs text-muted-foreground">
                This is the grammar section injected into AI generation.
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
            {isCreatingTopic ? "Create Topic" : "Save Changes"}
          </Button>
          {isCreatingTopic ? (
            <Button variant="outline" onClick={handleCancelCreate} disabled={isPending}>
              Cancel
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isPending || !showTopic || showTopic.isCustom}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset To Default
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Topic
              </Button>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grammar Rules</h1>
        <p className="text-muted-foreground">
          Manage grammar topic names, generation rules, and evaluation
          instructions.
        </p>
      </div>

      <Tabs
        value={activeLanguage}
        onValueChange={(value) => {
          const nextLanguage = value as LanguageTab;
          const nextTopic = topicsState[nextLanguage][0] ?? null;
          setActiveLanguage(nextLanguage);
          setIsCreatingTopic(false);
          setSelectedTopicKey(nextTopic?.topicKey ?? null);
          loadTopicDraft(nextTopic, nextLanguage);
        }}
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
            placeholder="Search topics, rules, guidance, evaluation"
            className="w-full lg:max-w-sm"
          />
        </div>

        {(["english", "spanish"] as const).map((language) => (
          <TabsContent key={language} value={language}>
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">Topics</CardTitle>
                    <Button size="sm" onClick={handleStartCreate} disabled={isPending}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Topic
                    </Button>
                  </div>
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
                        onClick={() => handleSelectTopic(topic.topicKey)}
                        className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                          !isCreatingTopic && topic.topicKey === selectedTopicKey
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{topic.displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              Level {topic.level}
                              {topic.displayName !== topic.topicKey
                                ? ` • ${topic.topicKey}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {topic.isCustom && (
                              <Badge variant="secondary">Custom</Badge>
                            )}
                            {topic.hasOverride && !topic.isCustom && (
                              <Badge variant="outline">Override</Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {isCreatingTopic
                      ? "Create Topic"
                      : selectedTopic?.displayName ?? "Topic Editor"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">{renderTopicEditor()}</CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}