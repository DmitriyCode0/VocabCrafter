import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import {
  generateJsonFromGeminiWithUsage,
  GEMINI_MODEL,
} from "@/lib/gemini/client";
import { getStudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import { tutorHasStudentAccess } from "@/lib/rbac/tutor-access";

const estimatedBandSchema = z.enum(["A0", "A1", "A2", "B1", "B2", "C1"]);

const vocabularyEstimateSchema = z
  .object({
    low: z.number().int().min(0),
    high: z.number().int().min(0),
    rationale: z.string().trim().min(1),
  })
  .refine((value) => value.high >= value.low, {
    message: "Vocabulary estimate high value must be >= low value",
    path: ["high"],
  });

const progressInsightsSchema = z.object({
  estimatedBand: estimatedBandSchema,
  summary: z.string().trim().min(1),
  passiveVocabulary: vocabularyEstimateSchema,
  activeVocabulary: vocabularyEstimateSchema,
  strengths: z.array(z.string().trim().min(1)).max(5),
  focusAreas: z.array(z.string().trim().min(1)).max(5),
  grammarPlan: z
    .array(
      z.object({
        topic: z.string().trim().min(1),
        reason: z.string().trim().min(1),
      }),
    )
    .max(6),
  vocabularyThemes: z
    .array(
      z.object({
        theme: z.string().trim().min(1),
        reason: z.string().trim().min(1),
        exampleWords: z.array(z.string().trim().min(1)).max(5),
      }),
    )
    .max(6),
  nextActions: z.array(z.string().trim().min(1)).max(6),
});

type ProgressSnapshot = Awaited<ReturnType<typeof getStudentProgressSnapshot>>;
type ProgressInsights = z.infer<typeof progressInsightsSchema>;
type EstimatedBand = z.infer<typeof estimatedBandSchema>;

const ESTIMATED_BANDS = estimatedBandSchema.options;
const PROFILE_BAND_BY_LEVEL = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  C2: "C1",
} as const;
const VOCABULARY_BASE_BY_BAND: Record<EstimatedBand, number> = {
  A0: 80,
  A1: 250,
  A2: 700,
  B1: 1500,
  B2: 3000,
  C1: 5500,
};
const FALLBACK_THEMES_BY_BAND: Record<EstimatedBand, string[]> = {
  A0: [
    "Survival phrases and core verbs",
    "People, numbers, and time",
    "Daily needs and simple requests",
  ],
  A1: [
    "Daily routines and essential verbs",
    "Home, family, and descriptions",
    "Food, shopping, and everyday places",
  ],
  A2: [
    "Travel and directions",
    "Health, body, and appointments",
    "Work, study, and schedules",
  ],
  B1: [
    "Opinions and discussion language",
    "News, culture, and media",
    "Problem solving and everyday situations",
  ],
  B2: [
    "Abstract topics and nuance",
    "Professional communication",
    "Collocations for fluent explanations",
  ],
  C1: [
    "Argumentation and persuasion",
    "Academic and professional nuance",
    "Idioms, register, and stylistic range",
  ],
};

const progressInsightsRequestModeSchema = z.enum([
  "full",
  "passive-vocabulary",
]);

const requestSchema = z.object({
  studentId: z.string().uuid().optional(),
  mode: progressInsightsRequestModeSchema.optional(),
  estimatedBand: estimatedBandSchema.optional(),
  activeVocabulary: vocabularyEstimateSchema.optional(),
  currentInsights: progressInsightsSchema.optional(),
});

async function parseOptionalRequestBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return { success: true as const, data: {} };
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return {
      success: false as const,
      response: NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      ),
    };
  }

  const parsed = requestSchema.safeParse(parsedJson);

  if (!parsed.success) {
    return {
      success: false as const,
      response: NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }

  return { success: true as const, data: parsed.data };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickFirstUnknown(
  record: Record<string, unknown> | null,
  keys: string[],
): unknown {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (value != null) {
      return value;
    }
  }

  return undefined;
}

function normalizeInlineText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function pickFirstString(
  record: Record<string, unknown> | null,
  keys: string[],
) {
  return normalizeInlineText(pickFirstUnknown(record, keys));
}

