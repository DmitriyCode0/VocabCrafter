"use client";

import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  GitBranch,
  Layers,
  Link2,
  Link2Off,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";
import {
  ASPECT_DEFINITIONS,
  ASPECT_MATRIX_META,
  CONDITIONAL_META,
  CONDITIONAL_POSITIONS,
  getAspectCellKey,
  MARKER_STYLES,
  parseTaggedSentence,
  resolveAspectType,
  resolveConditionalVariantKey,
  sanitizeConditionalSlots,
  splitConditionalSentence,
  TIME_AXIS_OPTIONS,
  type AspectCellKey,
  type AspectSentenceTemplate,
  type AspectTime,
  type AspectType,
  type ConditionalPresentMode,
  type ConditionalSentenceTemplate,
  type ConditionalSlot,
  type ConditionalVariantKey,
  type DetectorMode,
  type SentenceSegment,
} from "@/lib/grammar/tense-detector-data";
import { cn } from "@/lib/utils";

interface AIAnalysisResult {
  isCorrect: boolean;
  originalSentence: string;
  correctedSentence: string;
  shortLabelUk: string;
  detectedMode: DetectorMode;
  detectedTitle: string;
  explanationUk: string;
  time: AspectTime;
  isContinuous: boolean;
  isPerfect: boolean;
  isStateVerb?: boolean;
  ifSlot: ConditionalSlot;
  resultSlot: ConditionalSlot;
  presentMode: ConditionalPresentMode;
  aspectForms?: Record<AspectCellKey, string>;
  conditionalForms?: Record<ConditionalVariantKey, string>;
}

const FOCUS_RING_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const FOCUS_RING_INSET_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

function getSpringTransition(
  isDragging: boolean,
  reduceMotion: boolean | null,
): Transition {
  if (reduceMotion) {
    return { duration: 0 };
  }
  if (isDragging) {
    return {
      type: "spring",
      stiffness: 760,
      damping: 42,
      mass: 0.6,
    };
  }
  return {
    type: "spring",
    stiffness: 380,
    damping: 32,
    mass: 0.8,
  };
}

function getColumnCenterPercent(slot: 0 | 1 | 2): number {
  return 16.6667 + slot * 33.3333;
}

function clientXToColumnSlot(clientX: number, rect: DOMRect): 0 | 1 | 2 {
  const ratio = Math.min(
    0.9999,
    Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)),
  );
  return Math.floor(ratio * 3) as 0 | 1 | 2;
}

function HighlightedSegments({
  segments,
  badgeClassName,
}: {
  segments: SentenceSegment[];
  badgeClassName?: string;
}) {
  return (
    <>
      {segments.map((seg, segIdx) => {
        if (!seg.color) {
          return <span key={segIdx}>{seg.text}</span>;
        }
        const styles = MARKER_STYLES[seg.color];
        return (
          <span
            key={segIdx}
            className={cn(
              "mx-0.5 inline-block rounded-md border px-1.5 py-0.5 font-semibold transition-colors duration-200",
              styles.badge,
              badgeClassName,
            )}
          >
            {seg.text}
          </span>
        );
      })}
    </>
  );
}

