import type { GenerateContentResponseUsageMetadata } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type AIUsageFeature =
  | "generate_quiz"
  | "review_activity"
  | "parse_input"
  | "evaluate"
  | "progress_insights"
  | "monthly_report"
  | "passive_vocabulary_enrichment"
  | "lesson_transcript"
  | "classroom_transcript"
  | "tts";

export type AIUsageRequestType = "text" | "tts";

export interface AIUsageSnapshot {
  promptTokens: number;
  responseTokens: number;
  audioOutputTokens: number;
  totalTokens: number;
  isEstimated: boolean;
}

interface RecordAIUsageEventParams {
  userId: string;
  feature: AIUsageFeature;
  requestType: AIUsageRequestType;
  model: string;
  snapshot: AIUsageSnapshot;
  adminClient?: SupabaseClient<Database>;
}

export const AUDIO_TOKENS_PER_SECOND = 32;
export const GEMINI_TEXT_INPUT_COST_PER_MILLION = 0.25;
export const GEMINI_TEXT_OUTPUT_COST_PER_MILLION = 1.5;
export const GEMINI_TTS_INPUT_COST_PER_MILLION = 0.5;
export const GEMINI_TTS_OUTPUT_COST_PER_MILLION = 10;
export const GEMINI_STT_INPUT_COST_PER_MILLION = 1;
export const GEMINI_STT_OUTPUT_COST_PER_MILLION = 2.5;

export function isSpeechToTextFeature(feature: string | null | undefined) {
  return feature === "lesson_transcript" || feature === "classroom_transcript";
}

function estimateTextTokens(text: string) {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 4));
}

function sumModalityTokens(
  details:
    | GenerateContentResponseUsageMetadata["promptTokensDetails"]
    | GenerateContentResponseUsageMetadata["candidatesTokensDetails"]
    | undefined,
  modality: "TEXT" | "AUDIO",
) {
  return (details ?? []).reduce((sum, detail) => {
    if (detail.modality !== modality) {
      return sum;
    }

    return sum + (detail.tokenCount ?? 0);
  }, 0);
}

function estimateAudioTokensFromPcmBytes(
  pcmByteLength: number,
  sampleRate: number,
  channelCount: number,
  bitsPerSample: number,
) {
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerSecond = sampleRate * channelCount * bytesPerSample;

  if (bytesPerSecond <= 0 || pcmByteLength <= 0) {
    return 0;
  }

  const durationSeconds = pcmByteLength / bytesPerSecond;
  return Math.max(1, Math.round(durationSeconds * AUDIO_TOKENS_PER_SECOND));
}

export function extractTextUsageSnapshot({
  prompt,
  responseText,
  usageMetadata,
}: {
  prompt: string;
  responseText: string;
  usageMetadata?: GenerateContentResponseUsageMetadata;
}): AIUsageSnapshot {
  const metadataPromptTokens =
    usageMetadata?.promptTokenCount ??
    sumModalityTokens(usageMetadata?.promptTokensDetails, "TEXT");
  const metadataResponseTokens =
    usageMetadata?.candidatesTokenCount ??
    sumModalityTokens(usageMetadata?.candidatesTokensDetails, "TEXT");

  const promptTokens = metadataPromptTokens || estimateTextTokens(prompt);
  const responseTokens =
    metadataResponseTokens || estimateTextTokens(responseText);
  const totalTokens =
    usageMetadata?.totalTokenCount ?? promptTokens + responseTokens;

  return {
    promptTokens,
    responseTokens,
    audioOutputTokens: 0,
    totalTokens,
    isEstimated:
      !metadataPromptTokens ||
      !metadataResponseTokens ||
      usageMetadata?.totalTokenCount == null,
  };
}