function splitTextItems(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[•●▪]/g, "\n")
    .replace(/\s+\d+[.)]\s+/g, "\n")
    .split(/\n|;/)
    .map((item) => item.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item).trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function coerceInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string") {
    const match = value.match(/-?\d[\d,]*(?:\.\d+)?/);
    if (match) {
      return Math.max(0, Math.round(Number(match[0].replace(/,/g, ""))));
    }
  }

  return null;
}

function extractRange(value: string) {
  const matches = [...value.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)]
    .map((match) => Number(match[0].replace(/,/g, "")))
    .filter((match) => Number.isFinite(match));

  if (matches.length >= 2) {
    return [
      Math.max(0, Math.round(matches[0])),
      Math.max(0, Math.round(matches[1])),
    ] as const;
  }

  if (matches.length === 1) {
    const value = Math.max(0, Math.round(matches[0]));
    return [value, value] as const;
  }

  return null;
}

function unwrapProgressInsights(value: unknown) {
  let current = value;

  for (let depth = 0; depth < 3; depth += 1) {
    const record = asRecord(current);
    if (!record) {
      return current;
    }

    const looksLikeInsights = [
      "estimatedBand",
      "summary",
      "passiveVocabulary",
      "activeVocabulary",
      "strengths",
      "focusAreas",
      "grammarPlan",
      "vocabularyThemes",
      "nextActions",
    ].some((key) => key in record);

    if (looksLikeInsights) {
      return record;
    }

    const nested = pickFirstUnknown(record, [
      "result",
      "data",
      "response",
      "output",
      "insights",
      "analysis",
    ]);

    if (nested == null) {
      return record;
    }

    current = nested;
  }

  return current;
}

function deriveEstimatedBand(snapshot: ProgressSnapshot): EstimatedBand {
  const weightedScore = snapshot.axes.reduce((total, axis) => {
    const weight =
      axis.key === "vocabulary"
        ? 0.28
        : axis.key === "accuracy"
          ? 0.24
          : axis.key === "breadth"
            ? 0.18
            : axis.key === "grammar"
              ? 0.16
              : 0.14;

    return total + axis.score * weight;
  }, 0);

  const computedBand: EstimatedBand =
    weightedScore < 18
      ? "A0"
      : weightedScore < 38
        ? "A1"
        : weightedScore < 55
          ? "A2"
          : weightedScore < 72
            ? "B1"
            : weightedScore < 86
              ? "B2"
              : "C1";
  const computedIndex = ESTIMATED_BANDS.indexOf(computedBand);
  const profileBand = PROFILE_BAND_BY_LEVEL[snapshot.profile.cefrLevel];
  const profileIndex = ESTIMATED_BANDS.indexOf(profileBand);

  return ESTIMATED_BANDS[Math.min(computedIndex, profileIndex + 1)];
}

function normalizeEstimatedBand(
  value: unknown,
  snapshot: ProgressSnapshot,
): EstimatedBand {
  if (typeof value === "string") {
    const match = value.toUpperCase().match(/\b(A0|A1|A2|B1|B2|C1)\b/);
    if (match) {
      return match[1] as EstimatedBand;
    }
  }

  const record = asRecord(value);
  const nested = pickFirstUnknown(record, [
    "estimatedBand",
    "band",
    "overallBand",
    "level",
    "cefr",
  ]);

  if (nested != null) {
    return normalizeEstimatedBand(nested, snapshot);
  }

  return deriveEstimatedBand(snapshot);
}

