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
  ArrowLeftRight,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  GitBranch,
  Layers,
  Link2,
  Link2Off,
  Loader2,
  MessageSquareQuote,
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ASPECT_DEFINITIONS,
  ASPECT_MATRIX_META,
  CONDITIONAL_META,
  CONDITIONAL_POSITIONS,
  getAspectCellKey,
  MARKER_STYLES,
  parseTaggedSentence,
  PASSIVE_CATEGORIES,
  PASSIVE_PRESETS,
  REPORTED_CATEGORIES,
  REPORTED_PRESETS,
  REPORTED_TIME_COLUMNS,
  resolveActiveReportedComponents,
  resolveActiveReportedExpressions,
  resolveActiveTimeMarkers,
  resolveActiveUseCases,
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
  type PassiveCategory,
  type PassiveDerivationStep,
  type PassiveFormEntry,
  type PassiveSentenceTemplate,
  type PassiveVoiceFocus,
  type ReportedCategory,
  type ReportedFormEntry,
  type ReportedPerspective,
  type ReportedSentenceTemplate,
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
  detectedUseCaseIndex?: number | null;
  reportedCategory?: ReportedCategory;
  passiveCategory?: PassiveCategory;
  aspectForms?: Record<AspectCellKey, string>;
  conditionalForms?: Record<ConditionalVariantKey, string>;
  reportedForms?: Record<ReportedCategory, ReportedFormEntry>;
  passiveForms?: Record<PassiveCategory, PassiveFormEntry>;
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
      stiffness: 680,
      damping: 40,
      mass: 0.5,
    };
  }
  return {
    type: "spring",
    stiffness: 340,
    damping: 30,
    mass: 0.75,
  };
}

