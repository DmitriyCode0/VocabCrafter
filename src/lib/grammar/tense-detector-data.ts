export type MarkerColor = "amber" | "sky" | "emerald";

export type DetectorMode = "aspects" | "conditionals";

export interface MarkerStyleSpec {
  badge: string;
  markerBg: string;
  markerBorder: string;
  ring: string;
  text: string;
  strokeHex: string;
}

export const MARKER_STYLES: Record<MarkerColor, MarkerStyleSpec> = {
  amber: {
    badge:
      "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    markerBg: "bg-amber-500 text-amber-950",
    markerBorder: "border-amber-400",
    ring: "ring-amber-400/40",
    text: "text-amber-600 dark:text-amber-400",
    strokeHex: "#f59e0b",
  },
  sky: {
    badge: "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    markerBg: "bg-sky-500 text-sky-950",
    markerBorder: "border-sky-400",
    ring: "ring-sky-400/40",
    text: "text-sky-600 dark:text-sky-400",
    strokeHex: "#38bdf8",
  },
  emerald: {
    badge:
      "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    markerBg: "bg-emerald-500 text-emerald-950",
    markerBorder: "border-emerald-400",
    ring: "ring-emerald-400/40",
    text: "text-emerald-600 dark:text-emerald-400",
    strokeHex: "#34d399",
  },
};

export interface SentenceSegment {
  text: string;
  color?: MarkerColor;
}

/**
 * Parses `[[primary]]` and `{{secondary}}` marker spans into highlighted segments.
 */
export function parseTaggedSentence(
  tagged: string,
  primaryColor: MarkerColor = "emerald",
  secondaryColor: MarkerColor = "sky",
): { plainText: string; segments: SentenceSegment[] } {
  const tokenRegex = /(\[\[[\s\S]*?\]\]|\{\{[\s\S]*?\}\})/g;
  const parts = tagged.split(tokenRegex).filter((part) => part.length > 0);

  const segments: SentenceSegment[] = parts.map((part) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      return { text: part.slice(2, -2), color: primaryColor };
    }
    if (part.startsWith("{{") && part.endsWith("}}")) {
      return { text: part.slice(2, -2), color: secondaryColor };
    }
    return { text: part };
  });

  if (segments.length === 0) {
    return {
      plainText: tagged,
      segments: [{ text: tagged }],
    };
  }

  return {
    plainText: segments.map((segment) => segment.text).join(""),
    segments,
  };
}

// ─────────────────────────────────────────────────────────────────
// 1. АСПЕКТИ × ЧАС (МАТРИЦЯ 3 × 4)
// ─────────────────────────────────────────────────────────────────

export type AspectTime = "past" | "present" | "future";
export type AspectType =
  | "simple"
  | "continuous"
  | "perfect"
  | "perfect_continuous";
export type AspectCellKey = `${AspectTime}_${AspectType}`;

export function resolveAspectType(
  isContinuous: boolean,
  isPerfect: boolean,
): AspectType {
  if (isContinuous && isPerfect) return "perfect_continuous";
  if (isContinuous) return "continuous";
  if (isPerfect) return "perfect";
  return "simple";
}

export function getAspectCellKey(
  time: AspectTime,
  aspect: AspectType,
): AspectCellKey {
  return `${time}_${aspect}`;
}

export interface TimeAxisOption {
  key: AspectTime;
  slot: 0 | 1 | 2;
  labelEn: string;
  labelUk: string;
  tickLabelUk: string;
  cutoffLabelUk: string;
}

export const TIME_AXIS_OPTIONS: readonly TimeAxisOption[] = [
  {
    key: "past",
    slot: 0,
    labelEn: "Past",
    labelUk: "Минуле",
    tickLabelUk: "Past · Минуле",
    cutoffLabelUk: "до моменту в минулому (arrived / 5 pm)",
  },
  {
    key: "present",
    slot: 1,
    labelEn: "Present",
    labelUk: "Теперішнє",
    tickLabelUk: "Present · NOW",
    cutoffLabelUk: "до ЗАРАЗ (NOW)",
  },
  {
    key: "future",
    slot: 2,
    labelEn: "Future",
    labelUk: "Майбутнє",
    tickLabelUk: "Future · Майбутнє",
    cutoffLabelUk: "до моменту в майбутньому (by Friday)",
  },
] as const;