function buildFallbackVocabularyEstimates(
  snapshot: ProgressSnapshot,
  estimatedBand: EstimatedBand,
) {
  const passiveEvidenceBoost = snapshot.passiveSignals.equivalentWordCount;
  const passiveAnchor = Math.round(
    VOCABULARY_BASE_BY_BAND[estimatedBand] * 0.25,
  );
  const passiveCalculated = Math.round(
    snapshot.overview.totalWords *
      (1.5 + snapshot.overview.avgMasteryLevel * 0.22) +
      snapshot.overview.avgScore * 1.5 +
      snapshot.overview.masteredWords * 6 +
      snapshot.overview.grammarCoveredCount * 4 +
      passiveEvidenceBoost * 1.25,
  );
  const passiveLow = Math.max(
    snapshot.overview.totalWords + passiveEvidenceBoost,
    passiveAnchor,
    passiveCalculated,
  );
  const passiveHigh = Math.max(passiveLow + 25, Math.round(passiveLow * 1.2));
  const activeLow = Math.max(
    snapshot.overview.masteredWords,
    Math.round(
      snapshot.overview.totalWords *
        (0.34 + snapshot.overview.avgMasteryLevel * 0.045),
    ),
  );
  const activeHigh = Math.min(
    passiveHigh,
    Math.max(activeLow + 15, Math.round(activeLow * 1.18)),
  );
  const passiveEvidence = `Based on ${snapshot.overview.totalWords} tracked mastery words, average mastery ${snapshot.overview.avgMasteryLevel.toFixed(1)}/5, ${snapshot.overview.avgScore}% average scores, the current ${estimatedBand} study profile, and ${snapshot.passiveSignals.uniqueItems} passive-recognition imports contributing about ${passiveEvidenceBoost} recognition-equivalent words.`;
  const activeEvidence = `Active range is kept below passive recognition and weighted more heavily toward mastery, translation accuracy, and repeated recall. Passive-text imports do not raise the active range until the student shows recall or production evidence.`;

  return {
    passiveVocabulary: {
      low: passiveLow,
      high: passiveHigh,
      rationale: passiveEvidence,
    },
    activeVocabulary: {
      low: activeLow,
      high: activeHigh,
      rationale: `${activeEvidence} ${passiveEvidence}`,
    },
  };
}

function normalizeVocabularyEstimate(
  value: unknown,
  fallback: ProgressInsights["passiveVocabulary"],
) {
  const record = asRecord(value);
  const rangeText =
    pickFirstString(record, ["range", "estimate", "value", "summary"]) ??
    normalizeInlineText(value);
  let low = coerceInteger(
    pickFirstUnknown(record, ["low", "min", "from", "minimum"]),
  );
  let high = coerceInteger(
    pickFirstUnknown(record, ["high", "max", "to", "maximum"]),
  );

  if ((low == null || high == null) && rangeText) {
    const range = extractRange(rangeText);
    if (range) {
      low = range[0];
      high = range[1];
    }
  }

  if (low == null) {
    low = high ?? fallback.low;
  }
  if (high == null) {
    high = low ?? fallback.high;
  }

  const rationale =
    pickFirstString(record, [
      "rationale",
      "reason",
      "why",
      "note",
      "summary",
    ]) ??
    (rangeText && !extractRange(rangeText) ? rangeText : null) ??
    fallback.rationale;

  return {
    low,
    high: Math.max(low, high),
    rationale,
  };
}

function reconcileVocabularyEstimates(
  passiveVocabulary: ProgressInsights["passiveVocabulary"],
  activeVocabulary: ProgressInsights["activeVocabulary"],
) {
  const normalizedPassive = {
    ...passiveVocabulary,
    low: Math.max(passiveVocabulary.low, activeVocabulary.low),
    high: Math.max(passiveVocabulary.high, activeVocabulary.high),
  };

  const normalizedActive = {
    ...activeVocabulary,
    high: Math.min(activeVocabulary.high, normalizedPassive.high),
  };

  if (normalizedActive.high < normalizedActive.low) {
    normalizedActive.high = normalizedActive.low;
  }

  if (normalizedPassive.high < normalizedPassive.low) {
    normalizedPassive.high = normalizedPassive.low;
  }

  return {
    passiveVocabulary: normalizedPassive,
    activeVocabulary: normalizedActive,
  };
}

function normalizeTextList(value: unknown): string[] {
  if (typeof value === "string") {
    return splitTextItems(value);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeTextList(item));
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const nested = pickFirstUnknown(record, [
    "items",
    "list",
    "values",
    "points",
    "suggestions",
    "actions",
  ]);

  if (nested != null) {
    return normalizeTextList(nested);
  }

  const singleValue = pickFirstString(record, [
    "text",
    "label",
    "title",
    "item",
    "reason",
    "summary",
  ]);

  return singleValue ? [singleValue] : [];
}

function buildFallbackStrengths(snapshot: ProgressSnapshot) {
  return [...snapshot.axes]
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map(
      (axis) => `${axis.label} is currently a stronger signal: ${axis.value}.`,
    );
}

