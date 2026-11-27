export type MarkerColor = "amber" | "sky" | "emerald";

export type DetectorMode = "aspects" | "conditionals" | "reported" | "passive";

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
  strikethrough?: boolean;
}

/**
 * Parses `[[primary]]`, `{{secondary}}`, `<<tertiary>>`, and `~~strikethrough~~` spans into segments.
 */
export function parseTaggedSentence(
  tagged: string,
  primaryColor: MarkerColor = "emerald",
  secondaryColor: MarkerColor = "sky",
  tertiaryColor: MarkerColor = "amber",
): { plainText: string; segments: SentenceSegment[] } {
  const tokenRegex =
    /(\[\[[\s\S]*?\]\]|\{\{[\s\S]*?\}\}|<<[\s\S]*?>>|~~[\s\S]*?~~)/g;
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
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return { text: part.slice(2, -2), strikethrough: true };
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

export type AspectGraphVariant =
  | "single_fact"
  | "general_truth"
  | "habit_regular"
  | "sequence"
  | "timetable_future"
  | "future_time_clause"
  | "point_in_progress"
  | "duration_span"
  | "parallel_long"
  | "interrupted"
  | "future_arrangement"
  | "developing_trend"
  | "before_cutoff"
  | "life_experience"
  | "duration_up_to_cutoff";

export interface AspectUseCaseSpec {
  labelUk: string;
  graphVariant: AspectGraphVariant;
  exampleTagged: string;
  defaultPrimaryLabel?: string;
  defaultSecondaryLabel?: string;
  defaultCutoffLabel?: string;
}

export interface ResolvedUseCase {
  index: number;
  label: string;
  graphVariant: AspectGraphVariant;
  isActive: boolean;
}

export interface AspectTimelineLabels {
  primaryLabel: string | null;
  secondaryLabel: string | null;
  tertiaryLabel: string | null;
  durationOrStartLabel: string | null;
  cutoffLabel: string;
}

export interface AspectMatrixCellMeta {
  tenseName: string;
  shortFormula: string;
  formula: string;
  explanationUk: string;
  useCasesUk: readonly string[];
  useCaseSpecs: readonly AspectUseCaseSpec[];
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
    useCaseSpecs: [
      {
        labelUk: "Факти в минулому",
        graphVariant: "single_fact",
        exampleTagged: "I [[finished]] the project {{yesterday}}.",
        defaultPrimaryLabel: "finished",
        defaultSecondaryLabel: "yesterday",
      },
      {
        labelUk: "Регулярні дії раніше (used to)",
        graphVariant: "habit_regular",
        exampleTagged: "I [[used to walk]] to school {{every day}}.",
        defaultPrimaryLabel: "used to walk",
        defaultSecondaryLabel: "every day",
      },
      {
        labelUk: "Послідовні дії одна за одною",
        graphVariant: "sequence",
        exampleTagged: "I [[woke up]], {{made}} coffee, and <<left>> home.",
        defaultPrimaryLabel: "woke up",
        defaultSecondaryLabel: "made",
      },
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
    useCaseSpecs: [
      {
        labelUk: "У конкретний час (at 7 yesterday)",
        graphVariant: "point_in_progress",
        exampleTagged: "I [[was doing]] my classes {{at 7 pm yesterday}}.",
        defaultPrimaryLabel: "was doing",
        defaultSecondaryLabel: "at 7 pm yesterday",
      },
      {
        labelUk: "Тривалість (from ... to / all morning)",
        graphVariant: "duration_span",
        exampleTagged: "I [[was studying]] English {{all morning}}.",
        defaultPrimaryLabel: "was studying",
        defaultSecondaryLabel: "all morning",
      },
      {
        labelUk: "2 паралельні тривалі дії (while / as)",
        graphVariant: "parallel_long",
        exampleTagged:
          "While I [[was cooking]] dinner, she {{was doing}} her homework.",
        defaultPrimaryLabel: "was cooking",
        defaultSecondaryLabel: "was doing",
      },
      {
        labelUk: "Тривала дія, перервана коротшою (when + V2)",
        graphVariant: "interrupted",
        exampleTagged: "I [[was doing]] my classes {{when dinner started}}.",
        defaultPrimaryLabel: "was doing",
        defaultSecondaryLabel: "when dinner started",
      },
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
    useCaseSpecs: [
      {
        labelUk:
          "Дія відбулася ДО певного моменту чи дії в минулому (before / after)",
        graphVariant: "before_cutoff",
        exampleTagged: "I [[had done]] my classes {{before dinner}}.",
        defaultPrimaryLabel: "had done",
        defaultCutoffLabel: "before dinner",
      },
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
    useCaseSpecs: [
      {
        labelUk: "Тривала або повторювана дія ДО іншої дії в минулому",
        graphVariant: "duration_up_to_cutoff",
        exampleTagged:
          "I [[had been studying]] <<for two hours>> {{before dinner}}.",
        defaultPrimaryLabel: "had been studying",
        defaultCutoffLabel: "before dinner",
      },
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
    useCaseSpecs: [
      {
        labelUk: "Факти та істини",
        graphVariant: "general_truth",
        exampleTagged: "Water [[boils]] at 100°C.",
        defaultPrimaryLabel: "boils",
      },
      {
        labelUk: "Регулярні дії (every / often / never)",
        graphVariant: "habit_regular",
        exampleTagged: "I [[do]] my classes {{every day}}.",
        defaultPrimaryLabel: "do",
        defaultSecondaryLabel: "every day",
      },
      {
        labelUk: "Розклади й графіки (майбутнє)",
        graphVariant: "timetable_future",
        exampleTagged: "The train [[leaves]] {{at 8 pm tomorrow}}.",
        defaultPrimaryLabel: "leaves",
        defaultSecondaryLabel: "at 8 pm tomorrow",
      },
      {
        labelUk: "Майбутнє після if / when",
        graphVariant: "future_time_clause",
        exampleTagged: "I'll call you when I [[arrive]] {{tonight}}.",
        defaultPrimaryLabel: "arrive",
        defaultSecondaryLabel: "tonight",
      },
      {
        labelUk: "Дія зараз зі state verbs",
        graphVariant: "single_fact",
        exampleTagged: "I [[know]] the answer.",
        defaultPrimaryLabel: "know",
      },
      {
        labelUk: "Живі історії та жарти (storytelling)",
        graphVariant: "sequence",
        exampleTagged:
          "He [[opens]] the door, {{looks}} around, and <<smiles>>.",
        defaultPrimaryLabel: "opens",
        defaultSecondaryLabel: "looks",
      },
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
    useCaseSpecs: [
      {
        labelUk: "Прямо зараз (now)",
        graphVariant: "point_in_progress",
        exampleTagged: "I [[am doing]] my classes {{right now}}.",
        defaultPrimaryLabel: "am doing",
        defaultSecondaryLabel: "right now",
      },
      {
        labelUk: "Тимчасова дія (today / this week)",
        graphVariant: "duration_span",
        exampleTagged: "I [[am taking]] an intensive course {{this week}}.",
        defaultPrimaryLabel: "am taking",
        defaultSecondaryLabel: "this week",
      },
      {
        labelUk: "Запланована домовленість у майбутньому",
        graphVariant: "future_arrangement",
        exampleTagged: "I [[am meeting]] my tutor {{tonight at 7}}.",
        defaultPrimaryLabel: "am meeting",
        defaultSecondaryLabel: "tonight at 7",
      },
      {
        labelUk: "Розвиток і зміна (more and more)",
        graphVariant: "developing_trend",
        exampleTagged: "My English [[is getting]] {{better and better}}.",
        defaultPrimaryLabel: "is getting",
        defaultSecondaryLabel: "better and better",
      },
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
    useCaseSpecs: [
      {
        labelUk: "Новини та свіжий результат",
        graphVariant: "before_cutoff",
        exampleTagged: "I [[have done]] my classes {{already}}.",
        defaultPrimaryLabel: "have done",
        defaultCutoffLabel: "already",
      },
      {
        labelUk: "Життєвий досвід (ever / never / before)",
        graphVariant: "life_experience",
        exampleTagged: "I [[have visited]] London {{twice}}.",
        defaultPrimaryLabel: "have visited",
        defaultSecondaryLabel: "twice",
        defaultCutoffLabel: "NOW",
      },
      {
        labelUk: "Незавершений стан досі (для state verbs)",
        graphVariant: "duration_up_to_cutoff",
        exampleTagged: "I [[have known]] her <<since 2021>>.",
        defaultPrimaryLabel: "have known",
        defaultCutoffLabel: "NOW",
      },
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
    useCaseSpecs: [
      {
        labelUk: "Незавершена тривала дія, що триває досі (for / since)",
        graphVariant: "duration_up_to_cutoff",
        exampleTagged: "I [[have been studying]] <<for two hours>> {{today}}.",
        defaultPrimaryLabel: "have been studying",
        defaultCutoffLabel: "today",
      },
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
    useCaseSpecs: [
      {
        labelUk: "Факти й прогнози в майбутньому",
        graphVariant: "single_fact",
        exampleTagged: "I [[will finish]] my classes {{tomorrow}}.",
        defaultPrimaryLabel: "will finish",
        defaultSecondaryLabel: "tomorrow",
      },
      {
        labelUk: "Спонтанні рішення та обіцянки",
        graphVariant: "single_fact",
        exampleTagged: "Don't worry, I [[will help]] you {{right away}}.",
        defaultPrimaryLabel: "will help",
        defaultSecondaryLabel: "right away",
      },
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
    useCaseSpecs: [
      {
        labelUk: "У конкретний час у майбутньому (at 11 tomorrow)",
        graphVariant: "point_in_progress",
        exampleTagged: "I [[will be doing]] my classes {{at 11 tomorrow}}.",
        defaultPrimaryLabel: "will be doing",
        defaultSecondaryLabel: "at 11 tomorrow",
      },
      {
        labelUk: "Тривалість процесу (from ... to)",
        graphVariant: "duration_span",
        exampleTagged:
          "I [[will be working]] on this {{from 2 to 5 tomorrow}}.",
        defaultPrimaryLabel: "will be working",
        defaultSecondaryLabel: "from 2 to 5 tomorrow",
      },
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
    useCaseSpecs: [
      {
        labelUk: "Дія завершиться ДО моменту в майбутньому (by)",
        graphVariant: "before_cutoff",
        exampleTagged: "I [[will have done]] my classes {{by 7 pm tomorrow}}.",
        defaultPrimaryLabel: "will have done",
        defaultCutoffLabel: "by 7 pm tomorrow",
      },
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
    useCaseSpecs: [
      {
        labelUk: "Тривала дія ДО певного моменту в майбутньому",
        graphVariant: "duration_up_to_cutoff",
        exampleTagged:
          "I [[will have been working]] <<for 5 years>> {{by next month}}.",
        defaultPrimaryLabel: "will have been working",
        defaultCutoffLabel: "by next month",
      },
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

function cleanTimelineCueLabel(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[,.!?;:]+$/g, "").trim();
}

/**
 * Extracts crisp primary/secondary labels and an aligned Perfect boundary cue for the timeline.
 */
export function extractAspectTimelineLabels(
  cellKey: AspectCellKey,
  aspectTime: AspectTime,
  parsedSentence: { plainText: string; segments: SentenceSegment[] } | null,
  activeUseCaseSpec: AspectUseCaseSpec,
): AspectTimelineLabels {
  const emeraldSegments = (parsedSentence?.segments ?? [])
    .filter((segment) => segment.color === "emerald")
    .map((segment) => cleanTimelineCueLabel(segment.text))
    .filter(Boolean);
  const skySegments = (parsedSentence?.segments ?? [])
    .filter((segment) => segment.color === "sky")
    .map((segment) => cleanTimelineCueLabel(segment.text))
    .filter(Boolean);
  const amberSegments = (parsedSentence?.segments ?? [])
    .filter((segment) => segment.color === "amber")
    .map((segment) => cleanTimelineCueLabel(segment.text))
    .filter(Boolean);

  const primaryLabel =
    emeraldSegments[0] ?? activeUseCaseSpec.defaultPrimaryLabel ?? null;
  const secondaryLabel =
    skySegments[0] ?? activeUseCaseSpec.defaultSecondaryLabel ?? null;
  const tertiaryLabel = amberSegments[0] ?? null;

  const isDurationOrStart = (cue: string) => /^(for|since)\s+/i.test(cue);
  const isExperienceCount = (cue: string) =>
    /^(ever|never|once|twice|\d+\s+times)$/i.test(cue);

  const durationOrStartLabel =
    tertiaryLabel ??
    skySegments.find((cue) => isDurationOrStart(cue)) ??
    null;

  const boundaryCueFromSky =
    skySegments.find(
      (cue) =>
        !isDurationOrStart(cue) &&
        !isExperienceCount(cue) &&
        /\b(before|by|when|until|till|already|just|yet|now|today|this|so\s+far)\b/i.test(
          cue,
        ),
    ) ??
    skySegments.find(
      (cue) => !isDurationOrStart(cue) && !isExperienceCount(cue),
    ) ??
    null;

  let cutoffLabel =
    boundaryCueFromSky ??
    activeUseCaseSpec.defaultCutoffLabel ??
    ASPECT_MATRIX_META[cellKey].timeCueExample;

  if (aspectTime === "present") {
    const cleaned = cleanTimelineCueLabel(cutoffLabel);
    if (!cleaned || /^now$/i.test(cleaned) || /^right\s+now$/i.test(cleaned)) {
      cutoffLabel = "NOW";
    } else if (/^now\b/i.test(cleaned)) {
      cutoffLabel = cleaned;
    } else {
      cutoffLabel = `NOW · ${cleaned}`;
    }
  }

  return {
    primaryLabel,
    secondaryLabel,
    tertiaryLabel,
    durationOrStartLabel,
    cutoffLabel,
  };
}

/**
 * Matches typical tense markers against the sentence displayed on the timeline.
 */
export function resolveActiveTimeMarkers(
  cellKey: AspectCellKey,
  parsedSentence: { plainText: string; segments: SentenceSegment[] } | null,
  options?: {
    graphVariant?: AspectGraphVariant;
  },
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

  const skipFallbackSyntheticChip =
    options?.graphVariant === "general_truth" ||
    options?.graphVariant === "parallel_long" ||
    options?.graphVariant === "sequence";

  if (
    !skipFallbackSyntheticChip &&
    skyCues.length > 0 &&
    !resolved.some((marker) => marker.isActive)
  ) {
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
    selectedUseCaseIndex?: number | null;
  },
): ResolvedUseCase[] {
  const specs = ASPECT_MATRIX_META[cellKey].useCaseSpecs;

  if (specs.length === 1) {
    return [
      {
        index: 0,
        label: specs[0].labelUk,
        graphVariant: specs[0].graphVariant,
        isActive: true,
      },
    ];
  }

  if (
    typeof options?.selectedUseCaseIndex === "number" &&
    options.selectedUseCaseIndex >= 0 &&
    options.selectedUseCaseIndex < specs.length
  ) {
    return specs.map((spec, idx) => ({
      index: idx,
      label: spec.labelUk,
      graphVariant: spec.graphVariant,
      isActive: idx === options.selectedUseCaseIndex,
    }));
  }

  if (!parsedSentence) {
    return specs.map((spec, idx) => ({
      index: idx,
      label: spec.labelUk,
      graphVariant: spec.graphVariant,
      isActive: idx === 0,
    }));
  }

  if (
    options?.detectedCellKey === cellKey &&
    typeof options.detectedUseCaseIndex === "number" &&
    options.detectedUseCaseIndex >= 0 &&
    options.detectedUseCaseIndex < specs.length
  ) {
    return specs.map((spec, idx) => ({
      index: idx,
      label: spec.labelUk,
      graphVariant: spec.graphVariant,
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
      if (
        /\b(while|as)\b/i.test(text) ||
        (text.match(/\b(was|were)\s+\w+ing\b/gi)?.length ?? 0) >= 2
      ) {
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

  return specs.map((spec, idx) => ({
    index: idx,
    label: spec.labelUk,
    graphVariant: spec.graphVariant,
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

// ============================================================================
// SECTION 4: PASSIVE VOICE (SIMPLE CONVERSION + MODALS + INFINITIVES + GERUNDS)
// ============================================================================

export type PassiveCategory = "basic" | "modal_perfect" | "infinitive" | "gerund";

export type PassiveVoiceFocus = "active" | "passive";

export type PassiveDerivationStep = 1 | 2 | 3;

export interface PassiveCategoryMeta {
  id: PassiveCategory;
  labelUk: string;
  shortLabelUk: string;
  formulaBadge: string;
  headerTitleUk: string;
  subtitleUk: string;
  structureFormula: string;
  functionsUk: string[];
  modeKind: "conversion" | "derivation";
}

export interface PassivePreset {
  id: string;
  category: PassiveCategory;
  label: string;
  badgeText: string;
  functionUk: string;
  activeTagged: string;
  bridgeLabel: string;
  passiveTagged: string;
  altPassiveTagged?: string;
  altPassiveNoteUk?: string;
  focusPosition: Record<PassiveVoiceFocus, number>;
  verbPatternTitle?: string;
  verbPatternExplanationUk?: string;
  ukThoughtCue?: string;
  bridgeStepTagged?: string;
  step2NoteUk?: string;
  step3NoteUk?: string;
}

export interface PassiveFormEntry {
  activeTagged: string;
  passiveTagged: string;
  bridgeLabel: string;
  badgeText: string;
  functionUk: string;
  altPassiveTagged?: string;
  altPassiveNoteUk?: string;
  verbPatternTitle?: string;
  verbPatternExplanationUk?: string;
  ukThoughtCue?: string;
  bridgeStepTagged?: string;
  step2NoteUk?: string;
  step3NoteUk?: string;
}

export interface PassiveSentenceTemplate {
  id: string;
  labelUk: string;
  forms: Record<PassiveCategory, PassiveFormEntry>;
}

export const PASSIVE_CATEGORIES: PassiveCategoryMeta[] = [
  {
    id: "basic",
    labelUk: "Базовий пасив",
    shortLabelUk: "be + V3 · прості часи",
    formulaBadge: "S + be + V3",
    headerTitleUk: "Пасивний стан · Базова трансформація",
    subtitleUk: "Пряме перетворення Active → Passive, 2 додатки та прийменники",
    structureFormula: "Object → Subject + be (у часі) + V3 + (by agent)",
    functionsUk: [
      "Акцент на дії та об'єкті, а не на виконавці",
      "Невідомий, очевидний або неозначений виконавець (people / they)",
      "Збереження прийменника після дієслова (knocked over, spoken to)",
    ],
    modeKind: "conversion",
  },
  {
    id: "modal_perfect",
    labelUk: "Modals + have",
    shortLabelUk: "модальні в минулому",
    formulaBadge: "modal + have been + V3",
    headerTitleUk: "Пасивний стан · Модальні в минулому",
    subtitleUk: "Оцінка або припущення щодо пасивної дії в минулому",
    structureFormula: "Subject + could / must / should / might + have been + V3",
    functionsUk: [
      "Припущення або впевненість щодо минулої події (must / might)",
      "Можливість або докір у минулому (could / should have been done)",
    ],
    modeKind: "conversion",
  },
  {
    id: "infinitive",
    labelUk: "З інфінітивом",
    shortLabelUk: "(not) to be + V3",
    formulaBadge: "Verb + (not) to be + V3",
    headerTitleUk: "Пасивний стан · Інфінітив (to be + V3)",
    subtitleUk: "Згортання підрядного речення після дієслів моделі V + to V0",
    structureFormula: "Trigger Verb (want / expect / seem) + (not) to be + V3",
    functionsUk: [
      "Після дієслів і іменників, що керують інфінітивом з to",
      "Спрощення конструкції типу «я хочу, щоб мені...» у природне to be + V3",
    ],
    modeKind: "derivation",
  },
  {
    id: "gerund",
    labelUk: "З герундієм",
    shortLabelUk: "(not) being + V3",
    formulaBadge: "Verb / Prep + being + V3",
    headerTitleUk: "Пасивний стан · Герундій (being + V3)",
    subtitleUk: "Згортання підрядного речення після дієслів ставлення й прийменників",
    structureFormula: "Trigger Verb / Preposition (hate / remember / of) + being + V3",
    functionsUk: [
      "Після дієслів емоцій, пам'яті та уникнення (hate, remember, avoid)",
      "Після будь-якого прийменника (afraid of, without, before)",
    ],
    modeKind: "derivation",
  },
];

export const PASSIVE_PRESETS: PassivePreset[] = [
  // ---- BASIC CONVERSION (Tenses + Screenshot 1 special cases) ----
  {
    id: "basic-present-simple",
    category: "basic",
    label: "Present Simple",
    badgeText: "am / is / are + V3",
    functionUk: "Регулярний або постійний факт у пасиві — змінюємо лише be у Present Simple.",
    activeTagged: "Millions of tourists [[visit]] <<Kyiv>> {{every year}}.",
    bridgeLabel: "Object → Subject · am / is / are + V3",
    passiveTagged: "<<Kyiv>> [[is visited]] by millions of tourists {{every year}}.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "basic-past-simple",
    category: "basic",
    label: "Past Simple",
    badgeText: "was / were + V3",
    functionUk: "Завершена дія в минулому з фокусом на результаті чи об'єкті.",
    activeTagged: "A famous architect [[designed]] <<this bridge>> {{in 1920}}.",
    bridgeLabel: "Object → Subject · was / were + V3",
    passiveTagged: "<<This bridge>> [[was designed]] by a famous architect {{in 1920}}.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "basic-present-continuous",
    category: "basic",
    label: "Present Continuous",
    badgeText: "is being + V3",
    functionUk: "Процес просто зараз: додаємо being перед V3, щоб зберегти тривалість.",
    activeTagged: "Mechanics [[are repairing]] <<my car>> {{right now}}.",
    bridgeLabel: "is / are + being + V3",
    passiveTagged: "<<My car>> [[is being repaired]] {{right now}}.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "basic-present-perfect",
    category: "basic",
    label: "Present Perfect",
    badgeText: "has been + V3",
    functionUk: "Результат на цей момент: між have/has та V3 обов'язково з'являється been.",
    activeTagged: "They [[have already published]] <<the report>>.",
    bridgeLabel: "have / has + been + V3",
    passiveTagged: "<<The report>> [[has already been published]].",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "basic-future-simple",
    category: "basic",
    label: "Future Simple",
    badgeText: "will be + V3",
    functionUk: "Майбутня пасивна дія або офіційне оголошення.",
    activeTagged: "The team [[will announce]] <<the winner>> {{tomorrow}}.",
    bridgeLabel: "will + be + V3",
    passiveTagged: "<<The winner>> [[will be announced]] {{tomorrow}}.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "basic-two-objects",
    category: "basic",
    label: "2 objects",
    badgeText: "2 пасивні підмети",
    functionUk: "Дієслово з двома додатками: будь-який із них може стати підметом у пасиві.",
    activeTagged: "He [[gave]] <<this task>> {{to them}} 2 weeks ago.",
    bridgeLabel: "Непрямий або прямий додаток → Subject",
    passiveTagged: "<<They>> [[were given]] <<this task>> {{2 weeks ago}}.",
    altPassiveTagged: "<<This task>> [[was given]] {{to them}} 2 weeks ago.",
    altPassiveNoteUk:
      "Обидва варіанти правильні: частіше підметом стає особа (They were given...), але можна винести і предмет (This task was given to them...).",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "basic-prepositions",
    category: "basic",
    label: "Prepositions",
    badgeText: "Verb + Preposition",
    functionUk: "Фразовий прийменник нерозривно лишається поруч із дієсловом у V3.",
    activeTagged: "The cat [[knocked]] {{over}} <<the vase on the table>>.",
    bridgeLabel: "Прийменник лишається після дієслова",
    passiveTagged: "<<The vase on the table>> [[was knocked]] {{over}} by the cat.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "basic-vague-subject",
    category: "basic",
    label: "Vague subject",
    badgeText: "It is said / S + is believed to",
    functionUk: "Загальний підмет (People / They say) прибираємо через безособову чи інфінітивну форму.",
    activeTagged: "<<People>> [[believe]] Mohan is the best doctor in town.",
    bridgeLabel: "People believe → is believed to / It is believed",
    passiveTagged: "<<Mohan>> [[is believed]] {{to be}} the best doctor in town.",
    altPassiveTagged:
      "<<It>> [[is believed]] that Mohan is the best doctor in town. / <<It>> [[is said]] that the earth is round.",
    altPassiveNoteUk:
      "Дієслова думки й чуток (say, believe, assume) з неозначеним підметом people/they дають дві моделі: безособову (It is said/believed that...) або особову (Mohan is believed to be...).",
    focusPosition: { active: 15, passive: 85 },
  },

  // ---- MODALS + HAVE (Screenshot 1 bottom-middle) ----
  {
    id: "modal-could-have",
    category: "modal_perfect",
    label: "could have been",
    badgeText: "could + have been + V3",
    functionUk: "Можливість у минулому, яка могла бути реалізована.",
    activeTagged: "Someone [[could have done]] <<it>> {{yesterday}}.",
    bridgeLabel: "could + have + been + V3",
    passiveTagged: "<<It>> [[could have been done]] {{yesterday}}.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "modal-must-have",
    category: "modal_perfect",
    label: "must have been",
    badgeText: "must + have been + V3",
    functionUk: "Логічний висновок або висока впевненість щодо минулої дії.",
    activeTagged: "The team [[must have completed]] <<the project>> {{by the deadline}}.",
    bridgeLabel: "must + have + been + V3",
    passiveTagged: "<<The project>> [[must have been completed]] {{by the deadline}}.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "modal-should-have",
    category: "modal_perfect",
    label: "should have been",
    badgeText: "should + have been + V3",
    functionUk: "Докір або нереалізована рекомендація щодо минулого.",
    activeTagged: "They [[should have checked]] <<the contract>> {{earlier}}.",
    bridgeLabel: "should + have + been + V3",
    passiveTagged: "<<The contract>> [[should have been checked]] {{earlier}}.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "modal-might-have",
    category: "modal_perfect",
    label: "might have been",
    badgeText: "might + have been + V3",
    functionUk: "Ймовірне припущення про подію, що вже сталася.",
    activeTagged: "Someone [[might have left]] <<the door>> {{open}}.",
    bridgeLabel: "might + have + been + V3",
    passiveTagged: "<<The door>> [[might have been left]] {{open}}.",
    focusPosition: { active: 15, passive: 85 },
  },

  // ---- WITH INFINITIVES (Screenshot 1 top-right & Screenshot 2 bottom) ----
  {
    id: "inf-want-tell",
    category: "infinitive",
    label: "want to be told",
    badgeText: "want + to be + V3",
    functionUk: "Згортання конструкції «хочу, щоб мені сказали» у пасивний інфінітив.",
    ukThoughtCue: "Я хочу, щоб мені сказали, що робити",
    activeTagged: "I <<want>> that {{others}} [[tell]] me what to do.",
    bridgeStepTagged: "I <<want>> ~~that I am~~ [[told]] ~~by others~~ what to do.",
    bridgeLabel: "Скорочуємо that I am + by others → to be told",
    passiveTagged: "I <<want>> [[to be told]] what to do.",
    verbPatternTitle: "want + to + V0",
    verbPatternExplanationUk:
      "Дієслово want в англійській керує інфінітивом із to (want to do / want someone to do), а не підрядним реченням із that. Коли той самий підмет I отримує дію над собою, замість важкого «that I am told» ставимо пасивний інфінітив to be told.",
    step2NoteUk:
      "Переводимо підрядне речення у пасив (I am told) і відкидаємо зайве that I am та неозначеного агента by others.",
    step3NoteUk:
      "Модель дієслова want вимагає інфінітив із to, тому дієслово be повертається в початкову форму: to be + V3.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "inf-work-to-be-done",
    category: "infinitive",
    label: "work to be done",
    badgeText: "noun + to be + V3",
    functionUk: "Пасивний інфінітив як означення після іменника (що треба зробити).",
    ukThoughtCue: "Ходімо, є робота, яку потрібно зробити!",
    activeTagged: "Come on, there is <<work>> [[to do]]!",
    bridgeStepTagged: "Come on, there is <<work>> ~~that should be~~ [[done]] ~~by us~~!",
    bridgeLabel: "noun + to do → noun + to be done",
    passiveTagged: "Come on, there is <<work>> [[to be done]]!",
    verbPatternTitle: "noun (work / tasks) + to + V0",
    verbPatternExplanationUk:
      "Після іменників на кшталт work, a lot, nothing вживаємо означення-інфінітив із to. Варіант to be done звучить природніше, коли фокус саме на роботі, яку мають виконати (а не на тому, хто її робить).",
    step2NoteUk:
      "Розкриваємо зміст як пасив над роботою (work that is/should be done) і прибираємо сполучник that + be.",
    step3NoteUk:
      "Залишаємо пасивний інфінітив to be done безпосередньо після іменника work.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "inf-expect-invite",
    category: "infinitive",
    label: "expect to be invited",
    badgeText: "expect + to be + V3",
    functionUk: "Очікування пасивної дії, спрямованої на підмет.",
    ukThoughtCue: "Вона очікує, що її запросять на конференцію",
    activeTagged: "She <<expects>> that {{they}} [[will invite]] her to the conference.",
    bridgeStepTagged: "She <<expects>> ~~that she will be~~ [[invited]] ~~by them~~ to the conference.",
    bridgeLabel: "expect + that she will be → expect to be + V3",
    passiveTagged: "She <<expects>> [[to be invited]] to the conference.",
    verbPatternTitle: "expect + to + V0",
    verbPatternExplanationUk:
      "Дієслова планування й очікування (expect, hope, promise, refuse) поєднуються з інфінітивом із to. Якщо підмет сам стає об'єктом дії, використовуємо форму to be invited замість підрядного речення з that.",
    step2NoteUk:
      "Змінюємо підрядну частину на пасив (she will be invited) та скорочуємо повтор підмета й by them.",
    step3NoteUk:
      "З'єднуємо expect з пасивним інфінітивом to be + V3, зберігаючи модель дієслова expect.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "inf-not-to-be",
    category: "infinitive",
    label: "not to be disturbed",
    badgeText: "not to be + V3",
    functionUk: "Заперечна форма пасивного інфінітива: частка not стоїть перед to.",
    ukThoughtCue: "Він сподівається, що його не потурбують під час зустрічі",
    activeTagged: "He <<hopes>> that {{no one}} [[disturbs]] him during the meeting.",
    bridgeStepTagged: "He <<hopes>> ~~that he is~~ {{not}} [[disturbed]] ~~by anyone~~ during the meeting.",
    bridgeLabel: "Заперечення not + to be + V3",
    passiveTagged: "He <<hopes>> {{not}} [[to be disturbed]] during the meeting.",
    verbPatternTitle: "hope + (not) + to + V0",
    verbPatternExplanationUk:
      "Дієслово hope вимагає інфінітива з to. У заперечній формі частка not завжди передує інфінітиву — ставимо not перед to (not to be disturbed).",
    step2NoteUk:
      "Перетворюємо заперечне підрядне речення у пасив (he is not disturbed) і викреслюємо зайві слова.",
    step3NoteUk:
      "Виносимо not перед маркером інфінітива to: not to be disturbed.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "inf-perfect-seem",
    category: "infinitive",
    label: "to have been sent",
    badgeText: "to have been + V3",
    functionUk: "Перфектний пасивний інфінітив для дії, яка відбулася раніше за теперішній висновок.",
    ukThoughtCue: "Здається, що лист надіслали вчора",
    activeTagged: "It <<seems>> that {{someone}} [[sent]] the letter {{yesterday}}.",
    bridgeStepTagged: "The letter <<seems>> ~~that it was~~ [[sent]] ~~by someone~~ {{yesterday}}.",
    bridgeLabel: "seem + минула дія → to have been + V3",
    passiveTagged: "The letter <<seems>> [[to have been sent]] {{yesterday}}.",
    verbPatternTitle: "seem / appear + to + V0 (perfect: to have been V3)",
    verbPatternExplanationUk:
      "Дієслово seem вимагає інфінітива з to. Оскільки надсилання листа сталося вчора (раніше за теперішнє враження seems), беремо перфектну форму пасивного інфінітива: to have been sent.",
    step2NoteUk:
      "Виносимо об'єкт the letter у позицію підмета перед seems та прибираємо that it was і by someone.",
    step3NoteUk:
      "Щоб показати передування дії в минулому (yesterday), ставимо to have been + V3.",
    focusPosition: { active: 15, passive: 85 },
  },

  // ---- WITH GERUNDS (Screenshot 2 top & Screenshot 1 bottom-right) ----
  {
    id: "ger-hate-spoken-to",
    category: "gerund",
    label: "being spoken to",
    badgeText: "hate + being + V3 (+ prep)",
    functionUk: "Згортання «коли зі мною говорять» у пасивний герундій зі збереженням прийменника to.",
    ukThoughtCue: "Я ненавиджу, коли до мене говорять, наче до дитини",
    activeTagged: "I <<hate>> when {{people}} [[speak]] {{to me}} as if I'm a child.",
    bridgeStepTagged: "I <<hate>> ~~when I am~~ [[spoken]] {{to}} ~~by people~~ as if I'm a child.",
    bridgeLabel: "Скорочуємо when I am + by people → being spoken to",
    passiveTagged: "I <<hate>> [[being spoken]] {{to}} as if I'm a child.",
    verbPatternTitle: "hate / love / dislike + V-ing",
    verbPatternExplanationUk:
      "Дієслово hate керує герундієм (hate doing) для загального ставлення. Оскільки мовець — пасивний об'єкт дії, підрядне речення згортається у пасивний герундій being spoken, а прийменник to лишається при дієслові.",
    step2NoteUk:
      "Спочатку ставимо підрядну частину у пасив (when I am spoken to by people), далі прибираємо when I am і by people, але зберігаємо прийменник to.",
    step3NoteUk:
      "Після hate потрібен герундій (V-ing), тому am замінюється на being → being spoken to.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "ger-remember-taken",
    category: "gerund",
    label: "remember being taken",
    badgeText: "remember + being + V3",
    functionUk: "Спогад про минулу дію, яка відбулася над мовцем.",
    ukThoughtCue: "Я пам'ятаю, як мене везли до лікарні",
    activeTagged: "I <<remember>> how {{they}} [[took]] me to the hospital.",
    bridgeStepTagged: "I <<remember>> ~~how I was~~ [[taken]] ~~by them~~ to the hospital.",
    bridgeLabel: "remember + how I was taken → being taken",
    passiveTagged: "I <<remember>> [[being taken]] to the hospital.",
    verbPatternTitle: "remember + V-ing (спогад про минуле)",
    verbPatternExplanationUk:
      "Дієслово remember змінює значення залежно від моделі: remember + to V0 (не забути зробити), remember + V-ing (пам'ятати пережите). Тут ідеться про спогад, тому ставимо пасивний герундій being taken.",
    step2NoteUk:
      "Переводимо спогад у пасив (how I was taken by them) і викреслюємо зайве how I was та by them.",
    step3NoteUk:
      "Отримуємо чітку форму спогаду: remember being taken.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "ger-avoid-seen",
    category: "gerund",
    label: "avoid being seen",
    badgeText: "avoid + being + V3",
    functionUk: "Уникнення небажаної дії щодо себе.",
    ukThoughtCue: "Вона уникала того, щоб її помітили в аеропорту",
    activeTagged: "She <<avoided>> that {{reporters}} [[saw]] her at the airport.",
    bridgeStepTagged: "She <<avoided>> ~~that she was~~ [[seen]] ~~by reporters~~ at the airport.",
    bridgeLabel: "avoid + V-ing → avoid being + V3",
    passiveTagged: "She <<avoided>> [[being seen]] at the airport.",
    verbPatternTitle: "avoid + V-ing (без інфінітива)",
    verbPatternExplanationUk:
      "Після дієслова avoid в англійській можливий лише герундій (V-ing); інфінітив з to є грубою помилкою. У пасиві форма avoid V-ing перетворюється на avoid being seen.",
    step2NoteUk:
      "Змінюємо підрядне речення у пасив і відкидаємо that she was та by reporters.",
    step3NoteUk:
      "Узгоджуємо з моделлю avoid + V-ing → being seen.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "ger-preposition-afraid",
    category: "gerund",
    label: "afraid of being criticized",
    badgeText: "preposition + being + V3",
    functionUk: "Пасивний герундій після будь-якого прийменника.",
    ukThoughtCue: "Він боїться, що його розкритикують на зустрічі",
    activeTagged: "He <<is afraid of>> {{colleagues}} [[criticizing]] him at the meeting.",
    bridgeStepTagged: "He <<is afraid of>> ~~that he is~~ [[criticized]] ~~by colleagues~~ at the meeting.",
    bridgeLabel: "Preposition (of) + being + V3",
    passiveTagged: "He <<is afraid of>> [[being criticized]] at the meeting.",
    verbPatternTitle: "Preposition (of / about / without) + V-ing",
    verbPatternExplanationUk:
      "Залізний verb pattern: після будь-якого прийменника (of, about, in, without) дієслово вживається у формі герундія (V-ing). Коли дія пасивна, після прийменника завжди стоїть being + V3.",
    step2NoteUk:
      "Фіксуємо об'єкт дії (він сам) і прибираємо зайвий повтор підмета та виконавця.",
    step3NoteUk:
      "Після прийменника of ставимо пасивний герундій being criticized.",
    focusPosition: { active: 15, passive: 85 },
  },
  {
    id: "ger-not-being-invited",
    category: "gerund",
    label: "not being invited",
    badgeText: "not + being + V3",
    functionUk: "Заперечна форма пасивного герундія з not перед being.",
    ukThoughtCue: "Їм не подобається, коли їх не запрошують на командні події",
    activeTagged: "They <<dislike>> when {{people}} don't [[invite]] them to team events.",
    bridgeStepTagged: "They <<dislike>> ~~when they are~~ {{not}} [[invited]] ~~by people~~ to team events.",
    bridgeLabel: "dislike + not + being + V3",
    passiveTagged: "They <<dislike>> {{not}} [[being invited]] to team events.",
    verbPatternTitle: "dislike / mind + (not) + V-ing",
    verbPatternExplanationUk:
      "Дієслово dislike завжди керує герундієм (dislike doing). Для заперечення в пасивному герундії частка not ставиться безпосередньо перед being: not being invited.",
    step2NoteUk:
      "Згортаємо заперечне підрядне речення, лишаючи маркер заперечення not перед дієсловом.",
    step3NoteUk:
      "Перетворюємо are → being згідно з моделлю dislike + V-ing: not being invited.",
    focusPosition: { active: 15, passive: 85 },
  },
];

export const PASSIVE_SENTENCE_TEMPLATES: PassiveSentenceTemplate[] = [
  {
    id: "help",
    labelUk: "Підтримка (support)",
    forms: {
      basic: {
        activeTagged: "The mentor [[supports]] <<the students>> {{every week}}.",
        passiveTagged: "<<The students>> [[are supported]] by the mentor {{every week}}.",
        bridgeLabel: "Present Simple: am / is / are + V3",
        badgeText: "are + V3",
        functionUk: "Регулярна дія у теперішньому пасиві.",
      },
      modal_perfect: {
        activeTagged: "The mentor [[could have supported]] <<the students>> {{earlier}}.",
        passiveTagged: "<<The students>> [[could have been supported]] {{earlier}}.",
        bridgeLabel: "could + have been + V3",
        badgeText: "modal + have been + V3",
        functionUk: "Нереалізована можливість підтримки в минулому.",
      },
      infinitive: {
        ukThoughtCue: "Студенти хочуть, щоб їх підтримували",
        activeTagged: "The students <<want>> that {{mentors}} [[support]] them.",
        bridgeStepTagged: "The students <<want>> ~~that they are~~ [[supported]] ~~by mentors~~.",
        passiveTagged: "The students <<want>> [[to be supported]].",
        bridgeLabel: "want + to + V0 → to be supported",
        badgeText: "want + to be + V3",
        functionUk: "Дієслово want вимагає пасивного інфінітива.",
        verbPatternTitle: "want + to + V0",
        verbPatternExplanationUk:
          "Дієслово want завжди приймає інфінітив з to, тому пасивна форма — to be supported.",
        step2NoteUk: "Прибираємо that they are та неозначеного агента by mentors.",
        step3NoteUk: "Оформлюємо фінал як пасивний інфінітив to be supported.",
      },
      gerund: {
        ukThoughtCue: "Студентам подобається, коли їх підтримують",
        activeTagged: "The students <<enjoy>> when {{mentors}} [[support]] them.",
        bridgeStepTagged: "The students <<enjoy>> ~~when they are~~ [[supported]] ~~by mentors~~.",
        passiveTagged: "The students <<enjoy>> [[being supported]].",
        bridgeLabel: "enjoy + V-ing → being supported",
        badgeText: "enjoy + being + V3",
        functionUk: "Дієслово enjoy вимагає пасивного герундія.",
        verbPatternTitle: "enjoy + V-ing",
        verbPatternExplanationUk:
          "Після enjoy вживається виключно герундій (V-ing), тому в пасиві отримуємо being supported.",
        step2NoteUk: "Викреслюємо зайве when they are та by mentors.",
        step3NoteUk: "Замінюємо are на герундій being: enjoy being supported.",
      },
    },
  },
];
