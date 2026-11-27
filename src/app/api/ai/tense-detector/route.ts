import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateFromGeminiWithUsage, GEMINI_MODEL } from "@/lib/gemini/client";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import {
  ASPECT_MATRIX_META,
  getAspectCellKey,
  resolveAspectType,
  sanitizeConditionalSlots,
  type AspectCellKey,
  type ConditionalVariantKey,
  type PassiveCategory,
  type PassiveFormEntry,
  type ReportedCategory,
  type ReportedFormEntry,
} from "@/lib/grammar/tense-detector-data";

const ASPECT_CELL_KEYS: readonly AspectCellKey[] = [
  "past_simple",
  "past_continuous",
  "past_perfect",
  "past_perfect_continuous",
  "present_simple",
  "present_continuous",
  "present_perfect",
  "present_perfect_continuous",
  "future_simple",
  "future_continuous",
  "future_perfect",
  "future_perfect_continuous",
];

const CONDITIONAL_KEYS: readonly ConditionalVariantKey[] = [
  "zero",
  "first",
  "second",
  "third",
  "mixed_past_present",
  "mixed_present_past",
];

const REPORTED_CATEGORY_KEYS: readonly ReportedCategory[] = [
  "statement",
  "yes_no_question",
  "wh_question",
  "imperative",
];

const PASSIVE_CATEGORY_KEYS: readonly PassiveCategory[] = [
  "basic",
  "modal_perfect",
  "infinitive",
  "gerund",
];

const requestSchema = z.object({
  sentence: z.string().trim().min(2).max(400),
  preferredMode: z
    .enum(["aspects", "conditionals", "reported", "passive"])
    .optional(),
});

const reportedFormEntrySchema = z.object({
  directTagged: z.string().trim().min(1),
  reportedTagged: z.string().trim().min(1),
  directBadge: z.string().trim().nullable().optional().catch(null),
  reportedBadge: z.string().trim().nullable().optional().catch(null),
  bridgeLabelUk: z.string().trim().nullable().optional().catch(null),
  directSlot: z.union([z.literal(0), z.literal(1), z.literal(2)]).catch(2),
  reportedSlot: z.union([z.literal(0), z.literal(1), z.literal(2)]).catch(1),
  hasBackshift: z.boolean().catch(true),
});

const passiveFormEntrySchema = z.object({
  activeTagged: z.string().trim().nullable().optional().catch(null),
  passiveTagged: z.string().trim().nullable().optional().catch(null),
  active: z.string().trim().nullable().optional().catch(null),
  passive: z.string().trim().nullable().optional().catch(null),
  bridgeLabel: z.string().trim().nullable().optional().catch(null),
  badgeText: z.string().trim().nullable().optional().catch(null),
  functionUk: z.string().trim().nullable().optional().catch(null),
  altPassiveTagged: z.string().trim().nullable().optional().catch(null),
  altPassiveNoteUk: z.string().trim().nullable().optional().catch(null),
  verbPatternTitle: z.string().trim().nullable().optional().catch(null),
  verbPatternExplanationUk: z.string().trim().nullable().optional().catch(null),
  ukThoughtCue: z.string().trim().nullable().optional().catch(null),
  bridgeStepTagged: z.string().trim().nullable().optional().catch(null),
  step2NoteUk: z.string().trim().nullable().optional().catch(null),
  step3NoteUk: z.string().trim().nullable().optional().catch(null),
});