export function TenseDetectorClient() {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<DetectorMode>("aspects");

  // ── Aspects State (4 Aspect Selectors + Time on Graph) ───────────
  const [aspectTime, setAspectTime] = useState<AspectTime>("present");
  const [activeAspect, setActiveAspect] = useState<AspectType>("continuous");
  const [customAspectSentence, setCustomAspectSentence] =
    useState<AspectSentenceTemplate | null>(null);
  const [draggingAspectMarker, setDraggingAspectMarker] = useState(false);
  const aspectTrackRef = useRef<HTMLDivElement | null>(null);

  // ── Conditionals 3-2-1 State ─────────────────────────────────────
  const [condLinked, setCondLinked] = useState(true);
  const [condIfSlot, setCondIfSlot] = useState<ConditionalSlot>(2);
  const [condResultSlot, setCondResultSlot] = useState<ConditionalSlot>(2);
  const [condPresentMode, setCondPresentMode] =
    useState<ConditionalPresentMode>("unreal");
  const [customCondSentence, setCustomCondSentence] =
    useState<ConditionalSentenceTemplate | null>(null);
  const [draggingCondMarker, setDraggingCondMarker] = useState<
    "if" | "result" | null
  >(null);
  const condTrackRef = useRef<HTMLDivElement | null>(null);

  // ── AI Sentence Helper State ─────────────────────────────────────
  const [inputSentence, setInputSentence] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);

  // ── Derived Aspect State ─────────────────────────────────────────
  const isStateVerb = Boolean(customAspectSentence?.isStateVerb);
  const effectiveAspect: AspectType = isStateVerb
    ? activeAspect === "perfect" || activeAspect === "perfect_continuous"
      ? "perfect"
      : "simple"
    : activeAspect;
  const isContinuous =
    effectiveAspect === "continuous" ||
    effectiveAspect === "perfect_continuous";
  const isPerfect =
    effectiveAspect === "perfect" ||
    effectiveAspect === "perfect_continuous";
  const activeCellKey = getAspectCellKey(aspectTime, effectiveAspect);
  const activeCellMeta = ASPECT_MATRIX_META[activeCellKey];
  const activeAspectDef =
    ASPECT_DEFINITIONS.find((def) => def.key === effectiveAspect) ??
    ASPECT_DEFINITIONS[0];
  const activeTimeMeta =
    TIME_AXIS_OPTIONS.find((item) => item.key === aspectTime) ??
    TIME_AXIS_OPTIONS[1];
  const activeAspectTagged = customAspectSentence?.forms[activeCellKey] ?? null;
  const activeAspectParsed = activeAspectTagged
    ? parseTaggedSentence(activeAspectTagged, "emerald", "sky")
    : null;

  // ── Derived Conditionals State ───────────────────────────────────
  const activeCondKey = resolveConditionalVariantKey(
    condIfSlot,
    condResultSlot,
    condPresentMode,
  );
  const activeCondMeta = CONDITIONAL_META[activeCondKey];
  const activeCondTagged = customCondSentence?.forms[activeCondKey] ?? null;
  const activeCondParts = activeCondTagged
    ? splitConditionalSentence(activeCondTagged)
    : null;
  const activeCondPlainText = activeCondTagged
    ? parseTaggedSentence(activeCondTagged).plainText
    : "";

  // ── Shared Smooth Spring Transitions ─────────────────────────────
  const aspectSpring = getSpringTransition(draggingAspectMarker, reduceMotion);
  const condIfSpring = getSpringTransition(
    draggingCondMarker === "if",
    reduceMotion,
  );
  const condResultSpring = getSpringTransition(
    draggingCondMarker === "result",
    reduceMotion,
  );
  const condConnectorSpring = getSpringTransition(
    draggingCondMarker !== null,
    reduceMotion,
  );

  // ── Timeline Coordinates (Aspects Mode) ──────────────────────────
  const colCenterPct = getColumnCenterPercent(activeTimeMeta.slot);
  const nowPct = getColumnCenterPercent(1);
  const cutoffPct = isPerfect
    ? aspectTime === "past"
      ? 26
      : aspectTime === "present"
        ? 50
        : 90
    : colCenterPct;
  const actionPct = isPerfect
    ? aspectTime === "past"
      ? 11
      : aspectTime === "present"
        ? 35
        : 75
    : colCenterPct;

  // ── Timeline Coordinates (Conditionals Mode) ─────────────────────
  const condIfPct = getColumnCenterPercent(condIfSlot);
  const condResultPct = getColumnCenterPercent(condResultSlot);
  const condMaxSlot: ConditionalSlot = condLinked ? 2 : 1;

  // ── Drag & Keyboard Handlers ─────────────────────────────────────
  function handleAspectPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingAspectMarker(true);
  }

  function handleAspectPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingAspectMarker || !aspectTrackRef.current) return;
    const rect = aspectTrackRef.current.getBoundingClientRect();
    const slot = clientXToColumnSlot(event.clientX, rect);
    const nextTime = TIME_AXIS_OPTIONS[slot]?.key ?? "present";
    setAspectTime(nextTime);
  }

  function handleAspectMarkerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentSlot = activeTimeMeta.slot;
    let nextSlot: 0 | 1 | 2 | null = null;
    if (event.key === "ArrowLeft") {
      nextSlot = Math.max(0, currentSlot - 1) as 0 | 1 | 2;
    } else if (event.key === "ArrowRight") {
      nextSlot = Math.min(2, currentSlot + 1) as 0 | 1 | 2;
    } else if (event.key === "Home") {
      nextSlot = 0;
    } else if (event.key === "End") {
      nextSlot = 2;
    }
    if (nextSlot !== null) {
      event.preventDefault();
      setAspectTime(TIME_AXIS_OPTIONS[nextSlot]?.key ?? "present");
    }
  }

  function setCondPositions(marker: "if" | "result", slot: ConditionalSlot) {
    if (condLinked) {
      setCondIfSlot(slot);
      setCondResultSlot(slot);
      return;
    }
    const mixedSafeSlot = (slot === 2 ? 1 : slot) as 0 | 1;
    if (marker === "if") {
      setCondIfSlot(mixedSafeSlot);
    } else {
      setCondResultSlot(mixedSafeSlot);
    }
  }

  function handleCondPointerDown(
    marker: "if" | "result",
    event: PointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingCondMarker(marker);
  }

  function handleCondPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingCondMarker || !condTrackRef.current) return;
    const rect = condTrackRef.current.getBoundingClientRect();
    const rawSlot = clientXToColumnSlot(event.clientX, rect);
    const nextSlot = condLinked
      ? rawSlot
      : ((rawSlot === 2 ? 1 : rawSlot) as ConditionalSlot);
    setCondPositions(draggingCondMarker, nextSlot);
  }

  function handleCondMarkerKeyDown(
    marker: "if" | "result",
    currentSlot: ConditionalSlot,
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    const maxSlot = condLinked ? 2 : 1;
    let nextSlot: ConditionalSlot | null = null;
    if (event.key === "ArrowLeft") {
      nextSlot = Math.max(0, currentSlot - 1) as ConditionalSlot;
    } else if (event.key === "ArrowRight") {
      nextSlot = Math.min(maxSlot, currentSlot + 1) as ConditionalSlot;
    } else if (event.key === "Home") {
      nextSlot = 0;
    } else if (event.key === "End") {
      nextSlot = maxSlot as ConditionalSlot;
    }
    if (nextSlot !== null) {
      event.preventDefault();
      setCondPositions(marker, nextSlot);
    }
  }

  function handleResetCurrent() {
    if (mode === "aspects") {
      setAspectTime("present");
      setActiveAspect(isStateVerb ? "simple" : "continuous");
    } else {
      setCondLinked(true);
      setCondIfSlot(2);
      setCondResultSlot(2);
      setCondPresentMode("unreal");
    }
  }

  function applyAIResultToGraph(result: AIAnalysisResult) {
    setMode(result.detectedMode);
    if (result.detectedMode === "aspects") {
      setAspectTime(result.time);
      setActiveAspect(
        resolveAspectType(
          result.isStateVerb ? false : result.isContinuous,
          result.isPerfect,
        ),
      );
    } else {
      const sanitized = sanitizeConditionalSlots(
        result.ifSlot,
        result.resultSlot,
      );
      const isLinked = sanitized.ifSlot === sanitized.resultSlot;
      setCondLinked(isLinked);
      setCondIfSlot(sanitized.ifSlot);
      setCondResultSlot(sanitized.resultSlot);
      setCondPresentMode(result.presentMode);
    }
  }

  async function handleSubmitAISentence(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = inputSentence.trim();
    if (trimmed.length < 2 || isAnalyzing) return;

    setIsAnalyzing(true);
    setAiError(null);

    try {
      const response = await fetch("/api/ai/tense-detector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentence: trimmed,
          preferredMode: mode,
        }),
      });

      const payload = (await response.json()) as Partial<AIAnalysisResult> & {
        error?: string;
      };

      if (!response.ok) {
        setAiError(
          payload.error ?? "Не вдалося проаналізувати речення. Спробуйте ще раз.",
        );
        return;
      }

      const result = payload as AIAnalysisResult;
      setAiResult(result);
      applyAIResultToGraph(result);

      const uniqueId = `custom-${Date.now()}`;
      if (result.detectedMode === "aspects" && result.aspectForms) {
        setCustomAspectSentence({
          id: uniqueId,
          labelUk: result.shortLabelUk || "Речення на дошці",
          isCustom: true,
          isStateVerb: Boolean(result.isStateVerb),
          forms: result.aspectForms,
        });
      } else if (
        result.detectedMode === "conditionals" &&
        result.conditionalForms
      ) {
        setCustomCondSentence({
          id: uniqueId,
          labelUk: result.shortLabelUk || "Речення на дошці",
          isCustom: true,
          forms: result.conditionalForms,
        });
      }

      setInputSentence("");
    } catch {
      setAiError("Помилка мережі при зверненні до AI-помічника.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const activeStructureFormula =
    mode === "aspects" ? activeCellMeta.formula : activeCondMeta.formula;

  const condIfPosMeta = CONDITIONAL_POSITIONS[condIfSlot];
  const condResultPosMeta = CONDITIONAL_POSITIONS[condResultSlot];

  return (
    <div className="space-y-4">
      {/* ── Заголовок та перемикач режимів (Аспекти / Умовні речення) ── */}
      <div className="flex flex-col gap-3 border-b border-border/50 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Інтерактивний детектор часів
          </h1>
          <Badge
            variant="outline"
            className="border-primary/35 bg-primary/10 text-xs text-primary"
          >
            Дошка викладача
          </Badge>
        </div>

        {/* Перемикач між Аспектами та Умовними реченнями */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Режим інтерактивної дошки"
            className="inline-flex rounded-xl border border-border/70 bg-muted/40 p-1"
          >
            <button
              type="button"
              aria-pressed={mode === "aspects"}
              onClick={() => setMode("aspects")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
                FOCUS_RING_CLASS,
                mode === "aspects"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Layers className="h-4 w-4" aria-hidden="true" />
              Аспекти (Часи)
            </button>
            <button
              type="button"
              aria-pressed={mode === "conditionals"}
              onClick={() => setMode("conditionals")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
                FOCUS_RING_CLASS,
                mode === "conditionals"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <GitBranch className="h-4 w-4" aria-hidden="true" />
              Умовні речення
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetCurrent}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Скинути
          </Button>
        </div>
      </div>

      {/* ── Чистий рядок введення + AI-перевірка граматики ── */}
      <div className="space-y-2.5">
        <form
          onSubmit={(e) => handleSubmitAISentence(e)}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <label
              htmlFor="tense-detector-sentence-input"
              className="sr-only"
            >
              Речення англійською для граматичної перевірки
            </label>
            <Wand2
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
              aria-hidden="true"
            />
            <Input
              id="tense-detector-sentence-input"
              value={inputSentence}
              onChange={(e) => setInputSentence(e.target.value)}
              placeholder={
                mode === "conditionals"
                  ? "Введіть умовне речення англійською для перевірки (напр. If I won the lottery...)"
                  : "Введіть англійське речення для перевірки (навіть з помилкою)..."
              }
              className="h-11 bg-card pl-10 pr-10 text-sm shadow-xs sm:text-base"
              maxLength={400}
              disabled={isAnalyzing}
            />
            {inputSentence.length > 0 && !isAnalyzing ? (
              <button
                type="button"
                onClick={() => setInputSentence("")}
                aria-label="Очистити поле введення"
                className={cn(
                  "absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
                  FOCUS_RING_CLASS,
                )}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <Button
            type="submit"
            disabled={isAnalyzing || inputSentence.trim().length < 2}
            className="h-11 shrink-0 px-5"
          >
            {isAnalyzing ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Перевіряю...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                Перевірити
              </>
            )}
          </Button>
        </form>

        {aiError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <span>{aiError}</span>
            <button
              type="button"
              onClick={() => setAiError(null)}
              aria-label="Закрити повідомлення про помилку"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-destructive/15",
                FOCUS_RING_CLASS,
              )}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {aiResult ? (
            <motion.div
              key="ai-result-banner"
              role="status"
              aria-live="polite"
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={
                reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }
              }
              className={cn(
                "rounded-xl border px-4 py-3 text-sm",
                aiResult.isCorrect
                  ? "border-emerald-500/35 bg-emerald-500/[0.07]"
                  : "border-amber-500/40 bg-amber-500/[0.07]",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {aiResult.isCorrect ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    >
                      <CheckCircle2
                        className="mr-1 h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Правильно
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    >
                      <AlertTriangle
                        className="mr-1 h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Виправлено
                    </Badge>
                  )}
                  <Badge variant="secondary" className="font-mono text-xs">
                    {aiResult.detectedTitle}
                  </Badge>
                  {aiResult.isStateVerb && aiResult.detectedMode === "aspects" ? (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300"
                    >
                      State verb · без Continuous
                    </Badge>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => applyAIResultToGraph(aiResult)}
                  >
                    Показати на графіку
                  </Button>
                  <button
                    type="button"
                    onClick={() => setAiResult(null)}
                    aria-label="Сховати результат перевірки"
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground",
                      FOCUS_RING_CLASS,
                    )}
                    title="Сховати"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {!aiResult.isCorrect ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs sm:text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground line-through">
                      {aiResult.originalSentence}
                    </span>
                    <span className="text-muted-foreground" aria-hidden="true">
                      →
                    </span>
                    <span className="font-semibold text-foreground">
                      {aiResult.correctedSentence}
                    </span>
                  </div>
                  <BrowserTtsButton
                    text={aiResult.correctedSentence}
                    language="english"
                    label="Слухати"
                  />
                </div>
              ) : null}

              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {aiResult.explanationUk}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ── ОСНОВНА РОБОЧА ПАНЕЛЬ ─────────────────────────────────────── */}
      <Card className="overflow-hidden border-border/70 bg-card/70 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-card/40 pb-4">
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <Clock
                  className="h-5 w-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <CardTitle className="text-lg font-bold tracking-tight sm:text-xl">
                  {mode === "aspects"
                    ? activeCellMeta.tenseName
                    : activeCondMeta.nameUk}
                </CardTitle>
                {mode === "aspects" && isStateVerb ? (
                  <Badge
                    variant="outline"
                    className="border-amber-500/45 bg-amber-500/12 text-xs text-amber-700 dark:text-amber-300"
                  >
                    State verb · без Continuous
                  </Badge>
                ) : null}
              </div>

              {/* Виразний рядок структури (виділений блок над графіком) */}
              <div className="inline-flex max-w-full flex-wrap items-center gap-2.5 rounded-xl border-2 border-primary/45 bg-primary/12 px-3.5 py-2 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary/85">
                  Структура
                </span>
                <code className="font-mono text-sm font-bold tracking-wide text-primary sm:text-base">
                  {activeStructureFormula}
                </code>
              </div>

              <CardDescription className="text-sm leading-snug text-muted-foreground">
                {mode === "aspects"
                  ? activeCellMeta.explanationUk
                  : activeCondMeta.explanationUk}
              </CardDescription>
            </div>

            {mode === "aspects" ? (
              customAspectSentence && activeAspectParsed ? (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <BrowserTtsButton
                    text={activeAspectParsed.plainText}
                    language="english"
                    label="Слухати"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCustomAspectSentence(null)}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                    title="Прибрати речення з дошки"
                  >
                    <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Очистити
                  </Button>
                </div>
              ) : null
            ) : (
              <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                {customCondSentence && activeCondPlainText ? (
                  <div className="flex items-center gap-1.5">
                    <BrowserTtsButton
                      text={activeCondPlainText}
                      language="english"
                      label="Слухати"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomCondSentence(null)}
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                      title="Прибрати речення з дошки"
                    >
                      <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      Очистити
                    </Button>
                  </div>
                ) : null}

                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-background/50 px-3 py-1.5 text-xs font-medium">
                  {condLinked ? (
                    <Link2
                      className="h-3.5 w-3.5 text-primary"
                      aria-hidden="true"
                    />
                  ) : (
                    <Link2Off
                      className="h-3.5 w-3.5 text-amber-400"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    {condLinked ? "Чисті (1 · 2 · 3)" : "Міксовані (2 ↔ 3)"}
                  </span>
                  <Switch
                    checked={condLinked}
                    onCheckedChange={(checked) => {
                      setCondLinked(checked);
                      if (checked) {
                        if (condIfSlot === 2 || condResultSlot === 2) {
                          setCondIfSlot(2);
                          setCondResultSlot(2);
                        } else {
                          setCondResultSlot(condIfSlot);
                        }
                      } else {
                        setCondIfSlot(0);
                        setCondResultSlot(1);
                      }
                    }}
                  />
                </label>

                {condIfSlot === 1 && condResultSlot === 1 ? (
                  <div
                    role="group"
                    aria-label="Тип умови для позиції 2"
                    className="inline-flex rounded-lg border border-border/70 bg-background/50 p-0.5 text-xs"
                  >
                    <button
                      type="button"
                      aria-pressed={condPresentMode === "unreal"}
                      onClick={() => setCondPresentMode("unreal")}
                      className={cn(
                        "rounded-md px-2.5 py-1 font-medium transition-colors",
                        FOCUS_RING_CLASS,
                        condPresentMode === "unreal"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Нереальна (2nd)
                    </button>
                    <button
                      type="button"
                      aria-pressed={condPresentMode === "zero"}
                      onClick={() => setCondPresentMode("zero")}
                      className={cn(
                        "rounded-md px-2.5 py-1 font-medium transition-colors",
                        FOCUS_RING_CLASS,
                        condPresentMode === "zero"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Реальний факт (Zero)
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          {/* ════════════════════════════════════════════════════════════ */}
          {/* РЕЖИМ 1: 4 СЕЛЕКТОРИ АСПЕКТІВ + ЧИТАБЕЛЬНИЙ ГРАФІК           */}
          {/* ════════════════════════════════════════════════════════════ */}
          {mode === "aspects" ? (
            <div className="space-y-4">
              {/* 4 перемикачі аспектів з короткими поясненнями українською */}
              <div
                role="group"
                aria-label="Вибір аспекту"
                className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
              >
                {ASPECT_DEFINITIONS.map((aspect) => {
                  const isBlockedByStateVerb =
                    isStateVerb &&
                    (aspect.key === "continuous" ||
                      aspect.key === "perfect_continuous");
                  const isSelected = effectiveAspect === aspect.key;
                  return (
                    <button
                      key={aspect.key}
                      type="button"
                      disabled={isBlockedByStateVerb}
                      onClick={() => setActiveAspect(aspect.key)}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex flex-col items-start justify-between gap-1.5 rounded-xl border px-3.5 py-3 text-left transition-colors",
                        FOCUS_RING_CLASS,
                        isBlockedByStateVerb
                          ? "cursor-not-allowed border-amber-500/25 bg-amber-500/[0.04] opacity-55"
                          : isSelected
                            ? "border-primary bg-primary/[0.11] shadow-xs ring-1 ring-primary/35"
                            : "border-border/70 bg-background/55 hover:border-border hover:bg-accent/20",
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-sm font-bold tracking-tight",
                            isBlockedByStateVerb
                              ? "text-muted-foreground"
                              : isSelected
                                ? "text-primary"
                                : "text-foreground",
                          )}
                        >
                          {aspect.title}
                        </span>
                        {isBlockedByStateVerb ? (
                          <span className="rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            State verb · без -ing
                          </span>
                        ) : (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border/80 bg-background/60",
                            )}
                          >
                            {isSelected ? (
                              <Check className="h-2.5 w-2.5" />
                            ) : null}
                          </span>
                        )}
                      </div>
                      <span className="text-xs leading-snug text-muted-foreground">
                        {aspect.explanationUk}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Висококонтрастний інтерактивний графік Past / Present / Future */}
              <div
                ref={aspectTrackRef}
                onPointerMove={handleAspectPointerMove}
                onPointerUp={() => setDraggingAspectMarker(false)}
                onPointerCancel={() => setDraggingAspectMarker(false)}
                className="relative h-[328px] w-full select-none overflow-hidden rounded-xl border border-border/70 bg-background/55"
              >
                {/* 3 колонки часу прямо на графіку */}
                <div className="absolute inset-0 grid grid-cols-3 divide-x divide-border/40">
                  {TIME_AXIS_OPTIONS.map((opt) => {
                    const isColActive = aspectTime === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        aria-pressed={isColActive}
                        onClick={() => setAspectTime(opt.key)}
                        className={cn(
                          "flex h-full flex-col items-center pt-3 text-center transition-colors",
                          FOCUS_RING_INSET_CLASS,
                          isColActive
                            ? "bg-primary/[0.045]"
                            : "hover:bg-muted/20",
                        )}
                      >
                        <span
                          className={cn(
                            "text-xs font-bold tracking-tight sm:text-sm",
                            isColActive
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {opt.labelEn} · {opt.labelUk}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Ненав'язлива вертикальна лінія NOW на задньому плані */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-11 bottom-12 z-0 w-px -translate-x-1/2 bg-border/80"
                  style={{ left: `${nowPct}%` }}
                />

                {/* Плашка на графіку: лише назва часу (без структури) + введене речення */}
                <motion.div
                  animate={{ left: `${colCenterPct}%` }}
                  transition={aspectSpring}
                  className={cn(
                    "pointer-events-none absolute top-[54px] z-20 w-max max-w-[240px] rounded-xl border border-emerald-500/35 bg-card/95 px-3.5 py-2.5 text-center shadow-xs backdrop-blur-xs will-change-transform sm:max-w-[340px]",
                    aspectTime === "past"
                      ? "-translate-x-[24%]"
                      : aspectTime === "future"
                        ? "-translate-x-[76%]"
                        : "-translate-x-1/2",
                  )}
                >
                  <div className="text-xs font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                    {activeCellMeta.tenseName}
                  </div>
                  {activeAspectParsed ? (
                    <p className="mt-1 text-xs leading-snug font-medium text-foreground sm:text-sm">
                      <HighlightedSegments
                        segments={activeAspectParsed.segments}
                        badgeClassName="py-0"
                      />
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {activeAspectDef.explanationUk}
                    </p>
                  )}
                </motion.div>

                {/* Межа "ДО" та синхронізована крива стрілка для Perfect / Perfect-Continuous */}
                {isPerfect ? (
                  <>
                    <motion.div
                      animate={{ left: `${cutoffPct}%` }}
                      transition={aspectSpring}
                      className="pointer-events-none absolute top-[172px] z-10 h-[94px] w-0.5 -translate-x-1/2 bg-sky-500 will-change-transform"
                    />

                    {/* Синхронізований контейнер для кривої стрілки (їде в унісон із ✕) */}
                    <motion.div
                      animate={{ left: `${actionPct}%` }}
                      transition={aspectSpring}
                      style={{ width: `${cutoffPct - actionPct}%` }}
                      aria-hidden="true"
                      className="pointer-events-none absolute top-[160px] z-10 h-[56px] will-change-transform"
                    >
                      <svg
                        viewBox="0 0 200 60"
                        preserveAspectRatio="none"
                        className="h-full w-full overflow-visible"
                      >
                        <defs>
                          <marker
                            id="perfect-cutoff-arrow"
                            markerWidth="8"
                            markerHeight="8"
                            refX="6"
                            refY="4"
                            orient="auto"
                          >
                            <path d="M0,0 L8,4 L0,8 Z" fill="#38bdf8" />
                          </marker>
                        </defs>
                        <path
                          d="M 200 40 Q 100 -4 4 40"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                          strokeDasharray="6 4"
                          vectorEffect="non-scaling-stroke"
                          markerEnd="url(#perfect-cutoff-arrow)"
                        />
                      </svg>
                    </motion.div>

                    <motion.div
                      animate={{ left: `${(cutoffPct + actionPct) / 2}%` }}
                      transition={aspectSpring}
                      className="pointer-events-none absolute top-[148px] z-20 -translate-x-1/2 rounded-full border border-sky-500/40 bg-card/95 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-sky-700 shadow-xs will-change-transform dark:text-sky-300"
                    >
                      {isContinuous ? 'тривало "ДО"' : 'завершено "ДО"'}
                    </motion.div>
                  </>
                ) : null}

                {/* Основна горизонтальна вісь часу */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-[5%] top-[224px] z-10 h-0.5 -translate-y-1/2 bg-border"
                />

                {/* Декоративні засічки на осі (вибір відбувається через колонки або слайдер ✕) */}
                {TIME_AXIS_OPTIONS.map((opt) => (
                  <span
                    key={`axis-tick-${opt.key}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-[224px] z-10 block h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border"
                    style={{ left: `${getColumnCenterPercent(opt.slot)}%` }}
                  />
                ))}

                {/* Візуал SIMPLE: ритмічні повторювані крапки обабіч ✕ */}
                {effectiveAspect === "simple" ? (
                  <motion.div
                    animate={{ left: `${actionPct}%` }}
                    transition={aspectSpring}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-[224px] z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-5 will-change-transform"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/45" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/75" />
                    <span className="w-14" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/75" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/45" />
                  </motion.div>
                ) : null}

                {/* Візуал CONTINUOUS: чиста хвиля тривалості без тексту під ✕ */}
                {effectiveAspect === "continuous" ? (
                  <motion.div
                    animate={{ left: `${actionPct}%` }}
                    transition={aspectSpring}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-[224px] z-10 flex h-11 w-44 -translate-x-1/2 -translate-y-1/2 items-center justify-between rounded-full border border-emerald-500/45 bg-emerald-500/15 px-3.5 will-change-transform"
                  >
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      〰
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      〰
                    </span>
                  </motion.div>
                ) : null}

                {/* Візуал PERFECT-CONTINUOUS: хвиля тривалості аж до межі "ДО" */}
                {effectiveAspect === "perfect_continuous" ? (
                  <motion.div
                    animate={{
                      left: `${actionPct}%`,
                      width: `${cutoffPct - actionPct}%`,
                    }}
                    transition={aspectSpring}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-[224px] z-10 flex h-10 -translate-y-1/2 items-center justify-center rounded-l-full border border-r-0 border-emerald-500/45 bg-emerald-500/15 pl-8 pr-2 will-change-transform"
                  >
                    <span className="text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-300">
                      〰〰
                    </span>
                  </motion.div>
                ) : null}

                {/* Перетягуваний та клавіатурно-доступний маркер ✕ */}
                <motion.div
                  animate={{ left: `${actionPct}%` }}
                  transition={aspectSpring}
                  className="absolute top-[224px] z-20 -translate-x-1/2 -translate-y-1/2 touch-none select-none will-change-transform"
                >
                  <button
                    type="button"
                    role="slider"
                    aria-label="Позиція дії на лінії часу"
                    aria-valuemin={0}
                    aria-valuemax={2}
                    aria-valuenow={activeTimeMeta.slot}
                    aria-valuetext={`${activeTimeMeta.labelEn} (${activeTimeMeta.labelUk}) — ${activeCellMeta.tenseName}`}
                    onPointerDown={handleAspectPointerDown}
                    onKeyDown={handleAspectMarkerKeyDown}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 text-base font-black shadow-md ring-4 transition-transform hover:scale-110",
                      FOCUS_RING_CLASS,
                      MARKER_STYLES.emerald.markerBg,
                      MARKER_STYLES.emerald.markerBorder,
                      MARKER_STYLES.emerald.ring,
                      draggingAspectMarker
                        ? "scale-115 cursor-grabbing shadow-lg"
                        : "cursor-grab",
                    )}
                  >
                    ✕
                  </button>
                </motion.div>

                {/* Нижні підписи на осі: NOW та Межа "ДО" */}
                <div
                  className={cn(
                    "pointer-events-none absolute top-[276px] z-20 -translate-x-1/2 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wider whitespace-nowrap shadow-xs",
                    isPerfect && aspectTime === "present"
                      ? "border border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-300"
                      : "bg-foreground text-background",
                  )}
                  style={{ left: `${nowPct}%` }}
                >
                  {isPerfect && aspectTime === "present"
                    ? 'NOW · межа "ДО"'
                    : "NOW"}
                </div>

                {isPerfect && aspectTime !== "present" ? (
                  <motion.div
                    animate={{ left: `${cutoffPct}%` }}
                    transition={aspectSpring}
                    className="pointer-events-none absolute top-[276px] z-20 -translate-x-1/2 rounded-md border border-sky-500/45 bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-sky-700 will-change-transform dark:text-sky-300"
                  >
                    Межа &quot;ДО&quot;
                  </motion.div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* РЕЖИМ 2: УМОВНІ РЕЧЕННЯ (ЧИСТИЙ ДВОСМУГОВИЙ ГРАФІК)        */}
          {/* ════════════════════════════════════════════════════════════ */}
          {mode === "conditionals" ? (
            <div className="space-y-4">
              {/* Двосмуговий графік: IF (вгорі) + RESULT (внизу) */}
              <div
                ref={condTrackRef}
                onPointerMove={handleCondPointerMove}
                onPointerUp={() => setDraggingCondMarker(null)}
                onPointerCancel={() => setDraggingCondMarker(null)}
                className="relative h-[364px] w-full select-none overflow-hidden rounded-xl border border-border/70 bg-background/55"
              >
                {/* 3 колонки: Минуле (3), Теперішнє / Загальне (2), Майбутнє (1) */}
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 divide-x divide-border/40">
                  {CONDITIONAL_POSITIONS.map((pos) => {
                    const isFutureDisabled = !condLinked && pos.slot === 2;
                    const isActiveCol =
                      !isFutureDisabled &&
                      (condIfSlot === pos.slot || condResultSlot === pos.slot);
                    return (
                      <div
                        key={pos.slot}
                        className={cn(
                          "flex flex-col items-center px-2 pt-2.5 text-center transition-colors",
                          isActiveCol && "bg-primary/[0.04]",
                          isFutureDisabled && "bg-muted/20 opacity-40",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-bold text-foreground">
                            {pos.numberLabel}
                          </span>
                          <span className="text-xs font-semibold text-foreground sm:text-sm">
                            {pos.situationLabelUk}
                          </span>
                        </div>
                        {isFutureDisabled ? (
                          <span className="mt-0.5 text-[11px] text-muted-foreground">
                            лише чистий 1st
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Плавна анімована лінія зв'язку між IF ✕ та RESULT ✕ */}
                <svg
                  viewBox="0 0 1000 364"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  <motion.path
                    animate={{
                      d: `M ${condIfPct * 10} 152 C ${condIfPct * 10} 226, ${condResultPct * 10} 226, ${condResultPct * 10} 300`,
                    }}
                    transition={condConnectorSpring}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    className="text-primary/35"
                  />
                </svg>

                {/* Смуга 1: IF */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-[5%] top-[152px] h-0.5 -translate-y-1/2 bg-border"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute left-3 top-[152px] -translate-y-1/2 rounded border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                    MARKER_STYLES.amber.badge,
                  )}
                >
                  IF
                </span>

                {/* Клікабельні зони для переміщення IF */}
                {CONDITIONAL_POSITIONS.map((pos) => {
                  const pct = getColumnCenterPercent(pos.slot);
                  const isDisabled = !condLinked && pos.slot === 2;
                  const isZero =
                    pos.slot === 1 &&
                    condIfSlot === 1 &&
                    condResultSlot === 1 &&
                    condPresentMode === "zero";
                  return (
                    <button
                      key={`if-tick-${pos.slot}`}
                      type="button"
                      disabled={isDisabled}
                      aria-pressed={condIfSlot === pos.slot}
                      onClick={() => setCondPositions("if", pos.slot)}
                      className={cn(
                        "group/tick absolute top-[152px] -translate-x-1/2 -translate-y-1/2 rounded-lg px-5 py-3.5 transition-opacity",
                        FOCUS_RING_CLASS,
                        isDisabled && "pointer-events-none opacity-35",
                      )}
                      style={{ left: `${pct}%` }}
                      aria-label={`Умова IF: ${pos.situationLabelUk}`}
                    >
                      <span className="mx-auto block h-3 w-0.5 rounded-full bg-border group-hover/tick:bg-amber-400" />
                      <span className="mt-10 block whitespace-nowrap text-[11px] font-medium text-muted-foreground/85 group-hover/tick:text-foreground">
                        {isZero ? "Present Simple" : pos.ifShortFormula}
                      </span>
                    </button>
                  );
                })}

                {/* Плашка IF (назва часу + IF частина введеного речення) */}
                <motion.div
                  animate={{ left: `${condIfPct}%` }}
                  transition={condIfSpring}
                  className={cn(
                    "pointer-events-none absolute top-[62px] z-10 w-max max-w-[215px] rounded-xl border border-amber-500/35 bg-card/95 px-3 py-2 text-center shadow-xs backdrop-blur-xs will-change-transform sm:max-w-[300px]",
                    condIfSlot === 0
                      ? "-translate-x-[26%]"
                      : condIfSlot === 2
                        ? "-translate-x-[74%]"
                        : "-translate-x-1/2",
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                    <span>IF · {activeCondMeta.ifClauseTense}</span>
                    {activeCondMeta.ifBackshifted ? (
                      <span className="inline-flex items-center gap-0.5 font-semibold opacity-85">
                        <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                        backshift
                      </span>
                    ) : null}
                  </div>
                  {activeCondParts ? (
                    <p className="mt-0.5 text-xs leading-snug font-medium text-foreground sm:text-sm">
                      <HighlightedSegments
                        segments={activeCondParts.ifPart.segments}
                        badgeClassName="py-0"
                      />
                    </p>
                  ) : null}
                </motion.div>

                {/* Перетягуваний та клавіатурно-доступний маркер IF ✕ */}
                <motion.div
                  animate={{ left: `${condIfPct}%` }}
                  transition={condIfSpring}
                  className="absolute top-[152px] z-20 -translate-x-1/2 -translate-y-1/2 touch-none select-none will-change-transform"
                >
                  <button
                    type="button"
                    role="slider"
                    aria-label="Позиція умови IF на лінії часу"
                    aria-valuemin={0}
                    aria-valuemax={condMaxSlot}
                    aria-valuenow={condIfSlot}
                    aria-valuetext={`${condIfPosMeta.situationLabelUk} — IF: ${activeCondMeta.ifClauseTense}`}
                    onPointerDown={(e) => handleCondPointerDown("if", e)}
                    onKeyDown={(e) =>
                      handleCondMarkerKeyDown("if", condIfSlot, e)
                    }
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 text-base font-black shadow-md ring-4 transition-transform hover:scale-110",
                      FOCUS_RING_CLASS,
                      MARKER_STYLES.amber.markerBg,
                      MARKER_STYLES.amber.markerBorder,
                      MARKER_STYLES.amber.ring,
                      draggingCondMarker === "if"
                        ? "scale-115 cursor-grabbing shadow-lg"
                        : "cursor-grab",
                    )}
                  >
                    ✕
                  </button>
                </motion.div>

                {/* Смуга 2: RESULT */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-[5%] top-[300px] h-0.5 -translate-y-1/2 bg-border"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute left-3 top-[300px] -translate-y-1/2 rounded border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                    MARKER_STYLES.emerald.badge,
                  )}
                >
                  RESULT
                </span>

                {/* Клікабельні зони для переміщення RESULT */}
                {CONDITIONAL_POSITIONS.map((pos) => {
                  const pct = getColumnCenterPercent(pos.slot);
                  const isDisabled = !condLinked && pos.slot === 2;
                  const isZero =
                    pos.slot === 1 &&
                    condIfSlot === 1 &&
                    condResultSlot === 1 &&
                    condPresentMode === "zero";
                  return (
                    <button
                      key={`res-tick-${pos.slot}`}
                      type="button"
                      disabled={isDisabled}
                      aria-pressed={condResultSlot === pos.slot}
                      onClick={() => setCondPositions("result", pos.slot)}
                      className={cn(
                        "group/tick absolute top-[300px] -translate-x-1/2 -translate-y-1/2 rounded-lg px-5 py-3.5 transition-opacity",
                        FOCUS_RING_CLASS,
                        isDisabled && "pointer-events-none opacity-35",
                      )}
                      style={{ left: `${pct}%` }}
                      aria-label={`Результат RESULT: ${pos.situationLabelUk}`}
                    >
                      <span className="mx-auto block h-3 w-0.5 rounded-full bg-border group-hover/tick:bg-emerald-400" />
                      <span className="mt-10 block whitespace-nowrap text-[11px] font-medium text-muted-foreground/85 group-hover/tick:text-foreground">
                        {isZero ? "Present Simple" : pos.resultShortFormula}
                      </span>
                    </button>
                  );
                })}

                {/* Плашка RESULT (назва форми + RESULT частина введеного речення) */}
                <motion.div
                  animate={{ left: `${condResultPct}%` }}
                  transition={condResultSpring}
                  className={cn(
                    "pointer-events-none absolute top-[212px] z-10 w-max max-w-[215px] rounded-xl border border-emerald-500/35 bg-card/95 px-3 py-2 text-center shadow-xs backdrop-blur-xs will-change-transform sm:max-w-[300px]",
                    condResultSlot === 0
                      ? "-translate-x-[26%]"
                      : condResultSlot === 2
                        ? "-translate-x-[74%]"
                        : "-translate-x-1/2",
                  )}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                    RESULT · {activeCondMeta.resultClauseTense}
                  </div>
                  {activeCondParts && activeCondParts.resultPart.plainText ? (
                    <p className="mt-0.5 text-xs leading-snug font-medium text-foreground sm:text-sm">
                      <HighlightedSegments
                        segments={activeCondParts.resultPart.segments}
                        badgeClassName="py-0"
                      />
                    </p>
                  ) : null}
                </motion.div>

                {/* Перетягуваний та клавіатурно-доступний маркер RESULT ✕ */}
                <motion.div
                  animate={{ left: `${condResultPct}%` }}
                  transition={condResultSpring}
                  className="absolute top-[300px] z-20 -translate-x-1/2 -translate-y-1/2 touch-none select-none will-change-transform"
                >
                  <button
                    type="button"
                    role="slider"
                    aria-label="Позиція результату RESULT на лінії часу"
                    aria-valuemin={0}
                    aria-valuemax={condMaxSlot}
                    aria-valuenow={condResultSlot}
                    aria-valuetext={`${condResultPosMeta.situationLabelUk} — RESULT: ${activeCondMeta.resultClauseTense}`}
                    onPointerDown={(e) => handleCondPointerDown("result", e)}
                    onKeyDown={(e) =>
                      handleCondMarkerKeyDown("result", condResultSlot, e)
                    }
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 text-base font-black shadow-md ring-4 transition-transform hover:scale-110",
                      FOCUS_RING_CLASS,
                      MARKER_STYLES.emerald.markerBg,
                      MARKER_STYLES.emerald.markerBorder,
                      MARKER_STYLES.emerald.ring,
                      draggingCondMarker === "result"
                        ? "scale-115 cursor-grabbing shadow-lg"
                        : "cursor-grab",
                    )}
                  >
                    ✕
                  </button>
                </motion.div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
