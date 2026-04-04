import { z } from "zod";
import type { StudentProgressAxis } from "@/lib/progress/profile-metrics";

export const progressAxisKeySchema = z.enum([
  "vocabulary",
  "grammar",
  "determination",
  "accuracy",
  "breadth",
]);

export const estimatedBandSchema = z.enum(["A0", "A1", "A2", "B1", "B2", "C1"]);

export const vocabularyEstimateSchema = z
  .object({
    low: z.number().int().min(0),
    high: z.number().int().min(0),
    rationale: z.string().trim().min(1),
  })
  .refine((value) => value.high >= value.low, {
    message: "Vocabulary estimate high value must be >= low value",
    path: ["high"],
  });

export const progressInsightsSchema = z.object({
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

export const tutorProgressAxisOverrideSchema = z.object({
  key: progressAxisKeySchema,
  score: z.number().int().min(0).max(100),
  value: z.string().trim().min(1),
  helper: z.string().trim().min(1),
});

export const tutorProgressOverrideSchema = z.object({
  axisOverrides: z.array(tutorProgressAxisOverrideSchema).max(5).default([]),
  insightsOverride: progressInsightsSchema.nullable().default(null),
});

export type ProgressAxisKey = z.infer<typeof progressAxisKeySchema>;
export type ProgressInsights = z.infer<typeof progressInsightsSchema>;
export type EstimatedBand = z.infer<typeof estimatedBandSchema>;
export type TutorProgressAxisOverride = z.infer<
  typeof tutorProgressAxisOverrideSchema
>;
export type TutorProgressOverride = z.infer<typeof tutorProgressOverrideSchema>;

export const EMPTY_TUTOR_PROGRESS_OVERRIDE: TutorProgressOverride = {
  axisOverrides: [],
  insightsOverride: null,
};

export function parseTutorProgressOverride(
  input:
    | {
        axis_overrides?: unknown;
        insights_override?: unknown;
      }
    | null
    | undefined,
): TutorProgressOverride {
  if (!input) {
    return EMPTY_TUTOR_PROGRESS_OVERRIDE;
  }

  const axisOverrides = z
    .array(tutorProgressAxisOverrideSchema)
    .max(5)
    .safeParse(input.axis_overrides);
  const insightsOverride = progressInsightsSchema
    .nullable()
    .safeParse(input.insights_override ?? null);

  return {
    axisOverrides: axisOverrides.success ? axisOverrides.data : [],
    insightsOverride: insightsOverride.success ? insightsOverride.data : null,
  };
}

export function applyTutorAxisOverrides(
  axes: StudentProgressAxis[],
  axisOverrides: TutorProgressAxisOverride[],
) {
  const overrideMap = new Map(axisOverrides.map((axis) => [axis.key, axis]));

  return axes.map((axis) => {
    const override = overrideMap.get(axis.key);

    if (!override) {
      return axis;
    }

    return {
      ...axis,
      score: override.score,
      value: override.value,
      helper: override.helper,
    };
  });
}

export function buildChartDataFromAxes(axes: StudentProgressAxis[]) {
  return axes.map((axis) => ({
    axis: axis.shortLabel,
    score: axis.score,
    fullMark: 100,
  }));
}
