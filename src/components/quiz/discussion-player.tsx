"use client";

import { useState } from "react";
import { useAppI18n } from "@/components/providers/app-language-provider";
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
  const { messages } = useAppI18n();
  const [regeneratingPromptId, setRegeneratingPromptId] = useState<
    number | null
  >(null);

  function getPromptTerm(prompt: DiscussionPrompt, index: number) {
    return (
      prompt.sourceTerm ?? prompt.highlightText ?? vocabularyTerms[index]?.term
    );
  }

  async function handleRegeneratePrompt(
    prompt: DiscussionPrompt,
    index: number,
  ) {
    const sourceTerm = getPromptTerm(prompt, index);
    const vocabularyTerm =
      vocabularyTerms.find((term) => term.term === sourceTerm) ??
      vocabularyTerms[index];

    if (!sourceTerm || !vocabularyTerm) {
      toast.error(messages.quizSession.discussion.missingTargetVocab);
      return;
    }

    if (!quizConfig) {
      toast.error(messages.quizSession.discussion.missingConfig);
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
            ? generated.error || messages.quizSession.discussion.regenerateFailed
            : messages.quizSession.discussion.regenerateFailed,
        );
      }

      const nextPrompt =
        generated && "content" in generated
          ? generated.content?.prompts?.[0]
          : undefined;

      if (!nextPrompt) {
        throw new Error(messages.quizSession.discussion.noRegeneratedPrompt);
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

      const saved = (await saveResponse.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!saveResponse.ok) {
        throw new Error(
          saved?.error || messages.quizSession.discussion.saveFailed,
        );
      }

      onPromptsChange?.(nextPrompts);
      toast.success(messages.quizSession.discussion.regenerateSuccess(sourceTerm));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : messages.quizSession.discussion.regenerateFailed,
      );
    } finally {
      setRegeneratingPromptId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {messages.quizSession.discussion.title}
          </CardTitle>
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
                      ? messages.quizSession.discussion.agreeDisagree
                      : messages.quizSession.discussion.openEnded}
                  </Badge>
                  {getPromptTerm(prompt, index) ? (
                    <Badge
                      variant="outline"
                      className="border-primary/25 bg-primary/5 text-primary"
                    >
                      {messages.quizSession.discussion.targetVocab(
                        getPromptTerm(prompt, index) ?? "",
                      )}
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
                          {messages.quizSession.discussion.regenerating}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {messages.quizSession.discussion.regenerateQuestion}
                        </>
                      )}
                    </Button>
                  ) : null}
                  <BrowserTtsButton
                    text={prompt.prompt}
                    language={quizConfig?.targetLanguage}
                    label={messages.common.listen}
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
              {messages.quizSession.discussion.noPrompts}
            </p>
          )}

          <Button className="w-full" onClick={() => onComplete(prompts)}>
            {messages.quizSession.discussion.finishSession}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
