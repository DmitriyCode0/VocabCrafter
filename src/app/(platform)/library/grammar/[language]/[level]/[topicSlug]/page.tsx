import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GrammarTopicArticle } from "@/components/library/grammar-topic-article";
import { GrammarTopicArticleContents } from "@/components/library/grammar-topic-article-contents";
import { GrammarTopicDeveloperMode } from "@/components/library/grammar-topic-developer-mode";
import { LibraryPageHeader } from "@/components/library/library-page-header";
import { canUserEditGrammarArticles } from "@/lib/grammar/article-permissions";
import {
  getGrammarTopicLibraryContentState,
  getPublishedGrammarTopicContentWithFallback,
} from "@/lib/grammar/article-content-store";
import {
  getGrammarTopicSlug,
  buildGrammarTopicArticleHref,
} from "@/lib/grammar/library-topic-routes";
import {
  getGrammarLibraryArticleSectionId,
  type GrammarLibraryTopicContent,
} from "@/lib/grammar/library-topic-content";
import { getGrammarTopicPromptCatalog } from "@/lib/grammar/prompt-overrides";
import type { GrammarTopicPromptConfig } from "@/lib/grammar/prompt-overrides";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import { normalizeLearningLanguage } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/roles";

export const dynamic = "force-dynamic";

function buildGrammarTopicDeveloperDraft(
  topic: GrammarTopicPromptConfig,
): GrammarLibraryTopicContent {
  const firstRuleLine =
    topic.effectiveRule
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? topic.displayName;

  return {
    summary: firstRuleLine,
    formula: topic.displayName,
    sections: [
      {
        title: topic.displayName,
        items: [firstRuleLine],
      },
    ],
    examples: [
      {
        sentence: "Add an example sentence here.",
      },
    ],
  };
}

interface GrammarTopicArticlePageProps {
  params: Promise<{
    language: string;
    level: string;
    topicSlug: string;
  }>;
  searchParams: Promise<{
    developer?: string;
  }>;
}

