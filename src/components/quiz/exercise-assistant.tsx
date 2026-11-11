"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bot,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ExerciseAssistantQuizType =
  | "mcq"
  | "gap_fill"
  | "translation"
  | "text_translation"
  | "flashcards"
  | "discussion"
  | "results";

export interface ExerciseAssistantContextData {
  itemKey: string;
  quizType: ExerciseAssistantQuizType;
  cefrLevel?: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  isAnswered: boolean;
  itemLabel?: string;
  questionText?: string;
  sourceSentence?: string;
  targetTerm?: string;
  definition?: string;
  example?: string;
  hint?: string;
  options?: string[];
  userAnswer?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
  score?: number;
  feedback?: string;
  grammarTopic?: string;
}

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  followUps?: string[];
}

interface ExerciseAssistantContextValue {
  activeContext: ExerciseAssistantContextData | null;
  setActiveContext: (ctx: ExerciseAssistantContextData) => void;
  openAssistant: (overrideContext?: ExerciseAssistantContextData) => void;
  explainWithAI: (
    overrideContext?: ExerciseAssistantContextData,
    customPrompt?: string,
  ) => void;
  isOpen: boolean;
}

const ExerciseAssistantContext =
  createContext<ExerciseAssistantContextValue | null>(null);

function renderFormattedText(text: string): React.ReactNode {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((paragraph, pIndex) => {
    const lines = paragraph.split("\n");
    return (
      <div key={pIndex} className={pIndex > 0 ? "mt-2.5" : ""}>
        {lines.map((line, lIndex) => {
          const trimmed = line.trim();
          const isBullet = /^[-*•]\s+/.test(trimmed);
          const cleanLine = isBullet
            ? trimmed.replace(/^[-*•]\s+/, "")
            : line;

          const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
          const formattedParts = parts.map((part, partIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={partIdx} className="font-semibold text-foreground">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <React.Fragment key={partIdx}>{part}</React.Fragment>;
          });

          if (isBullet) {
            return (
              <div key={lIndex} className="ml-2 flex items-start gap-2 py-0.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                <span>{formattedParts}</span>
              </div>
            );
          }

          return (
            <p key={lIndex} className={lIndex > 0 ? "mt-1" : ""}>
              {formattedParts}
            </p>
          );
        })}
      </div>
    );
  });
}