function buildFallbackFocusAreas(snapshot: ProgressSnapshot) {
  return [...snapshot.axes]
    .sort((left, right) => left.score - right.score)
    .slice(0, 2)
    .map((axis) => {
      if (axis.key === "grammar") {
        return `Grammar needs the clearest next push: target uncovered topics and pair each one with a translation-heavy activity.`;
      }

      if (axis.key === "determination") {
        return `Consistency needs attention: even one short session each day will make retention steadier and lift the streak signal.`;
      }

      if (axis.key === "breadth") {
        return `Breadth is still limited: add a fresh cluster of words around one practical theme instead of only recycling familiar items.`;
      }

      if (axis.key === "accuracy") {
        return `Accuracy can move higher: slow down on review and revisit recent corrections before adding harder material.`;
      }

      return `Vocabulary needs consolidation: move more recent words to mastery 3+ so recall becomes stable instead of temporary.`;
    });
}

function buildFallbackGrammarPlan(snapshot: ProgressSnapshot) {
  const remaining = snapshot.grammar.remainingTopics
    .slice(0, 3)
    .map((topic) => ({
      topic: topic.label,
      reason: `This ${topic.level} topic is still uncovered in your history, so targeted practice here should lift grammar coverage fastest.`,
    }));
  const reinforcement = [...snapshot.grammar.coveredTopics]
    .sort(
      (left, right) => (left.averageScore ?? 101) - (right.averageScore ?? 101),
    )
    .filter(
      (topic) =>
        !remaining.some(
          (item) => item.topic.toLowerCase() === topic.label.toLowerCase(),
        ),
    )
    .slice(0, Math.max(0, 3 - remaining.length))
    .map((topic) => ({
      topic: topic.label,
      reason:
        topic.averageScore == null
          ? `You've seen this topic, but there is not enough scored practice yet to know whether it is stable.`
          : `You've covered this topic, but the current average is ${topic.averageScore}%, so a short review should improve control.`,
    }));

  return uniqueBy([...remaining, ...reinforcement], (item) => item.topic).slice(
    0,
    6,
  );
}

function getExampleWordPool(snapshot: ProgressSnapshot) {
  return uniqueStrings(snapshot.words.map((word) => word.term)).slice(0, 12);
}

function buildFallbackVocabularyThemes(
  snapshot: ProgressSnapshot,
  estimatedBand: EstimatedBand,
) {
  const examplePool = getExampleWordPool(snapshot);
  const reason =
    (snapshot.axes.find((axis) => axis.key === "breadth")?.score ?? 0) < 50
      ? "This theme expands your range into practical, high-utility territory."
      : "This theme extends what you already know into adjacent situations.";
  return FALLBACK_THEMES_BY_BAND[estimatedBand].map((theme, index) => ({
    theme,
    reason,
    exampleWords: examplePool.slice(index, index + 3),
  }));
}

function normalizeStringArray(value: unknown, fallback: string[], max: number) {
  return uniqueStrings([...normalizeTextList(value), ...fallback]).slice(
    0,
    max,
  );
}

function normalizeGrammarPlan(value: unknown, snapshot: ProgressSnapshot) {
  const record = asRecord(value);
  const nested = pickFirstUnknown(record, [
    "items",
    "list",
    "topics",
    "plan",
    "recommendations",
  ]);
  const source = Array.isArray(value)
    ? value
    : Array.isArray(nested)
      ? nested
      : typeof value === "string"
        ? splitTextItems(value)
        : typeof nested === "string"
          ? splitTextItems(nested)
          : [];
  const normalized = source.flatMap((item) => {
    if (typeof item === "string") {
      const topic = normalizeInlineText(item);
      return topic
        ? [
            {
              topic,
              reason:
                "This topic addresses a visible grammar gap in your current profile.",
            },
          ]
        : [];
    }

    const itemRecord = asRecord(item);
    if (!itemRecord) {
      return [];
    }

    const topic = pickFirstString(itemRecord, [
      "topic",
      "label",
      "title",
      "name",
    ]);
    if (!topic) {
      return [];
    }

    return [
      {
        topic,
        reason:
          pickFirstString(itemRecord, [
            "reason",
            "why",
            "description",
            "focus",
          ]) ??
          "This topic addresses a visible grammar gap in your current profile.",
      },
    ];
  });

  return uniqueBy(
    [...normalized, ...buildFallbackGrammarPlan(snapshot)],
    (item) => item.topic,
  ).slice(0, 6);
}