export function extractTtsUsageSnapshot({
  prompt,
  pcmByteLength,
  sampleRate,
  channelCount,
  bitsPerSample,
  usageMetadata,
}: {
  prompt: string;
  pcmByteLength: number;
  sampleRate: number;
  channelCount: number;
  bitsPerSample: number;
  usageMetadata?: GenerateContentResponseUsageMetadata;
}): AIUsageSnapshot {
  const metadataPromptTokens =
    usageMetadata?.promptTokenCount ??
    sumModalityTokens(usageMetadata?.promptTokensDetails, "TEXT");
  const modalityAudioTokens = sumModalityTokens(
    usageMetadata?.candidatesTokensDetails,
    "AUDIO",
  );
  const candidateAudioTokens =
    modalityAudioTokens || usageMetadata?.candidatesTokenCount || 0;

  const promptTokens = metadataPromptTokens || estimateTextTokens(prompt);
  const audioOutputTokens =
    candidateAudioTokens ||
    estimateAudioTokensFromPcmBytes(
      pcmByteLength,
      sampleRate,
      channelCount,
      bitsPerSample,
    );
  const totalTokens =
    usageMetadata?.totalTokenCount ?? promptTokens + audioOutputTokens;

  return {
    promptTokens,
    responseTokens: 0,
    audioOutputTokens,
    totalTokens,
    isEstimated:
      !metadataPromptTokens ||
      !candidateAudioTokens ||
      usageMetadata?.totalTokenCount == null,
  };
}

export function calculateTextCostUsd(
  promptTokens: number,
  responseTokens: number,
) {
  return (
    (promptTokens / 1_000_000) * GEMINI_TEXT_INPUT_COST_PER_MILLION +
    (responseTokens / 1_000_000) * GEMINI_TEXT_OUTPUT_COST_PER_MILLION
  );
}

export function calculateTtsCostUsd(
  promptTokens: number,
  audioOutputTokens: number,
) {
  return (
    (promptTokens / 1_000_000) * GEMINI_TTS_INPUT_COST_PER_MILLION +
    (audioOutputTokens / 1_000_000) * GEMINI_TTS_OUTPUT_COST_PER_MILLION
  );
}

export function calculateSttCostUsd(
  promptTokens: number,
  responseTokens: number,
) {
  return (
    (promptTokens / 1_000_000) * GEMINI_STT_INPUT_COST_PER_MILLION +
    (responseTokens / 1_000_000) * GEMINI_STT_OUTPUT_COST_PER_MILLION
  );
}

export async function recordAIUsageEvent({
  userId,
  feature,
  requestType,
  model,
  snapshot,
  adminClient,
}: RecordAIUsageEventParams) {
  try {
    const admin = adminClient ?? createAdminClient();
    const insertPayload = {
      user_id: userId,
      feature,
      request_type: requestType,
      provider: "gemini",
      model,
      prompt_tokens: snapshot.promptTokens,
      response_tokens: snapshot.responseTokens,
      audio_output_tokens: snapshot.audioOutputTokens,
      total_tokens: snapshot.totalTokens,
      is_estimated: snapshot.isEstimated,
    };

    const { error: rpcError } = await admin.rpc("log_ai_usage_event", {
      p_user_id: userId,
      p_feature: feature,
      p_request_type: requestType,
      p_provider: "gemini",
      p_model: model,
      p_prompt_tokens: snapshot.promptTokens,
      p_response_tokens: snapshot.responseTokens,
      p_audio_output_tokens: snapshot.audioOutputTokens,
      p_total_tokens: snapshot.totalTokens,
      p_is_estimated: snapshot.isEstimated,
    });

    if (!rpcError) {
      return;
    }

    const { error: insertError } = await admin
      .from("ai_usage_events")
      .insert(insertPayload);

    if (insertError) {
      console.error("AI usage logging error:", {
        userId,
        feature,
        requestType,
        model,
        rpcError,
        insertError,
      });
    }
  } catch (error) {
    console.error("AI usage logging error:", {
      userId,
      feature,
      requestType,
      model,
      error,
    });
  }
}
