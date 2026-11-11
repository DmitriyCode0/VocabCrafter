"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Languages, Loader2, PenLine, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { formatDateForAppLanguage } from "@/lib/i18n/format";
import {
  getAllowedCefrLevels,
  getDefaultCefrLevelForLanguage,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
} from "@/lib/languages";
import { cn } from "@/lib/utils";
import type { CEFRLevel, QuizTerm } from "@/types/quiz";

type MobileActivityType = "gap_fill" | "translation";

interface StudentMobileGapFillLauncherProps {
  displayName: string;
  cefrLevel?: string | null;
  preferredLanguage?: string | null;
  sourceLanguage?: string | null;
}

export function StudentMobileGapFillLauncher({
  displayName,
  cefrLevel: rawCefrLevel,
  preferredLanguage,
  sourceLanguage: rawSourceLanguage,
}: StudentMobileGapFillLauncherProps) {
  const router = useRouter();
  const { messages, appLanguage } = useAppI18n();
  const t = messages.dashboard.student.mobileGapFill;

  const targetLanguage = normalizeLearningLanguage(preferredLanguage);
  const sourceLanguage = normalizeSourceLanguage(rawSourceLanguage);
  const allowedCefrLevels = getAllowedCefrLevels(targetLanguage);
  const resolvedCefrLevel: CEFRLevel =
    rawCefrLevel && allowedCefrLevels.includes(rawCefrLevel as CEFRLevel)
      ? (rawCefrLevel as CEFRLevel)
      : getDefaultCefrLevelForLanguage(targetLanguage);

  const [mode, setMode] = useState<"home" | "paste">("home");
  const [activityType, setActivityType] =
    useState<MobileActivityType>("gap_fill");
  const [selectedLevel, setSelectedLevel] =
    useState<CEFRLevel>(resolvedCefrLevel);
  const [text, setText] = useState("");
  const [statusStep, setStatusStep] = useState<"idle" | "parsing" | "building">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const isWorking = statusStep !== "idle";

  function openActivity(type: MobileActivityType) {
    setActivityType(type);
    setError(null);
    setMode("paste");
  }

  async function handleGenerate() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError(t.emptyInputError);
      return;
    }

    setError(null);
    setStatusStep("parsing");

    try {
      // 1. Parse pasted vocabulary with AI
      const parseRes = await fetch("/api/ai/parse-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          targetLanguage,
          sourceLanguage,
          screenshots: [],
        }),
      });

      if (!parseRes.ok) {
        const data = await parseRes.json().catch(() => null);
        throw new Error(
          data?.error || messages.createQuiz.wordInput.parseFailed,
        );
      }

      const parsedData = (await parseRes.json()) as { terms: QuizTerm[] };
      if (!parsedData.terms || parsedData.terms.length === 0) {
        throw new Error(messages.createQuiz.wordInput.parseFailed);
      }

      setStatusStep("building");

      // 2. Resolve terms against the shared dictionary
      const resolveRes = await fetch("/api/quizzes/resolve-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms: parsedData.terms,
          targetLanguage,
          sourceLanguage,
        }),
      });

      const resolvedTerms: QuizTerm[] = resolveRes.ok
        ? ((await resolveRes.json()) as { terms: QuizTerm[] }).terms
        : parsedData.terms;

      const config = {
        cefrLevel: selectedLevel,
        studentProfileCefrLevel: resolvedCefrLevel,
        selectedCefrLevel: selectedLevel,
        targetLanguage,
        sourceLanguage,
        vocabularyChallenge: "Standard" as const,
        grammarChallenge: "Standard" as const,
        teacherPersona: "standard" as const,
        timedMode: false,
      };

      // 3. Generate exercise at selected CEFR level
      const genRes = await fetch("/api/ai/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activityType,
          terms: resolvedTerms,
          config,
        }),
      });

      if (!genRes.ok) {
        const data = await genRes.json().catch(() => null);
        throw new Error(data?.error || "Failed to generate exercise");
      }

      const { content } = (await genRes.json()) as {
        content: Record<string, unknown>;
      };

      // 4. Save quiz & redirect directly to the interactive player
      const saveRes = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${messages.createQuiz.defaultTitlePrefix} - ${formatDateForAppLanguage(appLanguage, new Date())}`,
          type: activityType,
          cefrLevel: selectedLevel,
          vocabularyTerms: resolvedTerms,
          generatedContent: content,
          config,
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => null);
        throw new Error(data?.error || "Failed to save exercise");
      }

      const { quiz } = (await saveRes.json()) as { quiz: { id: string } };
      router.push(`/quizzes/${quiz.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate exercise",
      );
      setStatusStep("idle");
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col justify-center py-4 md:hidden">
      {mode === "home" ? (
        <Card className="border-primary/25 shadow-md">
          <CardHeader className="items-center space-y-4 pb-4 pt-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <PenLine className="h-7 w-7" />
            </div>

            <CardTitle className="text-2xl font-bold tracking-tight">
              {messages.dashboard.welcomeBack(displayName)}
            </CardTitle>

            <div className="w-full space-y-1.5 pt-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t.chooseLevelLabel}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {allowedCefrLevels.map((lvl) => {
                  const isSelected = selectedLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSelectedLevel(lvl)}
                      className={cn(
                        "min-w-[44px] rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/30 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pb-8 pt-2">
            <Button
              size="lg"
              className="h-14 w-full rounded-xl text-base font-semibold shadow-sm"
              onClick={() => openActivity("gap_fill")}
            >
              <PenLine className="mr-2.5 h-5 w-5" />
              {t.createGapFillButton}
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="h-14 w-full rounded-xl border-primary/30 text-base font-semibold shadow-sm"
              onClick={() => openActivity("translation")}
            >
              <Languages className="mr-2.5 h-5 w-5" />
              {t.createTranslationButton}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/25 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 h-8 px-2 text-xs text-muted-foreground"
                disabled={isWorking}
                onClick={() => {
                  setError(null);
                  setMode("home");
                }}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t.backButton}
              </Button>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs">
                  {activityType === "gap_fill"
                    ? t.gapFillBadge
                    : t.translationBadge}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {t.levelBadge(selectedLevel)}
                </Badge>
              </div>
            </div>
            <CardTitle className="pt-1 text-xl">{t.pasteTitle}</CardTitle>
            <CardDescription className="text-xs">
              {t.pasteDescription(selectedLevel)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {allowedCefrLevels.map((lvl) => {
                const isSelected = selectedLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    disabled={isWorking}
                    onClick={() => setSelectedLevel(lvl)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-muted/30 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.pastePlaceholder}
              disabled={isWorking}
              rows={8}
              autoFocus
              className="min-h-[190px] resize-none rounded-xl text-base leading-relaxed"
            />

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            <Button
              size="lg"
              className="h-14 w-full rounded-xl text-base font-semibold shadow-sm"
              disabled={isWorking || !text.trim()}
              onClick={handleGenerate}
            >
              {isWorking ? (
                <>
                  <Loader2 className="mr-2.5 h-5 w-5 animate-spin" />
                  {statusStep === "parsing"
                    ? t.generatingStepParsing
                    : t.generatingStepBuilding}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2.5 h-5 w-5" />
                  {t.generateButton}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