export interface AspectDefinition {
  key: AspectType;
  title: string;
  explanationUk: string;
  detailUk: string;
}

export const ASPECT_DEFINITIONS: readonly AspectDefinition[] = [
  {
    key: "simple",
    title: "Simple",
    explanationUk: "регулярна подія",
    detailUk: "Факт, звичка або регулярна повторювана дія у вибраному часі.",
  },
  {
    key: "continuous",
    title: "Continuous",
    explanationUk: "має продовжуваність",
    detailUk: "Дія в процесі, триває у певний момент часу.",
  },
  {
    key: "perfect",
    title: "Perfect",
    explanationUk: 'Подія яка завершена "до" якогось часу',
    detailUk: "Важливий результат або факт завершення ДО певної межі на осі часу.",
  },
  {
    key: "perfect_continuous",
    title: "Perfect-Continuous",
    explanationUk: "комбінація попередніх",
    detailUk:
      "Дія тривала безперервно (мала продовжуваність) ДО певної межі часу.",
  },
] as const;

export interface AspectMatrixCellMeta {
  tenseName: string;
  shortFormula: string;
  formula: string;
  explanationUk: string;
  timeCueExample: string;
}

export const ASPECT_MATRIX_META: Record<AspectCellKey, AspectMatrixCellMeta> = {
  past_simple: {
    tenseName: "Past Simple",
    shortFormula: "V2 / -ed",
    formula: "S + V2 (або did + V0)",
    explanationUk: "Завершена або регулярна подія в минулому.",
    timeCueExample: "yesterday / last week",
  },
  past_continuous: {
    tenseName: "Past Continuous",
    shortFormula: "was / were + V-ing",
    formula: "S + was / were + V-ing",
    explanationUk: "Тривалий процес у конкретний момент минулого.",
    timeCueExample: "at 5 pm yesterday",
  },
  past_perfect: {
    tenseName: "Past Perfect",
    shortFormula: "had + V3",
    formula: "S + had + V3",
    explanationUk: 'Подія, що завершилася "ДО" іншого моменту в минулому.',
    timeCueExample: "before we arrived",
  },
  past_perfect_continuous: {
    tenseName: "Past Perfect Continuous",
    shortFormula: "had been + V-ing",
    formula: "S + had been + V-ing",
    explanationUk: 'Дія тривала впродовж часу "ДО" моменту в минулому.',
    timeCueExample: "for an hour before...",
  },
  present_simple: {
    tenseName: "Present Simple",
    shortFormula: "V1 / V-s",
    formula: "S + V1 (he/she/it + -s)",
    explanationUk: "Регулярна дія, звичка або постійний факт зараз.",
    timeCueExample: "every day / usually",
  },
  present_continuous: {
    tenseName: "Present Continuous",
    shortFormula: "am / is / are + V-ing",
    formula: "S + am / is / are + V-ing",
    explanationUk: "Процес, що триває прямо зараз або у поточний період.",
    timeCueExample: "right now / at the moment",
  },
  present_perfect: {
    tenseName: "Present Perfect",
    shortFormula: "have / has + V3",
    formula: "S + have / has + V3",
    explanationUk: 'Подія завершилася "ДО" ЗАРАЗ і дає результат у теперішньому.',
    timeCueExample: "already / just / by now",
  },
  present_perfect_continuous: {
    tenseName: "Present Perfect Continuous",
    shortFormula: "have / has been + V-ing",
    formula: "S + have / has been + V-ing",
    explanationUk: 'Дія почалася раніше, тривала і триває "ДО" моменту NOW.',
    timeCueExample: "for 2 hours / since morning",
  },
  future_simple: {
    tenseName: "Future Simple",
    shortFormula: "will + V0",
    formula: "S + will + V0",
    explanationUk: "Майбутній факт, рішення або регулярна дія в майбутньому.",
    timeCueExample: "tomorrow / next week",
  },
  future_continuous: {
    tenseName: "Future Continuous",
    shortFormula: "will be + V-ing",
    formula: "S + will be + V-ing",
    explanationUk: "Тривалий процес у конкретний момент у майбутньому.",
    timeCueExample: "at this time tomorrow",
  },
  future_perfect: {
    tenseName: "Future Perfect",
    shortFormula: "will have + V3",
    formula: "S + will have + V3",
    explanationUk: 'Подія буде завершена "ДО" певної межі в майбутньому.',
    timeCueExample: "by 7 pm tomorrow",
  },
  future_perfect_continuous: {
    tenseName: "Future Perfect Continuous",
    shortFormula: "will have been + V-ing",
    formula: "S + will have been + V-ing",
    explanationUk: 'Дія триватиме певний час "ДО" моменту в майбутньому.',
    timeCueExample: "for 5 years by next month",
  },
};