const aiResponseSchema = z.object({
  isCorrect: z.boolean(),
  correctedSentence: z.string().trim().min(1),
  shortLabelUk: z.string().trim().min(1).max(60),
  detectedMode: z.enum(["aspects", "conditionals", "reported", "passive"]),
  detectedTitle: z.string().trim().min(1).max(100),
  explanationUk: z.string().trim().min(1).max(1200),
  time: z.enum(["past", "present", "future"]).catch("present"),
  isContinuous: z.boolean().catch(false),
  isPerfect: z.boolean().catch(false),
  isStateVerb: z.boolean().catch(false),
  ifSlot: z
    .union([z.literal(0), z.literal(1), z.literal(2)])
    .catch(1),
  resultSlot: z
    .union([z.literal(0), z.literal(1), z.literal(2)])
    .catch(1),
  presentMode: z.enum(["unreal", "zero"]).catch("unreal"),
  detectedUseCaseIndex: z
    .number()
    .int()
    .min(0)
    .max(10)
    .nullable()
    .optional()
    .catch(null),
  reportedCategory: z
    .enum(["statement", "yes_no_question", "wh_question", "imperative"])
    .catch("statement"),
  passiveCategory: z
    .enum(["basic", "modal_perfect", "infinitive", "gerund"])
    .catch("basic"),
  aspectForms: z.record(z.string(), z.string()).nullable().optional(),
  conditionalForms: z.record(z.string(), z.string()).nullable().optional(),
  reportedForms: z
    .record(z.string(), reportedFormEntrySchema)
    .nullable()
    .optional(),
  passiveForms: z
    .record(z.string(), passiveFormEntrySchema)
    .nullable()
    .optional()
    .catch(null),
});

function normalizeAspectForms(
  rawForms: Record<string, string> | null | undefined,
  fallbackSentence: string,
  isStateVerb: boolean,
): Record<AspectCellKey, string> {
  const entries = ASPECT_CELL_KEYS.map((key) => {
    const candidate = rawForms?.[key]?.trim();
    return [key, candidate && candidate.length > 0 ? candidate : `[[${fallbackSentence}]]`] as const;
  });

  const normalized = Object.fromEntries(entries) as Record<AspectCellKey, string>;
  if (isStateVerb) {
    normalized.past_continuous = normalized.past_simple;
    normalized.present_continuous = normalized.present_simple;
    normalized.future_continuous = normalized.future_simple;
    normalized.past_perfect_continuous = normalized.past_perfect;
    normalized.present_perfect_continuous = normalized.present_perfect;
    normalized.future_perfect_continuous = normalized.future_perfect;
  }

  return normalized;
}

function normalizeConditionalForms(
  rawForms: Record<string, string> | null | undefined,
  fallbackSentence: string,
): Record<ConditionalVariantKey, string> {
  const entries = CONDITIONAL_KEYS.map((key) => {
    const candidate = rawForms?.[key]?.trim();
    return [key, candidate && candidate.length > 0 ? candidate : `[[${fallbackSentence}]]`] as const;
  });

  return Object.fromEntries(entries) as Record<ConditionalVariantKey, string>;
}

const REPORTED_DEFAULT_BADGES: Record<
  ReportedCategory,
  { direct: string; reported: string; bridge: string }
> = {
  statement: {
    direct: "DIRECT STATEMENT",
    reported: "REPORTED STATEMENT",
    bridge: "Зсув часу назад (Backshift)",
  },
  yes_no_question: {
    direct: "YES / NO QUESTION",
    reported: "'IF / WHETHER' + S + V",
    bridge: "if / whether + прямий порядок",
  },
  wh_question: {
    direct: "WH- + AUXILIARY VERB",
    reported: "WH- + SUBJECT + VERB",
    bridge: "Wh- + прямий порядок (без '?')",
  },
  imperative: {
    direct: "IMPERATIVE",
    reported: "TOLD / ASKED + (NOT) TO + V0",
    bridge: "V0 → (not) to + V0",
  },
};

function normalizeReportedForms(
  rawForms:
    | Record<
        string,
        { [K in keyof ReportedFormEntry]?: ReportedFormEntry[K] | null }
      >
    | null
    | undefined,
  fallbackSentence: string,
): Record<ReportedCategory, ReportedFormEntry> {
  const entries = REPORTED_CATEGORY_KEYS.map((key) => {
    const candidate = rawForms?.[key];
    const defaults = REPORTED_DEFAULT_BADGES[key];
    const directSlot =
      candidate?.directSlot === 0 ||
      candidate?.directSlot === 1 ||
      candidate?.directSlot === 2
        ? candidate.directSlot
        : 2;
    const reportedSlot =
      candidate?.reportedSlot === 0 ||
      candidate?.reportedSlot === 1 ||
      candidate?.reportedSlot === 2
        ? candidate.reportedSlot
        : key === "imperative"
          ? directSlot
          : Math.max(0, directSlot - 1) as 0 | 1 | 2;

    return [
      key,
      {
        directTagged:
          candidate?.directTagged?.trim() || `[[${fallbackSentence}]]`,
        reportedTagged:
          candidate?.reportedTagged?.trim() || `[[${fallbackSentence}]]`,
        directBadge: candidate?.directBadge?.trim() || defaults.direct,
        reportedBadge: candidate?.reportedBadge?.trim() || defaults.reported,
        bridgeLabelUk: candidate?.bridgeLabelUk?.trim() || defaults.bridge,
        directSlot,
        reportedSlot,
        hasBackshift:
          key === "imperative"
            ? false
            : candidate?.hasBackshift ?? reportedSlot < directSlot,
      },
    ] as const;
  });

  return Object.fromEntries(entries) as Record<
    ReportedCategory,
    ReportedFormEntry
  >;
}