function normalizeVocabularyThemes(
  value: unknown,
  snapshot: ProgressSnapshot,
  estimatedBand: EstimatedBand,
) {
  const record = asRecord(value);
  const nested = pickFirstUnknown(record, [
    "items",
    "list",
    "themes",
    "recommendations",
  ]);
  const source = Array.isArray(value)
    ? value
    : Array.isArray(nested)
      ? nested
      : typeof value === "string"
        ? splitTextItems(value)
        : typeof nested === "string"
          ? splitTextItems(nested)
          : [];
  const examplePool = getExampleWordPool(snapshot);
  const normalized = source.flatMap((item, index) => {
    if (typeof item === "string") {
      const theme = normalizeInlineText(item);
      return theme
        ? [
            {
              theme,
              reason:
                "This theme is a useful next step for widening usable vocabulary.",
              exampleWords: examplePool.slice(index, index + 3),
            },
          ]
        : [];
    }

    const itemRecord = asRecord(item);
    if (!itemRecord) {
      return [];
    }

    const theme = pickFirstString(itemRecord, [
      "theme",
      "label",
      "title",
      "name",
    ]);
    if (!theme) {
      return [];
    }

    const exampleWords = uniqueStrings(
      normalizeTextList(
        pickFirstUnknown(itemRecord, ["exampleWords", "examples", "words"]),
      ),
    ).slice(0, 5);

    return [
      {
        theme,
        reason:
          pickFirstString(itemRecord, [
            "reason",
            "why",
            "description",
            "focus",
          ]) ??
          "This theme is a useful next step for widening usable vocabulary.",
        exampleWords:
          exampleWords.length > 0
            ? exampleWords
            : examplePool.slice(index, index + 3),
      },
    ];
  });

  return uniqueBy(
    [...normalized, ...buildFallbackVocabularyThemes(snapshot, estimatedBand)],
    (item) => item.theme,
  ).slice(0, 6);
}

function buildFallbackNextActions(
  snapshot: ProgressSnapshot,
  grammarPlan: ProgressInsights["grammarPlan"],
  vocabularyThemes: ProgressInsights["vocabularyThemes"],
) {
  return [
    snapshot.overview.streakDays > 0
      ? `Keep the streak alive with one short practice session today.`
      : `Complete one short practice session today to start a streak.`,
    grammarPlan[0]
      ? `Study ${grammarPlan[0].topic} next, then follow it with one translation-focused activity.`
      : `Do one grammar-heavy translation activity and review every correction before moving on.`,
    vocabularyThemes[0]
      ? `Add 8-12 words around ${vocabularyThemes[0].theme.toLowerCase()} and review them until several reach mastery 3.`
      : `Add 8-12 new words and review them until several reach mastery 3.`,
    snapshot.overview.avgScore < 75
      ? `Redo one recent low-scoring attempt and compare your corrections before starting new material.`
      : `Keep accuracy high by reviewing mistakes before you start a harder activity.`,
  ];
}

function buildFallbackSummary(
  snapshot: ProgressSnapshot,
  estimatedBand: EstimatedBand,
) {
  const strongest = [...snapshot.axes].sort(
    (left, right) => right.score - left.score,
  )[0];
  const weakest = [...snapshot.axes].sort(
    (left, right) => left.score - right.score,
  )[0];

  return `Your current profile looks closest to ${estimatedBand}, with ${strongest.label.toLowerCase()} acting as the strongest signal and ${weakest.label.toLowerCase()} offering the clearest next lift. Keep practice steady and focus the next block of work on ${weakest.label.toLowerCase()} so the rest of the profile catches up.`;
}

function buildFallbackProgressInsights(
  snapshot: ProgressSnapshot,
): ProgressInsights {
  const estimatedBand = deriveEstimatedBand(snapshot);
  const grammarPlan = buildFallbackGrammarPlan(snapshot);
  const vocabularyThemes = buildFallbackVocabularyThemes(
    snapshot,
    estimatedBand,
  );
  const vocabularyEstimates = buildFallbackVocabularyEstimates(
    snapshot,
    estimatedBand,
  );

  return progressInsightsSchema.parse({
    estimatedBand,
    summary: buildFallbackSummary(snapshot, estimatedBand),
    passiveVocabulary: vocabularyEstimates.passiveVocabulary,
    activeVocabulary: vocabularyEstimates.activeVocabulary,
    strengths: buildFallbackStrengths(snapshot),
    focusAreas: buildFallbackFocusAreas(snapshot),
    grammarPlan,
    vocabularyThemes,
    nextActions: buildFallbackNextActions(
      snapshot,
      grammarPlan,
      vocabularyThemes,
    ),
  });
}