export interface AspectSentenceTemplate {
  id: string;
  labelUk: string;
  isCustom?: boolean;
  isStateVerb?: boolean;
  forms: Record<AspectCellKey, string>;
}

// ─────────────────────────────────────────────────────────────────
// 2. УМОВНІ РЕЧЕННЯ (CONDITIONALS 3 · 2 · 1 & MIXED)
// ─────────────────────────────────────────────────────────────────

export type ConditionalSlot = 0 | 1 | 2;
export type ConditionalPresentMode = "unreal" | "zero";
export type ConditionalVariantKey =
  | "zero"
  | "first"
  | "second"
  | "third"
  | "mixed_past_present"
  | "mixed_present_past";

export interface ConditionalPositionMeta {
  slot: ConditionalSlot;
  numberLabel: string;
  shortTimeUk: string;
  situationLabelUk: string;
  ifGrammar: string;
  ifShortFormula: string;
  resultGrammar: string;
  resultShortFormula: string;
  hasBackshift: boolean;
}

export const CONDITIONAL_POSITIONS: readonly ConditionalPositionMeta[] = [
  {
    slot: 0,
    numberLabel: "3",
    shortTimeUk: "Минуле",
    situationLabelUk: "Минуле (Past)",
    ifGrammar: "Past Perfect (had + V3)",
    ifShortFormula: "had + V3",
    resultGrammar: "would / could + have V3",
    resultShortFormula: "would + have V3",
    hasBackshift: true,
  },
  {
    slot: 1,
    numberLabel: "2",
    shortTimeUk: "Теперішнє / Загальне",
    situationLabelUk: "Теперішнє / Загальне (Now / General)",
    ifGrammar: "Past Simple (V2 / were)",
    ifShortFormula: "V2 / were",
    resultGrammar: "would / could + V0",
    resultShortFormula: "would + V0",
    hasBackshift: true,
  },
  {
    slot: 2,
    numberLabel: "1",
    shortTimeUk: "Майбутнє",
    situationLabelUk: "Майбутнє (Future)",
    ifGrammar: "Present Simple (V1 / -s)",
    ifShortFormula: "Present Simple",
    resultGrammar: "will / can + V0",
    resultShortFormula: "will + V0",
    hasBackshift: false,
  },
] as const;

/**
 * Enforces pure 1st/2nd/3rd conditionals and limits Mixed conditionals exclusively to positions 2 <-> 3.
 */
export function sanitizeConditionalSlots(
  ifSlot: ConditionalSlot,
  resultSlot: ConditionalSlot,
): { ifSlot: ConditionalSlot; resultSlot: ConditionalSlot } {
  if (ifSlot === 2 || resultSlot === 2) {
    return { ifSlot: 2, resultSlot: 2 };
  }
  return { ifSlot, resultSlot };
}

export function resolveConditionalVariantKey(
  rawIfSlot: ConditionalSlot,
  rawResultSlot: ConditionalSlot,
  presentMode: ConditionalPresentMode,
): ConditionalVariantKey {
  const { ifSlot, resultSlot } = sanitizeConditionalSlots(
    rawIfSlot,
    rawResultSlot,
  );
  if (ifSlot === 1 && resultSlot === 1 && presentMode === "zero") {
    return "zero";
  }
  if (ifSlot === 2 && resultSlot === 2) {
    return "first";
  }
  if (ifSlot === 1 && resultSlot === 1) {
    return "second";
  }
  if (ifSlot === 0 && resultSlot === 0) {
    return "third";
  }
  if (ifSlot === 0 && resultSlot === 1) {
    return "mixed_past_present";
  }
  return "mixed_present_past";
}