const PASSIVE_DEFAULT_BADGES: Record<
  PassiveCategory,
  { badge: string; bridge: string; fnUk: string }
> = {
  basic: {
    badge: "be + V3",
    bridge: "Object → Subject · be + V3",
    fnUk: "Фокус на дії та об'єкті у пасивному стані.",
  },
  modal_perfect: {
    badge: "modal + have been + V3",
    bridge: "modal + have been + V3",
    fnUk: "Припущення або можливість у минулому.",
  },
  infinitive: {
    badge: "to be + V3",
    bridge: "Скорочення підрядного речення → to be + V3",
    fnUk: "Керування дієслова моделлю V + to + V0.",
  },
  gerund: {
    badge: "being + V3",
    bridge: "Скорочення підрядного речення → being + V3",
    fnUk: "Керування дієслова або прийменника моделлю V-ing.",
  },
};

function ensureHighlighted(text: string): string {
  if (
    text.includes("[[") ||
    text.includes("<<") ||
    text.includes("{{") ||
    text.includes("~~")
  ) {
    return text;
  }
  return `[[${text}]]`;
}

function normalizePassiveForms(
  rawForms:
    | Record<
        string,
        Partial<{
          activeTagged: string | null;
          passiveTagged: string | null;
          active: string | null;
          passive: string | null;
          bridgeLabel: string | null;
          badgeText: string | null;
          functionUk: string | null;
          altPassiveTagged: string | null;
          altPassiveNoteUk: string | null;
          verbPatternTitle: string | null;
          verbPatternExplanationUk: string | null;
          ukThoughtCue: string | null;
          bridgeStepTagged: string | null;
          step2NoteUk: string | null;
          step3NoteUk: string | null;
        }>
      >
    | null
    | undefined,
  fallbackPassiveSentence: string,
  originalSentence: string,
): Record<PassiveCategory, PassiveFormEntry> {
  const entries = PASSIVE_CATEGORY_KEYS.map((key) => {
    const candidate = rawForms?.[key];
    const defaults = PASSIVE_DEFAULT_BADGES[key];
    const rawActive =
      candidate?.activeTagged?.trim() ||
      candidate?.active?.trim() ||
      originalSentence.trim() ||
      fallbackPassiveSentence;
    const rawPassive =
      candidate?.passiveTagged?.trim() ||
      candidate?.passive?.trim() ||
      fallbackPassiveSentence;
    return [
      key,
      {
        activeTagged: ensureHighlighted(rawActive),
        passiveTagged: ensureHighlighted(rawPassive),
        bridgeLabel: candidate?.bridgeLabel?.trim() || defaults.bridge,
        badgeText: candidate?.badgeText?.trim() || defaults.badge,
        functionUk: candidate?.functionUk?.trim() || defaults.fnUk,
        altPassiveTagged: candidate?.altPassiveTagged?.trim() || undefined,
        altPassiveNoteUk: candidate?.altPassiveNoteUk?.trim() || undefined,
        verbPatternTitle: candidate?.verbPatternTitle?.trim() || undefined,
        verbPatternExplanationUk:
          candidate?.verbPatternExplanationUk?.trim() || undefined,
        ukThoughtCue: candidate?.ukThoughtCue?.trim() || undefined,
        bridgeStepTagged: candidate?.bridgeStepTagged?.trim() || undefined,
        step2NoteUk: candidate?.step2NoteUk?.trim() || undefined,
        step3NoteUk: candidate?.step3NoteUk?.trim() || undefined,
      } satisfies PassiveFormEntry,
    ] as const;
  });

  return Object.fromEntries(entries) as Record<
    PassiveCategory,
    PassiveFormEntry
  >;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "tutor" && profile?.role !== "superadmin") {
      return NextResponse.json(
        { error: "Доступ лише для викладача" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Будь ласка, введіть коректне речення (від 2 до 400 символів).",
        },
        { status: 400 },
      );
    }

    const quota = await checkAIQuota(user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Вичерпано місячний ліміт AI (${quota.limit}). Оновіть тариф або спробуйте пізніше.`,
          code: "QUOTA_EXCEEDED",
        },
        { status: 429 },
      );
    }

    const { sentence, preferredMode } = parsed.data;
    const useCasesGuide = ASPECT_CELL_KEYS.map(
      (cellKey) =>
        `- ${cellKey}: ${ASPECT_MATRIX_META[cellKey].useCasesUk
          .map((useCase, idx) => `[${idx}] ${useCase}`)
          .join(" | ")}`,
    ).join("\n");

    const prompt = `Analyze the following English sentence submitted by an English tutor or student on an interactive grammar whiteboard:

INPUT SENTENCE: "${sentence}"
CURRENT BOARD TAB: "${preferredMode ?? "aspects"}"

YOUR TASKS:
1. Grammar & State Verb Check:
   - Determine "isStateVerb": boolean:
     * Set "isStateVerb": true if the main verb expresses a STATE rather than a dynamic action in this context (e.g., "be" + state/adjective like "be busy / tired / happy / here", "know", "understand", "believe", "remember", "want", "need", "like", "love", "hate", "belong", "own", "seem", or stative "have" = possess, "think" = opinion, "see/hear" = perception).
     * Set "isStateVerb": false for dynamic action verbs and dynamic uses of dual-meaning verbs (e.g., "have lunch / have a meeting", "think about moving", "see a doctor").
   - Set "isCorrect": true ONLY if the sentence is grammatically accurate and natural (spelling, verb form, tense, auxiliaries, word order). If a state verb is mistakenly written in Continuous/Perfect-Continuous (e.g., "I am knowing", "I have been being busy", "She is wanting"), set "isCorrect": false!
   - Set "correctedSentence": the natural, grammatically correct English version of the sentence (keep the same meaning and core vocabulary). If a state verb was in Continuous, convert it to Simple or Perfect (e.g. "I have been being busy" -> "I have been busy", "I am knowing" -> "I know").
2. Ukrainian explanation ("explanationUk") & short label ("shortLabelUk"):
   - Write "shortLabelUk" as a crisp 2-4 word Ukrainian topic name (e.g., "Сигналізація вдома", "Зайнятість на тижні", "Купівля будинку").
   - Write "explanationUk" VERY BRIEFLY in simple, accessible Ukrainian (1-2 short sentences MAX, under 45 words):
     * If detectedMode === "aspects" and isStateVerb is true: briefly note that this is a state verb (дієслово стану), so it uses Simple/Perfect instead of Continuous (-ing).
     * If detectedMode === "passive": write 1-2 crisp Ukrainian sentences explaining (a) the passive structure used (or fixed/converted), (b) the exact Verb Pattern of the trigger verb/preposition when relevant (e.g., "Дієслово want керує інфінітивом з to (want + to V0), тому в пасиві вживаємо to be told"), and (c) any kept preposition, 2-object choice, or dropped vague agent.
     * Otherwise concisely name any fix and why the tense or conditional applies.
3. Graph Mode & Coordinates:
   - If CURRENT BOARD TAB is "passive" OR the sentence clearly demonstrates Passive Voice (uses be + V3, modal + have been + V3, passive infinitive to be + V3 / to have been + V3, or passive gerund being + V3):
     * "detectedMode": "passive"
     * "passiveCategory":
       - "modal_perfect" if modal + have (been) + V3 (e.g. could/must/should/might have been done)
       - "infinitive" if trigger verb/noun takes infinitive with to + passive (to be + V3 / not to be + V3 / to have been + V3, e.g. want to be told, work to be done, seems to have been sent, or broken calque like "I want that others tell me" / "I want being told")
       - "gerund" if trigger verb/preposition takes -ing + passive (being + V3 / not being + V3, e.g. hate being spoken to, remember being taken, avoid being seen, afraid of being criticized, or calque "hate when people speak to me" / "avoid to be seen")
       - "basic" for standard passive tenses (am/is/are/was/were/will be/is being/has been + V3), 2 objects, prepositions after verbs, vague subject ("People say / believe..."), or Active sentences converted to simple Passive on the passive tab.
     * STRICT GRAMMAR & VERB PATTERN CHECK FOR PASSIVE:
       - Valid Passive input (including short complete clauses like "I want to be told", "There is work to be done", "I hate being spoken to"): set "isCorrect": true, keep "correctedSentence" as clean natural Passive English, and classify into the exact "passiveCategory".
       - Valid Active input on "passive" tab (e.g. "The cat knocked over the vase", "He gave this task to them", "People say the earth is round"): set "isCorrect": true, put the natural Passive conversion in "correctedSentence", and explain the Active → Passive shift in "explanationUk".
       - Broken Passive / Verb-Pattern / Calque input (e.g. "I want being told", "I want that others tell me", "She avoided to be seen", dropped preposition like "I hate being spoken as if I'm a child", missing "been" in "It could have done yesterday"): set "isCorrect": false, put the corrected natural Passive sentence in "correctedSentence", and explain the fix + verb pattern in "explanationUk".
   - Else if CURRENT BOARD TAB is "reported" OR the sentence is in Indirect/Reported Speech (uses "said", "told", "asked if/whether", "asked where/when/what", "told/asked me (not) to"):
     * "detectedMode": "reported"
     * "reportedCategory": "statement" | "yes_no_question" | "wh_question" | "imperative"
     * STRICT GRAMMAR CHECK FOR REPORTED SPEECH:
       - If the user submitted a broken Reported Speech sentence (e.g. "He asked me where did she go", "She said me she is tired", "He asked me did they call", unshifted time cues like "tomorrow/yesterday/here" with past reporting verb, or "told me don't go"), set "isCorrect": false and provide the fixed Reported Speech version in "correctedSentence".
       - If the user submitted Direct Speech while on the "reported" tab (e.g. "When did they arrive yesterday?"), evaluate whether their direct sentence is valid English ("isCorrect": true if valid, false if typo/error), put the natural Reported Speech conversion in "correctedSentence" (with past reporting verb like "He/She said / asked me / told me..."), and concisely explain the key transformations in "explanationUk" (backshift, if/whether, S+V order, time/place perspective change).
   - Else if the sentence is a Conditional sentence (uses if / unless / hypothetical conditional structure):
     * "detectedMode": "conditionals"
     * "ifSlot": 0 for Past (3rd / Mixed from Past), 1 for Present or General (2nd / Zero / Mixed from General trait), 2 for Future (1st)
     * "resultSlot": 0 for Past result (would have V3), 1 for Present/General result (would V0 / Present), 2 for Future result (will V0)
     * STRICT RULE: Future (slot 2) can ONLY pair with slot 2 (1st Conditional: ifSlot=2, resultSlot=2). Mixed Conditionals ONLY combine slot 0 and slot 1!
     * "presentMode": "zero" if Zero Conditional, otherwise "unreal"
   - Otherwise:
     * "detectedMode": "aspects"
     * "time": "past" | "present" | "future"
     * "isContinuous": true ONLY if isStateVerb is false AND it is Continuous or Perfect Continuous; if isStateVerb is true, ALWAYS set "isContinuous": false
     * "isPerfect": true if Perfect or Perfect Continuous, else false
   - Set "detectedTitle" to the English grammar name (e.g. "Past Perfect", "2nd Conditional", "Reported Statement", "Passive Simple", "Passive Modals + Have", "Passive Infinitive", "Passive Gerund").
   - If detectedMode === "aspects", set "detectedUseCaseIndex" (0-based integer) picking which function from the matching cell below best describes this sentence's usage; otherwise set null:
${useCasesGuide}
4. Generate morphed timeline forms so the user can drag ✕ on the graph and watch THEIR sentence adapt!
   - If detectedMode === "aspects": fill ALL 12 keys of "aspectForms" (${ASPECT_CELL_KEYS.join(", ")}).
     * Adapt the verb and add natural short time cues matching each cell.
     * IMPORTANT: If "isStateVerb" is true, NEVER use unnatural "-ing" state forms like "was being busy" or "have been being busy"; keep Simple forms in *_continuous keys and Perfect forms in *_perfect_continuous keys.
     * Tag semantically so the timeline graph color-codes each part clearly:
       - [[...]] (emerald / green): main or primary long verb phrase (e.g. "[[was doing]]", "[[had done]]", "[[was cooking]]").
       - {{...}} (sky / blue):
         * In Perfect / Perfect Continuous: the aligned cutoff action or boundary cue (e.g. "{{before dinner}}", "{{when we arrived}}", "{{by 7 pm tomorrow}}", "{{already}}"). Put any "for ..." duration inside <<...>> (amber) instead so {{...}} stays the boundary!
         * In Continuous with a shorter interrupting action: the shorter interrupting clause/time (e.g. "{{when dinner started}}", "{{at 7 pm yesterday}}").
         * In Continuous with 2 parallel long actions: the SECOND long continuous verb phrase (e.g. "While I [[was cooking]] dinner, she {{was doing}} her homework.").
         * In Simple sequence of actions: the 2nd verb in {{...}} and optional 3rd verb in <<...>>.
     * Example: "past_perfect": "I [[had done]] my classes {{before dinner}}."
     * Example: "past_continuous": "I [[was doing]] my classes {{when dinner started}}."
     * For the cell matching the user's detected tense, keep their correctedSentence wording as close as possible with [[...]], {{...}}, and optional <<...>> tags!
   - If detectedMode === "conditionals": fill ALL 6 keys of "conditionalForms" (${CONDITIONAL_KEYS.join(", ")}).
     * EVERY form MUST be written cleanly as two comma-separated parts ("If ..., ..."), with the IF-clause verb in [[...]] and the RESULT-clause verb in {{...}}.
     * Example: "second": "If I [[won]] the lottery now, I {{would buy}} a house."
   - If detectedMode === "reported": fill ALL 4 keys of "reportedForms" (${REPORTED_CATEGORY_KEYS.join(", ")}), adapting the core topic/vocabulary of the sentence across statement, yes/no question, wh-question, and imperative:
     * Keep the user's actual situation intact in the matching "reportedCategory".
     * Tag ONLY with:
       - [[...]] (emerald): backshifted verb / original verb / infinitive "(not) to + V0"
       - <<...>> (amber): reporting frame ("said (that)", "told me", "asked me if/whether + S", "asked me + wh-word + S") and direct question inversion ("Did they", "When did they")
       - {{...}} (sky): shifted pronouns and time/place perspective cues (e.g., {{now}}/{{then}}, {{today}}/{{that day}}, {{yesterday}}/{{the day before}}, {{tomorrow}}/{{the next day}}, {{here}}/{{there}}, {{I}}/{{he}}/{{she}})
     * Set directSlot (2=Present/Future in direct quote, 1=Past Simple/Present Perfect in direct quote) and reportedSlot (1=Past backshifted from Present, 0=Past Perfect backshifted from Past/Present Perfect, 2=Imperative / unchanged modal).
     * Example for yes_no_question: { "directTagged": "'<<Did they>> [[arrive]] {{yesterday}}?'", "reportedTagged": "He asked me <<if/whether they>> [[had arrived]] {{the day before}}.", "directBadge": "YES/NO QUESTION", "reportedBadge": "'IF/WHETHER' + S + V", "bridgeLabelUk": "if / whether + прямий порядок", "directSlot": 1, "reportedSlot": 0, "hasBackshift": true }
   - If detectedMode === "passive": fill ALL 4 keys of "passiveForms" (${PASSIVE_CATEGORY_KEYS.join(", ")}), adapting the user's core topic/verbs across basic passive, modals + have, passive infinitive, and passive gerund.
     * EVERY category object ("basic", "modal_perfect", "infinitive", "gerund") MUST use exact property names "activeTagged", "passiveTagged", "bridgeLabel", "badgeText", "functionUk", plus "verbPatternTitle" and "verbPatternExplanationUk" explaining the verb pattern of the verbs used.
     * Keep the user's actual sentence and core verbs intact in the matching "passiveCategory".
     * Tag ONLY with:
       - [[...]] (emerald): passive or active core verb phrase (e.g., [[is visited]], [[to be told]], [[being spoken]], [[could have been done]])
       - <<...>> (amber): trigger verb (e.g., <<want>>, <<hate>>, <<remember>>, <<avoid>>) or promoted subject / object
       - {{...}} (sky): preposition kept with verb (e.g., {{to}}, {{over}}), time cue, or negation {{not}}
       - ~~...~~ (ONLY in "bridgeStepTagged"): struck-through redundant clause/agent dropped in Step 2 (e.g., "I <<hate>> ~~when I am~~ [[spoken]] {{to}} ~~by people~~ as if I'm a child.")
     * For "infinitive" and "gerund": ALWAYS provide non-null "ukThoughtCue" (Ukrainian thought starter), "bridgeStepTagged" (Step 2 intermediate passive with ~~...~~), "verbPatternTitle" (exact pattern of the trigger verb/head from the user's sentence, e.g. "hate + V-ing", "want + to + V0", "afraid of + V-ing"), "verbPatternExplanationUk" (1-2 clear Ukrainian sentences explaining WHY that specific verb/preposition requires infinitive or gerund and how passive fits it), "step2NoteUk", and "step3NoteUk".
     * If the "basic" form has 2 objects or a vague subject ("People say / believe..."), also populate "altPassiveTagged" and "altPassiveNoteUk".
     * Example for "basic": { "activeTagged": "Someone [[tells]] <<me>> the news.", "passiveTagged": "<<I>> [[am told]] the news.", "bridgeLabel": "Object → Subject · am / is / are + V3", "badgeText": "am + V3", "functionUk": "Фокус на тому, хто отримує інформацію.", "verbPatternTitle": null, "verbPatternExplanationUk": null, "altPassiveTagged": null, "altPassiveNoteUk": null }
     * Example for "infinitive": { "ukThoughtCue": "Я хочу, щоб мені сказали", "activeTagged": "I <<want>> that {{others}} [[tell]] me.", "bridgeStepTagged": "I <<want>> ~~that I am~~ [[told]] ~~by others~~.", "passiveTagged": "I <<want>> [[to be told]].", "bridgeLabel": "Скорочуємо that I am + by others → to be told", "badgeText": "want + to be + V3", "functionUk": "Керування дієслова want моделлю з to-інфінітивом.", "verbPatternTitle": "want + to + V0", "verbPatternExplanationUk": "Дієслово want вимагає після себе інфінітива з to, тому пасивна форма — to be told.", "step2NoteUk": "Прибираємо that I am та неозначеного агента by others.", "step3NoteUk": "Після want ставимо пасивний інфінітив to be + V3." }

Respond ONLY with valid JSON matching this exact structure:
{
  "isCorrect": boolean,
  "correctedSentence": "string",
  "shortLabelUk": "string",
  "detectedMode": "aspects" | "conditionals" | "reported" | "passive",
  "detectedTitle": "string",
  "explanationUk": "string",
  "time": "past" | "present" | "future",
  "isContinuous": boolean,
  "isPerfect": boolean,
  "isStateVerb": boolean,
  "ifSlot": 0 | 1 | 2,
  "resultSlot": 0 | 1 | 2,
  "presentMode": "unreal" | "zero",
  "detectedUseCaseIndex": number | null,
  "reportedCategory": "statement" | "yes_no_question" | "wh_question" | "imperative",
  "passiveCategory": "basic" | "modal_perfect" | "infinitive" | "gerund",
  "aspectForms": { "past_simple": "...", ... all 12 keys } | null,
  "conditionalForms": { "zero": "...", ... all 6 keys } | null,
  "reportedForms": { "statement": { ... }, "yes_no_question": { ... }, "wh_question": { ... }, "imperative": { ... } } | null,
  "passiveForms": {
    "basic": { "activeTagged": "...", "passiveTagged": "...", "bridgeLabel": "...", "badgeText": "...", "functionUk": "...", "altPassiveTagged": null, "altPassiveNoteUk": null, "verbPatternTitle": null, "verbPatternExplanationUk": null },
    "modal_perfect": { "activeTagged": "...", "passiveTagged": "...", "bridgeLabel": "...", "badgeText": "...", "functionUk": "...", "verbPatternTitle": null, "verbPatternExplanationUk": null },
    "infinitive": { "activeTagged": "...", "passiveTagged": "...", "bridgeLabel": "...", "badgeText": "...", "functionUk": "...", "ukThoughtCue": "...", "bridgeStepTagged": "...", "verbPatternTitle": "...", "verbPatternExplanationUk": "...", "step2NoteUk": "...", "step3NoteUk": "..." },
    "gerund": { "activeTagged": "...", "passiveTagged": "...", "bridgeLabel": "...", "badgeText": "...", "functionUk": "...", "ukThoughtCue": "...", "bridgeStepTagged": "...", "verbPatternTitle": "...", "verbPatternExplanationUk": "...", "step2NoteUk": "...", "step3NoteUk": "..." }
  } | null
}`;

    const { data: result, usageSnapshot } = await generateFromGeminiWithUsage(
      {
        prompt,
        systemInstruction:
          "You are an expert English grammar teacher creating visual explanations in Ukrainian for VocabCrafter. Always return valid JSON only.",
        temperature: 0.25,
      },
      aiResponseSchema,
    );

    await recordAIUsageEvent({
      userId: user.id,
      feature: "tense_detector",
      requestType: "text",
      model: GEMINI_MODEL,
      snapshot: usageSnapshot,
    });

    await incrementAICalls(user.id);

    const normalizedCondSlots = sanitizeConditionalSlots(
      result.ifSlot,
      result.resultSlot,
    );
    const safeIsContinuous = result.isStateVerb ? false : result.isContinuous;
    const detectedCellKey = getAspectCellKey(
      result.time,
      resolveAspectType(safeIsContinuous, result.isPerfect),
    );
    const cellUseCasesCount =
      ASPECT_MATRIX_META[detectedCellKey].useCasesUk.length;
    const validUseCaseIndex =
      result.detectedMode === "aspects" &&
      typeof result.detectedUseCaseIndex === "number" &&
      result.detectedUseCaseIndex >= 0 &&
      result.detectedUseCaseIndex < cellUseCasesCount
        ? result.detectedUseCaseIndex
        : null;

    return NextResponse.json({
      isCorrect: result.isCorrect,
      originalSentence: sentence,
      correctedSentence: result.correctedSentence,
      shortLabelUk: result.shortLabelUk,
      detectedMode: result.detectedMode,
      detectedTitle: result.detectedTitle,
      explanationUk: result.explanationUk,
      time: result.time,
      isContinuous: safeIsContinuous,
      isPerfect: result.isPerfect,
      isStateVerb: result.isStateVerb,
      ifSlot: normalizedCondSlots.ifSlot,
      resultSlot: normalizedCondSlots.resultSlot,
      presentMode: result.presentMode,
      detectedUseCaseIndex: validUseCaseIndex,
      reportedCategory: result.reportedCategory,
      passiveCategory: result.passiveCategory,
      aspectForms:
        result.detectedMode === "aspects"
          ? normalizeAspectForms(
              result.aspectForms,
              result.correctedSentence,
              result.isStateVerb,
            )
          : undefined,
      conditionalForms:
        result.detectedMode === "conditionals"
          ? normalizeConditionalForms(
              result.conditionalForms,
              result.correctedSentence,
            )
          : undefined,
      reportedForms:
        result.detectedMode === "reported"
          ? normalizeReportedForms(
              result.reportedForms,
              result.correctedSentence,
            )
          : undefined,
      passiveForms:
        result.detectedMode === "passive"
          ? normalizePassiveForms(
              result.passiveForms,
              result.correctedSentence,
              sentence,
            )
          : undefined,
    });
  } catch (error) {
    console.error("Tense detector AI error:", error);
    return NextResponse.json(
      { error: "Не вдалося перевірити речення за допомогою AI. Спробуйте ще раз." },
      { status: 500 },
    );
  }
}
