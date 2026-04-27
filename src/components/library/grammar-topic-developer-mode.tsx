"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  Code2,
  FileText,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  publishGrammarTopicArticle,
  saveGrammarTopicArticleDraft,
} from "@/app/(platform)/library/grammar/actions";
import type {
  GrammarLibraryTopicContent,
  GrammarLibraryTopicExample,
  GrammarLibraryTopicQuizQuestion,
  GrammarLibraryTopicSection,
} from "@/lib/grammar/library-topic-content";
import type { LearningLanguage } from "@/lib/languages";

interface GrammarTopicDeveloperModeProps {
  topicKey: string;
  learningLanguage: LearningLanguage;
  level: string;
  initialContent: GrammarLibraryTopicContent;
}

type EditorMode = "visual" | "json";

const QUIZ_OPTION_IDS = Array.from({ length: 26 }, (_, index) =>
  String.fromCharCode(97 + index),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDraftContentFromUnknown(
  value: unknown,
): GrammarLibraryTopicContent | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.summary !== "string" ||
    typeof value.formula !== "string" ||
    !Array.isArray(value.sections) ||
    !Array.isArray(value.examples)
  ) {
    return null;
  }

  const sections: GrammarLibraryTopicSection[] = [];

  for (const section of value.sections) {
    if (
      !isRecord(section) ||
      typeof section.title !== "string" ||
      !Array.isArray(section.items) ||
      !section.items.every((item) => typeof item === "string")
    ) {
      return null;
    }

    sections.push({
      title: section.title,
      items: [...section.items],
    });
  }

  const examples: GrammarLibraryTopicExample[] = [];

  for (const example of value.examples) {
    if (!isRecord(example) || typeof example.sentence !== "string") {
      return null;
    }

    if (example.note !== undefined && typeof example.note !== "string") {
      return null;
    }

    examples.push({
      sentence: example.sentence,
      ...(typeof example.note === "string" ? { note: example.note } : {}),
    });
  }

  let quiz: GrammarLibraryTopicContent["quiz"];

  if (value.quiz !== undefined) {
    if (!isRecord(value.quiz) || !Array.isArray(value.quiz.questions)) {
      return null;
    }

    const questions: GrammarLibraryTopicQuizQuestion[] = [];

    for (const question of value.quiz.questions) {
      if (
        !isRecord(question) ||
        typeof question.question !== "string" ||
        typeof question.correctOptionId !== "string" ||
        typeof question.explanation !== "string" ||
        !Array.isArray(question.options)
      ) {
        return null;
      }

      const options = question.options.map((option) => {
        if (
          !isRecord(option) ||
          typeof option.id !== "string" ||
          typeof option.label !== "string"
        ) {
          return null;
        }

        return {
          id: option.id,
          label: option.label,
        };
      });

      if (options.some((option) => option === null)) {
        return null;
      }

      const normalizedOptions = options.filter(
        (option): option is NonNullable<typeof option> => option !== null,
      );

      questions.push({
        question: question.question,
        options: normalizedOptions,
        correctOptionId: normalizedOptions.some(
          (option) => option.id === question.correctOptionId,
        )
          ? question.correctOptionId
          : (normalizedOptions[0]?.id ?? "a"),
        explanation: question.explanation,
      });
    }

    quiz = { questions };
  }

  return {
    summary: value.summary,
    formula: value.formula,
    ...(typeof value.note === "string" ? { note: value.note } : {}),
    sections,
    examples,
    ...(quiz ? { quiz } : {}),
  };
}

function getNextQuizOptionId(
  options: GrammarLibraryTopicQuizQuestion["options"],
) {
  const usedIds = new Set(options.map((option) => option.id));

  for (const candidate of QUIZ_OPTION_IDS) {
    if (!usedIds.has(candidate)) {
      return candidate;
    }
  }

  return `option-${options.length + 1}`;
}

function createEmptySection(): GrammarLibraryTopicSection {
  return {
    title: "",
    items: [""],
  };
}

function createEmptyExample(): GrammarLibraryTopicExample {
  return {
    sentence: "",
    note: "",
  };
}

function createEmptyQuizQuestion(): GrammarLibraryTopicQuizQuestion {
  return {
    question: "",
    options: [
      { id: "a", label: "" },
      { id: "b", label: "" },
      { id: "c", label: "" },
    ],
    correctOptionId: "a",
    explanation: "",
  };
}

