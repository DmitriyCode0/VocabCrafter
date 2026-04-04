import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { extractTtsUsageSnapshot, recordAIUsageEvent } from "@/lib/ai/usage";
import {
  DEFAULT_GEMINI_TTS_VOICE,
  normalizeGeminiTtsVoice,
} from "@/lib/ai/tts-voices";
import { getGenAI, GEMINI_TTS_MODEL } from "@/lib/gemini/client";
import { getSpeechLanguageTag } from "@/lib/languages";

const SAMPLE_RATE = 24000;
const CHANNEL_COUNT = 1;
const BITS_PER_SAMPLE = 16;

const requestSchema = z.object({
  text: z.string().trim().min(1).max(3000),
  language: z.enum(["english", "spanish", "ukrainian"]).optional(),
  voice: z.string().trim().optional(),
});

function buildTtsPrompt(text: string) {
  return `Read the following transcript aloud exactly as written. Do not translate it. Do not add words. Do not explain anything. Output audio only.\n\nTranscript:\n${text}`;
}

function createWavHeader(dataLength: number) {
  const blockAlign = (CHANNEL_COUNT * BITS_PER_SAMPLE) / 8;
  const byteRate = SAMPLE_RATE * blockAlign;
  const buffer = Buffer.alloc(44);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNEL_COUNT, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

function pcmToWavBuffer(pcmData: Buffer) {
  return Buffer.concat([createWavHeader(pcmData.length), pcmData]);
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

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
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

    const { text, language, voice } = parsed.data;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("ai_voice")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.warn("Failed to load AI voice preference, using default.", {
        userId: user.id,
        message: profileError.message,
      });
    }

    const voiceName = normalizeGeminiTtsVoice(
      voice ?? profile?.ai_voice ?? DEFAULT_GEMINI_TTS_VOICE,
    );
    const prompt = buildTtsPrompt(text);
    const response = await getGenAI().models.generateContent({
      model: GEMINI_TTS_MODEL,
      contents: prompt,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          languageCode: getSpeechLanguageTag(language),
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName,
            },
          },
        },
      },
    });

    const audioData = response.data;

    if (!audioData) {
      console.error("Gemini TTS returned no audio data", {
        promptFeedback: response.promptFeedback,
        candidates: response.candidates?.map((candidate) => ({
          finishReason: candidate.finishReason,
          finishMessage: candidate.finishMessage,
          partKinds: candidate.content?.parts?.map((part) => Object.keys(part)),
        })),
      });

      return NextResponse.json(
        { error: "AI returned empty audio" },
        { status: 502 },
      );
    }

    const pcmBuffer = Buffer.from(audioData, "base64");
    const wavBuffer = pcmToWavBuffer(pcmBuffer);

    await recordAIUsageEvent({
      userId: user.id,
      feature: "tts",
      requestType: "tts",
      model: GEMINI_TTS_MODEL,
      snapshot: extractTtsUsageSnapshot({
        prompt,
        pcmByteLength: pcmBuffer.length,
        sampleRate: SAMPLE_RATE,
        channelCount: CHANNEL_COUNT,
        bitsPerSample: BITS_PER_SAMPLE,
        usageMetadata: response.usageMetadata,
      }),
    });

    await incrementAICalls(user.id);

    return new NextResponse(wavBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wavBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Gemini TTS error:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
    ) {
      const errorMessage =
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Gemini TTS request failed";

      return NextResponse.json(
        { error: errorMessage },
        {
          status:
            error.status >= 400 && error.status < 600 ? error.status : 502,
        },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