export default async function GrammarTopicArticlePage({
  params,
  searchParams,
}: GrammarTopicArticlePageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, app_language")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "tutor" && profile?.role !== "superadmin") {
    redirect("/dashboard");
  }

  const resolvedParams = await params;
  const learningLanguage = normalizeLearningLanguage(resolvedParams.language);
  const catalog = await getGrammarTopicPromptCatalog(learningLanguage);
  const topics = catalog.flatMap(({ topics: catalogTopics }) => catalogTopics);
  const topicIndex = topics.findIndex(
    (item) =>
      item.level === resolvedParams.level &&
      getGrammarTopicSlug(item.topicKey) === resolvedParams.topicSlug,
  );
  const topic = topicIndex >= 0 ? topics[topicIndex] : null;

  if (!topic) {
    notFound();
  }

  const messages = getAppMessages(normalizeAppLanguage(profile.app_language));
  const resolvedSearchParams = await searchParams;
  const [topicContent, contentState, canEditArticle] = await Promise.all([
    getPublishedGrammarTopicContentWithFallback(topic.topicKey),
    getGrammarTopicLibraryContentState(topic.topicKey),
    canUserEditGrammarArticles(user.id, profile.role as Role),
  ]);
  const developerMode = resolvedSearchParams.developer === "1" && canEditArticle;
  const developerContent =
    contentState?.draftContent ??
    contentState?.publishedContent ??
    topicContent ??
    buildGrammarTopicDeveloperDraft(topic);
  const articlePreviewContent =
    developerMode && contentState?.draftContent
      ? contentState.draftContent
      : topicContent ?? developerContent;
  const articleHref = buildGrammarTopicArticleHref(
    topic.learningLanguage,
    topic.level,
    topic.topicKey,
  );
  const topicSummary =
    articlePreviewContent?.summary ??
    topic.effectiveRule.split("\n")[0]?.trim() ??
    "";
  const sectionLinks = articlePreviewContent
    ? [
        ...articlePreviewContent.sections.map((section) => ({
          id: getGrammarLibraryArticleSectionId(section.title),
          label: section.title,
        })),
        { id: "examples", label: messages.library.examplesTitle },
        ...(articlePreviewContent.quiz
          ? [{ id: "mini-quiz", label: messages.library.miniQuizTitle }]
          : []),
      ]
    : [];
  const previousTopic = topicIndex > 0 ? topics[topicIndex - 1] : null;
  const nextTopic = topicIndex < topics.length - 1 ? topics[topicIndex + 1] : null;

  return (
    <div className="space-y-6">
      <LibraryPageHeader
        currentSection="grammar"
        title={messages.library.title}
        description={messages.library.grammarDescription}
      />

      <div className="mx-auto max-w-5xl space-y-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/library" className="transition-colors hover:text-foreground">
            {messages.library.title}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>{messages.common.studyLanguageNames[topic.learningLanguage]}</span>
          <ChevronRight className="h-4 w-4" />
          <span>{topic.level}</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{topic.displayName}</span>
        </nav>

        <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-muted/70 via-background to-muted/20 p-6 shadow-sm sm:p-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{topic.level}</Badge>
              <Badge variant="secondary">
                {messages.common.studyLanguageNames[topic.learningLanguage]}
              </Badge>
              {topic.isCustom ? (
                <Badge variant="secondary">{messages.library.customTopicBadge}</Badge>
              ) : null}
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {topic.displayName}
              </h1>
              {topic.displayName !== topic.topicKey ? (
                <p className="text-sm text-muted-foreground">{topic.topicKey}</p>
              ) : null}
              <p className="max-w-3xl text-base leading-7 text-foreground/85 sm:text-lg">
                {topicSummary || messages.library.futureDevelopment}
              </p>
            </div>

            <Link
              href="/library"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {messages.library.backToGrammarLibrary}
            </Link>

            {canEditArticle ? (
              <Link
                href={developerMode ? articleHref : `${articleHref}?developer=1`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <PencilLine className="mr-1 h-4 w-4" />
                {developerMode
                  ? messages.library.exitDeveloperMode
                  : messages.library.editArticle}
              </Link>
            ) : null}
          </div>
        </section>

        {developerMode ? (
          <Card className="border-primary/30 bg-primary/5 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold tracking-tight">
                {messages.library.developerModeTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-foreground/85">
              <p>{messages.library.developerModeDescription}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border bg-card/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {messages.library.draftStatusLabel}
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {contentState?.draftContent
                      ? messages.library.developerContentAvailable
                      : messages.library.developerContentMissing}
                  </p>
                </div>
                <div className="rounded-xl border bg-card/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {messages.library.publishedStatusLabel}
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {contentState?.publishedContent
                      ? messages.library.developerContentAvailable
                      : messages.library.developerContentMissing}
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground">
                {messages.library.developerModeNextStep}
              </p>
              <GrammarTopicDeveloperMode
                key={`grammar-topic-editor-${topic.topicKey}-${contentState?.updatedAt ?? "base"}`}
                topicKey={topic.topicKey}
                learningLanguage={topic.learningLanguage}
                level={topic.level}
                initialContent={developerContent}
              />
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold tracking-tight">
                {messages.library.grammarTab}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-8">
              <GrammarTopicArticle
                topic={topic}
                fallbackMessage={messages.library.futureDevelopment}
                formulaLabel={messages.library.formulaLabel}
                examplesLabel={messages.library.examplesTitle}
                miniQuizTitle={messages.library.miniQuizTitle}
                explainLabel={messages.library.explainAnswer}
                submitQuizLabel={messages.library.submitQuiz}
                finishQuizLabel={messages.library.finishQuiz}
                resetQuizLabel={messages.library.resetQuiz}
                correctOptionLabel={messages.library.correctOption}
                questionLabel={messages.library.questionLabel}
                scoreLabel={messages.library.scoreLabel}
                contentOverride={articlePreviewContent}
              />
            </CardContent>
          </Card>

          <div className="space-y-4 lg:sticky lg:top-6">
            {sectionLinks.length > 0 ? (
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold tracking-tight">
                    {messages.library.articleContentsTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GrammarTopicArticleContents sections={sectionLinks} />
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold tracking-tight">
                  {messages.library.browseAllTopics}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href="/library"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {messages.library.backToGrammarLibrary}
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {messages.library.continueWithLevel}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {previousTopic ? (
              <Link
                href={buildGrammarTopicArticleHref(
                  previousTopic.learningLanguage,
                  previousTopic.level,
                  previousTopic.topicKey,
                )}
                className="block"
              >
                <Card className="h-full border-border/70 transition-colors hover:border-foreground/20 hover:bg-muted/20">
                  <CardContent className="space-y-2 py-6">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {messages.common.previous}
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {previousTopic.displayName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {previousTopic.level} · {messages.common.studyLanguageNames[previousTopic.learningLanguage]}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ) : <div />}

            {nextTopic ? (
              <Link
                href={buildGrammarTopicArticleHref(
                  nextTopic.learningLanguage,
                  nextTopic.level,
                  nextTopic.topicKey,
                )}
                className="block"
              >
                <Card className="h-full border-border/70 transition-colors hover:border-foreground/20 hover:bg-muted/20">
                  <CardContent className="space-y-2 py-6 text-left md:text-right">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {messages.common.next}
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {nextTopic.displayName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {nextTopic.level} · {messages.common.studyLanguageNames[nextTopic.learningLanguage]}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ) : <div />}
          </div>
        </section>
      </div>
    </div>
  );
}