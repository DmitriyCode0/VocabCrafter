"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAppI18n } from "@/components/providers/app-language-provider";
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
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";
import { Loader2, Save } from "lucide-react";
import {
  APP_LANGUAGES,
  normalizeAppLanguage,
  type AppLanguage,
} from "@/lib/i18n/app-language";
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
  getGeminiTtsPreviewSamples,
  getGeminiTtsVoiceOption,
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
  appLanguage: AppLanguage;
  aiVoice: GeminiTtsVoice;
}

export default function SettingsPage() {
  const router = useRouter();
  const { messages } = useAppI18n();
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
  const profileAppLanguage = normalizeAppLanguage(profile?.app_language);
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
    appLanguage: profileAppLanguage,
    aiVoice: profileAiVoice ?? DEFAULT_GEMINI_TTS_VOICE,
  };

  const fullName = draft?.fullName ?? baseDraft.fullName;
  const learningLanguage =
    draft?.learningLanguage ?? baseDraft.learningLanguage;
  const sourceLanguage = draft?.sourceLanguage ?? baseDraft.sourceLanguage;
  const appLanguage = draft?.appLanguage ?? baseDraft.appLanguage;
  const aiVoice = draft?.aiVoice ?? baseDraft.aiVoice;
  const rawCefrLevel = draft?.cefrLevel ?? baseDraft.cefrLevel;
  const selectedVoiceOption =
    getGeminiTtsVoiceOption(aiVoice) ?? getGeminiTtsVoiceOption(profileAiVoice);
  const previewSamples = getGeminiTtsPreviewSamples(learningLanguage);
  const selectedLearningLanguageLabel =
    messages.common.studyLanguageNames[learningLanguage];
  const isUnsavedVoiceChange = aiVoice !== profileAiVoice;
  const voiceDescriptionMap = messages.settings.aiVoice.voiceDescriptions;

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
        app_language: appLanguage,
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
      router.refresh();
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
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.settings.title}
        </h1>
        <p className="text-muted-foreground">{messages.settings.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{messages.settings.profileTitle}</CardTitle>
          <CardDescription>{messages.settings.profileDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{messages.settings.fullNameLabel}</Label>
            <Input
              id="fullName"
              placeholder={messages.settings.fullNamePlaceholder}
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
            <Label htmlFor="learningLanguage">
              {messages.settings.learningLanguageLabel}
            </Label>
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
                <SelectValue
                  placeholder={messages.settings.learningLanguagePlaceholder}
                />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {messages.common.studyLanguageNames[option.value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceLanguage">
              {messages.settings.sourceLanguageLabel}
            </Label>
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
                <SelectValue
                  placeholder={messages.settings.sourceLanguagePlaceholder}
                />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {messages.common.studyLanguageNames[option.value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appLanguage">
              {messages.settings.appLanguageLabel}
            </Label>
            <Select
              value={appLanguage}
              onValueChange={(value) => {
                updateDraft((current) => ({
                  ...current,
                  appLanguage: value as AppLanguage,
                }));
              }}
            >
              <SelectTrigger id="appLanguage">
                <SelectValue
                  placeholder={messages.settings.appLanguagePlaceholder}
                />
              </SelectTrigger>
              <SelectContent>
                {APP_LANGUAGES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {messages.common.languageNames[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {messages.settings.appLanguageDescription}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aiVoice">{messages.settings.aiVoice.label}</Label>
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
                <SelectValue
                  placeholder={messages.settings.aiVoice.placeholder}
                />
              </SelectTrigger>
              <SelectContent>
                {GEMINI_TTS_VOICE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} - {voiceDescriptionMap[
                      option.description as keyof typeof voiceDescriptionMap
                    ]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {messages.settings.aiVoice.description}
            </p>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {messages.settings.aiVoice.previewTitle(
                        selectedVoiceOption?.label ?? aiVoice,
                      )}
                    </p>
                    <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {selectedVoiceOption
                        ? voiceDescriptionMap[
                            selectedVoiceOption.description as keyof typeof voiceDescriptionMap
                          ]
                        : messages.settings.aiVoice.previewFallbackBadge}
                    </span>
                    {isUnsavedVoiceChange && (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                        {messages.settings.aiVoice.unsavedBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {messages.settings.aiVoice.previewDescription(
                      selectedLearningLanguageLabel,
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {previewSamples.map((sample) => (
                  <div
                    key={sample.label}
                    className="space-y-3 rounded-lg border bg-background p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {messages.settings.aiVoice.quickPreviewLabel}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {sample.text}
                      </p>
                    </div>
                    <BrowserTtsButton
                      text={sample.text}
                      language={learningLanguage}
                      voice={aiVoice}
                      label={messages.settings.aiVoice.playPreview}
                      className="w-full justify-center"
                    />
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {messages.settings.aiVoice.previewNote}
              </p>
            </div>
          </div>

          {profile?.role === "student" && (
            <div className="space-y-2">
              <Label htmlFor="cefrLevel">{messages.settings.cefrLevelLabel}</Label>
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
                  <SelectValue
                    placeholder={messages.settings.cefrLevelPlaceholder}
                  />
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
                {messages.settings.cefrLevelDescription}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {messages.common.saving}
              </>
            ) : saved ? (
              messages.common.saved
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {messages.common.saveChanges}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.settings.appearanceTitle}</CardTitle>
          <CardDescription>
            {messages.settings.appearanceDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{messages.common.theme}</p>
              <p className="text-xs text-muted-foreground">
                {messages.settings.themeDescription}
              </p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
