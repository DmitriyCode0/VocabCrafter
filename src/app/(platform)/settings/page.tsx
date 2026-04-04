"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2, Save } from "lucide-react";
import {
  TARGET_LANGUAGE_OPTIONS,
  SOURCE_LANGUAGE_OPTIONS,
  getAllowedCefrLevels,
  getDefaultCefrLevelForLanguage,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
  type LearningLanguage,
  type SourceLanguage,
} from "@/lib/languages";
import {
  DEFAULT_GEMINI_TTS_VOICE,
  GEMINI_TTS_CACHE_NAMES_TO_CLEAR,
  GEMINI_TTS_VOICE_OPTIONS,
  normalizeGeminiTtsVoice,
  type GeminiTtsVoice,
} from "@/lib/ai/tts-voices";

async function clearGeminiTtsCaches() {
  if (typeof window === "undefined" || !("caches" in window)) {
    return;
  }

  await Promise.all(
    GEMINI_TTS_CACHE_NAMES_TO_CLEAR.map((cacheName) =>
      window.caches.delete(cacheName),
    ),
  );
}

interface SettingsDraft {
  fullName: string;
  cefrLevel: string;
  learningLanguage: LearningLanguage;
  sourceLanguage: SourceLanguage;
  aiVoice: GeminiTtsVoice;
}

export default function SettingsPage() {
  const { profile, isLoading: profileLoading } = useUser();
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profileLearningLanguage = normalizeLearningLanguage(
    profile?.preferred_language,
  );
  const profileSourceLanguage = normalizeSourceLanguage(
    profile?.source_language,
  );
  const profileAiVoice = normalizeGeminiTtsVoice(profile?.ai_voice);
  const profileAllowedCefrLevels = getAllowedCefrLevels(
    profileLearningLanguage,
  );
  const profileCefrLevel = profileAllowedCefrLevels.includes(
    profile?.cefr_level as (typeof profileAllowedCefrLevels)[number],
  )
    ? (profile?.cefr_level ??
      getDefaultCefrLevelForLanguage(profileLearningLanguage))
    : getDefaultCefrLevelForLanguage(profileLearningLanguage);

  const baseDraft: SettingsDraft = {
    fullName: profile?.full_name ?? "",
    cefrLevel: profileCefrLevel,
    learningLanguage: profileLearningLanguage,
    sourceLanguage: profileSourceLanguage,
    aiVoice: profileAiVoice ?? DEFAULT_GEMINI_TTS_VOICE,
  };

  const fullName = draft?.fullName ?? baseDraft.fullName;
  const learningLanguage =
    draft?.learningLanguage ?? baseDraft.learningLanguage;
  const sourceLanguage = draft?.sourceLanguage ?? baseDraft.sourceLanguage;
  const aiVoice = draft?.aiVoice ?? baseDraft.aiVoice;
  const rawCefrLevel = draft?.cefrLevel ?? baseDraft.cefrLevel;

  const allowedCefrLevels = getAllowedCefrLevels(learningLanguage);
  const cefrLevel = allowedCefrLevels.includes(
    rawCefrLevel as (typeof allowedCefrLevels)[number],
  )
    ? rawCefrLevel
    : getDefaultCefrLevelForLanguage(learningLanguage);

  function updateDraft(transform: (current: SettingsDraft) => SettingsDraft) {
    setDraft((current) => transform(current ?? baseDraft));
  }

  async function handleSave() {
    if (!profile) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    const normalizedAiVoice = normalizeGeminiTtsVoice(aiVoice);

    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        cefr_level: cefrLevel,
        preferred_language: learningLanguage,
        source_language: sourceLanguage,
        ai_voice: normalizedAiVoice,
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      if (profileAiVoice !== normalizedAiVoice) {
        try {
          await clearGeminiTtsCaches();
        } catch (cacheError) {
          console.warn(
            "Failed to clear cached TTS audio after voice change.",
            cacheError,
          );
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }

    setSaving(false);
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your personal information and language level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="Your full name"
              value={fullName}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="learningLanguage">Language You Are Learning</Label>
            <Select
              value={learningLanguage}
              onValueChange={(value) => {
                const nextLearningLanguage = value as LearningLanguage;

                updateDraft((current) => {
                  const nextAllowedCefrLevels =
                    getAllowedCefrLevels(nextLearningLanguage);
                  const nextCefrLevel = nextAllowedCefrLevels.includes(
                    current.cefrLevel as (typeof nextAllowedCefrLevels)[number],
                  )
                    ? current.cefrLevel
                    : getDefaultCefrLevelForLanguage(nextLearningLanguage);

                  return {
                    ...current,
                    learningLanguage: nextLearningLanguage,
                    cefrLevel: nextCefrLevel,
                  };
                });
              }}
            >
              <SelectTrigger id="learningLanguage">
                <SelectValue placeholder="Select a learning language" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceLanguage">Language You Learn From</Label>
            <Select
              value={sourceLanguage}
              onValueChange={(value) => {
                updateDraft((current) => ({
                  ...current,
                  sourceLanguage: value as SourceLanguage,
                }));
              }}
            >
              <SelectTrigger id="sourceLanguage">
                <SelectValue placeholder="Select a source language" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aiVoice">AI Voice</Label>
            <Select
              value={aiVoice}
              onValueChange={(value) => {
                updateDraft((current) => ({
                  ...current,
                  aiVoice: value as GeminiTtsVoice,
                }));
              }}
            >
              <SelectTrigger id="aiVoice">
                <SelectValue placeholder="Select an AI voice" />
              </SelectTrigger>
              <SelectContent>
                {GEMINI_TTS_VOICE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose which Gemini voice is used for quiz audio playback.
            </p>
          </div>

          {profile?.role === "student" && (
            <div className="space-y-2">
              <Label htmlFor="cefrLevel">Level (CEFR)</Label>
              <Select
                value={cefrLevel}
                onValueChange={(value) => {
                  updateDraft((current) => ({
                    ...current,
                    cefrLevel: value,
                  }));
                }}
              >
                <SelectTrigger id="cefrLevel">
                  <SelectValue placeholder="Select your level" />
                </SelectTrigger>
                <SelectContent>
                  {allowedCefrLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This determines quiz difficulty and available grammar topics.
                Spanish is currently limited to A1 for testing.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              "Saved!"
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize how VocabCrafter 2.0 looks on your device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">
                Switch between light, dark, and system theme.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
