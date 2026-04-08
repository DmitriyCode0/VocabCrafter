"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import type { DiscussionPrompt, QuizConfig, QuizTerm } from "@/types/quiz";

interface DiscussionPlayerProps {
  quizId: string;
  prompts: DiscussionPrompt[];
  vocabularyTerms?: QuizTerm[];
  quizConfig?: QuizConfig;
  isOwner?: boolean;
  onPromptsChange?: (prompts: DiscussionPrompt[]) => void;
  onComplete: (prompts: DiscussionPrompt[]) => void;
}

function renderHighlightedPrompt(
  promptText: string,
  highlight?: string,
): React.ReactNode {
  if (!highlight) {
    return promptText;
  }

  const index = promptText.toLowerCase().indexOf(highlight.toLowerCase());
  if (index === -1) {
    return promptText;
  }

  const before = promptText.slice(0, index);
  const match = promptText.slice(index, index + highlight.length);
  const after = promptText.slice(index + highlight.length);

  return (
    <>
      {before}
      <span className="font-bold text-primary underline decoration-primary/40 decoration-2 underline-offset-2">
        {match}
      </span>
      {after}
    </>
  );
}

export function DiscussionPlayer({
  quizId,
  prompts,
  vocabularyTerms = [],
  quizConfig,
  isOwner = false,
  onPromptsChange,
  onComplete,
}: DiscussionPlayerProps) {
  const [regeneratingPromptId, setRegeneratingPromptId] = useState<number | null>(
    null,
  );

  function getPromptTerm(prompt: DiscussionPrompt, index: number) {
    return prompt.sourceTerm ?? prompt.highlightText ?? vocabularyTerms[index]?.term;
  }

  async function handleRegeneratePrompt(prompt: DiscussionPrompt, index: number) {
    const sourceTerm = getPromptTerm(prompt, index);
    const vocabularyTerm =
      vocabularyTerms.find((term) => term.term === sourceTerm) ??
      vocabularyTerms[index];

    if (!sourceTerm || !vocabularyTerm) {
      toast.error("Could not determine the target vocabulary for this prompt.");
      return;
    }

    if (!quizConfig) {
      toast.error("This quiz is missing its generation config, so the prompt cannot be regenerated.");
      return;
    }

    setRegeneratingPromptId(prompt.id);

    try {
      const generateResponse = await fetch("/api/ai/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "discussion",
          terms: [vocabularyTerm],
          config: quizConfig,
        }),
      });

      const generated = (await generateResponse.json().catch(() => null)) as
        | { content?: { prompts?: DiscussionPrompt[] }; error?: never }
        | { error?: string }
        | null;

      if (!generateResponse.ok) {
        throw new Error(
          generated && "error" in generated
            ? generated.error || "Failed to regenerate prompt"
            : "Failed to regenerate prompt",
        );
      }

      const nextPrompt =
        generated && "content" in generated
          ? generated.content?.prompts?.[0]
          : undefined;

      if (!nextPrompt) {
        throw new Error("No regenerated prompt was returned.");
      }

      const nextPrompts = prompts.map((currentPrompt, currentIndex) =>
        currentIndex === index
          ? {
              ...nextPrompt,
              id: currentPrompt.id,
              sourceTerm,
              highlightText: nextPrompt.highlightText ?? sourceTerm,
            }
          : currentPrompt,
      );

      const saveResponse = await fetch(`/api/quizzes/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedContent: {
            prompts: nextPrompts,
          },
        }),
      });

      const saved = (await saveResponse.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!saveResponse.ok) {
        throw new Error(saved?.error || "Failed to save regenerated prompt");
      }

      onPromptsChange?.(nextPrompts);
      toast.success(`Regenerated prompt for \"${sourceTerm}\".`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to regenerate prompt",
      );
    } finally {
      setRegeneratingPromptId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live Discussion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {prompts.map((prompt, index) => (
            <div
              key={prompt.id}
              className="rounded-md border bg-card p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">#{index + 1}</Badge>
                  <Badge variant="secondary">
                    {prompt.type === "agree-disagree"
                      ? "Agree / Disagree"
                      : "Open-ended"}
                  </Badge>
                  {getPromptTerm(prompt, index) ? (
                    <Badge
                      variant="outline"
                      className="border-primary/25 bg-primary/5 text-primary"
                    >
                      Target vocab: {getPromptTerm(prompt, index)}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && quizConfig ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegeneratePrompt(prompt, index)}
                      disabled={regeneratingPromptId === prompt.id}
                    >
                      {regeneratingPromptId === prompt.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Regenerate Question
                        </>
                      )}
                    </Button>
                  ) : null}
                  <BrowserTtsButton
                    text={prompt.prompt}
                    language={quizConfig?.targetLanguage}
                    label="Listen"
                  />
                </div>
              </div>
              <p className="text-sm leading-relaxed">
                {renderHighlightedPrompt(
                  prompt.prompt,
                  prompt.highlightText ?? getPromptTerm(prompt, index),
                )}
              </p>
            </div>
          ))}

          {prompts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No discussion prompts were generated for this quiz.
            </p>
          )}

          <Button className="w-full" onClick={() => onComplete(prompts)}>
            Finish Session
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