function buildPassiveVocabularyOnlyEstimate(
  snapshot: ProgressSnapshot,
  estimatedBand?: EstimatedBand,
  activeVocabulary?: ProgressInsights["activeVocabulary"],
) {
  const resolvedBand = estimatedBand ?? deriveEstimatedBand(snapshot);
  const vocabularyEstimates = buildFallbackVocabularyEstimates(
    snapshot,
    resolvedBand,
  );

  if (!activeVocabulary) {
    return vocabularyEstimates.passiveVocabulary;
  }

  return reconcileVocabularyEstimates(
    vocabularyEstimates.passiveVocabulary,
    activeVocabulary,
  ).passiveVocabulary;
}

function normalizeProgressInsights(
  raw: unknown,
  snapshot: ProgressSnapshot,
): ProgressInsights {
  const candidate = asRecord(unwrapProgressInsights(raw));
  if (!candidate) {
    return buildFallbackProgressInsights(snapshot);
  }

  const estimatedBand = normalizeEstimatedBand(
    pickFirstUnknown(candidate, [
      "estimatedBand",
      "band",
      "overallBand",
      "level",
    ]),
    snapshot,
  );
  const fallbackVocabulary = buildFallbackVocabularyEstimates(
    snapshot,
    estimatedBand,
  );
  const reconciledVocabulary = reconcileVocabularyEstimates(
    normalizeVocabularyEstimate(
      pickFirstUnknown(candidate, [
        "passiveVocabulary",
        "passive",
        "passiveEstimate",
        "receptiveVocabulary",
      ]),
      fallbackVocabulary.passiveVocabulary,
    ),
    normalizeVocabularyEstimate(
      pickFirstUnknown(candidate, [
        "activeVocabulary",
        "active",
        "activeEstimate",
        "productiveVocabulary",
      ]),
      fallbackVocabulary.activeVocabulary,
    ),
  );
  const grammarPlan = normalizeGrammarPlan(
    pickFirstUnknown(candidate, [
      "grammarPlan",
      "grammar",
      "grammarSuggestions",
      "plan",
    ]),
    snapshot,
  );
  const vocabularyThemes = normalizeVocabularyThemes(
    pickFirstUnknown(candidate, [
      "vocabularyThemes",
      "themes",
      "vocabThemes",
      "vocabularySuggestions",
    ]),
    snapshot,
    estimatedBand,
  );
  const strengths = normalizeStringArray(
    pickFirstUnknown(candidate, ["strengths", "wins", "strongPoints"]),
    buildFallbackStrengths(snapshot),
    5,
  );
  const focusAreas = normalizeStringArray(
    pickFirstUnknown(candidate, ["focusAreas", "weaknesses", "growthAreas"]),
    buildFallbackFocusAreas(snapshot),
    5,
  );
  const nextActions = normalizeStringArray(
    pickFirstUnknown(candidate, [
      "nextActions",
      "actions",
      "nextSteps",
      "actionPlan",
    ]),
    buildFallbackNextActions(snapshot, grammarPlan, vocabularyThemes),
    6,
  );
  const summary =
    pickFirstString(candidate, [
      "summary",
      "overview",
      "analysis",
      "profileSummary",
    ]) ?? buildFallbackSummary(snapshot, estimatedBand);

  return progressInsightsSchema.parse({
    estimatedBand,
    summary,
    passiveVocabulary: reconciledVocabulary.passiveVocabulary,
    activeVocabulary: reconciledVocabulary.activeVocabulary,
    strengths,
    focusAreas,
    grammarPlan,
    vocabularyThemes,
    nextActions,
  });
}

