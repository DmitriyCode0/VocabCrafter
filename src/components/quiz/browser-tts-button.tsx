"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Square, Volume2 } from "lucide-react";
import { getSpeechLanguageTag } from "@/lib/languages";

const GEMINI_TTS_CACHE_NAME = "gemini-tts-v1";

interface BrowserTtsButtonProps {
  text: string;
  language?: string | null;
  label?: string;
  className?: string;
}

export function BrowserTtsButton({
  text,
  language,
  label = "Listen",
  className,
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

  function speakWithBrowser(textToSpeak: string) {
    if (!supportsBrowserSpeech) {
      return;
    }

    const synthesis = window.speechSynthesis;

    synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = getSpeechLanguageTag(language);
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

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
    const hashedKey = await hashCacheKey(
      `${normalizedLanguage}:${textToSpeak}`,
    );

    return new Request(
      `/tts-cache/${hashedKey}.wav?lang=${normalizedLanguage}`,
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
    const cacheKey = `${language ?? "default"}:${textToSpeak}`;

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
      speakWithBrowser(trimmedText);
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
