"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Compass,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/roles";

interface SuggestedLink {
  label: string;
  href: string;
}

interface SiteAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestedLinks?: SuggestedLink[];
  followUps?: string[];
}

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

export function SiteAssistantButton({ role }: { role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const { messages } = useAppI18n();
  const t = messages.siteAssistant;

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<SiteAssistantMessage[]>([]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages.length, isLoading, isOpen]);

  const quickPrompts =
    role === "tutor"
      ? t.tutorQuickPrompts
      : role === "superadmin"
        ? t.adminQuickPrompts
        : t.studentQuickPrompts;

  async function sendQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    const userMessage: SiteAssistantMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed,
    };

    const nextHistory = [...chatMessages, userMessage];
    setChatMessages(nextHistory);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/site-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathname,
          messages: nextHistory.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        reply?: string;
        suggestedLinks?: SuggestedLink[];
        followUps?: string[];
        error?: string;
      } | null;

      if (!res.ok || !payload?.reply) {
        throw new Error(payload?.error || t.errorGeneric);
      }

      const assistantMessage: SiteAssistantMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: payload.reply,
        suggestedLinks: payload.suggestedLinks ?? [],
        followUps: payload.followUps ?? [],
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorGeneric);
    } finally {
      setIsLoading(false);
    }
  }

  function handleNavigate(href: string) {
    setIsOpen(false);
    router.push(href);
  }

  const lastMessage = chatMessages[chatMessages.length - 1];
  const latestFollowUps =
    lastMessage?.role === "assistant" && lastMessage.followUps?.length
      ? lastMessage.followUps
      : [];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-medium">{t.buttonLabel}</span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-4 py-3.5 pr-12">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Compass className="h-4 w-4" />
              </div>
              <SheetTitle className="text-base">{t.title}</SheetTitle>
            </div>
            {chatMessages.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setChatMessages([]);
                  setError(null);
                }}
                title={t.clearChat}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
          <SheetDescription className="text-xs">
            {t.description}
          </SheetDescription>
        </SheetHeader>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {chatMessages.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {t.emptyTitle}
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {t.emptySubtitle}
              </p>

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
            </div>
          ) : (
            <>
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col gap-2",
                    msg.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border bg-muted/60 text-foreground",
                    )}
                  >
                    {msg.role === "assistant"
                      ? renderFormattedText(msg.content)
                      : msg.content}
                  </div>

                  {msg.role === "assistant" &&
                  msg.suggestedLinks &&
                  msg.suggestedLinks.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {msg.suggestedLinks.map((link) => (
                        <Button
                          key={`${link.href}-${link.label}`}
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleNavigate(link.href)}
                          className="h-7 gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20"
                        >
                          <span>{link.label}</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      ))}
                    </div>
                  ) : null}
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
                      className="rounded-full border border-border bg-card px-3 py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
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

        {/* Input footer */}
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
  );
}