export function GrammarTopicDeveloperMode({
  topicKey,
  learningLanguage,
  level,
  initialContent,
}: GrammarTopicDeveloperModeProps) {
  const router = useRouter();
  const { messages } = useAppI18n();
  const initialContentText = JSON.stringify(initialContent, null, 2);
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [draftContent, setDraftContent] =
    useState<GrammarLibraryTopicContent>(initialContent);
  const [jsonDraft, setJsonDraft] = useState(initialContentText);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const quizQuestionCount = draftContent.quiz?.questions.length ?? 0;

  function handleEditorModeChange(nextMode: string) {
    const normalizedMode = nextMode as EditorMode;

    if (normalizedMode === "json") {
      setJsonDraft(JSON.stringify(draftContent, null, 2));
      setJsonError(null);
    }

    if (normalizedMode === "visual" && jsonError) {
      setJsonDraft(JSON.stringify(draftContent, null, 2));
      setJsonError(null);
    }

    setEditorMode(normalizedMode);
  }

  function updateDraft(
    transform: (current: GrammarLibraryTopicContent) => GrammarLibraryTopicContent,
  ) {
    setDraftContent((current) => transform(current));
  }

  function handleReset() {
    setDraftContent(initialContent);
    setJsonDraft(initialContentText);
    setJsonError(null);
    setEditorMode("visual");
  }

  function handleJsonChange(value: string) {
    setJsonDraft(value);

    try {
      const parsed = JSON.parse(value);
      const normalizedDraft = parseDraftContentFromUnknown(parsed);

      if (!normalizedDraft) {
        setJsonError(messages.library.articleEditor.jsonInvalid);
        return;
      }

      setDraftContent(normalizedDraft);
      setJsonError(null);
    } catch (error) {
      setJsonError(
        error instanceof Error
          ? error.message
          : messages.library.articleEditor.jsonInvalid,
      );
    }
  }

  function runMutation(mode: "draft" | "publish") {
    if (jsonError) {
      setEditorMode("json");
      toast.error(messages.library.articleEditor.jsonInvalid);
      return;
    }

    const contentText = JSON.stringify(draftContent, null, 2);

    startTransition(async () => {
      try {
        if (mode === "publish") {
          await publishGrammarTopicArticle({
            topicKey,
            learningLanguage,
            level,
            contentText,
          });
          toast.success(messages.library.articlePublished);
        } else {
          await saveGrammarTopicArticleDraft({
            topicKey,
            learningLanguage,
            level,
            contentText,
          });
          toast.success(messages.library.draftSaved);
        }

        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : mode === "publish"
              ? messages.library.articlePublishFailed
              : messages.library.articleSaveFailed,
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div className="space-y-2">
            <Badge variant="outline" className="border-primary/20 bg-background/80">
              {messages.library.developerModeTitle}
            </Badge>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">
              {messages.library.articleEditor.heroTitle}
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {messages.library.articleEditor.heroDescription}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              {
                label: messages.library.articleEditor.statsSections,
                value: draftContent.sections.length,
                Icon: FileText,
              },
              {
                label: messages.library.articleEditor.statsExamples,
                value: draftContent.examples.length,
                Icon: Sparkles,
              },
              {
                label: messages.library.articleEditor.statsQuestions,
                value: quizQuestionCount,
                Icon: BookOpenText,
              },
            ].map(({ label, value, Icon }) => (
              <div
                key={label}
                className="rounded-xl border border-border/70 bg-background/85 p-4 shadow-sm backdrop-blur"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                  </p>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs value={editorMode} onValueChange={handleEditorModeChange} className="gap-5">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="visual" className="min-w-[160px] justify-start">
            <Sparkles className="h-4 w-4" />
            {messages.library.articleEditor.visualTab}
          </TabsTrigger>
          <TabsTrigger value="json" className="min-w-[160px] justify-start">
            <Code2 className="h-4 w-4" />
            {messages.library.articleEditor.jsonTab}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-5">
          <Card className="overflow-hidden border-primary/15">
            <CardHeader className="border-b bg-gradient-to-r from-primary/8 via-background to-background">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                {messages.library.articleEditor.overviewTitle}
              </CardTitle>
              <CardDescription>
                {messages.library.articleEditor.overviewDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>{messages.library.articleEditor.summaryLabel}</Label>
                <Textarea
                  value={draftContent.summary}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{messages.library.formulaLabel}</Label>
                <Input
                  value={draftContent.formula}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      formula: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{messages.library.articleEditor.noteLabel}</Label>
                <Textarea
                  value={draftContent.note ?? ""}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                {messages.library.articleEditor.sectionsTitle}
              </CardTitle>
              <CardDescription>
                {messages.library.articleEditor.sectionsDescription}
              </CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      sections: current.sections.concat(createEmptySection()),
                    }))
                  }
                  disabled={isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {messages.library.articleEditor.addSection}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {draftContent.sections.map((section, sectionIndex) => (
                <div
                  key={`section-${sectionIndex}`}
                  className="rounded-2xl border bg-muted/20 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="secondary">
                      {messages.library.articleEditor.sectionLabel} {sectionIndex + 1}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateDraft((current) => ({
                          ...current,
                          sections: current.sections.filter(
                            (_, index) => index !== sectionIndex,
                          ),
                        }))
                      }
                      disabled={isPending || draftContent.sections.length === 1}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {messages.common.remove}
                    </Button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>
                        {messages.library.articleEditor.sectionTitleLabel}
                      </Label>
                      <Input
                        value={section.title}
                        onChange={(event) =>
                          updateDraft((current) => ({
                            ...current,
                            sections: current.sections.map((currentSection, index) =>
                              index === sectionIndex
                                ? {
                                    ...currentSection,
                                    title: event.target.value,
                                  }
                                : currentSection,
                            ),
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-3">
                      {section.items.map((item, itemIndex) => (
                        <div
                          key={`section-${sectionIndex}-item-${itemIndex}`}
                          className="flex items-start gap-2"
                        >
                          <div className="flex-1 space-y-2">
                            <Label>
                              {messages.library.articleEditor.bulletLabel} {itemIndex + 1}
                            </Label>
                            <Textarea
                              value={item}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  sections: current.sections.map(
                                    (currentSection, currentSectionIndex) =>
                                      currentSectionIndex === sectionIndex
                                        ? {
                                            ...currentSection,
                                            items: currentSection.items.map(
                                              (currentItem, currentItemIndex) =>
                                                currentItemIndex === itemIndex
                                                  ? event.target.value
                                                  : currentItem,
                                            ),
                                          }
                                        : currentSection,
                                  ),
                                }))
                              }
                              rows={2}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="mt-7"
                            onClick={() =>
                              updateDraft((current) => ({
                                ...current,
                                sections: current.sections.map(
                                  (currentSection, currentSectionIndex) =>
                                    currentSectionIndex === sectionIndex
                                      ? {
                                          ...currentSection,
                                          items: currentSection.items.filter(
                                            (_, currentItemIndex) =>
                                              currentItemIndex !== itemIndex,
                                          ),
                                        }
                                      : currentSection,
                                ),
                              }))
                            }
                            disabled={isPending || section.items.length === 1}
                            aria-label={messages.common.remove}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateDraft((current) => ({
                            ...current,
                            sections: current.sections.map((currentSection, index) =>
                              index === sectionIndex
                                ? {
                                    ...currentSection,
                                    items: currentSection.items.concat(""),
                                  }
                                : currentSection,
                            ),
                          }))
                        }
                        disabled={isPending}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {messages.library.articleEditor.addBullet}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                {messages.library.articleEditor.examplesTitle}
              </CardTitle>
              <CardDescription>
                {messages.library.articleEditor.examplesDescription}
              </CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      examples: current.examples.concat(createEmptyExample()),
                    }))
                  }
                  disabled={isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {messages.library.articleEditor.addExample}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {draftContent.examples.map((example, exampleIndex) => (
                <div
                  key={`example-${exampleIndex}`}
                  className="rounded-2xl border bg-muted/20 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="secondary">
                      {messages.library.articleEditor.exampleLabel} {exampleIndex + 1}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateDraft((current) => ({
                          ...current,
                          examples: current.examples.filter(
                            (_, index) => index !== exampleIndex,
                          ),
                        }))
                      }
                      disabled={isPending || draftContent.examples.length === 1}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {messages.common.remove}
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>
                        {messages.library.articleEditor.exampleSentenceLabel}
                      </Label>
                      <Textarea
                        value={example.sentence}
                        onChange={(event) =>
                          updateDraft((current) => ({
                            ...current,
                            examples: current.examples.map((currentExample, index) =>
                              index === exampleIndex
                                ? {
                                    ...currentExample,
                                    sentence: event.target.value,
                                  }
                                : currentExample,
                            ),
                          }))
                        }
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>
                        {messages.library.articleEditor.exampleNoteLabel}
                      </Label>
                      <Input
                        value={example.note ?? ""}
                        onChange={(event) =>
                          updateDraft((current) => ({
                            ...current,
                            examples: current.examples.map((currentExample, index) =>
                              index === exampleIndex
                                ? {
                                    ...currentExample,
                                    note: event.target.value,
                                  }
                                : currentExample,
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpenText className="h-4 w-4 text-primary" />
                {messages.library.articleEditor.quizTitle}
              </CardTitle>
              <CardDescription>
                {messages.library.articleEditor.quizDescription}
              </CardDescription>
              <CardAction>
                {draftContent.quiz ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateDraft((current) => ({
                        summary: current.summary,
                        formula: current.formula,
                        ...(current.note !== undefined
                          ? { note: current.note }
                          : {}),
                        sections: current.sections,
                        examples: current.examples,
                      }))
                    }
                    disabled={isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {messages.library.articleEditor.removeQuiz}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateDraft((current) => ({
                        ...current,
                        quiz: {
                          questions: [createEmptyQuizQuestion()],
                        },
                      }))
                    }
                    disabled={isPending}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {messages.library.articleEditor.addQuiz}
                  </Button>
                )}
              </CardAction>
            </CardHeader>

            <CardContent className="space-y-4">
              {draftContent.quiz ? (
                <>
                  {draftContent.quiz.questions.map((question, questionIndex) => (
                    <div
                      key={`question-${questionIndex}`}
                      className="rounded-2xl border bg-muted/20 p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Badge variant="secondary">
                          {messages.library.questionLabel} {questionIndex + 1}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateDraft((current) => ({
                              ...current,
                              quiz: current.quiz
                                ? {
                                    questions: current.quiz.questions.filter(
                                      (_, index) => index !== questionIndex,
                                    ),
                                  }
                                : undefined,
                            }))
                          }
                          disabled={
                            isPending || quizQuestionCount === 1
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {messages.common.remove}
                        </Button>
                      </div>

                      <div className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <Label>
                            {messages.library.articleEditor.questionPromptLabel}
                          </Label>
                          <Textarea
                            value={question.question}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                quiz: current.quiz
                                  ? {
                                      questions: current.quiz.questions.map(
                                        (currentQuestion, index) =>
                                          index === questionIndex
                                            ? {
                                                ...currentQuestion,
                                                question: event.target.value,
                                              }
                                            : currentQuestion,
                                      ),
                                    }
                                  : undefined,
                              }))
                            }
                            rows={2}
                          />
                        </div>

                        <div className="space-y-3">
                          {question.options.map((option, optionIndex) => (
                            <div
                              key={`question-${questionIndex}-option-${option.id}`}
                              className="rounded-xl border bg-background p-3 shadow-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <Badge
                                  variant={
                                    option.id === question.correctOptionId
                                      ? "default"
                                      : "outline"
                                  }
                                >
                                  {messages.library.articleEditor.optionLabel} {optionIndex + 1}
                                </Badge>

                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    variant={
                                      option.id === question.correctOptionId
                                        ? "secondary"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() =>
                                      updateDraft((current) => ({
                                        ...current,
                                        quiz: current.quiz
                                          ? {
                                              questions: current.quiz.questions.map(
                                                (currentQuestion, index) =>
                                                  index === questionIndex
                                                    ? {
                                                        ...currentQuestion,
                                                        correctOptionId: option.id,
                                                      }
                                                    : currentQuestion,
                                              ),
                                            }
                                          : undefined,
                                      }))
                                    }
                                    disabled={isPending}
                                  >
                                    {option.id === question.correctOptionId
                                      ? messages.library.articleEditor.correctBadge
                                      : messages.library.articleEditor.makeCorrect}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() =>
                                      updateDraft((current) => ({
                                        ...current,
                                        quiz: current.quiz
                                          ? {
                                              questions: current.quiz.questions.map(
                                                (currentQuestion, index) => {
                                                  if (index !== questionIndex) {
                                                    return currentQuestion;
                                                  }

                                                  const nextOptions =
                                                    currentQuestion.options.filter(
                                                      (currentOption) =>
                                                        currentOption.id !== option.id,
                                                    );

                                                  return {
                                                    ...currentQuestion,
                                                    options: nextOptions,
                                                    correctOptionId:
                                                      currentQuestion.correctOptionId ===
                                                        option.id
                                                        ? (nextOptions[0]?.id ?? "a")
                                                        : currentQuestion.correctOptionId,
                                                  };
                                                },
                                              ),
                                            }
                                          : undefined,
                                      }))
                                    }
                                    disabled={isPending || question.options.length <= 2}
                                    aria-label={messages.common.remove}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="mt-3 space-y-2">
                                <Label>
                                  {messages.library.articleEditor.optionLabel} {optionIndex + 1}
                                </Label>
                                <Input
                                  value={option.label}
                                  onChange={(event) =>
                                    updateDraft((current) => ({
                                      ...current,
                                      quiz: current.quiz
                                        ? {
                                            questions: current.quiz.questions.map(
                                              (currentQuestion, index) =>
                                                index === questionIndex
                                                  ? {
                                                      ...currentQuestion,
                                                      options: currentQuestion.options.map(
                                                        (currentOption) =>
                                                          currentOption.id === option.id
                                                            ? {
                                                                ...currentOption,
                                                                label: event.target.value,
                                                              }
                                                            : currentOption,
                                                      ),
                                                    }
                                                  : currentQuestion,
                                            ),
                                          }
                                        : undefined,
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          ))}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateDraft((current) => ({
                                ...current,
                                quiz: current.quiz
                                  ? {
                                      questions: current.quiz.questions.map(
                                        (currentQuestion, index) =>
                                          index === questionIndex
                                            ? {
                                                ...currentQuestion,
                                                options: currentQuestion.options.concat({
                                                  id: getNextQuizOptionId(
                                                    currentQuestion.options,
                                                  ),
                                                  label: "",
                                                }),
                                              }
                                            : currentQuestion,
                                      ),
                                    }
                                  : undefined,
                              }))
                            }
                            disabled={isPending}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {messages.library.articleEditor.addOption}
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label>
                            {messages.library.articleEditor.questionExplanationLabel}
                          </Label>
                          <Textarea
                            value={question.explanation}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                quiz: current.quiz
                                  ? {
                                      questions: current.quiz.questions.map(
                                        (currentQuestion, index) =>
                                          index === questionIndex
                                            ? {
                                                ...currentQuestion,
                                                explanation: event.target.value,
                                              }
                                            : currentQuestion,
                                      ),
                                    }
                                  : undefined,
                              }))
                            }
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateDraft((current) => ({
                        ...current,
                        quiz: current.quiz
                          ? {
                              questions: current.quiz.questions.concat(
                                createEmptyQuizQuestion(),
                              ),
                            }
                          : {
                              questions: [createEmptyQuizQuestion()],
                            },
                      }))
                    }
                    disabled={isPending}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {messages.library.articleEditor.addQuestion}
                  </Button>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed bg-muted/15 p-6 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {messages.library.articleEditor.quizEmptyTitle}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {messages.library.articleEditor.quizEmptyDescription}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="h-4 w-4 text-primary" />
                {messages.library.editorJsonLabel}
              </CardTitle>
              <CardDescription>{messages.library.editorJsonHelp}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={jsonDraft}
                onChange={(event) => handleJsonChange(event.target.value)}
                className="min-h-[28rem] font-mono text-xs leading-6"
                spellCheck={false}
              />

              {jsonError ? (
                <p className="text-sm text-destructive">{jsonError}</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => runMutation("draft")}
          disabled={isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {messages.library.saveDraft}
        </Button>
        <Button onClick={() => runMutation("publish")} disabled={isPending}>
          <Upload className="mr-2 h-4 w-4" />
          {messages.library.publishArticle}
        </Button>
        <Button variant="ghost" onClick={handleReset} disabled={isPending}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {messages.library.resetEditor}
        </Button>
      </div>
    </div>
  );
}