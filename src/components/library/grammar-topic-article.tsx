import {
  getGrammarLibraryArticleSectionId,
  getGrammarLibraryTopicContent,
  type GrammarLibraryTopicContent,
} from "@/lib/grammar/library-topic-content";
import { GrammarTopicMiniQuiz } from "@/components/library/grammar-topic-mini-quiz";
import type { GrammarTopicPromptConfig } from "@/lib/grammar/prompt-overrides";

interface GrammarTopicArticleProps {
  topic: GrammarTopicPromptConfig;
  fallbackMessage: string;
  formulaLabel: string;
  examplesLabel: string;
  miniQuizTitle: string;
  explainLabel: string;
  submitQuizLabel: string;
  finishQuizLabel: string;
  resetQuizLabel: string;
  correctOptionLabel: string;
  questionLabel: string;
  scoreLabel: string;
  contentOverride?: GrammarLibraryTopicContent | null;
}

function formatFallbackContent(ruleText: string) {
  return ruleText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function GrammarTopicArticle({
  topic,
  fallbackMessage,
  formulaLabel,
  examplesLabel,
  miniQuizTitle,
  explainLabel,
  submitQuizLabel,
  finishQuizLabel,
  resetQuizLabel,
  correctOptionLabel,
  questionLabel,
  scoreLabel,
  contentOverride,
}: GrammarTopicArticleProps) {
  const content = contentOverride ?? getGrammarLibraryTopicContent(topic.topicKey);

  if (!content) {
    const fallbackLines = formatFallbackContent(topic.effectiveRule);

    return (
      <article className="space-y-6">
        <div className="space-y-3">
          {fallbackLines.length > 0 ? (
            fallbackLines.map((line) => (
              <p key={line} className="text-sm leading-7 text-foreground/90">
                {line}
              </p>
            ))
          ) : (
            <p className="text-sm leading-7 text-muted-foreground">{fallbackMessage}</p>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="space-y-8">
      <div className="space-y-4">
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {formulaLabel}
          </p>
          <p className="mt-2 text-base font-medium text-foreground">{content.formula}</p>
        </div>
        {content.note ? (
          <p className="text-sm leading-6 text-muted-foreground">{content.note}</p>
        ) : null}
      </div>

      {content.sections.map((section) => (
        <section
          key={section.title}
          id={getGrammarLibraryArticleSectionId(section.title)}
          className="scroll-mt-24 space-y-3"
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {section.title}
          </h2>
          <ul className="space-y-2 pl-5 text-sm leading-7 text-foreground/85">
            {section.items.map((item) => (
              <li key={item} className="list-disc">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section id="examples" className="scroll-mt-24 space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {examplesLabel}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {content.examples.map((example) => (
            <div key={example.sentence} className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-medium leading-6 text-foreground">
                {example.sentence}
              </p>
              {example.note ? (
                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {example.note}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {content.quiz ? (
        <GrammarTopicMiniQuiz
          quiz={content.quiz}
          title={miniQuizTitle}
          explainLabel={explainLabel}
          submitLabel={submitQuizLabel}
          finishQuizLabel={finishQuizLabel}
          resetLabel={resetQuizLabel}
          correctOptionLabel={correctOptionLabel}
          questionLabel={questionLabel}
          scoreLabel={scoreLabel}
        />
      ) : null}
    </article>
  );
}