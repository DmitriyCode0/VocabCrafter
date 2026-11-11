"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  ImagePlus,
  Languages,
  Loader2,
  PenLine,
  Sparkles,
  X,
} from "lucide-react";
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
import {
  StudentGoogleMeetBanner,
  type StudentNextLesson,
} from "@/components/dashboard/student-google-meet-banner";
import { QuizWordPicker } from "@/components/quiz/quiz-word-picker";
import type { CEFRLevel, QuizTerm } from "@/types/quiz";

type MobileActivityType = "gap_fill" | "translation";
type InputTab = "manual" | "from_quiz";

const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

interface ScreenshotDraft {
  id: string;
  name: string;
  mimeType: (typeof ACCEPTED_IMAGE_TYPES)[number];
  dataUrl: string;
}

function createScreenshotId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isAcceptedImageType(
  value: string,
): value is (typeof ACCEPTED_IMAGE_TYPES)[number] {
  return ACCEPTED_IMAGE_TYPES.includes(
    value as (typeof ACCEPTED_IMAGE_TYPES)[number],
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read screenshot"));
    };
    reader.onerror = () => reject(new Error("Failed to read screenshot"));
    reader.readAsDataURL(file);
  });
}


interface StudentMobileGapFillLauncherProps {
  displayName: string;
  cefrLevel?: string | null;
  preferredLanguage?: string | null;
  sourceLanguage?: string | null;
  nextLesson?: StudentNextLesson | null;
  todayIso?: string;
}

export function StudentMobileGapFillLauncher({
  displayName,
  cefrLevel: rawCefrLevel,
  preferredLanguage,
  sourceLanguage: rawSourceLanguage,
  nextLesson = null,
  todayIso = "",
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
  const [inputTab, setInputTab] = useState<InputTab>("manual");
  const [activityType, setActivityType] =
    useState<MobileActivityType>("gap_fill");
  const [selectedLevel, setSelectedLevel] =
    useState<CEFRLevel>(resolvedCefrLevel);
  const [text, setText] = useState("");
  const [screenshots, setScreenshots] = useState<ScreenshotDraft[]>([]);
  const [statusStep, setStatusStep] = useState<"idle" | "parsing" | "building">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isWorking = statusStep !== "idle";

  function openActivity(type: MobileActivityType) {
    setActivityType(type);
    setError(null);
    setInputTab("manual");
    setMode("paste");
  }

  async function appendScreenshotFiles(files: File[]) {
    const remainingSlots = MAX_SCREENSHOTS - screenshots.length;

    if (remainingSlots <= 0) {
      setError(messages.createQuiz.wordInput.attachLimitError(MAX_SCREENSHOTS));
      return;
    }

    const validFiles = files.slice(0, remainingSlots);
    const nextDrafts: ScreenshotDraft[] = [];

    for (const file of validFiles) {
      if (!isAcceptedImageType(file.type)) {
        setError(messages.createQuiz.wordInput.invalidImageTypeError);
        continue;
      }

      if (file.size > MAX_SCREENSHOT_SIZE_BYTES) {
        setError(messages.createQuiz.wordInput.screenshotSizeError(5));
        continue;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        nextDrafts.push({
          id: createScreenshotId(),
          name:
            file.name ||
            messages.createQuiz.wordInput.screenshotLabel(
              screenshots.length + nextDrafts.length + 1,
            ),
          mimeType: file.type,
          dataUrl,
        });
      } catch {
        setError(messages.createQuiz.wordInput.parseFailed);
      }
    }

    if (nextDrafts.length > 0) {
      setError(null);
      setScreenshots((current) => [...current, ...nextDrafts]);
    }
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      void appendScreenshotFiles(files);
    }
    event.target.value = "";
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    void appendScreenshotFiles(files);
  }

  function removeScreenshot(id: string) {
    setScreenshots((current) => current.filter((item) => item.id !== id));
  }

  async function generateFromTerms(terms: QuizTerm[]) {
    setError(null);
    setStatusStep("building");

    try {
      const resolveRes = await fetch("/api/quizzes/resolve-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms,
          targetLanguage,
          sourceLanguage,
        }),
      });

      const resolvedTerms: QuizTerm[] = resolveRes.ok
        ? ((await resolveRes.json()) as { terms: QuizTerm[] }).terms
        : terms;

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

  async function handleGenerate() {
    const trimmed = text.trim();
    if (!trimmed && screenshots.length === 0) {
      setError(t.emptyInputError);
      return;
    }

    setError(null);
    setStatusStep("parsing");

    try {
      const payloadScreenshots = screenshots.map((s) => ({
        name: s.name,
        mimeType: s.mimeType,
        data: s.dataUrl.split(",")[1] || s.dataUrl,
      }));

      // 1. Parse pasted vocabulary and/or screenshots with AI
      const parseRes = await fetch("/api/ai/parse-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          targetLanguage,
          sourceLanguage,
          screenshots: payloadScreenshots,
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

      await generateFromTerms(parsedData.terms);
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
        <div className="space-y-4">
          <StudentGoogleMeetBanner
            nextLesson={nextLesson}
            todayIso={todayIso}
          />

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
      </div>
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

            <div className="grid grid-cols-2 gap-1.5 rounded-lg border bg-muted/40 p-1">
              <button
                type="button"
                disabled={isWorking}
                onClick={() => {
                  setError(null);
                  setInputTab("manual");
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  inputTab === "manual"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <PenLine className="h-3.5 w-3.5" />
                {t.tabManual}
              </button>
              <button
                type="button"
                disabled={isWorking}
                onClick={() => {
                  setError(null);
                  setInputTab("from_quiz");
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  inputTab === "from_quiz"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                {t.tabFromQuiz}
              </button>
            </div>

            {inputTab === "from_quiz" ? (
              <div className="space-y-3">
                <QuizWordPicker
                  onSelect={(terms) => {
                    void generateFromTerms(terms);
                  }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={t.pastePlaceholder}
                  disabled={isWorking}
                  rows={6}
                  autoFocus
                  className="min-h-[150px] resize-none rounded-xl text-base leading-relaxed"
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleFileSelection}
                />

                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isWorking || screenshots.length >= MAX_SCREENSHOTS}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs"
                  >
                    <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                    {t.attachScreenshotButton}
                    {screenshots.length > 0
                      ? ` (${screenshots.length}/${MAX_SCREENSHOTS})`
                      : ""}
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    Max 3 photos (up to 5MB)
                  </span>
                </div>

                {screenshots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {screenshots.map((s) => (
                      <div
                        key={s.id}
                        className="group relative aspect-video overflow-hidden rounded-lg border bg-muted"
                      >
                        <Image
                          src={s.dataUrl}
                          alt={s.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <button
                          type="button"
                          onClick={() => removeScreenshot(s.id)}
                          disabled={isWorking}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition-opacity hover:bg-black"
                          title="Remove screenshot"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {error ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </p>
                ) : null}

                <Button
                  size="lg"
                  className="h-14 w-full rounded-xl text-base font-semibold shadow-sm"
                  disabled={isWorking || (!text.trim() && screenshots.length === 0)}
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
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

