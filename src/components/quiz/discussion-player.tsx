"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";
import type { DiscussionPrompt, QuizConfig } from "@/types/quiz";

interface DiscussionPlayerProps {
  prompts: DiscussionPrompt[];
  quizConfig?: QuizConfig;
  onComplete: (prompts: DiscussionPrompt[]) => void;
}

export function DiscussionPlayer({
  prompts,
  quizConfig,
  onComplete,
}: DiscussionPlayerProps) {
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline">#{index + 1}</Badge>
                  <Badge variant="secondary">
                    {prompt.type === "agree-disagree"
                      ? "Agree / Disagree"
                      : "Open-ended"}
                  </Badge>
                </div>
                <BrowserTtsButton
                  text={prompt.prompt}
                  language={quizConfig?.targetLanguage}
                  label="Listen"
                />
              </div>
              <p className="text-sm leading-relaxed">{prompt.prompt}</p>
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
