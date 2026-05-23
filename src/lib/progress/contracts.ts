import { z } from "zod";

export const progressAxisKeySchema = z.enum([
  "active_vocab",
  "grammar_variety",
  "engagement",
  "accuracy",
  "passive_vocab",
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

export const tutorTimeAdjustmentHoursSchema = z
  .number()
  .finite()
  .min(-5000)
  .max(5000)
  .default(0);

export type ProgressInsights = z.infer<typeof progressInsightsSchema>;
export type EstimatedBand = z.infer<typeof estimatedBandSchema>;

export function parseProgressInsightsValue(
  input: unknown,
): ProgressInsights | null {
  const parsed = progressInsightsSchema.nullable().safeParse(input ?? null);
  return parsed.success ? parsed.data : null;
}