function getCrossfadeTransition(reduceMotion: boolean | null): Transition {
  if (reduceMotion) {
    return { duration: 0 };
  }
  return {
    duration: 0.16,
    ease: [0.22, 1, 0.36, 1],
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
        if (seg.strikethrough) {
          return (
            <span
              key={segIdx}
              className="mx-0.5 inline-block rounded bg-rose-500/10 px-1 py-0.5 text-rose-600 line-through decoration-rose-500/90 decoration-2 dark:bg-rose-500/15 dark:text-rose-300/85"
            >
              {seg.text}
            </span>
          );
        }
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

  // ── Reported Speech State ────────────────────────────────────────
  const [reportedCategory, setReportedCategory] =
    useState<ReportedCategory>("statement");
  const [selectedReportedPresetIds, setSelectedReportedPresetIds] = useState<
    Record<ReportedCategory, string>
  >({
    statement: "stmt_pres_cont",
    yes_no_question: "yn_past",
    wh_question: "wh_past",
    imperative: "imp_pos",
  });
  const [reportedPerspective, setReportedPerspective] =
    useState<ReportedPerspective>("reported");
  const [customReportedSentence, setCustomReportedSentence] =
    useState<ReportedSentenceTemplate | null>(null);
  const [draggingReportedMarker, setDraggingReportedMarker] = useState(false);
  const reportedTrackRef = useRef<HTMLDivElement | null>(null);

  // ── Passive Voice State ──────────────────────────────────────────
  const [passiveCategory, setPassiveCategory] =
    useState<PassiveCategory>("basic");
  const [selectedPassivePresetIds, setSelectedPassivePresetIds] = useState<
    Record<PassiveCategory, string>
  >({
    basic: "basic-present-simple",
    modal_perfect: "modal-could-have",
    infinitive: "inf-want-tell",
    gerund: "ger-hate-spoken-to",
  });
  const [passiveFocus, setPassiveFocus] =
    useState<PassiveVoiceFocus>("passive");
  const [passiveStep, setPassiveStep] = useState<PassiveDerivationStep>(3);
  const [customPassiveSentence, setCustomPassiveSentence] =
    useState<PassiveSentenceTemplate | null>(null);
  const [draggingPassiveMarker, setDraggingPassiveMarker] = useState(false);
  const passiveTrackRef = useRef<HTMLDivElement | null>(null);

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
  const resolvedTimeMarkers = resolveActiveTimeMarkers(
    activeCellKey,
    activeAspectParsed,
  );
  const hasActiveTimeMarker = resolvedTimeMarkers.some(
    (marker) => marker.isActive,
  );
  const resolvedUseCases = resolveActiveUseCases(
    activeCellKey,
    activeAspectParsed,
    {
      isStateVerb,
      detectedCellKey: customAspectSentence?.detectedCellKey,
      detectedUseCaseIndex: customAspectSentence?.detectedUseCaseIndex,
    },
  );
  const hasActiveUseCase = resolvedUseCases.some((item) => item.isActive);

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

  // ── Derived Reported Speech State ────────────────────────────────
  const activeReportedCategoryMeta =
    REPORTED_CATEGORIES.find((item) => item.key === reportedCategory) ??
    REPORTED_CATEGORIES[0];
  const reportedCategoryPresets = REPORTED_PRESETS.filter(
    (preset) => preset.category === reportedCategory,
  );
  const activeReportedPreset =
    reportedCategoryPresets.find(
      (preset) => preset.id === selectedReportedPresetIds[reportedCategory],
    ) ?? reportedCategoryPresets[0];
  const activeReportedEntry: ReportedFormEntry = customReportedSentence
    ? customReportedSentence.forms[reportedCategory]
    : activeReportedPreset;
  const directParsed = parseTaggedSentence(
    activeReportedEntry.directTagged,
    "emerald",
    "sky",
    "amber",
  );
  const reportedParsed = parseTaggedSentence(
    activeReportedEntry.reportedTagged,
    "emerald",
    "sky",
    "amber",
  );
  const resolvedReportedExpressions = resolveActiveReportedExpressions(
    directParsed.plainText,
    reportedParsed.plainText,
  );
  const hasActiveReportedExpression = resolvedReportedExpressions.some(
    (item) => item.isActive,
  );
  const hasPerspectiveTokens =
    hasActiveReportedExpression ||
    reportedParsed.segments.some((segment) => segment.color === "sky");
  const resolvedReportedComponents = resolveActiveReportedComponents({
    category: reportedCategory,
    hasBackshift: activeReportedEntry.hasBackshift,
    hasPerspectiveShift: hasPerspectiveTokens,
  });

  // ── Derived Passive Voice State ──────────────────────────────────
  const activePassiveCategoryMeta =
    PASSIVE_CATEGORIES.find((item) => item.id === passiveCategory) ??
    PASSIVE_CATEGORIES[0];
  const passiveCategoryPresets = PASSIVE_PRESETS.filter(
    (preset) => preset.category === passiveCategory,
  );
  const activePassivePreset =
    passiveCategoryPresets.find(
      (preset) => preset.id === selectedPassivePresetIds[passiveCategory],
    ) ?? passiveCategoryPresets[0];
  const activePassiveEntry: PassiveFormEntry = customPassiveSentence
    ? customPassiveSentence.forms[passiveCategory]
    : activePassivePreset;
  const passiveActiveParsed = parseTaggedSentence(
    activePassiveEntry.activeTagged,
    "emerald",
    "sky",
    "amber",
  );
  const passiveResultParsed = parseTaggedSentence(
    activePassiveEntry.passiveTagged,
    "emerald",
    "sky",
    "amber",
  );
  const passiveBridgeParsed = activePassiveEntry.bridgeStepTagged
    ? parseTaggedSentence(
        activePassiveEntry.bridgeStepTagged,
        "emerald",
        "sky",
        "amber",
      )
    : null;
  const passiveAltParsed = activePassiveEntry.altPassiveTagged
    ? parseTaggedSentence(
        activePassiveEntry.altPassiveTagged,
        "emerald",
        "sky",
        "amber",
      )
    : null;

  // ── Shared Smooth Spring Transitions ─────────────────────────────
  const aspectSpring = getSpringTransition(draggingAspectMarker, reduceMotion);
  const reportedSpring = getSpringTransition(
    draggingReportedMarker,
    reduceMotion,
  );
  const passiveSpring = getSpringTransition(
    draggingPassiveMarker,
    reduceMotion,
  );
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

  // ── Timeline Coordinates (Reported Speech Mode) ──────────────────
  const reportedDirectPct = getColumnCenterPercent(
    activeReportedEntry.directSlot,
  );
  const reportedTargetPct = getColumnCenterPercent(
    activeReportedEntry.reportedSlot,
  );
  const reportedActiveSlot =
    reportedPerspective === "direct"
      ? activeReportedEntry.directSlot
      : activeReportedEntry.reportedSlot;
  const reportedMarkerPct = getColumnCenterPercent(reportedActiveSlot);

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

  function handleReportedPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingReportedMarker(true);
  }

  function handleReportedPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingReportedMarker || !reportedTrackRef.current) return;
    if (activeReportedEntry.directSlot === activeReportedEntry.reportedSlot) {
      return;
    }
    const rect = reportedTrackRef.current.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)),
    );
    const directDist = Math.abs(
      ratio - getColumnCenterPercent(activeReportedEntry.directSlot) / 100,
    );
    const reportedDist = Math.abs(
      ratio - getColumnCenterPercent(activeReportedEntry.reportedSlot) / 100,
    );
    setReportedPerspective(reportedDist <= directDist ? "reported" : "direct");
  }

  function handleReportedMarkerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowLeft" || event.key === "Home") {
      event.preventDefault();
      setReportedPerspective("reported");
    } else if (event.key === "ArrowRight" || event.key === "End") {
      event.preventDefault();
      setReportedPerspective("direct");
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setReportedPerspective((prev) =>
        prev === "reported" ? "direct" : "reported",
      );
    }
  }

  function handlePassivePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingPassiveMarker(true);
  }

  function handlePassivePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingPassiveMarker || !passiveTrackRef.current) return;
    const rect = passiveTrackRef.current.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)),
    );
    if (activePassiveCategoryMeta.modeKind === "conversion") {
      setPassiveFocus(ratio < 0.5 ? "active" : "passive");
    } else {
      const slot = clientXToColumnSlot(event.clientX, rect);
      setPassiveStep((slot + 1) as PassiveDerivationStep);
    }
  }

  function handlePassiveMarkerKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    if (activePassiveCategoryMeta.modeKind === "conversion") {
      if (event.key === "ArrowLeft" || event.key === "Home") {
        event.preventDefault();
        setPassiveFocus("active");
      } else if (event.key === "ArrowRight" || event.key === "End") {
        event.preventDefault();
        setPassiveFocus("passive");
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setPassiveFocus((prev) => (prev === "active" ? "passive" : "active"));
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPassiveStep((prev) => Math.max(1, prev - 1) as PassiveDerivationStep);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setPassiveStep((prev) => Math.min(3, prev + 1) as PassiveDerivationStep);
    } else if (event.key === "Home") {
      event.preventDefault();
      setPassiveStep(1);
    } else if (event.key === "End") {
      event.preventDefault();
      setPassiveStep(3);
    }
  }

  function handleResetCurrent() {
    setAiResult(null);
    setAiError(null);
    if (mode === "aspects") {
      setCustomAspectSentence(null);
      setAspectTime("present");
      setActiveAspect("continuous");
    } else if (mode === "conditionals") {
      setCustomCondSentence(null);
      setCondLinked(true);
      setCondIfSlot(2);
      setCondResultSlot(2);
      setCondPresentMode("unreal");
    } else if (mode === "reported") {
      setCustomReportedSentence(null);
      setReportedCategory("statement");
      setSelectedReportedPresetIds({
        statement: "stmt_pres_cont",
        yes_no_question: "yn_past",
        wh_question: "wh_past",
        imperative: "imp_pos",
      });
      setReportedPerspective("reported");
    } else {
      setCustomPassiveSentence(null);
      setPassiveCategory("basic");
      setSelectedPassivePresetIds({
        basic: "basic-present-simple",
        modal_perfect: "modal-could-have",
        infinitive: "inf-want-tell",
        gerund: "ger-hate-spoken-to",
      });
      setPassiveFocus("passive");
      setPassiveStep(3);
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
    } else if (result.detectedMode === "conditionals") {
      const sanitized = sanitizeConditionalSlots(
        result.ifSlot,
        result.resultSlot,
      );
      const isLinked = sanitized.ifSlot === sanitized.resultSlot;
      setCondLinked(isLinked);
      setCondIfSlot(sanitized.ifSlot);
      setCondResultSlot(sanitized.resultSlot);
      setCondPresentMode(result.presentMode);
    } else if (result.detectedMode === "reported") {
      setReportedCategory(result.reportedCategory ?? "statement");
      setReportedPerspective("reported");
      if (result.reportedForms) {
        setCustomReportedSentence({
          id: `ai-${Date.now()}`,
          labelUk: result.shortLabelUk || "Речення на дошці",
          forms: result.reportedForms,
        });
      }
    } else {
      setPassiveCategory(result.passiveCategory ?? "basic");
      setPassiveFocus("passive");
      setPassiveStep(3);
      if (result.passiveForms) {
        setCustomPassiveSentence({
          id: `ai-${Date.now()}`,
          labelUk: result.shortLabelUk || "Речення на дошці",
          forms: result.passiveForms,
        });
      }
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
        const detectedAspect = resolveAspectType(
          result.isStateVerb ? false : result.isContinuous,
          result.isPerfect,
        );
        const detectedCellKey = getAspectCellKey(result.time, detectedAspect);
        setCustomAspectSentence({
          id: uniqueId,
          labelUk: result.shortLabelUk || "Речення на дошці",
          isCustom: true,
          isStateVerb: Boolean(result.isStateVerb),
          detectedCellKey,
          detectedUseCaseIndex: result.detectedUseCaseIndex ?? null,
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
      } else if (
        result.detectedMode === "reported" &&
        result.reportedForms
      ) {
        setCustomReportedSentence({
          id: uniqueId,
          labelUk: result.shortLabelUk || "Речення на дошці",
          forms: result.reportedForms,
        });
      } else if (
        result.detectedMode === "passive" &&
        result.passiveForms
      ) {
        setCustomPassiveSentence({
          id: uniqueId,
          labelUk: result.shortLabelUk || "Речення на дошці",
          forms: result.passiveForms,
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
    mode === "aspects"
      ? activeCellMeta.formula
      : mode === "conditionals"
        ? activeCondMeta.formula
        : mode === "reported"
          ? activeReportedCategoryMeta.formula
          : activePassiveCategoryMeta.structureFormula;

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

        {/* Перемикач між Аспектами, Умовними реченнями та Непрямою мовою */}
        <div
          role="group"
          aria-label="Режим інтерактивної дошки"
          className="inline-flex flex-wrap rounded-xl border border-border/70 bg-card/70 p-1 shadow-xs"
        >
          <button
            type="button"
            aria-pressed={mode === "aspects"}
            onClick={() => setMode("aspects")}
            className={cn(
              "relative inline-flex items-center rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
              FOCUS_RING_CLASS,
              mode === "aspects"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {mode === "aspects" ? (
              <motion.span
                layoutId="detector-mode-pill"
                transition={getSpringTransition(false, reduceMotion)}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-primary shadow-xs"
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <Layers className="h-4 w-4" aria-hidden="true" />
              Аспекти (Часи)
            </span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "conditionals"}
            onClick={() => setMode("conditionals")}
            className={cn(
              "relative inline-flex items-center rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
              FOCUS_RING_CLASS,
              mode === "conditionals"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {mode === "conditionals" ? (
              <motion.span
                layoutId="detector-mode-pill"
                transition={getSpringTransition(false, reduceMotion)}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-primary shadow-xs"
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <GitBranch className="h-4 w-4" aria-hidden="true" />
              Умовні речення
            </span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "reported"}
            onClick={() => setMode("reported")}
            className={cn(
              "relative inline-flex items-center rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
              FOCUS_RING_CLASS,
              mode === "reported"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {mode === "reported" ? (
              <motion.span
                layoutId="detector-mode-pill"
                transition={getSpringTransition(false, reduceMotion)}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-primary shadow-xs"
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <MessageSquareQuote className="h-4 w-4" aria-hidden="true" />
              Непряма мова
            </span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "passive"}
            onClick={() => setMode("passive")}
            className={cn(
              "relative inline-flex items-center rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
              FOCUS_RING_CLASS,
              mode === "passive"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {mode === "passive" ? (
              <motion.span
                layoutId="detector-mode-pill"
                transition={getSpringTransition(false, reduceMotion)}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-primary shadow-xs"
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              Пасивний стан
            </span>
          </button>
        </div>
      </div>

      {/* ── Чистий рядок введення + AI-перевірка граматики ── */}
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
                : mode === "reported"
                  ? "Введіть пряму чи непряму мову для перевірки (напр. When did they arrive? або He asked me where was Tom)"
                  : mode === "passive"
                    ? "Введіть пасив чи актив для розбору (напр. I want to be told..., I hate being spoken to... або The cat knocked over the vase)"
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

      {/* ── ОСНОВНА РОБОЧА ПАНЕЛЬ ─────────────────────────────────────── */}
      <Card className="overflow-hidden border-border/70 bg-card/70 shadow-sm">
        <CardHeader className="flex flex-col items-stretch gap-3.5 border-b border-border/50 bg-card/40 px-4 py-4 sm:px-6">
          {/* Рядок 1: Назва часу + структура ліворуч, кнопка скидання завжди праворуч */}
          <div className="flex min-h-[40px] w-full flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5 text-left">
              <Clock
                className="h-5 w-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <CardTitle className="text-lg font-bold tracking-tight sm:text-xl xl:text-2xl">
                {mode === "aspects"
                  ? activeCellMeta.tenseName
                  : mode === "conditionals"
                    ? activeCondMeta.nameUk
                    : mode === "reported"
                      ? activeReportedCategoryMeta.headerTitleUk
                      : activePassiveCategoryMeta.headerTitleUk}
              </CardTitle>

              {/* Виразний рядок структури (виділений блок прямо біля назви часу) */}
              <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border-2 border-primary/45 bg-primary/12 px-3 py-1 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary/85">
                  Структура
                </span>
                <code className="font-mono text-xs font-bold tracking-wide text-primary sm:text-sm xl:text-base">
                  {activeStructureFormula}
                </code>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetCurrent}
              className="ml-auto h-8 shrink-0 gap-1.5 px-3 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Скинути
            </Button>
          </div>

          {/* Рядок 2: Симетрична 3-колонкова панель фіксованої висоти (без зсуву графіка) */}
          <div className="grid w-full grid-cols-1 gap-3 lg:h-[160px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-3.5">
            {mode === "reported" ? (
              <div
                role="group"
                aria-label="Вибір типу непрямої мови"
                className="grid h-full min-h-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:col-span-2"
              >
                {REPORTED_CATEGORIES.map((cat) => {
                  const isSelected = reportedCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => {
                        setReportedCategory(cat.key);
                        setReportedPerspective("reported");
                      }}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative flex h-full min-h-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border px-3.5 py-2 text-center transition-colors",
                        FOCUS_RING_CLASS,
                        isSelected
                          ? "border-transparent"
                          : "border-border/70 bg-background/55 hover:border-border hover:bg-accent/20",
                      )}
                    >
                      {isSelected ? (
                        <motion.span
                          layoutId="reported-active-ring"
                          transition={getSpringTransition(false, reduceMotion)}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-xl border-2 border-primary bg-primary/[0.11] shadow-xs"
                        />
                      ) : null}
                      <div className="relative z-10 flex w-full items-center justify-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-bold tracking-tight",
                            isSelected ? "text-primary" : "text-foreground",
                          )}
                        >
                          {cat.title}
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/80 bg-background/60",
                          )}
                        >
                          {isSelected ? <Check className="h-2.5 w-2.5" /> : null}
                        </span>
                      </div>
                      <span className="relative z-10 text-xs leading-snug text-muted-foreground">
                        {cat.explanationUk}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : mode === "passive" ? (
              <div
                role="group"
                aria-label="Вибір структури пасивного стану"
                className="grid h-full min-h-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:col-span-2"
              >
                {PASSIVE_CATEGORIES.map((cat) => {
                  const isSelected = passiveCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setPassiveCategory(cat.id);
                        setPassiveFocus("passive");
                        setPassiveStep(3);
                      }}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative flex h-full min-h-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border px-3.5 py-2 text-center transition-colors",
                        FOCUS_RING_CLASS,
                        isSelected
                          ? "border-transparent"
                          : "border-border/70 bg-background/55 hover:border-border hover:bg-accent/20",
                      )}
                    >
                      {isSelected ? (
                        <motion.span
                          layoutId="passive-active-ring"
                          transition={getSpringTransition(false, reduceMotion)}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-xl border-2 border-primary bg-primary/[0.11] shadow-xs"
                        />
                      ) : null}
                      <div className="relative z-10 flex w-full items-center justify-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-bold tracking-tight",
                            isSelected ? "text-primary" : "text-foreground",
                          )}
                        >
                          {cat.labelUk}
                        </span>
                        <code className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                          {cat.formulaBadge}
                        </code>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/80 bg-background/60",
                          )}
                        >
                          {isSelected ? <Check className="h-2.5 w-2.5" /> : null}
                        </span>
                      </div>
                      <span className="relative z-10 line-clamp-1 text-xs leading-snug text-muted-foreground">
                        {cat.shortLabelUk}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {/* Ліва колонка: Типові маркери часу або режим умовних речень */}
                {mode === "aspects" ? (
                  <div
                    aria-label="Типові маркери часу"
                    className="flex h-full min-h-0 flex-col rounded-xl border border-border/60 bg-background/45 px-3.5 py-2.5 text-left"
                  >
                    <div className="mb-2 flex min-h-[18px] shrink-0 items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Типові маркери часу
                      </span>
                      {hasActiveTimeMarker ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-sky-600 dark:text-sky-300">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full bg-sky-400"
                          />
                          На графіку
                        </span>
                      ) : null}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-y-auto pr-0.5">
                      {resolvedTimeMarkers.map((marker) => (
                        <span
                          key={marker.label}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors",
                            marker.isActive
                              ? cn(
                                  MARKER_STYLES.sky.badge,
                                  "font-semibold shadow-xs ring-1 ring-sky-400/40",
                                )
                              : "border-border/60 bg-card/65 font-medium text-muted-foreground",
                          )}
                        >
                          {marker.isActive ? (
                            <span
                              aria-hidden="true"
                              className="h-1.5 w-1.5 rounded-full bg-sky-400"
                            />
                          ) : null}
                          {marker.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    aria-label="Режим умовних речень"
                    className="flex h-full min-h-0 flex-col rounded-xl border border-border/60 bg-background/45 px-3.5 py-2.5 text-left"
                  >
                    <div className="mb-2 flex min-h-[18px] shrink-0 items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Режим умови
                      </span>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 overflow-y-auto">
                      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-background/50 px-3 py-1.5 text-xs font-medium">
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
                          className="inline-flex w-fit rounded-lg border border-border/70 bg-background/50 p-0.5 text-xs"
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
                  </div>
                )}

                {/* Центральна колонка: Функції (коли вживаємо) */}
                <div
                  aria-label="Функції (коли вживаємо)"
                  className="flex h-full min-h-0 flex-col items-center rounded-xl border border-border/60 bg-background/45 px-3.5 py-2.5 text-center"
                >
                  <div className="mb-1.5 flex min-h-[18px] w-full shrink-0 items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Функції (коли вживаємо)
                    </span>
                    {mode === "aspects" && hasActiveUseCase ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full bg-emerald-400"
                        />
                        У реченні
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-h-0 w-full flex-1 overflow-y-auto">
                    {mode === "aspects" ? (
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={`uses-${activeCellKey}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
                          transition={getCrossfadeTransition(reduceMotion)}
                          className="my-auto flex w-full flex-wrap items-center justify-center gap-1.5"
                        >
                          {resolvedUseCases.map((useCase) => (
                            <span
                              key={useCase.label}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                                useCase.isActive
                                  ? "border-emerald-500/60 bg-emerald-500/20 font-semibold text-emerald-800 shadow-xs ring-1 ring-emerald-400/45 dark:text-emerald-200"
                                  : activeAspectParsed
                                    ? "border-border/60 bg-card/55 font-medium text-muted-foreground opacity-75"
                                    : "border-emerald-500/30 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300",
                              )}
                            >
                              {useCase.isActive ? (
                                <span
                                  aria-hidden="true"
                                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                                />
                              ) : null}
                              {useCase.label}
                            </span>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                    ) : (
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={`cond-uses-${activeCondKey}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
                          transition={getCrossfadeTransition(reduceMotion)}
                          className="my-auto flex w-full flex-col items-center justify-center gap-2"
                        >
                          <p className="text-xs leading-snug text-foreground/90 sm:text-sm">
                            {activeCondMeta.explanationUk}
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                                MARKER_STYLES.amber.badge,
                              )}
                            >
                              IF · {activeCondMeta.ifClauseTense}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                                MARKER_STYLES.emerald.badge,
                              )}
                            >
                              RESULT · {activeCondMeta.resultClauseTense}
                            </span>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Права колонка: Зворотний зв'язок AI (перенесено з-під інпуту) */}
            <div
              className={cn(
                "flex h-full min-h-0 flex-col rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                aiError
                  ? "border-destructive/40 bg-destructive/10"
                  : isAnalyzing
                    ? "border-primary/35 bg-primary/[0.06]"
                    : aiResult
                      ? aiResult.isCorrect
                        ? "border-emerald-500/35 bg-emerald-500/[0.07]"
                        : "border-amber-500/40 bg-amber-500/[0.07]"
                      : "border-dashed border-border/60 bg-background/30",
              )}
            >
              {isAnalyzing ? (
                <>
                  <div className="mb-1.5 flex min-h-[18px] shrink-0 items-center gap-1.5">
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin text-primary"
                      aria-hidden="true"
                    />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      Перевіряємо речення...
                    </span>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center text-center text-xs text-muted-foreground">
                    {mode === "passive"
                      ? "AI визначає пасивну конструкцію, verb pattern і кроки утворення..."
                      : mode === "reported"
                        ? "AI перевіряє узгодження часів, порядок слів і маркери..."
                        : "AI аналізує час, аспект і граматичну будову..."}
                  </div>
                </>
              ) : aiError ? (
                <div role="alert" className="flex min-h-0 flex-1 flex-col">
                  <div className="mb-1.5 flex min-h-[18px] shrink-0 items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-destructive">
                      Помилка перевірки
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiError(null)}
                      aria-label="Закрити повідомлення про помилку"
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/15",
                        FOCUS_RING_CLASS,
                      )}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center overflow-y-auto text-xs leading-snug text-destructive">
                    {aiError}
                  </div>
                </div>
              ) : aiResult ? (() => {
                const normalizeCompare = (s: string) =>
                  s.trim().replace(/[.!?]+$/, "").toLowerCase();
                const hasTransformedSentence =
                  normalizeCompare(aiResult.originalSentence) !==
                  normalizeCompare(aiResult.correctedSentence);
                return (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="mb-1.5 flex shrink-0 items-center justify-between gap-1.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      {aiResult.isCorrect ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 bg-emerald-500/15 px-2 py-0 text-[11px] text-emerald-700 dark:text-emerald-300"
                        >
                          <CheckCircle2
                            className="mr-1 h-3 w-3"
                            aria-hidden="true"
                          />
                          {hasTransformedSentence
                            ? "Правильно · Конвертовано"
                            : "Правильно"}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 bg-amber-500/15 px-2 py-0 text-[11px] text-amber-700 dark:text-amber-300"
                        >
                          <AlertTriangle
                            className="mr-1 h-3 w-3"
                            aria-hidden="true"
                          />
                          Виправлено
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className="px-2 py-0 font-mono text-[11px]"
                      >
                        {aiResult.detectedTitle}
                      </Badge>
                      {aiResult.isStateVerb &&
                      aiResult.detectedMode === "aspects" ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-300"
                        >
                          State verb
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => applyAIResultToGraph(aiResult)}
                        aria-label={
                          aiResult.detectedMode === "passive" ||
                          aiResult.detectedMode === "reported"
                            ? "Показати розбір на дошці"
                            : "Показати на графіку"
                        }
                      >
                        {aiResult.detectedMode === "passive" ||
                        aiResult.detectedMode === "reported"
                          ? "До розбору"
                          : "На графік"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setAiResult(null)}
                        aria-label="Сховати результат перевірки"
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground",
                          FOCUS_RING_CLASS,
                        )}
                        title="Сховати"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                    {!aiResult.isCorrect ? (
                      <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1 text-xs">
                        <span className="text-muted-foreground line-through">
                          {aiResult.originalSentence}
                        </span>{" "}
                        <span
                          className="text-muted-foreground"
                          aria-hidden="true"
                        >
                          →
                        </span>{" "}
                        <span className="font-semibold text-foreground">
                          {aiResult.correctedSentence}
                        </span>
                      </div>
                    ) : hasTransformedSentence ? (
                      <div className="rounded-lg border border-emerald-500/30 bg-background/65 px-2.5 py-1 text-xs">
                        <span className="text-muted-foreground">
                          {aiResult.originalSentence}
                        </span>{" "}
                        <span
                          className="text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        >
                          →
                        </span>{" "}
                        <span className="font-semibold text-foreground">
                          {aiResult.correctedSentence}
                        </span>
                      </div>
                    ) : null}
                    <p className="text-xs leading-snug text-muted-foreground">
                      {aiResult.explanationUk}
                    </p>
                  </div>
                </div>
                );
              })() : (
                <>
                  <div className="mb-1.5 flex min-h-[18px] shrink-0 items-center gap-1.5">
                    <Sparkles
                      className="h-3.5 w-3.5 text-primary/80"
                      aria-hidden="true"
                    />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Зворотний зв&apos;язок AI
                    </span>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center px-2 text-center text-xs leading-relaxed text-muted-foreground/85">
                    Введіть речення у поле вище та натисніть «Перевірити» — тут
                    з’явиться граматичний розбір.
                  </div>
                </>
              )}
            </div>
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
                        "relative flex flex-col items-center justify-between gap-1.5 overflow-hidden rounded-xl border px-3.5 py-3 text-center transition-colors",
                        FOCUS_RING_CLASS,
                        isBlockedByStateVerb
                          ? "cursor-not-allowed border-amber-500/25 bg-amber-500/[0.04] opacity-55"
                          : isSelected
                            ? "border-transparent"
                            : "border-border/70 bg-background/55 hover:border-border hover:bg-accent/20",
                      )}
                    >
                      {isSelected && !isBlockedByStateVerb ? (
                        <motion.span
                          layoutId="aspect-active-ring"
                          transition={getSpringTransition(false, reduceMotion)}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-xl border-2 border-primary bg-primary/[0.11] shadow-xs"
                        />
                      ) : null}
                      <div className="relative z-10 flex w-full items-center justify-center gap-2">
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
                      <span className="relative z-10 text-xs leading-snug text-muted-foreground">
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
                        onMouseDown={(e) => e.preventDefault()}
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

                {/* Плашка на графіку: відцентрована рівно над своєю колонкою */}
                <motion.div
                  initial={false}
                  animate={{ x: `${colCenterPct - 50}%` }}
                  transition={aspectSpring}
                  className="pointer-events-none absolute inset-x-0 top-[54px] z-20 flex justify-center will-change-transform"
                >
                  <div className="w-max max-w-[29%] rounded-xl border border-emerald-500/35 bg-card/95 px-3.5 py-2.5 text-center shadow-xs backdrop-blur-xs sm:max-w-[30%]">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`bubble-${activeCellKey}-${activeAspectParsed?.plainText ?? "default"}`}
                        initial={reduceMotion ? false : { opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -2 }}
                        transition={getCrossfadeTransition(reduceMotion)}
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
                    </AnimatePresence>
                  </div>
                </motion.div>

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

                {/* Анімовані візуальні індикатори аспектів на GPU transform */}
                <AnimatePresence initial={false}>
                  {isPerfect ? (
                    <motion.div
                      key="perfect-cutoff"
                      initial={
                        reduceMotion
                          ? false
                          : { opacity: 0, x: `${cutoffPct - 50}%` }
                      }
                      animate={{ opacity: 1, x: `${cutoffPct - 50}%` }}
                      exit={reduceMotion ? undefined : { opacity: 0 }}
                      transition={{
                        ...aspectSpring,
                        opacity: getCrossfadeTransition(reduceMotion),
                      }}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-[172px] z-10 flex justify-center will-change-transform"
                    >
                      <div className="h-[94px] w-0.5 bg-sky-500" />
                    </motion.div>
                  ) : null}

                  {isPerfect ? (
                    <motion.div
                      key="perfect-arrow"
                      initial={
                        reduceMotion
                          ? false
                          : {
                              opacity: 0,
                              x: `${(actionPct + cutoffPct) / 2 - 50}%`,
                            }
                      }
                      animate={{
                        opacity: 1,
                        x: `${(actionPct + cutoffPct) / 2 - 50}%`,
                      }}
                      exit={reduceMotion ? undefined : { opacity: 0 }}
                      transition={{
                        ...aspectSpring,
                        opacity: getCrossfadeTransition(reduceMotion),
                      }}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-[160px] z-10 flex justify-center will-change-transform"
                    >
                      <div
                        className="h-[56px]"
                        style={{ width: `${cutoffPct - actionPct}%` }}
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
                      </div>
                    </motion.div>
                  ) : null}

                  {isPerfect ? (
                    <motion.div
                      key="perfect-badge"
                      initial={
                        reduceMotion
                          ? false
                          : {
                              opacity: 0,
                              scale: 0.94,
                              x: `${(cutoffPct + actionPct) / 2 - 50}%`,
                            }
                      }
                      animate={{
                        opacity: 1,
                        scale: 1,
                        x: `${(cutoffPct + actionPct) / 2 - 50}%`,
                      }}
                      exit={
                        reduceMotion ? undefined : { opacity: 0, scale: 0.94 }
                      }
                      transition={{
                        ...aspectSpring,
                        opacity: getCrossfadeTransition(reduceMotion),
                        scale: getCrossfadeTransition(reduceMotion),
                      }}
                      className="pointer-events-none absolute inset-x-0 top-[148px] z-20 flex justify-center will-change-transform"
                    >
                      <span className="rounded-full border border-sky-500/40 bg-card/95 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-sky-700 shadow-xs dark:text-sky-300">
                        {isContinuous ? 'тривало "ДО"' : 'завершено "ДО"'}
                      </span>
                    </motion.div>
                  ) : null}

                  {effectiveAspect === "simple" ? (
                    <motion.div
                      key="aspect-simple"
                      initial={
                        reduceMotion
                          ? false
                          : {
                              opacity: 0,
                              scale: 0.94,
                              x: `${actionPct - 50}%`,
                            }
                      }
                      animate={{
                        opacity: 1,
                        scale: 1,
                        x: `${actionPct - 50}%`,
                      }}
                      exit={
                        reduceMotion ? undefined : { opacity: 0, scale: 0.94 }
                      }
                      transition={{
                        ...aspectSpring,
                        opacity: getCrossfadeTransition(reduceMotion),
                        scale: getCrossfadeTransition(reduceMotion),
                      }}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-[224px] z-10 flex -translate-y-1/2 justify-center will-change-transform"
                    >
                      <div className="flex items-center gap-5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/45" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/75" />
                        <span className="w-14" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/75" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/45" />
                      </div>
                    </motion.div>
                  ) : null}

                  {effectiveAspect === "continuous" ? (
                    <motion.div
                      key="aspect-continuous"
                      initial={
                        reduceMotion
                          ? false
                          : {
                              opacity: 0,
                              scale: 0.94,
                              x: `${actionPct - 50}%`,
                            }
                      }
                      animate={{
                        opacity: 1,
                        scale: 1,
                        x: `${actionPct - 50}%`,
                      }}
                      exit={
                        reduceMotion ? undefined : { opacity: 0, scale: 0.94 }
                      }
                      transition={{
                        ...aspectSpring,
                        opacity: getCrossfadeTransition(reduceMotion),
                        scale: getCrossfadeTransition(reduceMotion),
                      }}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-[224px] z-10 flex -translate-y-1/2 justify-center will-change-transform"
                    >
                      <div className="flex h-11 w-44 items-center justify-between rounded-full border border-emerald-500/45 bg-emerald-500/15 px-3.5">
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          〰
                        </span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          〰
                        </span>
                      </div>
                    </motion.div>
                  ) : null}

                  {effectiveAspect === "perfect_continuous" ? (
                    <motion.div
                      key="aspect-perfect-continuous"
                      initial={
                        reduceMotion
                          ? false
                          : {
                              opacity: 0,
                              scale: 0.94,
                              x: `${(actionPct + cutoffPct) / 2 - 50}%`,
                            }
                      }
                      animate={{
                        opacity: 1,
                        scale: 1,
                        x: `${(actionPct + cutoffPct) / 2 - 50}%`,
                      }}
                      exit={
                        reduceMotion ? undefined : { opacity: 0, scale: 0.94 }
                      }
                      transition={{
                        ...aspectSpring,
                        opacity: getCrossfadeTransition(reduceMotion),
                        scale: getCrossfadeTransition(reduceMotion),
                      }}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-[224px] z-10 flex -translate-y-1/2 justify-center will-change-transform"
                    >
                      <div
                        className="flex h-10 items-center justify-center rounded-l-full border border-r-0 border-emerald-500/45 bg-emerald-500/15 pl-8 pr-2"
                        style={{ width: `${cutoffPct - actionPct}%` }}
                      >
                        <span className="text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-300">
                          〰〰
                        </span>
                      </div>
                    </motion.div>
                  ) : null}

                  {isPerfect && aspectTime !== "present" ? (
                    <motion.div
                      key="cutoff-label"
                      initial={
                        reduceMotion
                          ? false
                          : { opacity: 0, x: `${cutoffPct - 50}%` }
                      }
                      animate={{ opacity: 1, x: `${cutoffPct - 50}%` }}
                      exit={reduceMotion ? undefined : { opacity: 0 }}
                      transition={{
                        ...aspectSpring,
                        opacity: getCrossfadeTransition(reduceMotion),
                      }}
                      className="pointer-events-none absolute inset-x-0 top-[276px] z-20 flex justify-center will-change-transform"
                    >
                      <span className="rounded-md border border-sky-500/45 bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-sky-700 dark:text-sky-300">
                        Межа &quot;ДО&quot;
                      </span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {/* Перетягуваний та клавіатурно-доступний маркер ✕ */}
                <motion.div
                  initial={false}
                  animate={{ x: `${actionPct - 50}%` }}
                  transition={aspectSpring}
                  className="pointer-events-none absolute inset-x-0 top-[224px] z-20 flex -translate-y-1/2 justify-center will-change-transform"
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
                      "pointer-events-auto flex h-10 w-10 touch-none select-none items-center justify-center rounded-full border-2 text-base font-black shadow-md ring-4 transition-transform hover:scale-110",
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

                {/* Нижній підпис NOW на осі */}
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

                {/* Плашка IF (відцентрована рівно над своєю колонкою) */}
                <motion.div
                  initial={false}
                  animate={{ x: `${condIfPct - 50}%` }}
                  transition={condIfSpring}
                  className="pointer-events-none absolute inset-x-0 top-[62px] z-10 flex justify-center will-change-transform"
                >
                  <div className="w-max max-w-[29%] rounded-xl border border-amber-500/35 bg-card/95 px-3 py-2 text-center shadow-xs backdrop-blur-xs sm:max-w-[30%]">
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
                  </div>
                </motion.div>

                {/* Перетягуваний та клавіатурно-доступний маркер IF ✕ */}
                <motion.div
                  initial={false}
                  animate={{ x: `${condIfPct - 50}%` }}
                  transition={condIfSpring}
                  className="pointer-events-none absolute inset-x-0 top-[152px] z-20 flex -translate-y-1/2 justify-center will-change-transform"
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
                      "pointer-events-auto flex h-9 w-9 touch-none select-none items-center justify-center rounded-full border-2 text-base font-black shadow-md ring-4 transition-transform hover:scale-110",
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

                {/* Плашка RESULT (відцентрована рівно над своєю колонкою) */}
                <motion.div
                  initial={false}
                  animate={{ x: `${condResultPct - 50}%` }}
                  transition={condResultSpring}
                  className="pointer-events-none absolute inset-x-0 top-[212px] z-10 flex justify-center will-change-transform"
                >
                  <div className="w-max max-w-[29%] rounded-xl border border-emerald-500/35 bg-card/95 px-3 py-2 text-center shadow-xs backdrop-blur-xs sm:max-w-[30%]">
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
                  </div>
                </motion.div>

                {/* Перетягуваний та клавіатурно-доступний маркер RESULT ✕ */}
                <motion.div
                  initial={false}
                  animate={{ x: `${condResultPct - 50}%` }}
                  transition={condResultSpring}
                  className="pointer-events-none absolute inset-x-0 top-[300px] z-20 flex -translate-y-1/2 justify-center will-change-transform"
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
                      "pointer-events-auto flex h-9 w-9 touch-none select-none items-center justify-center rounded-full border-2 text-base font-black shadow-md ring-4 transition-transform hover:scale-110",
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

          {/* ════════════════════════════════════════════════════════════ */}
          {/* РЕЖИМ 3: НЕПРЯМА МОВА (REPORTED SPEECH)                      */}
          {/* ════════════════════════════════════════════════════════════ */}
          {mode === "reported" ? (
            <div className="space-y-4">
              {/* Смуга вибору правила (з таблиць VERB FORMS / QUESTIONS / IMPERATIVES) */}
              <div className="flex min-h-[38px] flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-1.5">
                {customReportedSentence ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge
                        variant="secondary"
                        className="border border-primary/30 bg-primary/10 text-primary"
                      >
                        {customReportedSentence.labelUk}
                      </Badge>
                      <span className="text-muted-foreground">
                        Ваше речення адаптовано під 4 типи непрямої мови
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomReportedSentence(null)}
                      className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      Повернути табличні приклади
                    </Button>
                  </>
                ) : (
                  <div
                    role="group"
                    aria-label="Приклади правил перетворення"
                    className="flex flex-wrap items-center gap-1.5"
                  >
                    {reportedCategoryPresets.map((preset) => {
                      const isPresetActive =
                        activeReportedPreset.id === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          aria-pressed={isPresetActive}
                          onClick={() => {
                            setSelectedReportedPresetIds((prev) => ({
                              ...prev,
                              [reportedCategory]: preset.id,
                            }));
                            setReportedPerspective("reported");
                          }}
                          className={cn(
                            "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                            FOCUS_RING_CLASS,
                            isPresetActive
                              ? "border-primary bg-primary text-primary-foreground shadow-xs"
                              : "border-border/60 bg-card/70 text-muted-foreground hover:border-border hover:text-foreground",
                          )}
                        >
                          {preset.pillLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Інтерактивна дошка: Пряма ↔ Непряма мова + Таймлайн зсуву часу */}
              <div className="space-y-3 rounded-xl border border-border/70 bg-background/55 p-4">
                {/* Частина A: Порівняння Direct Speech → Reported Speech */}
                <div className="grid min-h-[116px] gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                  <button
                    type="button"
                    aria-pressed={reportedPerspective === "direct"}
                    onClick={() => setReportedPerspective("direct")}
                    className={cn(
                      "flex flex-col items-start justify-between gap-2 rounded-xl border p-3.5 text-left transition-all",
                      FOCUS_RING_CLASS,
                      reportedPerspective === "direct"
                        ? "border-sky-500/60 bg-sky-500/[0.08] ring-1 ring-sky-400/40"
                        : "border-border/70 bg-card/75 hover:border-border",
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        1. Пряма мова (Direct)
                      </span>
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider",
                          MARKER_STYLES.sky.badge,
                        )}
                      >
                        {activeReportedEntry.directBadge}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-foreground sm:text-base">
                      <HighlightedSegments
                        segments={directParsed.segments}
                        badgeClassName="py-0"
                      />
                    </p>
                  </button>

                  <div className="flex flex-col items-center justify-center gap-1 px-1 text-center">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary">
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <span className="max-w-[155px] rounded-full border border-border/60 bg-card/85 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {activeReportedEntry.bridgeLabelUk}
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-pressed={reportedPerspective === "reported"}
                    onClick={() => setReportedPerspective("reported")}
                    className={cn(
                      "flex flex-col items-start justify-between gap-2 rounded-xl border p-3.5 text-left transition-all",
                      FOCUS_RING_CLASS,
                      reportedPerspective === "reported"
                        ? "border-emerald-500/60 bg-emerald-500/[0.08] ring-1 ring-emerald-400/40"
                        : "border-border/70 bg-card/75 hover:border-border",
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        2. Непряма мова (Reported)
                      </span>
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider",
                          MARKER_STYLES.emerald.badge,
                        )}
                      >
                        {activeReportedEntry.reportedBadge}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-foreground sm:text-base">
                      <HighlightedSegments
                        segments={reportedParsed.segments}
                        badgeClassName="py-0"
                      />
                    </p>
                  </button>
                </div>

                {/* Частина B: Вісь зсуву часу (Backshift Timeline) */}
                <div
                  ref={reportedTrackRef}
                  onPointerMove={handleReportedPointerMove}
                  onPointerUp={() => setDraggingReportedMarker(false)}
                  onPointerCancel={() => setDraggingReportedMarker(false)}
                  className="relative h-[138px] w-full select-none overflow-hidden rounded-xl border border-border/70 bg-card/45"
                >
                  <div className="absolute inset-0 grid grid-cols-3 divide-x divide-border/40">
                    {REPORTED_TIME_COLUMNS.map((col) => {
                      const isDirectHere =
                        activeReportedEntry.directSlot === col.slot;
                      const isReportedHere =
                        activeReportedEntry.reportedSlot === col.slot;
                      const isInteractive = isDirectHere || isReportedHere;
                      const isColFocused = reportedActiveSlot === col.slot;

                      return (
                        <button
                          key={col.slot}
                          type="button"
                          disabled={!isInteractive}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (isDirectHere && isReportedHere) {
                              setReportedPerspective((prev) =>
                                prev === "direct" ? "reported" : "direct",
                              );
                            } else if (isReportedHere) {
                              setReportedPerspective("reported");
                            } else if (isDirectHere) {
                              setReportedPerspective("direct");
                            }
                          }}
                          className={cn(
                            "flex h-full flex-col items-center pt-2.5 text-center transition-colors",
                            FOCUS_RING_INSET_CLASS,
                            isColFocused
                              ? "bg-primary/[0.05]"
                              : isInteractive
                                ? "hover:bg-muted/20"
                                : "opacity-55",
                          )}
                        >
                          <span
                            className={cn(
                              "px-2 text-[11px] font-bold tracking-tight sm:text-xs",
                              isColFocused
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          >
                            {col.labelUk}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Горизонтальна вісь часу */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-[6%] top-[90px] z-10 h-0.5 -translate-y-1/2 bg-border"
                  />

                  {REPORTED_TIME_COLUMNS.map((col) => (
                    <span
                      key={`rep-tick-${col.slot}`}
                      aria-hidden="true"
                      className="pointer-events-none absolute top-[90px] z-10 block h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border"
                      style={{ left: `${getColumnCenterPercent(col.slot)}%` }}
                    />
                  ))}

                  {/* Точка походження прямої мови */}
                  {activeReportedEntry.directSlot !==
                  activeReportedEntry.reportedSlot ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute top-[90px] z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                      style={{ left: `${reportedDirectPct}%` }}
                    >
                      <span className="h-6 w-6 rounded-full border-2 border-dashed border-sky-400/70 bg-sky-500/10" />
                    </div>
                  ) : null}

                  {/* Дуга зсуву часу назад (Backshift) або статична підказка */}
                  <AnimatePresence initial={false}>
                    {activeReportedEntry.hasBackshift &&
                    activeReportedEntry.directSlot !==
                      activeReportedEntry.reportedSlot ? (
                      <motion.div
                        key={`rep-curve-${activeReportedEntry.directSlot}-${activeReportedEntry.reportedSlot}`}
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        transition={getCrossfadeTransition(reduceMotion)}
                        aria-hidden="true"
                        className="pointer-events-none absolute top-[40px] z-10 h-[50px]"
                        style={{
                          left: `${Math.min(reportedDirectPct, reportedTargetPct)}%`,
                          width: `${Math.abs(reportedDirectPct - reportedTargetPct)}%`,
                        }}
                      >
                        <svg
                          viewBox="0 0 200 50"
                          preserveAspectRatio="none"
                          className="h-full w-full overflow-visible"
                        >
                          <defs>
                            <marker
                              id="reported-backshift-arrow"
                              markerWidth="8"
                              markerHeight="8"
                              refX="6"
                              refY="4"
                              orient="auto"
                            >
                              <path d="M0,0 L8,4 L0,8 Z" fill="#34d399" />
                            </marker>
                          </defs>
                          <path
                            d="M 196 42 Q 100 -4 6 42"
                            fill="none"
                            stroke="#34d399"
                            strokeWidth="2.5"
                            strokeDasharray="6 4"
                            vectorEffect="non-scaling-stroke"
                            markerEnd="url(#reported-backshift-arrow)"
                          />
                        </svg>
                        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-full border border-emerald-500/40 bg-card/95 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-emerald-700 shadow-xs dark:text-emerald-300">
                          ← Backshift (крок назад)
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="rep-static-note"
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        transition={getCrossfadeTransition(reduceMotion)}
                        className="pointer-events-none absolute inset-x-0 top-[42px] z-10 flex justify-center"
                      >
                        <span className="rounded-full border border-border/70 bg-card/90 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground shadow-xs">
                          Час дієслова не зсувається
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Перетягуваний та клавіатурний маркер перспективи ✕ */}
                  <motion.div
                    initial={false}
                    animate={{ x: `${reportedMarkerPct - 50}%` }}
                    transition={reportedSpring}
                    className="pointer-events-none absolute inset-x-0 top-[90px] z-20 flex -translate-y-1/2 justify-center will-change-transform"
                  >
                    <button
                      type="button"
                      role="slider"
                      aria-label="Перспектива: пряма чи непряма мова"
                      aria-valuemin={0}
                      aria-valuemax={2}
                      aria-valuenow={reportedActiveSlot}
                      aria-valuetext={
                        reportedPerspective === "direct"
                          ? "Пряма мова (Direct Speech)"
                          : "Непряма мова (Reported Speech)"
                      }
                      onPointerDown={handleReportedPointerDown}
                      onKeyDown={handleReportedMarkerKeyDown}
                      className={cn(
                        "pointer-events-auto flex h-9 w-9 touch-none select-none items-center justify-center rounded-full border-2 text-base font-black shadow-md ring-4 transition-transform hover:scale-110",
                        FOCUS_RING_CLASS,
                        reportedPerspective === "direct"
                          ? cn(
                              MARKER_STYLES.sky.markerBg,
                              MARKER_STYLES.sky.markerBorder,
                              MARKER_STYLES.sky.ring,
                            )
                          : cn(
                              MARKER_STYLES.emerald.markerBg,
                              MARKER_STYLES.emerald.markerBorder,
                              MARKER_STYLES.emerald.ring,
                            ),
                        draggingReportedMarker
                          ? "scale-115 cursor-grabbing shadow-lg"
                          : "cursor-grab",
                      )}
                    >
                      ✕
                    </button>
                  </motion.div>

                  {/* Підписи під віссю */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-around text-[10px] font-semibold text-muted-foreground/85">
                    <span>Давніший факт (had + V3)</span>
                    <span>Момент переказу (said / asked)</span>
                    <span>Озвучення вживу (&quot;Direct&quot;)</span>
                  </div>
                </div>

                {/* Частина C: Підсвічені компоненти перетворення та зміна перспективи часу/місця */}
                <div
                  aria-label="Активні компоненти перетворення"
                  className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5"
                >
                  {resolvedReportedComponents.map((comp) => {
                    const dotColorClass =
                      comp.color === "emerald"
                        ? "bg-emerald-400"
                        : comp.color === "amber"
                          ? "bg-amber-400"
                          : "bg-sky-400";
                    return (
                      <span
                        key={comp.key}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                          comp.isActive
                            ? cn(
                                MARKER_STYLES[comp.color].badge,
                                "font-semibold shadow-xs",
                              )
                            : "border-border/60 bg-card/55 font-medium text-muted-foreground opacity-55",
                        )}
                      >
                        {comp.isActive ? (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              dotColorClass,
                            )}
                          />
                        ) : null}
                        {comp.label}
                      </span>
                    );
                  })}
                  {resolvedReportedExpressions
                    .filter((expr) => expr.isActive)
                    .map((expr) => (
                      <span
                        key={expr.label}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-xs",
                          MARKER_STYLES.sky.badge,
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-sky-400"
                        />
                        {expr.label}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          ) : null}

          {mode === "passive" ? (
            <div className="space-y-4">
              {/* Підтипи / приклади пасивного стану */}
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {customPassiveSentence ? (
                  <button
                    type="button"
                    onClick={() => setCustomPassiveSentence(null)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary shadow-xs transition-colors hover:bg-primary/20",
                      FOCUS_RING_CLASS,
                    )}
                    title="Натисніть, щоб повернутися до вбудованих прикладів"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Ваше речення: {customPassiveSentence.labelUk}
                    <X className="ml-0.5 h-3 w-3 opacity-75" aria-hidden="true" />
                  </button>
                ) : null}
                {passiveCategoryPresets.map((preset) => {
                  const isActivePreset =
                    !customPassiveSentence && activePassivePreset.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setCustomPassiveSentence(null);
                        setSelectedPassivePresetIds((prev) => ({
                          ...prev,
                          [passiveCategory]: preset.id,
                        }));
                        setPassiveFocus("passive");
                        setPassiveStep(3);
                      }}
                      aria-pressed={isActivePreset}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                        FOCUS_RING_CLASS,
                        isActivePreset
                          ? "border-primary/55 bg-primary/15 font-semibold text-primary shadow-xs"
                          : "border-border/70 bg-background/55 text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {activePassiveCategoryMeta.modeKind === "conversion" ? (
                <>
                  {activePassiveEntry.verbPatternExplanationUk ? (
                    <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.06] px-4 py-2.5 shadow-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Layers
                          className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          Особливість дієслова
                        </span>
                        {activePassiveEntry.verbPatternTitle ? (
                          <code className="rounded-md border border-amber-500/40 bg-background/80 px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                            {activePassiveEntry.verbPatternTitle}
                          </code>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-foreground/90 sm:text-sm">
                        {activePassiveEntry.verbPatternExplanationUk}
                      </p>
                    </div>
                  ) : null}
                  {/* Пряма трансформація Active ↔ Passive */}
                  <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                    {/* Картка 1: Активний стан */}
                    <button
                      type="button"
                      onClick={() => setPassiveFocus("active")}
                      className={cn(
                        "flex h-full flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-all",
                        FOCUS_RING_CLASS,
                        passiveFocus === "active"
                          ? "border-amber-500/55 bg-amber-500/[0.06] shadow-sm ring-1 ring-amber-500/20"
                          : "border-border/65 bg-background/45 opacity-80 hover:opacity-100",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          1. Активний стан (Active Voice)
                        </span>
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            MARKER_STYLES.amber.badge,
                          )}
                        >
                          Фокус на виконавці
                        </span>
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={`pa-${passiveCategory}-${activePassiveEntry.activeTagged}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="text-base font-medium leading-relaxed text-foreground sm:text-lg"
                        >
                          <HighlightedSegments
                            segments={passiveActiveParsed.segments}
                          />
                        </motion.p>
                      </AnimatePresence>
                      <div className="text-xs text-muted-foreground">
                        Підмет виконує дію над об&apos;єктом.
                      </div>
                    </button>

                    {/* Центральний міст трансформації */}
                    <div className="flex flex-col items-center justify-center gap-1.5 px-1 py-1">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/12 text-primary shadow-xs">
                        <ArrowRight
                          className="h-4 w-4 rotate-90 lg:rotate-0"
                          aria-hidden="true"
                        />
                      </div>
                      <span className="max-w-[190px] rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-center text-[11px] font-semibold leading-tight text-muted-foreground">
                        {activePassiveEntry.bridgeLabel}
                      </span>
                    </div>

                    {/* Картка 2: Пасивний стан */}
                    <button
                      type="button"
                      onClick={() => setPassiveFocus("passive")}
                      className={cn(
                        "flex h-full flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-all",
                        FOCUS_RING_CLASS,
                        passiveFocus === "passive"
                          ? "border-emerald-500/55 bg-emerald-500/[0.06] shadow-sm ring-1 ring-emerald-500/20"
                          : "border-border/65 bg-background/45 opacity-80 hover:opacity-100",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          2. Пасивний стан (Passive Voice)
                        </span>
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide",
                            MARKER_STYLES.emerald.badge,
                          )}
                        >
                          {activePassiveEntry.badgeText}
                        </span>
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={`pp-${passiveCategory}-${activePassiveEntry.passiveTagged}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="text-base font-medium leading-relaxed text-foreground sm:text-lg"
                        >
                          <HighlightedSegments
                            segments={passiveResultParsed.segments}
                          />
                        </motion.p>
                      </AnimatePresence>
                      {passiveAltParsed ? (
                        <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.06] px-3 py-2 text-xs">
                          <span className="font-bold text-sky-700 dark:text-sky-300">
                            Альтернативний варіант:{" "}
                          </span>
                          <span className="text-foreground">
                            <HighlightedSegments
                              segments={passiveAltParsed.segments}
                              badgeClassName="text-[11px] px-1 py-0"
                            />
                          </span>
                          {activePassiveEntry.altPassiveNoteUk ? (
                            <p className="mt-1 leading-snug text-muted-foreground">
                              {activePassiveEntry.altPassiveNoteUk}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          Об&apos;єкт стає підметом, у фокусі — сама дія або результат.
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Пояснення функції */}
                  <div className="flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3.5 py-1 text-xs font-medium text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                      />
                      {activePassiveEntry.functionUk}
                    </span>
                  </div>

                  {/* Інтерактивний 2-позиційний слайдер фокусу Active ↔ Passive */}
                  <div
                    ref={passiveTrackRef}
                    onPointerMove={handlePassivePointerMove}
                    onPointerUp={() => setDraggingPassiveMarker(false)}
                    onPointerCancel={() => setDraggingPassiveMarker(false)}
                    className="relative h-[112px] select-none overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-background/65 via-background/35 to-background/65 touch-none"
                  >
                    <div className="grid h-full grid-cols-2 divide-x divide-border/40">
                      <button
                        type="button"
                        onClick={() => setPassiveFocus("active")}
                        className={cn(
                          "flex flex-col items-center justify-start pt-3 text-center transition-colors",
                          FOCUS_RING_CLASS,
                          passiveFocus === "active"
                            ? "bg-amber-500/[0.06]"
                            : "hover:bg-accent/15",
                        )}
                      >
                        <span
                          className={cn(
                            "text-xs font-bold uppercase tracking-wider",
                            passiveFocus === "active"
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-muted-foreground",
                          )}
                        >
                          Акцент на виконавці · Active
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPassiveFocus("passive")}
                        className={cn(
                          "flex flex-col items-center justify-start pt-3 text-center transition-colors",
                          FOCUS_RING_CLASS,
                          passiveFocus === "passive"
                            ? "bg-emerald-500/[0.06]"
                            : "hover:bg-accent/15",
                        )}
                      >
                        <span
                          className={cn(
                            "text-xs font-bold uppercase tracking-wider",
                            passiveFocus === "passive"
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-muted-foreground",
                          )}
                        >
                          Акцент на об&apos;єкті й дії · Passive
                        </span>
                      </button>
                    </div>

                    {/* Горизонтальна вісь */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-[25%] top-[62%] h-0.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-amber-500/50 via-primary/45 to-emerald-500/60"
                    />

                    {/* Рухомий GPU-маркер */}
                    <motion.div
                      animate={{
                        x: passiveFocus === "active" ? "-25%" : "25%",
                      }}
                      transition={passiveSpring}
                      className="pointer-events-none absolute inset-0"
                    >
                      <div className="absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2">
                        <button
                          type="button"
                          role="slider"
                          aria-label="Перемикач фокусу: Активний або Пасивний стан"
                          aria-valuemin={0}
                          aria-valuemax={1}
                          aria-valuenow={passiveFocus === "active" ? 0 : 1}
                          aria-valuetext={
                            passiveFocus === "active"
                              ? "Активний стан"
                              : "Пасивний стан"
                          }
                          onPointerDown={handlePassivePointerDown}
                          onKeyDown={handlePassiveMarkerKeyDown}
                          className={cn(
                            "pointer-events-auto flex h-9 w-9 cursor-grab items-center justify-center rounded-full border-2 shadow-md transition-transform active:scale-95 active:cursor-grabbing",
                            FOCUS_RING_CLASS,
                            passiveFocus === "active"
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-emerald-500 bg-emerald-500 text-white",
                          )}
                        >
                          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </>
              ) : (
                <>
                  {/* Пояснення Verb Pattern для дієслова з речення */}
                  <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.06] px-4 py-3.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Layers
                          className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          Verb Pattern · Керування дієслова
                        </span>
                        {activePassiveEntry.verbPatternTitle ? (
                          <code className="rounded-md border border-amber-500/40 bg-background/80 px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                            {activePassiveEntry.verbPatternTitle}
                          </code>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold",
                          MARKER_STYLES.emerald.badge,
                        )}
                      >
                        {passiveCategory === "infinitive"
                          ? "Infinitive: (not) to be + V3"
                          : "Gerund: (not) being + V3"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                      {activePassiveEntry.verbPatternExplanationUk ??
                        activePassiveEntry.functionUk}
                    </p>
                    {activePassiveEntry.ukThoughtCue ? (
                      <div className="mt-2.5 inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-background/75 px-2.5 py-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground/80">
                          Думка українською:
                        </span>
                        <span className="italic">
                          «{activePassiveEntry.ukThoughtCue}»
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Покрокове виведення: Крок 1 → Крок 2 (з викресленням) → Крок 3 */}
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    {/* Крок 1 */}
                    <button
                      type="button"
                      onClick={() => setPassiveStep(1)}
                      className={cn(
                        "flex flex-col justify-between gap-2.5 rounded-2xl border p-4 text-left transition-all",
                        FOCUS_RING_CLASS,
                        passiveStep === 1
                          ? "border-amber-500/60 bg-amber-500/[0.06] shadow-sm ring-1 ring-amber-500/20"
                          : "border-border/65 bg-background/45 hover:border-border",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          Крок 1 · Повний актив
                        </span>
                        <span className="rounded border border-border/60 bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          Active Clause
                        </span>
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={`pstep1-${passiveCategory}-${activePassiveEntry.activeTagged}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="text-sm font-medium leading-relaxed text-foreground sm:text-base"
                        >
                          <HighlightedSegments
                            segments={passiveActiveParsed.segments}
                          />
                        </motion.p>
                      </AnimatePresence>
                      <p className="text-xs leading-snug text-muted-foreground">
                        Дослівна розгорнута думка з підрядним реченням і загальним виконавцем.
                      </p>
                    </button>

                    {/* Крок 2 */}
                    <button
                      type="button"
                      onClick={() => setPassiveStep(2)}
                      className={cn(
                        "flex flex-col justify-between gap-2.5 rounded-2xl border p-4 text-left transition-all",
                        FOCUS_RING_CLASS,
                        passiveStep === 2
                          ? "border-sky-500/60 bg-sky-500/[0.06] shadow-sm ring-1 ring-sky-500/20"
                          : "border-border/65 bg-background/45 hover:border-border",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                          Крок 2 · Скорочення пасиву
                        </span>
                        <span className="rounded border border-rose-500/35 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                          Викидаємо зайве
                        </span>
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={`pstep2-${passiveCategory}-${activePassiveEntry.bridgeStepTagged ?? activePassiveEntry.passiveTagged}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="text-sm font-medium leading-relaxed text-foreground sm:text-base"
                        >
                          <HighlightedSegments
                            segments={
                              (passiveBridgeParsed ?? passiveResultParsed)
                                .segments
                            }
                          />
                        </motion.p>
                      </AnimatePresence>
                      <p className="text-xs leading-snug text-muted-foreground">
                        {activePassiveEntry.step2NoteUk ??
                          "Прибираємо сполучник підрядного, повтор підмета та зайве by + агент, зберігаючи прийменник."}
                      </p>
                    </button>

                    {/* Крок 3 */}
                    <button
                      type="button"
                      onClick={() => setPassiveStep(3)}
                      className={cn(
                        "flex flex-col justify-between gap-2.5 rounded-2xl border p-4 text-left transition-all",
                        FOCUS_RING_CLASS,
                        passiveStep === 3
                          ? "border-emerald-500/60 bg-emerald-500/[0.07] shadow-sm ring-1 ring-emerald-500/25"
                          : "border-border/65 bg-background/45 hover:border-border",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          Крок 3 · Природний результат
                        </span>
                        <span
                          className={cn(
                            "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold",
                            MARKER_STYLES.emerald.badge,
                          )}
                        >
                          {activePassiveEntry.badgeText}
                        </span>
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={`pstep3-${passiveCategory}-${activePassiveEntry.passiveTagged}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="text-sm font-medium leading-relaxed text-foreground sm:text-base"
                        >
                          <HighlightedSegments
                            segments={passiveResultParsed.segments}
                          />
                        </motion.p>
                      </AnimatePresence>
                      <p className="text-xs leading-snug text-muted-foreground">
                        {activePassiveEntry.step3NoteUk ??
                          "Ставимо пасив у форму, яку вимагає керуюче слово (to be + V3 або being + V3)."}
                      </p>
                    </button>
                  </div>

                  {/* Інтерактивний 3-кроковий трек виведення форми */}
                  <div
                    ref={passiveTrackRef}
                    onPointerMove={handlePassivePointerMove}
                    onPointerUp={() => setDraggingPassiveMarker(false)}
                    onPointerCancel={() => setDraggingPassiveMarker(false)}
                    className="relative h-[112px] select-none overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-background/65 via-background/35 to-background/65 touch-none"
                  >
                    <div className="grid h-full grid-cols-3 divide-x divide-border/40">
                      {(
                        [
                          { step: 1 as const, label: "Крок 1 · Повний актив" },
                          { step: 2 as const, label: "Крок 2 · Скорочення" },
                          {
                            step: 3 as const,
                            label:
                              passiveCategory === "infinitive"
                                ? "Крок 3 · to be + V3"
                                : "Крок 3 · being + V3",
                          },
                        ] as const
                      ).map((col) => {
                        const isActiveStep = passiveStep === col.step;
                        return (
                          <button
                            key={col.step}
                            type="button"
                            onClick={() => setPassiveStep(col.step)}
                            className={cn(
                              "flex flex-col items-center justify-start pt-3 text-center transition-colors",
                              FOCUS_RING_CLASS,
                              isActiveStep
                                ? "bg-primary/[0.06]"
                                : "hover:bg-accent/15",
                            )}
                          >
                            <span
                              className={cn(
                                "text-[11px] font-bold uppercase tracking-wider sm:text-xs",
                                isActiveStep
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                            >
                              {col.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-[16.6667%] top-[62%] h-0.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-amber-500/50 via-sky-500/55 to-emerald-500/65"
                    />

                    <motion.div
                      animate={{
                        x: `${getColumnCenterPercent((passiveStep - 1) as 0 | 1 | 2) - 50}%`,
                      }}
                      transition={passiveSpring}
                      className="pointer-events-none absolute inset-0"
                    >
                      <div className="absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2">
                        <button
                          type="button"
                          role="slider"
                          aria-label="Крок виведення пасивного інфінітива або герундія"
                          aria-valuemin={1}
                          aria-valuemax={3}
                          aria-valuenow={passiveStep}
                          aria-valuetext={`Крок ${passiveStep} з 3`}
                          onPointerDown={handlePassivePointerDown}
                          onKeyDown={handlePassiveMarkerKeyDown}
                          className={cn(
                            "pointer-events-auto flex h-9 w-9 cursor-grab items-center justify-center rounded-full border-2 border-primary bg-primary text-xs font-bold text-primary-foreground shadow-md transition-transform active:scale-95 active:cursor-grabbing",
                            FOCUS_RING_CLASS,
                          )}
                        >
                          {passiveStep}
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
