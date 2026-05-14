"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Square, Volume2 } from "lucide-react";
import {
  GEMINI_TTS_CACHE_NAME,
  type GeminiTtsVoice,
} from "@/lib/ai/tts-voices";
import {
  getSpeechLanguageTag,
  type EnglishVariantPreference,
} from "@/lib/languages";

interface BrowserTtsButtonProps {
  text: string;
  language?: string | null;
  englishVariantPreference?: EnglishVariantPreference | null;
  voice?: GeminiTtsVoice | null;
  label?: string;
  className?: string;
  browserOnly?: boolean;
}

export function BrowserTtsButton({
  text,
  language,
  englishVariantPreference,
  voice,
  label = "Listen",
  className,
  browserOnly = false,
}: BrowserTtsButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cachedUrlRef = useRef<string | null>(null);
  const cachedKeyRef = useRef<string | null>(null);
  const supportsBrowserSpeech =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (cachedUrlRef.current) {
        URL.revokeObjectURL(cachedUrlRef.current);
        cachedUrlRef.current = null;
      }
    };
  }, []);

  function stopPlayback() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setIsSpeaking(false);
    setIsLoading(false);
  }

  function isAppleSpeechPlatform() {
    if (typeof navigator === "undefined") {
      return false;
    }

    const platform = navigator.platform ?? "";
    const userAgent = navigator.userAgent ?? "";
    return /Mac|iPhone|iPad|iPod/i.test(`${platform} ${userAgent}`);
  }

  async function getAvailableBrowserVoices() {
    if (!supportsBrowserSpeech) {
      return [] as SpeechSynthesisVoice[];
    }

    const synthesis = window.speechSynthesis;
    const existingVoices = synthesis.getVoices();

    if (existingVoices.length > 0) {
      return existingVoices;
    }

    await new Promise<void>((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        synthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        window.clearTimeout(timeoutId);
        resolve();
      };

      const handleVoicesChanged = () => finish();
      const timeoutId = window.setTimeout(finish, 400);

      synthesis.addEventListener("voiceschanged", handleVoicesChanged);
      synthesis.getVoices();
    });

    return synthesis.getVoices();
  }

  function pickBestBrowserVoice(
    voices: SpeechSynthesisVoice[],
    languageTag: string,
  ) {
    const normalizedLanguageTag = languageTag.toLowerCase();
    const normalizedBaseLanguage =
      normalizedLanguageTag.split("-")[0] ?? normalizedLanguageTag;
    const applePlatform = isAppleSpeechPlatform();

    const scoredVoices = voices.map((currentVoice) => {
      const normalizedVoiceLanguage = currentVoice.lang.toLowerCase();
      const normalizedVoiceBaseLanguage =
        normalizedVoiceLanguage.split("-")[0] ?? normalizedVoiceLanguage;
      const voiceDescriptor = `${currentVoice.name} ${currentVoice.voiceURI}`.toLowerCase();
      let score = 0;

      if (normalizedVoiceLanguage === normalizedLanguageTag) {
        score += 300;
      } else if (normalizedVoiceBaseLanguage === normalizedBaseLanguage) {
        score += 180;
      }

      if (currentVoice.default) {
        score += 40;
      }

      if (currentVoice.localService) {
        score += 30;
      }

      if (applePlatform) {
        if (/(premium|enhanced|natural)/.test(voiceDescriptor)) {
          score += 90;
        }

        if (/compact/.test(voiceDescriptor)) {
          score -= 70;
        }

        if (/(alex|daniel|karen|moira|samantha|serena)/.test(voiceDescriptor)) {
          score += 35;
        }
      }

      return { currentVoice, score };
    });

    scoredVoices.sort((left, right) => right.score - left.score);
    return scoredVoices[0]?.currentVoice ?? null;
  }

  async function speakWithBrowser(textToSpeak: string) {
    if (!supportsBrowserSpeech) {
      return;
    }

    const synthesis = window.speechSynthesis;
    const speechLanguageTag = getSpeechLanguageTag(
      language,
      englishVariantPreference,
    );

    synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = speechLanguageTag;
    utterance.rate = isAppleSpeechPlatform() ? 0.9 : 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    try {
      const availableVoices = await getAvailableBrowserVoices();
      const preferredVoice = pickBestBrowserVoice(
        availableVoices,
        speechLanguageTag,
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang || speechLanguageTag;
      }
    } catch (error) {
      console.warn("Failed to resolve a preferred browser speech voice.", error);
    }

    setIsSpeaking(true);
    synthesis.speak(utterance);
  }

  async function hashCacheKey(value: string) {
    if (
      typeof window !== "undefined" &&
      "crypto" in window &&
      "subtle" in window.crypto
    ) {
      const encoded = new TextEncoder().encode(value);
      const digest = await window.crypto.subtle.digest("SHA-256", encoded);
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }

    return encodeURIComponent(value).slice(0, 160);
  }

  async function createPersistentCacheRequest(textToSpeak: string) {
    const normalizedLanguage = language ?? "default";
    const normalizedEnglishVariant = englishVariantPreference ?? "profile";
    const normalizedVoice = voice ?? "profile";
    const hashedKey = await hashCacheKey(
      `${normalizedLanguage}:${normalizedEnglishVariant}:${normalizedVoice}:${textToSpeak}`,
    );

    return new Request(
      `/tts-cache/${hashedKey}.wav?lang=${normalizedLanguage}&variant=${normalizedEnglishVariant}&voice=${normalizedVoice}`,
      {
        method: "GET",
      },
    );
  }

  async function getPersistentCachedAudio(cacheRequest: Request) {
    if (typeof window === "undefined" || !("caches" in window)) {
      return null;
    }

    const cache = await window.caches.open(GEMINI_TTS_CACHE_NAME);
    return cache.match(cacheRequest);
  }

  async function storePersistentCachedAudio(
    cacheRequest: Request,
    audioBlob: Blob,
  ) {
    if (typeof window === "undefined" || !("caches" in window)) {
      return;
    }

    const cache = await window.caches.open(GEMINI_TTS_CACHE_NAME);
    await cache.put(
      cacheRequest,
      new Response(audioBlob, {
        headers: {
          "Content-Type": audioBlob.type || "audio/wav",
        },
      }),
    );
  }

  function rememberAudioUrl(cacheKey: string, audioUrl: string) {
    if (cachedUrlRef.current) {
      URL.revokeObjectURL(cachedUrlRef.current);
    }

    cachedKeyRef.current = cacheKey;
    cachedUrlRef.current = audioUrl;
    return audioUrl;
  }

  async function playAudioUrl(audioUrl: string) {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => setIsSpeaking(false);
    audio.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    await audio.play();
  }

  async function fetchGeminiAudio(textToSpeak: string) {
    const cacheKey = `${language ?? "default"}:${englishVariantPreference ?? "profile"}:${voice ?? "profile"}:${textToSpeak}`;

    if (cachedKeyRef.current === cacheKey && cachedUrlRef.current) {
      return cachedUrlRef.current;
    }

    const persistentCacheRequest =
      await createPersistentCacheRequest(textToSpeak);
    const cachedResponse = await getPersistentCachedAudio(
      persistentCacheRequest,
    );

    if (cachedResponse) {
      const cachedBlob = await cachedResponse.blob();
      return rememberAudioUrl(cacheKey, URL.createObjectURL(cachedBlob));
    }

    const response = await fetch("/api/ai/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: textToSpeak,
        language,
        englishVariantPreference,
        voice,
      }),
    });

    if (!response.ok) {
      throw new Error("Gemini TTS request failed");
    }

    const blob = await response.blob();
    await storePersistentCachedAudio(persistentCacheRequest, blob);

    return rememberAudioUrl(cacheKey, URL.createObjectURL(blob));
  }

  async function handleSpeak() {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    if (isSpeaking) {
      stopPlayback();
      return;
    }

    if (browserOnly) {
      setIsLoading(false);
      await speakWithBrowser(trimmedText);
      return;
    }

    setIsLoading(true);

    try {
      const audioUrl = await fetchGeminiAudio(trimmedText);
      setIsLoading(false);
      await playAudioUrl(audioUrl);
    } catch (error) {
      console.warn(
        "Gemini TTS unavailable, falling back to browser speech.",
        error,
      );
      setIsLoading(false);
      await speakWithBrowser(trimmedText);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(event) => {
        event.stopPropagation();
        void handleSpeak();
      }}
      disabled={isLoading || !text.trim()}
      className={className}
      aria-label={isSpeaking ? `Stop ${label.toLowerCase()}` : label}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
      ) : isSpeaking ? (
        <Square className="mr-2 h-3.5 w-3.5" />
      ) : (
        <Volume2 className="mr-2 h-3.5 w-3.5" />
      )}
      {isLoading ? "Loading..." : isSpeaking ? "Stop" : label}
    </Button>
  );
}