function buildProgressInsightsPrompt(
  userId: string,
  snapshot: ProgressSnapshot,
) {
  const axesText = snapshot.axes
    .map(
      (axis) =>
        `- ${axis.label}: ${axis.score}/100 (${axis.value})${axis.beta ? " [BETA]" : ""}. ${axis.helper}`,
    )
    .join("\n");
  const activityText =
    snapshot.activityStats.length > 0
      ? snapshot.activityStats
          .map(
            (activity) =>
              `- ${activity.label}: ${activity.averageScore}% average across ${activity.count} attempts`,
          )
          .join("\n")
      : "- No scored activity breakdown yet";
  const coveredTopicsText =
    snapshot.grammar.coveredTopics.length > 0
      ? snapshot.grammar.coveredTopics
          .map(
            (topic) =>
              `- ${topic.label} (${topic.level})${topic.averageScore == null ? "" : `: ${topic.averageScore}% avg over ${topic.attempts} attempts`}`,
          )
          .join("\n")
      : "- None yet";
  const remainingTopicsText =
    snapshot.grammar.remainingTopics.length > 0
      ? snapshot.grammar.remainingTopics
          .map((topic) => `- ${topic.label} (${topic.level})`)
          .join("\n")
      : "- No uncovered grammar topics remain inside the current level catalog";
  const wordsText =
    snapshot.words.length > 0
      ? snapshot.words
          .map(
            (word) =>
              `- ${word.term} | ${word.definition} | level ${word.masteryLevel} | correct ${word.correctCount} | translation ${word.translationCorrectCount} | streak ${word.streak}`,
          )
          .join("\n")
      : "- No tracked words yet";
  const passiveSignalsText =
    snapshot.passiveSignals.sampleItems.length > 0
      ? snapshot.passiveSignals.sampleItems
          .map(
            (item) =>
              `- ${item.term}${item.definition ? ` | ${item.definition}` : ""} | ${item.itemType}${item.sourceLabel ? ` | source ${item.sourceLabel}` : ""}`,
          )
          .join("\n")
      : "- None yet";

  return `You are an expert language coach building a student-facing progress interpretation.

Student context:
- User ID: ${userId}
- Target language: ${snapshot.profile.targetLanguageLabel}
- Source language: ${snapshot.profile.sourceLanguageLabel}
- Student profile CEFR level: ${snapshot.profile.cefrLevel}

Deterministic progress axes:
${axesText}

Overview:
- Total attempts: ${snapshot.overview.totalAttempts}
- Average score: ${snapshot.overview.avgScore}%
- Best score: ${snapshot.overview.bestScore}%
- Day streak: ${snapshot.overview.streakDays}
- Total unique words: ${snapshot.overview.totalWords}
- Mastered words: ${snapshot.overview.masteredWords}
- Average mastery level: ${snapshot.overview.avgMasteryLevel}/5
- Grammar topics covered: ${snapshot.overview.grammarCoveredCount}/${snapshot.overview.grammarAvailableCount}
- Passive-recognition imports: ${snapshot.passiveSignals.uniqueItems} items (${snapshot.passiveSignals.wordCount} words, ${snapshot.passiveSignals.phraseCount} phrases)
- Passive-recognition equivalent words: ${snapshot.passiveSignals.equivalentWordCount} (the single-word total added to passive-vocabulary estimates)

Activity performance:
${activityText}

Covered grammar topics:
${coveredTopicsText}

Remaining grammar topics:
${remainingTopicsText}

Tracked vocabulary words:
${wordsText}

Passive recognition evidence from understood text or curated imports:
${passiveSignalsText}

Instructions:
- Estimate the learner's overall study band from A0 to C1. This is an approximate learning profile, not an official CEFR certification.
- Estimate passive vocabulary as the number of words the student likely recognizes.
- Estimate active vocabulary as the number of words the student can likely use accurately.
- Passive vocabulary must be greater than or equal to active vocabulary.
- Use the full tracked word list, the mastery data, the student's CEFR setting, and quiz performance to make the estimate.
- Treat passive-recognition imports as evidence for recognition only. They can raise passive vocabulary estimates, but they must not be treated as proof of active mastery, recall, or review readiness.
- Equivalent words means the single-word total derived from passive evidence that is fed into passive-vocabulary estimation.
- Grammar plan topics must come from the remaining grammar topics list whenever that list is non-empty.
- Vocabulary themes should reflect what the student already knows plus the next useful adjacent topics.
- Keep recommendations encouraging, concrete, and study-oriented.
- Output JSON only.

Respond with JSON in this exact structure:
{
  "estimatedBand": "A0 | A1 | A2 | B1 | B2 | C1",
  "summary": "short paragraph",
  "passiveVocabulary": {
    "low": 0,
    "high": 0,
    "rationale": "why"
  },
  "activeVocabulary": {
    "low": 0,
    "high": 0,
    "rationale": "why"
  },
  "strengths": ["..."],
  "focusAreas": ["..."],
  "grammarPlan": [
    {
      "topic": "topic name",
      "reason": "why next"
    }
  ],
  "vocabularyThemes": [
    {
      "theme": "theme name",
      "reason": "why this theme fits",
      "exampleWords": ["word one", "word two"]
    }
  ],
  "nextActions": ["..."]
}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const parsedRequest = await parseOptionalRequestBody(request);

    if (!parsedRequest.success) {
      return parsedRequest.response;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestedStudentId = parsedRequest.data.studentId;
    const requestMode = parsedRequest.data.mode ?? "full";
    const supabaseAdmin = createAdminClient();
    let targetUserId = user.id;

    if (requestedStudentId && requestedStudentId !== user.id) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (profile.role !== "tutor" && profile.role !== "superadmin") {
        return NextResponse.json(
          { error: "Only tutors can request student progress insights" },
          { status: 403 },
        );
      }

      if (profile.role !== "superadmin") {
        const hasAccess = await tutorHasStudentAccess(
          supabaseAdmin,
          user.id,
          requestedStudentId,
        );

        if (!hasAccess) {
          return NextResponse.json(
            { error: "You do not have access to this student" },
            { status: 403 },
          );
        }
      }

      targetUserId = requestedStudentId;
    }

    const snapshot = await getStudentProgressSnapshot(targetUserId);

    if (
      snapshot.overview.totalAttempts === 0 &&
      snapshot.overview.totalWords === 0 &&
      snapshot.passiveSignals.uniqueItems === 0
    ) {
      return NextResponse.json(
        { error: "Not enough progress data yet" },
        { status: 400 },
      );
    }

    if (requestMode === "passive-vocabulary") {
      const passiveVocabulary = buildPassiveVocabularyOnlyEstimate(
        snapshot,
        parsedRequest.data.estimatedBand,
        parsedRequest.data.activeVocabulary,
      );

      if (targetUserId === user.id && parsedRequest.data.currentInsights) {
        const mergedInsights = progressInsightsSchema.parse({
          ...parsedRequest.data.currentInsights,
          passiveVocabulary,
        });

        const { error: saveError } = await supabaseAdmin
          .from("student_progress_insights")
          .upsert(
            {
              user_id: user.id,
              insights: mergedInsights,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );

        if (saveError) {
          console.error(
            "Save passive-only student progress insights error:",
            saveError,
          );
        }
      }

      return NextResponse.json({ passiveVocabulary });
    }

    const quota = await checkAIQuota(user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `AI call limit reached (${quota.limit}/month). Upgrade your plan for more.`,
          code: "QUOTA_EXCEEDED",
        },
        { status: 429 },
      );
    }

    const prompt = buildProgressInsightsPrompt(targetUserId, snapshot);
    let result: ProgressInsights;

    try {
      const { data: rawResult, usageSnapshot } =
        await generateJsonFromGeminiWithUsage({
          prompt,
          systemInstruction:
            "You are a careful language-learning coach. You estimate learning profile bands conservatively, never present them as official CEFR certification, and always return valid JSON only.",
          temperature: 0.4,
        });

      result = normalizeProgressInsights(rawResult, snapshot);

      await recordAIUsageEvent({
        userId: user.id,
        feature: "progress_insights",
        requestType: "text",
        model: GEMINI_MODEL,
        snapshot: usageSnapshot,
      });

      await incrementAICalls(user.id);
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        console.error("Progress insights normalization fallback:", error);
        result = buildFallbackProgressInsights(snapshot);
      } else {
        throw error;
      }
    }

    if (targetUserId === user.id) {
      const { error: saveError } = await supabaseAdmin
        .from("student_progress_insights")
        .upsert(
          {
            user_id: user.id,
            insights: result,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (saveError) {
        console.error("Save student progress insights error:", saveError);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Progress insights error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