export function ExerciseAssistantProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { messages } = useAppI18n();
  const t = messages.quizSession.assistant;

  const [activeContext, setActiveContextState] =
    useState<ExerciseAssistantContextData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadsByKey, setThreadsByKey] = useState<
    Record<string, AssistantMessage[]>
  >({});

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const setActiveContext = useCallback((ctx: ExerciseAssistantContextData) => {
    setActiveContextState(ctx);
  }, []);

  const currentKey = activeContext?.itemKey ?? "default";
  const currentMessages = useMemo(
    () => threadsByKey[currentKey] ?? [],
    [threadsByKey, currentKey],
  );

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentMessages.length, isLoading, isOpen]);

  const sendQuestion = useCallback(
    async (
      questionText: string,
      contextToUse?: ExerciseAssistantContextData | null,
    ) => {
      const targetContext = contextToUse ?? activeContext;
      const trimmed = questionText.trim();
      if (!trimmed || !targetContext || isLoading) return;

      const threadKey = targetContext.itemKey || "default";
      const existingMessages = threadsByKey[threadKey] ?? [];
      const userMessage: AssistantMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        content: trimmed,
      };

      const updatedMessages = [...existingMessages, userMessage];
      setThreadsByKey((prev) => ({
        ...prev,
        [threadKey]: updatedMessages,
      }));
      setInput("");
      setError(null);
      setIsLoading(true);

      try {
        const res = await fetch("/api/ai/exercise-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizType: targetContext.quizType,
            cefrLevel: targetContext.cefrLevel,
            targetLanguage: targetContext.targetLanguage,
            sourceLanguage: targetContext.sourceLanguage,
            isAnswered: targetContext.isAnswered,
            context: {
              itemLabel: targetContext.itemLabel,
              questionText: targetContext.questionText,
              sourceSentence: targetContext.sourceSentence,
              targetTerm: targetContext.targetTerm,
              definition: targetContext.definition,
              example: targetContext.example,
              hint: targetContext.hint,
              options: targetContext.options,
              userAnswer: targetContext.userAnswer,
              correctAnswer: targetContext.correctAnswer,
              isCorrect: targetContext.isCorrect,
              score: targetContext.score,
              feedback: targetContext.feedback,
              grammarTopic: targetContext.grammarTopic,
            },
            messages: updatedMessages.slice(-10).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        const payload = (await res.json().catch(() => null)) as {
          reply?: string;
          followUps?: string[];
          error?: string;
        } | null;

        if (!res.ok || !payload?.reply) {
          throw new Error(payload?.error || t.errorGeneric);
        }

        const assistantMessage: AssistantMessage = {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: payload.reply,
          followUps: payload.followUps ?? [],
        };

        setThreadsByKey((prev) => ({
          ...prev,
          [threadKey]: [...(prev[threadKey] ?? []), assistantMessage],
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : t.errorGeneric);
      } finally {
        setIsLoading(false);
      }
    },
    [activeContext, isLoading, t.errorGeneric, threadsByKey],
  );

  const openAssistant = useCallback(
    (overrideContext?: ExerciseAssistantContextData) => {
      if (overrideContext) {
        setActiveContextState(overrideContext);
      }
      setError(null);
      setIsOpen(true);
    },
    [],
  );

  const explainWithAI = useCallback(
    (
      overrideContext?: ExerciseAssistantContextData,
      customPrompt?: string,
    ) => {
      const targetContext = overrideContext ?? activeContext;
      if (overrideContext) {
        setActiveContextState(overrideContext);
      }
      setError(null);
      setIsOpen(true);

      if (!targetContext) return;

      const existing = threadsByKey[targetContext.itemKey] ?? [];
      if (existing.length > 0 && !customPrompt) {
        return;
      }

      const defaultPrompt =
        customPrompt ??
        (targetContext.isAnswered
          ? targetContext.isCorrect === false ||
            (typeof targetContext.score === "number" &&
              targetContext.score < 85)
            ? t.quickPrompts.explainMistake
            : t.quickPrompts.whyCorrect
          : t.quickPrompts.hint);

      void sendQuestion(defaultPrompt, targetContext);
    },
    [activeContext, sendQuestion, t.quickPrompts, threadsByKey],
  );

  function handleClearCurrentChat() {
    if (!activeContext) return;
    setThreadsByKey((prev) => {
      const next = { ...prev };
      delete next[activeContext.itemKey];
      return next;
    });
    setError(null);
  }

  const isHintMode = Boolean(
    activeContext &&
      !activeContext.isAnswered &&
      (activeContext.quizType === "mcq" ||
        activeContext.quizType === "gap_fill" ||
        activeContext.quizType === "translation" ||
        activeContext.quizType === "text_translation"),
  );

  const quickPrompts = useMemo(() => {
    if (!activeContext) return [];
    if (isHintMode) {
      return [
        t.quickPrompts.hint,
        t.quickPrompts.grammarRule,
        t.quickPrompts.vocabMeaning,
      ];
    }

    const prompts: string[] = [];
    if (
      activeContext.isCorrect === false ||
      (typeof activeContext.score === "number" && activeContext.score < 85)
    ) {
      prompts.push(t.quickPrompts.explainMistake);
    }
    prompts.push(t.quickPrompts.whyCorrect);
    prompts.push(t.quickPrompts.moreExamples);
    prompts.push(t.quickPrompts.grammarRule);
    return prompts.slice(0, 3);
  }, [activeContext, isHintMode, t.quickPrompts]);

  const contextPreviewText =
    activeContext?.questionText ||
    activeContext?.sourceSentence ||
    activeContext?.targetTerm ||
    null;

  const contextValue = useMemo<ExerciseAssistantContextValue>(
    () => ({
      activeContext,
      setActiveContext,
      openAssistant,
      explainWithAI,
      isOpen,
    }),
    [activeContext, setActiveContext, openAssistant, explainWithAI, isOpen],
  );

  const lastMessage = currentMessages[currentMessages.length - 1];
  const latestFollowUps =
    lastMessage?.role === "assistant" && lastMessage.followUps?.length
      ? lastMessage.followUps
      : [];

  return (
    <ExerciseAssistantContext.Provider value={contextValue}>
      {children}

      {/* Floating AI Tutor Trigger Button */}
      <div className="fixed bottom-5 right-5 z-40">
        <Button
          type="button"
          size="lg"
          onClick={() => openAssistant()}
          className="h-12 rounded-full px-4 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] sm:px-5"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          <span className="font-medium">{t.floatingButton}</span>
          {currentMessages.length > 0 ? (
            <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-xs font-semibold">
              {currentMessages.length}
            </span>
          ) : null}
        </Button>
      </div>

      {/* Slide-out AI Tutor Drawer */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b px-4 py-3.5 pr-12">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <SheetTitle className="text-base">{t.title}</SheetTitle>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px]",
                    isHintMode
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  <Lightbulb className="mr-1 h-3 w-3" />
                  {isHintMode ? t.hintModeBadge : t.explainModeBadge}
                </Badge>
                {currentMessages.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={handleClearCurrentChat}
                    title={t.clearChat}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
            <SheetDescription className="text-xs">
              {isHintMode ? t.subtitleHintMode : t.subtitleExplainMode}
            </SheetDescription>
          </SheetHeader>

          {/* Active Question Context Preview */}
          {contextPreviewText ? (
            <div className="border-b bg-muted/40 px-4 py-2.5 text-xs">
              <div className="mb-0.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>
                  {activeContext?.itemLabel || t.currentContextLabel}
                </span>
                {activeContext?.cefrLevel ? (
                  <span>{activeContext.cefrLevel}</span>
                ) : null}
              </div>
              <p className="line-clamp-2 font-medium text-foreground">
                {contextPreviewText}
              </p>
              {activeContext?.userAnswer ? (
                <p className="mt-1 line-clamp-1 text-muted-foreground">
                  <span className="font-medium">
                    {messages.quizSession.results.yourAnswer}:
                  </span>{" "}
                  {activeContext.userAnswer}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {currentMessages.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {t.emptyStateTitle}
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {isHintMode
                    ? t.emptyStateHintDescription
                    : t.emptyStateExplainDescription}
                </p>

                {quickPrompts.length > 0 ? (
                  <div className="mt-4 flex w-full flex-col gap-2">
                    {quickPrompts.map((promptText) => (
                      <button
                        key={promptText}
                        type="button"
                        onClick={() => void sendQuestion(promptText)}
                        className="flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{promptText}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {currentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col",
                      msg.role === "user" ? "items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "border bg-muted/60 text-foreground",
                      )}
                    >
                      {msg.role === "assistant"
                        ? renderFormattedText(msg.content)
                        : msg.content}
                    </div>
                  </div>
                ))}

                {isLoading ? (
                  <div className="flex items-start">
                    <div className="flex items-center gap-2 rounded-2xl border bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>{t.thinking}</span>
                    </div>
                  </div>
                ) : null}

                {!isLoading && latestFollowUps.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {latestFollowUps.map((followUp) => (
                      <button
                        key={followUp}
                        type="button"
                        onClick={() => void sendQuestion(followUp)}
                        className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        {followUp}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}

            <div ref={scrollEndRef} />
          </div>

          {/* Input Footer */}
          <div className="border-t bg-background p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendQuestion(input);
                  }
                }}
                placeholder={t.inputPlaceholder}
                rows={2}
                disabled={isLoading}
                className="min-h-[44px] max-h-28 resize-none text-sm"
              />
              <Button
                type="button"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                disabled={!input.trim() || isLoading}
                onClick={() => void sendQuestion(input)}
                aria-label={t.sendButtonAria}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </ExerciseAssistantContext.Provider>
  );
}

export function useExerciseAssistant() {
  return useContext(ExerciseAssistantContext);
}

/**
 * Automatically syncs the active question/item state with the Exercise AI Assistant.
 */
export function useSyncExerciseAssistantContext(
  context: ExerciseAssistantContextData,
) {
  const assistant = useExerciseAssistant();
  const setActiveContext = assistant?.setActiveContext;

  const serialized = JSON.stringify(context);

  useEffect(() => {
    if (!setActiveContext) return;
    setActiveContext(JSON.parse(serialized) as ExerciseAssistantContextData);
  }, [serialized, setActiveContext]);
}

/**
 * Quick button to open the AI Assistant and immediately explain the current (or overridden) item.
 */
export function ExplainWithAIButton({
  contextOverride,
  customPrompt,
  label,
  className,
  size = "sm",
  variant = "outline",
}: {
  contextOverride?: ExerciseAssistantContextData;
  customPrompt?: string;
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const assistant = useExerciseAssistant();
  const { messages } = useAppI18n();

  if (!assistant) return null;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => assistant.explainWithAI(contextOverride, customPrompt)}
      className={cn(
        "gap-1.5 border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary",
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span>{label ?? messages.quizSession.assistant.explainButton}</span>
    </Button>
  );
}

