import type { CEFRLevel } from "@/types/quiz";

export const CEFR_LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const CEFR_GUIDED_HOURS_SOURCE =
  "Approximate cumulative guided learning hours based on Cambridge English CEFR guidance from beginner level.";

export const CEFR_GUIDED_HOURS: Record<
  CEFRLevel,
  {
    minHours: number;
    maxHours: number;
    averageHours: number;
  }
> = {
  A1: { minHours: 90, maxHours: 100, averageHours: 95 },
  A2: { minHours: 180, maxHours: 200, averageHours: 190 },
  B1: { minHours: 350, maxHours: 400, averageHours: 375 },
  B2: { minHours: 500, maxHours: 600, averageHours: 550 },
  C1: { minHours: 700, maxHours: 800, averageHours: 750 },
  C2: { minHours: 1000, maxHours: 1200, averageHours: 1100 },
};