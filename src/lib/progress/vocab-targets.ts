import type { CEFRLevel } from "@/types/quiz";

/**
 * CEFR-inspired product targets for overall vocabulary progress.
 *
 * Active vocabulary = words actively used in production (tracked via word_mastery).
 * A1: basic survival vocabulary, A2: routine matters, B1: familiar topics,
 * B2: abstract topics, C1: flexible effective use, C2: near-native range.
 */
export const ACTIVE_VOCAB_TARGETS: Record<CEFRLevel, number> = {
  A1: 400,
  A2: 800,
  B1: 1200,
  B2: 2500,
  C1: 4000,
  C2: 8000,
};

/**
 * Passive vocabulary = words recognized but not necessarily produced
 * (tracked via passive_vocabulary_evidence).
 * A1: understand basic phrases, A2: simple texts, B1: standard text,
 * B2: contemporary articles, C1: demanding texts, C2: near-native comprehension.
 */
export const PASSIVE_VOCAB_TARGETS: Record<CEFRLevel, number> = {
  A1: 600,
  A2: 1500,
  B1: 4000,
  B2: 8000,
  C1: 15000,
  C2: 25000,
};