export interface ConditionalVariantMeta {
  nameUk: string;
  formula: string;
  explanationUk: string;
  ifClauseTense: string;
  resultClauseTense: string;
  ifBackshifted: boolean;
  resultBackshifted: boolean;
}

export interface SplitConditionalParts {
  ifPart: { plainText: string; segments: SentenceSegment[] };
  resultPart: { plainText: string; segments: SentenceSegment[] };
}

/**
 * Splits a conditional tagged string into highlighted IF (amber) and RESULT (emerald) clauses.
 */
export function splitConditionalSentence(
  tagged: string,
): SplitConditionalParts {
  const commaIndex = tagged.indexOf(",");
  let ifRaw = "";
  let resultRaw = "";

  if (commaIndex !== -1) {
    const left = tagged.slice(0, commaIndex).trim();
    const right = tagged.slice(commaIndex + 1).trim();

    if (
      left.includes("[[") ||
      /^(if|unless|when|provided|suppose)\b/i.test(left)
    ) {
      ifRaw = `${left},`;
      resultRaw = right;
    } else if (right.includes("[[")) {
      ifRaw = right;
      resultRaw = left;
    } else {
      ifRaw = `${left},`;
      resultRaw = right;
    }
  } else {
    const match = /\s+(if|unless)\s+/i.exec(tagged);
    if (match && match.index >= 0) {
      resultRaw = tagged.slice(0, match.index).trim();
      ifRaw = tagged.slice(match.index).trim();
    } else {
      ifRaw = tagged;
      resultRaw = "";
    }
  }

  return {
    ifPart: parseTaggedSentence(ifRaw, "amber", "emerald"),
    resultPart: parseTaggedSentence(resultRaw, "amber", "emerald"),
  };
}

export const CONDITIONAL_META: Record<
  ConditionalVariantKey,
  ConditionalVariantMeta
> = {
  zero: {
    nameUk: "Zero Conditional (Реальний факт)",
    formula: "If + Present Simple , Present Simple",
    explanationUk: "Загальний факт або закономірність, що справджується завжди.",
    ifClauseTense: "Present Simple",
    resultClauseTense: "Present Simple",
    ifBackshifted: false,
    resultBackshifted: false,
  },
  first: {
    nameUk: "1st Conditional (Майбутня умова)",
    formula: "If + Present Simple , will / can + V0",
    explanationUk: "Реальна умова та ймовірний результат у майбутньому.",
    ifClauseTense: "Present Simple",
    resultClauseTense: "will / can + V0",
    ifBackshifted: false,
    resultBackshifted: false,
  },
  second: {
    nameUk: "2nd Conditional (Теперішнє / загальне)",
    formula: "If + Past Simple , would / could + V0",
    explanationUk: "Нереальна або загальна уявна умова (теперішній чи загальний план).",
    ifClauseTense: "Past Simple",
    resultClauseTense: "would / could + V0",
    ifBackshifted: true,
    resultBackshifted: false,
  },
  third: {
    nameUk: "3rd Conditional (Уявне минуле)",
    formula: "If + Past Perfect , would / could + have V3",
    explanationUk: "Нереальна ситуація в минулому, яку вже неможливо змінити.",
    ifClauseTense: "Past Perfect",
    resultClauseTense: "would / could + have V3",
    ifBackshifted: true,
    resultBackshifted: true,
  },
  mixed_past_present: {
    nameUk: "Mixed (3 → 2: Минуле → Теперішнє / Загальне)",
    formula: "If + Past Perfect , would / could + V0",
    explanationUk: "Умова стосується минулого, а результат відчутний зараз або загалом.",
    ifClauseTense: "Past Perfect",
    resultClauseTense: "would / could + V0",
    ifBackshifted: true,
    resultBackshifted: false,
  },
  mixed_present_past: {
    nameUk: "Mixed (2 → 3: Теперішнє / Загальне → Минуле)",
    formula: "If + Past Simple , would / could + have V3",
    explanationUk: "Постійна чи теперішня умова вплинула на результат у минулому.",
    ifClauseTense: "Past Simple",
    resultClauseTense: "would / could + have V3",
    ifBackshifted: true,
    resultBackshifted: true,
  },
};

export interface ConditionalSentenceTemplate {
  id: string;
  labelUk: string;
  isCustom?: boolean;
  forms: Record<ConditionalVariantKey, string>;
}
