export type MarkerColor = "amber" | "sky" | "emerald";

export type DetectorMode = "aspects" | "conditionals" | "reported";

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
 * Parses `[[primary]]`, `{{secondary}}`, and `<<tertiary>>` marker spans into highlighted segments.
 */
export function parseTaggedSentence(
  tagged: string,
  primaryColor: MarkerColor = "emerald",
  secondaryColor: MarkerColor = "sky",
  tertiaryColor: MarkerColor = "amber",
): { plainText: string; segments: SentenceSegment[] } {
  const tokenRegex = /(\[\[[\s\S]*?\]\]|\{\{[\s\S]*?\}\}|<<[\s\S]*?>>)/g;
  const parts = tagged.split(tokenRegex).filter((part) => part.length > 0);

  const segments: SentenceSegment[] = parts.map((part) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      return { text: part.slice(2, -2), color: primaryColor };
    }
    if (part.startsWith("{{") && part.endsWith("}}")) {
      return { text: part.slice(2, -2), color: secondaryColor };
    }
    if (part.startsWith("<<") && part.endsWith(">>")) {
      return { text: part.slice(2, -2), color: tertiaryColor };
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

export interface TimeMarkerSpec {
  id: string;
  label: string;
  pattern: RegExp;
  excludePattern?: RegExp;
}

export interface ResolvedTimeMarker {
  label: string;
  isActive: boolean;
}

export interface ResolvedUseCase {
  label: string;
  isActive: boolean;
}

export interface AspectMatrixCellMeta {
  tenseName: string;
  shortFormula: string;
  formula: string;
  explanationUk: string;
  useCasesUk: readonly string[];
  timeCueExample: string;
  timeMarkers: readonly TimeMarkerSpec[];
}

export const ASPECT_MATRIX_META: Record<AspectCellKey, AspectMatrixCellMeta> = {
  past_simple: {
    tenseName: "Past Simple",
    shortFormula: "V2 / -ed",
    formula: "S + V2 (або did + V0)",
    explanationUk: "Завершена або регулярна подія в минулому.",
    useCasesUk: [
      "Факти в минулому",
      "Регулярні дії раніше (used to)",
      "Послідовні дії одна за одною",
    ],
    timeCueExample: "yesterday / last week",
    timeMarkers: [
      { id: "yesterday", label: "yesterday", pattern: /\byesterday\b/i },
      {
        id: "last",
        label: "last week / year",
        pattern: /\blast\s+(night|week|month|year|summer|winter|monday|tuesday|wednesday|thursday|friday|saturday|sunday|time)\b/i,
      },
      { id: "ago", label: "... ago", pattern: /\bago\b/i },
      { id: "in-year", label: "in 2020", pattern: /\bin\s+(19|20)\d{2}\b/i },
      { id: "when", label: "when ...", pattern: /\bwhen\b/i },
    ],
  },
  past_continuous: {
    tenseName: "Past Continuous",
    shortFormula: "was / were + V-ing",
    formula: "S + was / were + V-ing",
    explanationUk: "Тривалий процес у конкретний момент минулого.",
    useCasesUk: [
      "У конкретний час (at 7 yesterday)",
      "Тривалість (from ... to / all morning)",
      "2 паралельні тривалі дії (while / as)",
      "Тривала дія, перервана коротшою (when + V2)",
    ],
    timeCueExample: "at 5 pm yesterday",
    timeMarkers: [
      {
        id: "at-time",
        label: "at 5 pm (yesterday)",
        pattern: /\bat\s+\d{1,2}(:\d{2})?\s*(am|pm|o'clock)?/i,
      },
      { id: "when", label: "when ...", pattern: /\bwhen\b/i },
      { id: "while", label: "while ...", pattern: /\bwhile\b/i },
      {
        id: "all-period",
        label: "all evening / day",
        pattern: /\ball\s+(morning|afternoon|evening|night|day|week)\b/i,
      },
      {
        id: "that-moment",
        label: "at that moment",
        pattern: /\bat\s+that\s+(moment|time)\b/i,
      },
    ],
  },
  past_perfect: {
    tenseName: "Past Perfect",
    shortFormula: "had + V3",
    formula: "S + had + V3",
    explanationUk: 'Подія, що завершилася "ДО" іншого моменту в минулому.',
    useCasesUk: [
      "Дія відбулася ДО певного моменту чи дії в минулому (before / after)",
    ],
    timeCueExample: "before we arrived",
    timeMarkers: [
      { id: "before", label: "before ...", pattern: /\bbefore\b/i },
      {
        id: "by-the-time",
        label: "by the time ...",
        pattern: /\bby\s+the\s+time\b/i,
      },
      {
        id: "by-point",
        label: "by 5 pm / by then",
        pattern: /\bby\s+/i,
        excludePattern: /\bby\s+the\s+time\b/gi,
      },
      { id: "already", label: "already", pattern: /\balready\b/i },
      { id: "after", label: "after ...", pattern: /\bafter\b/i },
    ],
  },
  past_perfect_continuous: {
    tenseName: "Past Perfect Continuous",
    shortFormula: "had been + V-ing",
    formula: "S + had been + V-ing",
    explanationUk: 'Дія тривала впродовж часу "ДО" моменту в минулому.',
    useCasesUk: [
      "Тривала або повторювана дія ДО іншої дії в минулому",
    ],
    timeCueExample: "for an hour before...",
    timeMarkers: [
      {
        id: "for",
        label: "for ...",
        pattern: /\bfor\s+(an?\s+|one|\d+|two|three|four|five|six|ten|many|several|hours|minutes|days|weeks|months|years)/i,
      },
      { id: "since", label: "since ...", pattern: /\bsince\b/i },
      {
        id: "all-period",
        label: "all day / week",
        pattern: /\ball\s+(day|week|morning|evening|night)\b/i,
      },
      { id: "before", label: "before ...", pattern: /\bbefore\b/i },
    ],
  },
  present_simple: {
    tenseName: "Present Simple",
    shortFormula: "V1 / V-s",
    formula: "S + V1 (he/she/it + -s)",
    explanationUk: "Регулярна дія, звичка або постійний факт зараз.",
    useCasesUk: [
      "Факти та істини",
      "Регулярні дії (every / often / never)",
      "Розклади й графіки (майбутнє)",
      "Майбутнє після if / when",
      "Дія зараз зі state verbs",
      "Живі історії та жарти (storytelling)",
    ],
    timeCueExample: "every day / usually",
    timeMarkers: [
      {
        id: "every",
        label: "every day / week",
        pattern: /\bevery\s+(day|week|month|year|morning|evening|night|time|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      },
      {
        id: "usually",
        label: "usually / often",
        pattern: /\b(usually|often|normally|generally|frequently)\b/i,
      },
      { id: "always", label: "always", pattern: /\balways\b/i },
      {
        id: "sometimes",
        label: "sometimes / never",
        pattern: /\b(sometimes|rarely|seldom|never)\b/i,
      },
      {
        id: "daily",
        label: "daily / on Mondays",
        pattern: /\b(daily|weekly|monthly|on\s+(mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays|weekends))\b/i,
      },
    ],
  },
  present_continuous: {
    tenseName: "Present Continuous",
    shortFormula: "am / is / are + V-ing",
    formula: "S + am / is / are + V-ing",
    explanationUk: "Процес, що триває прямо зараз або у поточний період.",
    useCasesUk: [
      "Прямо зараз (now)",
      "Тимчасова дія (today / this week)",
      "Запланована домовленість у майбутньому",
      "Розвиток і зміна (more and more)",
    ],
    timeCueExample: "right now / at the moment",
    timeMarkers: [
      { id: "right-now", label: "right now", pattern: /\bright\s+now\b/i },
      {
        id: "now",
        label: "now",
        pattern: /\bnow\b/i,
        excludePattern: /\bright\s+now\b/gi,
      },
      {
        id: "at-the-moment",
        label: "at the moment",
        pattern: /\bat\s+the\s+moment\b/i,
      },
      {
        id: "currently",
        label: "currently",
        pattern: /\b(currently|presently)\b/i,
      },
      {
        id: "today",
        label: "today / this week",
        pattern: /\b(today|tonight|this\s+(week|month|year|morning|afternoon|evening))\b/i,
      },
    ],
  },
  present_perfect: {
    tenseName: "Present Perfect",
    shortFormula: "have / has + V3",
    formula: "S + have / has + V3",
    explanationUk: 'Подія завершилася "ДО" ЗАРАЗ і дає результат у теперішньому.',
    useCasesUk: [
      "Новини та свіжий результат",
      "Життєвий досвід (ever / never / before)",
      "Незавершений стан досі (для state verbs)",
    ],
    timeCueExample: "already / just / by now",
    timeMarkers: [
      {
        id: "already-just",
        label: "already / just",
        pattern: /\b(already|just)\b/i,
      },
      { id: "yet", label: "yet", pattern: /\byet\b/i },
      { id: "ever-never", label: "ever / never", pattern: /\b(ever|never)\b/i },
      {
        id: "so-far",
        label: "so far / recently",
        pattern: /\b(so\s+far|recently|lately|by\s+now)\b/i,
      },
      {
        id: "this-week",
        label: "this week / today",
        pattern: /\b(today|this\s+(week|month|year|morning)|all\s+(week|day))\b/i,
      },
      {
        id: "for-since",
        label: "for / since",
        pattern: /\b(for\s+(a\s+|an\s+|\d+|two|three|four|five|many|several|hours|days|weeks|months|years)|since)\b/i,
      },
    ],
  },
  present_perfect_continuous: {
    tenseName: "Present Perfect Continuous",
    shortFormula: "have / has been + V-ing",
    formula: "S + have / has been + V-ing",
    explanationUk: 'Дія почалася раніше, тривала і триває "ДО" моменту NOW.',
    useCasesUk: [
      "Незавершена тривала дія, що триває досі (for / since)",
    ],
    timeCueExample: "for 2 hours / since morning",
    timeMarkers: [
      {
        id: "for",
        label: "for ...",
        pattern: /\bfor\s+(an?\s+|one|\d+|two|three|four|five|six|ten|many|several|hours|minutes|days|weeks|months|years|a\s+long\s+time)/i,
      },
      { id: "since", label: "since ...", pattern: /\bsince\b/i },
      {
        id: "all-week",
        label: "all week / day",
        pattern: /\ball\s+(day|week|month|morning|afternoon|evening)\b/i,
      },
      {
        id: "lately",
        label: "lately / recently",
        pattern: /\b(lately|recently)\b/i,
      },
    ],
  },
  future_simple: {
    tenseName: "Future Simple",
    shortFormula: "will + V0",
    formula: "S + will + V0",
    explanationUk: "Майбутній факт, рішення або регулярна дія в майбутньому.",
    useCasesUk: [
      "Факти й прогнози в майбутньому",
      "Спонтанні рішення та обіцянки",
    ],
    timeCueExample: "tomorrow / next week",
    timeMarkers: [
      { id: "tomorrow", label: "tomorrow", pattern: /\btomorrow\b/i },
      {
        id: "next",
        label: "next week / year",
        pattern: /\bnext\s+(week|month|year|summer|winter|monday|tuesday|wednesday|thursday|friday|saturday|sunday|time)\b/i,
      },
      {
        id: "tonight-soon",
        label: "tonight / soon",
        pattern: /\b(tonight|soon|later)\b/i,
      },
      {
        id: "in-future",
        label: "in a few days",
        pattern: /\bin\s+(a\s+|an\s+|\d+|two|three|five|ten|few|some)\s*(minutes?|hours?|days?|weeks?|months?|years?)\b/i,
      },
    ],
  },
  future_continuous: {
    tenseName: "Future Continuous",
    shortFormula: "will be + V-ing",
    formula: "S + will be + V-ing",
    explanationUk: "Тривалий процес у конкретний момент у майбутньому.",
    useCasesUk: [
      "У конкретний час у майбутньому (at 11 tomorrow)",
      "Тривалість процесу (from ... to)",
    ],
    timeCueExample: "at this time tomorrow",
    timeMarkers: [
      {
        id: "at-this-time",
        label: "at this time tomorrow",
        pattern: /\bat\s+this\s+time\b/i,
      },
      {
        id: "at-clock",
        label: "at 5 pm tomorrow",
        pattern: /\bat\s+\d{1,2}(:\d{2})?\s*(am|pm|o'clock)?/i,
        excludePattern: /\bat\s+this\s+time\b/gi,
      },
      {
        id: "all-day",
        label: "all day tomorrow",
        pattern: /\ball\s+(day|evening|morning|afternoon|week)\b/i,
      },
      { id: "when", label: "when ...", pattern: /\bwhen\b/i },
    ],
  },
  future_perfect: {
    tenseName: "Future Perfect",
    shortFormula: "will have + V3",
    formula: "S + will have + V3",
    explanationUk: 'Подія буде завершена "ДО" певної межі в майбутньому.',
    useCasesUk: [
      "Дія завершиться ДО моменту в майбутньому (by)",
    ],
    timeCueExample: "by 7 pm tomorrow",
    timeMarkers: [
      {
        id: "by-the-time",
        label: "by the time ...",
        pattern: /\bby\s+the\s+time\b/i,
      },
      {
        id: "by-point",
        label: "by Friday / by 7 pm",
        pattern: /\bby\s+/i,
        excludePattern: /\bby\s+the\s+time\b/gi,
      },
      { id: "before", label: "before ...", pattern: /\bbefore\b/i },
    ],
  },
  future_perfect_continuous: {
    tenseName: "Future Perfect Continuous",
    shortFormula: "will have been + V-ing",
    formula: "S + will have been + V-ing",
    explanationUk: 'Дія триватиме певний час "ДО" моменту в майбутньому.',
    useCasesUk: [
      "Тривала дія ДО певного моменту в майбутньому",
    ],
    timeCueExample: "for 5 years by next month",
    timeMarkers: [
      {
        id: "for",
        label: "for ...",
        pattern: /\bfor\s+(an?\s+|one|\d+|two|three|four|five|six|ten|many|several|hours|minutes|days|weeks|months|years)/i,
      },
      {
        id: "by-the-time",
        label: "by the time ...",
        pattern: /\bby\s+the\s+time\b/i,
      },
      {
        id: "by-point",
        label: "by ...",
        pattern: /\bby\s+/i,
        excludePattern: /\bby\s+the\s+time\b/gi,
      },
    ],
  },
};

/**
 * Matches typical tense markers against the sentence displayed on the timeline.
 */
export function resolveActiveTimeMarkers(
  cellKey: AspectCellKey,
  parsedSentence: { plainText: string; segments: SentenceSegment[] } | null,
): ResolvedTimeMarker[] {
  const specs = ASPECT_MATRIX_META[cellKey].timeMarkers;

  if (!parsedSentence) {
    return specs.map((spec) => ({ label: spec.label, isActive: false }));
  }

  const skyCues = parsedSentence.segments
    .filter((segment) => segment.color === "sky")
    .map((segment) => segment.text.trim())
    .filter(Boolean);

  const searchCorpus =
    skyCues.length > 0
      ? `${skyCues.join(" ")} | ${parsedSentence.plainText}`
      : parsedSentence.plainText;

  const resolved: ResolvedTimeMarker[] = specs.map((spec) => {
    const targetText = spec.excludePattern
      ? searchCorpus.replace(spec.excludePattern, " ")
      : searchCorpus;
    return {
      label: spec.label,
      isActive: spec.pattern.test(targetText),
    };
  });

  if (skyCues.length > 0 && !resolved.some((marker) => marker.isActive)) {
    const fallbackLabel = skyCues
      .join(" · ")
      .replace(/[,.!?;:]+$/g, "")
      .trim();
    if (fallbackLabel) {
      return [...resolved, { label: fallbackLabel, isActive: true }];
    }
  }

  return resolved;
}

/**
 * Resolves which tense function (use case) applies to the sentence displayed on the timeline.
 */
export function resolveActiveUseCases(
  cellKey: AspectCellKey,
  parsedSentence: { plainText: string; segments: SentenceSegment[] } | null,
  options?: {
    isStateVerb?: boolean;
    detectedCellKey?: AspectCellKey;
    detectedUseCaseIndex?: number | null;
  },
): ResolvedUseCase[] {
  const useCases = ASPECT_MATRIX_META[cellKey].useCasesUk;

  if (!parsedSentence) {
    return useCases.map((label) => ({ label, isActive: false }));
  }

  if (useCases.length === 1) {
    return [{ label: useCases[0], isActive: true }];
  }

  if (
    options?.detectedCellKey === cellKey &&
    typeof options.detectedUseCaseIndex === "number" &&
    options.detectedUseCaseIndex >= 0 &&
    options.detectedUseCaseIndex < useCases.length
  ) {
    return useCases.map((label, idx) => ({
      label,
      isActive: idx === options.detectedUseCaseIndex,
    }));
  }

  const text = parsedSentence.plainText;
  const isStateVerb = Boolean(options?.isStateVerb);
  let matchedIndex = 0;

  switch (cellKey) {
    case "past_simple":
      if (
        /\b(used\s+to|every\s+|usually|often|always|sometimes|never|daily|weekly|on\s+(mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays|weekends))\b/i.test(
          text,
        )
      ) {
        matchedIndex = 1;
      } else if (
        /\b(then|after\s+that|and\s+then|first\b.*\bthen)\b/i.test(text)
      ) {
        matchedIndex = 2;
      } else {
        matchedIndex = 0;
      }
      break;

    case "past_continuous":
      if (/\b(while|as)\b/i.test(text)) {
        matchedIndex = 2;
      } else if (/\bwhen\b/i.test(text)) {
        matchedIndex = 3;
      } else if (
        /\b(from\s+.+\s+to|all\s+(morning|afternoon|evening|night|day|week)|whole\s+(day|morning|evening))\b/i.test(
          text,
        )
      ) {
        matchedIndex = 1;
      } else {
        matchedIndex = 0;
      }
      break;

    case "present_simple": {
      const isHabit =
        /\b(every\s+|usually|often|always|sometimes|rarely|seldom|never|daily|weekly|monthly|on\s+(mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays|weekends))\b/i.test(
          text,
        );
      if (
        /\b(if|unless|as\s+soon\s+as|until)\b/i.test(text) ||
        (/\bwhen\b/i.test(text) &&
          /\b(will|tomorrow|soon|later|tonight)\b/i.test(text))
      ) {
        matchedIndex = 3;
      } else if (
        /\b(train|bus|flight|plane|lesson|class|movie|concert|film|show|match)\b.*\b(leaves?|departs?|arrives?|starts?|begins?|ends?|opens?|closes?)\b|\b(leaves?|departs?|arrives?|starts?|begins?|opens?|closes?)\s+at\s+\d/i.test(
          text,
        )
      ) {
        matchedIndex = 2;
      } else if (isHabit) {
        matchedIndex = 1;
      } else if (isStateVerb) {
        matchedIndex = 4;
      } else {
        matchedIndex = 0;
      }
      break;
    }

    case "present_continuous":
      if (
        /\b(more\s+and\s+more|getting\s+|becoming\s+|growing\s+|changing|better\s+and\s+better|faster\s+and\s+faster)\b/i.test(
          text,
        )
      ) {
        matchedIndex = 3;
      } else if (
        /\b(tomorrow|tonight|next\s+(week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(weekend|evening))\b/i.test(
          text,
        )
      ) {
        matchedIndex = 2;
      } else if (
        /\b(today|this\s+(week|month|semester|year|summer)|these\s+days|temporarily)\b/i.test(
          text,
        ) &&
        !/\b(right\s+now|at\s+the\s+moment)\b/i.test(text)
      ) {
        matchedIndex = 1;
      } else {
        matchedIndex = 0;
      }
      break;

    case "present_perfect":
      if (
        /\b(ever|never|before|once|twice|\d+\s+times|have\s+been\s+to|has\s+been\s+to)\b/i.test(
          text,
        )
      ) {
        matchedIndex = 1;
      } else if (
        isStateVerb &&
        /\b(for|since|all\s+(day|week|month|year|my\s+life)|always)\b/i.test(
          text,
        )
      ) {
        matchedIndex = 2;
      } else if (isStateVerb) {
        matchedIndex = 2;
      } else {
        matchedIndex = 0;
      }
      break;

    case "future_simple":
      if (
        /\b(promise|swear|don't\s+worry|i'll\s+(help|get|answer|do|take)|i\s+will\s+help|wait,?\s+i'll|okay,?\s+i'll)\b/i.test(
          text,
        )
      ) {
        matchedIndex = 1;
      } else {
        matchedIndex = 0;
      }
      break;

    case "future_continuous":
      if (
        /\b(from\s+.+\s+to|all\s+(day|morning|evening|week|afternoon)|for\s+\d|whole\s+day)\b/i.test(
          text,
        )
      ) {
        matchedIndex = 1;
      } else {
        matchedIndex = 0;
      }
      break;

    default:
      matchedIndex = 0;
      break;
  }

  return useCases.map((label, idx) => ({
    label,
    isActive: idx === matchedIndex,
  }));
}

export interface AspectSentenceTemplate {
  id: string;
  labelUk: string;
  isCustom?: boolean;
  isStateVerb?: boolean;
  detectedCellKey?: AspectCellKey;
  detectedUseCaseIndex?: number | null;
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

// ─────────────────────────────────────────────────────────────────
// 3. НЕПРЯМА МОВА (REPORTED SPEECH)
// ─────────────────────────────────────────────────────────────────

export type ReportedCategory =
  | "statement"
  | "yes_no_question"
  | "wh_question"
  | "imperative";

export type ReportedPerspective = "direct" | "reported";

export type ReportedComponentKey =
  | "tense_shift"
  | "if_whether"
  | "regular_order"
  | "imperative_infinitive"
  | "perspective_shift";

export interface ReportedCategoryMeta {
  key: ReportedCategory;
  title: string;
  explanationUk: string;
  headerTitleUk: string;
  formula: string;
}

export const REPORTED_CATEGORIES: readonly ReportedCategoryMeta[] = [
  {
    key: "statement",
    title: "Твердження",
    explanationUk: "said / told + зсув часу назад",
    headerTitleUk: "Непряма мова · Твердження",
    formula: "S + said / told me (that) + S + V(backshift)",
  },
  {
    key: "yes_no_question",
    title: "Загальні питання",
    explanationUk: "if / whether + прямий порядок S + V",
    headerTitleUk: "Непряма мова · Загальні питання (Yes/No)",
    formula: "S + asked (me) + if / whether + S + V",
  },
  {
    key: "wh_question",
    title: "Спеціальні питання",
    explanationUk: "Wh-слово + прямий порядок S + V",
    headerTitleUk: "Непряма мова · Спеціальні питання (Wh-)",
    formula: "S + asked (me) + Wh-word + S + V",
  },
  {
    key: "imperative",
    title: "Накази й прохання",
    explanationUk: "told / asked + me + (not) to + V0",
    headerTitleUk: "Непряма мова · Накази й прохання",
    formula: "S + told / asked + me + (not) to + V0",
  },
] as const;

export interface ReportedTimeColumn {
  slot: 0 | 1 | 2;
  labelUk: string;
}

export const REPORTED_TIME_COLUMNS: readonly ReportedTimeColumn[] = [
  {
    slot: 0,
    labelUk: "Past Perfect · Давніше в минулому",
  },
  {
    slot: 1,
    labelUk: "Past · Переказ (said / asked)",
  },
  {
    slot: 2,
    labelUk: 'Present · Момент мовлення (Direct)',
  },
] as const;

export const REPORTED_EXPRESSION_SHIFTS: readonly TimeMarkerSpec[] = [
  {
    id: "now",
    label: "now → then",
    pattern: /\b(now|then|at\s+that\s+moment)\b/i,
  },
  {
    id: "today",
    label: "today → that day",
    pattern: /\b(today|that\s+day)\b/i,
  },
  {
    id: "tonight",
    label: "tonight → that night",
    pattern: /\b(tonight|that\s+night)\b/i,
  },
  {
    id: "last-night",
    label: "last night → the night before",
    pattern: /\b(last\s+night|the\s+night\s+before|the\s+previous\s+night)\b/i,
  },
  {
    id: "tomorrow",
    label: "tomorrow → the next day",
    pattern: /\b(tomorrow|the\s+(next|following)\s+day)\b/i,
  },
  {
    id: "yesterday",
    label: "yesterday → the day before",
    pattern: /\b(yesterday|the\s+day\s+before|the\s+previous\s+day)\b/i,
  },
  {
    id: "this-week",
    label: "this week → that week",
    pattern: /\b(this\s+week|that\s+week)\b/i,
  },
  {
    id: "next-week",
    label: "next week → the next week",
    pattern: /\b(next\s+week|the\s+(next|following)\s+week)\b/i,
  },
  {
    id: "here",
    label: "here → there",
    pattern: /\b(here|there)\b/i,
  },
] as const;

export function resolveActiveReportedExpressions(
  directPlain: string,
  reportedPlain: string,
): ResolvedTimeMarker[] {
  const corpus = `${directPlain} | ${reportedPlain}`;
  return REPORTED_EXPRESSION_SHIFTS.map((spec) => ({
    label: spec.label,
    isActive: spec.pattern.test(corpus),
  }));
}

export interface ReportedFormEntry {
  directTagged: string;
  reportedTagged: string;
  directBadge: string;
  reportedBadge: string;
  bridgeLabelUk: string;
  directSlot: 0 | 1 | 2;
  reportedSlot: 0 | 1 | 2;
  hasBackshift: boolean;
}

export interface ReportedPreset extends ReportedFormEntry {
  id: string;
  category: ReportedCategory;
  pillLabel: string;
}

export const REPORTED_PRESETS: readonly ReportedPreset[] = [
  // ── 1. ТВЕРДЖЕННЯ (STATEMENTS · VERB & MODAL SHIFTS) ──────────
  {
    id: "stmt_pres_simple",
    category: "statement",
    pillLabel: "Present Simple → Past Simple",
    directBadge: "PRESENT SIMPLE",
    reportedBadge: "PAST SIMPLE",
    bridgeLabelUk: "am / V1 → was / V2",
    directTagged: "'{{I}} [[am]] exhausted {{today}}.'",
    reportedTagged: "He <<said (that)>> {{he}} [[was]] exhausted {{that day}}.",
    directSlot: 2,
    reportedSlot: 1,
    hasBackshift: true,
  },
  {
    id: "stmt_pres_cont",
    category: "statement",
    pillLabel: "Present Cont. → Past Cont.",
    directBadge: "PRESENT CONTINUOUS",
    reportedBadge: "PAST CONTINUOUS",
    bridgeLabelUk: "am/is/are V-ing → was/were V-ing",
    directTagged: "'{{I}} [[am studying]] {{here now}}.'",
    reportedTagged:
      "She <<told me (that)>> {{she}} [[was studying]] {{there then}}.",
    directSlot: 2,
    reportedSlot: 1,
    hasBackshift: true,
  },
  {
    id: "stmt_past_simple",
    category: "statement",
    pillLabel: "Past Simple → Past Perfect",
    directBadge: "PAST SIMPLE",
    reportedBadge: "PAST PERFECT",
    bridgeLabelUk: "V2 → had + V3",
    directTagged: "'{{I}} [[saw]] her {{last night}}.'",
    reportedTagged:
      "She <<said (that)>> {{she}} [[had seen]] her {{the night before}}.",
    directSlot: 1,
    reportedSlot: 0,
    hasBackshift: true,
  },
  {
    id: "stmt_pres_perf",
    category: "statement",
    pillLabel: "Present Perfect → Past Perfect",
    directBadge: "PRESENT PERFECT",
    reportedBadge: "PAST PERFECT",
    bridgeLabelUk: "have / has V3 → had + V3",
    directTagged: "'{{I}} [[have]] never [[been]] to Rome.'",
    reportedTagged: "She <<said (that)>> {{she}} [[had]] never [[been]] to Rome.",
    directSlot: 1,
    reportedSlot: 0,
    hasBackshift: true,
  },
  {
    id: "stmt_will",
    category: "statement",
    pillLabel: "will → would",
    directBadge: "WILL",
    reportedBadge: "WOULD",
    bridgeLabelUk: "will + V0 → would + V0",
    directTagged: "'{{I}} [[will help]] {{you tomorrow}}.'",
    reportedTagged:
      "He <<said (that)>> {{he}} [[would help]] {{me the next day}}.",
    directSlot: 2,
    reportedSlot: 1,
    hasBackshift: true,
  },
  {
    id: "stmt_must",
    category: "statement",
    pillLabel: "must → had to",
    directBadge: "MUST",
    reportedBadge: "HAD TO",
    bridgeLabelUk: "must → had to",
    directTagged: "'{{You}} [[must pay]] attention {{today}}.'",
    reportedTagged:
      "She <<told me (that)>> {{I}} [[had to pay]] attention {{that day}}.",
    directSlot: 2,
    reportedSlot: 1,
    hasBackshift: true,
  },
  {
    id: "stmt_can",
    category: "statement",
    pillLabel: "can → could",
    directBadge: "CAN",
    reportedBadge: "COULD",
    bridgeLabelUk: "can → could",
    directTagged: "'We [[can do]] it {{this week}}.'",
    reportedTagged: "She <<said (that)>> we [[could do]] it {{that week}}.",
    directSlot: 2,
    reportedSlot: 1,
    hasBackshift: true,
  },
  {
    id: "stmt_may",
    category: "statement",
    pillLabel: "may → might",
    directBadge: "MAY",
    reportedBadge: "MIGHT",
    bridgeLabelUk: "may → might",
    directTagged: "'{{I}} [[may arrive]] late {{tonight}}.'",
    reportedTagged:
      "He <<told me (that)>> {{he}} [[might arrive]] late {{that night}}.",
    directSlot: 2,
    reportedSlot: 1,
    hasBackshift: true,
  },
  {
    id: "stmt_modal_same",
    category: "statement",
    pillLabel: "should / could / might (=)",
    directBadge: "COULD / MIGHT / SHOULD",
    reportedBadge: "БЕЗ ЗМІНИ МОДАЛЬНОГО",
    bridgeLabelUk: "should / could / might → без змін",
    directTagged: "'{{You}} [[should call]] {{next week}}.'",
    reportedTagged:
      "He <<told me (that)>> {{I}} [[should call]] {{the next week}}.",
    directSlot: 1,
    reportedSlot: 1,
    hasBackshift: false,
  },

  // ── 2. ЗАГАЛЬНІ ПИТАННЯ (YES / NO QUESTIONS) ────────────────────
  {
    id: "yn_past",
    category: "yes_no_question",
    pillLabel: "Did...? → if/whether + had V3",
    directBadge: "YES / NO QUESTION",
    reportedBadge: "'IF / WHETHER' + S + V",
    bridgeLabelUk: "if / whether + прямий порядок + backshift",
    directTagged: "'<<Did they>> [[call]] {{yesterday}}?'",
    reportedTagged:
      "He asked me <<if/whether they>> [[had called]] {{the day before}}.",
    directSlot: 1,
    reportedSlot: 0,
    hasBackshift: true,
  },
  {
    id: "yn_present",
    category: "yes_no_question",
    pillLabel: "Are you...? → if/whether + was",
    directBadge: "YES / NO · PRESENT CONT.",
    reportedBadge: "'IF / WHETHER' + S + V",
    bridgeLabelUk: "if / whether + S + was/were (без '?')",
    directTagged: "'<<Are>> {{you}} [[working]] {{here today}}?'",
    reportedTagged:
      "She asked me <<if/whether>> {{I}} [[was working]] {{there that day}}.",
    directSlot: 2,
    reportedSlot: 1,
    hasBackshift: true,
  },
  {
    id: "yn_modal",
    category: "yes_no_question",
    pillLabel: "Will you...? → if/whether + would",
    directBadge: "YES / NO · MODAL",
    reportedBadge: "'IF / WHETHER' + S + MODAL",
    bridgeLabelUk: "if / whether + S + would/could",
    directTagged: "'<<Will>> {{you}} [[do]] it {{now}}?'",
    reportedTagged: "He asked me <<if/whether>> {{I}} [[would do]] it {{then}}.",
    directSlot: 2,
    reportedSlot: 1,
    hasBackshift: true,
  },

  // ── 3. СПЕЦІАЛЬНІ ПИТАННЯ (WH- QUESTIONS) ──────────────────────
  {
    id: "wh_past",
    category: "wh_question",
    pillLabel: "When did...? → when + had V3",
    directBadge: "WH-WORD + AUXILIARY VERB",
    reportedBadge: "WH-WORD + SUBJECT + VERB",
    bridgeLabelUk: "Wh- + прямий порядок (без did)",
    directTagged: "'<<When did they>> [[arrive]] {{yesterday}}?'",
    reportedTagged:
      "He asked me <<when they>> [[had arrived]] {{the day before}}.",
    directSlot: 1,
    reportedSlot: 0,
    hasBackshift: true,
  },
  {
    id: "wh_present",
    category: "wh_question",
    pillLabel: "Where is...? → where + was",
    directBadge: "WH-WORD + AM / IS / ARE",
    reportedBadge: "WH-WORD + SUBJECT + VERB",
    bridgeLabelUk: "Wh- + S + V (без інверсії й '?')",
    directTagged: "'<<Where is>> Tom {{now}}?'",
    reportedTagged: "She asked me <<where>> Tom [[was]] {{then}}.",
    directSlot: 2,
    reportedSlot: 1,
    hasBackshift: true,
  },
  {
    id: "wh_modal",
    category: "wh_question",
    pillLabel: "What can...? → what + could",
    directBadge: "WH-WORD + MODAL VERB",
    reportedBadge: "WH-WORD + SUBJECT + MODAL",
    bridgeLabelUk: "Wh- + S + could/would",
    directTagged: "'<<What can>> we [[do]] {{next week}}?'",
    reportedTagged:
      "He asked me <<what>> we [[could do]] {{the next week}}.",
    directSlot: 2,
    reportedSlot: 1,
    hasBackshift: true,
  },

  // ── 4. НАКАЗИ Й ПРОХАННЯ (IMPERATIVES) ──────────────────────────
  {
    id: "imp_pos",
    category: "imperative",
    pillLabel: "Наказ (+): told me + to V0",
    directBadge: "POSITIVE IMPERATIVE",
    reportedBadge: "ASKED / TOLD ME + TO-INFINITIVE",
    bridgeLabelUk: "V0 → told/asked me + to + V0",
    directTagged: "'[[Call]] {{me tomorrow}}.'",
    reportedTagged:
      "He <<told me>> [[to call]] {{him the next day}}.",
    directSlot: 2,
    reportedSlot: 2,
    hasBackshift: false,
  },
  {
    id: "imp_neg",
    category: "imperative",
    pillLabel: "Заборона (−): asked me + not to V0",
    directBadge: "NEGATIVE IMPERATIVE",
    reportedBadge: "ASKED / TOLD ME + NOT TO + V0",
    bridgeLabelUk: "Don't V0 → asked me + not to + V0",
    directTagged: "'[[Don't answer]] the door {{tonight}}.'",
    reportedTagged:
      "He <<asked me>> [[not to answer]] the door {{that night}}.",
    directSlot: 2,
    reportedSlot: 2,
    hasBackshift: false,
  },
] as const;

export interface ResolvedReportedComponent {
  key: ReportedComponentKey;
  label: string;
  color: MarkerColor;
  isActive: boolean;
}

export function resolveActiveReportedComponents({
  category,
  hasBackshift,
  hasPerspectiveShift,
}: {
  category: ReportedCategory;
  hasBackshift: boolean;
  hasPerspectiveShift: boolean;
}): ResolvedReportedComponent[] {
  return [
    {
      key: "tense_shift",
      label: "Зсув часу назад (Backshift)",
      color: "emerald",
      isActive: category !== "imperative" && hasBackshift,
    },
    {
      key: "if_whether",
      label: "Сполучник if / whether",
      color: "amber",
      isActive: category === "yes_no_question",
    },
    {
      key: "regular_order",
      label: 'Прямий порядок слів (S + V, без "?")',
      color: "amber",
      isActive:
        category === "yes_no_question" || category === "wh_question",
    },
    {
      key: "imperative_infinitive",
      label: "Інфінітив (not) to + V0",
      color: "emerald",
      isActive: category === "imperative",
    },
    {
      key: "perspective_shift",
      label: "Дистанція: час / місце / особи",
      color: "sky",
      isActive: hasPerspectiveShift,
    },
  ];
}

export interface ReportedSentenceTemplate {
  id: string;
  labelUk: string;
  forms: Record<ReportedCategory, ReportedFormEntry>;
}
