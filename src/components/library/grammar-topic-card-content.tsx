import { ArrowUpRight } from "lucide-react";
import { getGrammarLibraryTopicContent } from "@/lib/grammar/library-topic-content";
import type { GrammarTopicPromptConfig } from "@/lib/grammar/prompt-overrides";

interface GrammarTopicCardContentProps {
  topic: GrammarTopicPromptConfig;
  fallbackMessage: string;
  openArticleLabel: string;
}

export function GrammarTopicCardContent({
  topic,
  fallbackMessage,
  openArticleLabel,
}: GrammarTopicCardContentProps) {
  const content = getGrammarLibraryTopicContent(topic.topicKey);
  const preview = content?.summary ?? topic.effectiveRule.split("\n")[0]?.trim();

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-foreground/90">
        {preview || fallbackMessage}
      </p>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span>{openArticleLabel}</span>
        <ArrowUpRight className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}