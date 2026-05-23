"use client";

import { useState, type ReactNode } from "react";
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
import { Separator } from "@/components/ui/separator";
import { BrowserTtsButton } from "@/components/quiz/browser-tts-button";
import { Loader2, Save } from "lucide-react";
import {
  APP_LANGUAGES,
  normalizeAppLanguage,
  type AppLanguage,
} from "@/lib/i18n/app-language";
import {
  ENGLISH_VARIANT_PREFERENCES,
  TARGET_LANGUAGE_OPTIONS,
  SOURCE_LANGUAGE_OPTIONS,
  getAllowedCefrLevels,
  getDefaultCefrLevelForLanguage,
  normalizeEnglishVariantPreference,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
  type EnglishVariantPreference,
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
  englishVariantPreference: EnglishVariantPreference;
  appLanguage: AppLanguage;
  aiVoice: GeminiTtsVoice;
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="divide-y divide-border/60 border-y border-border/60">
        {children}
      </div>
    </section>
  );
}

function SettingsFieldRow({
  htmlFor,
  label,
  description,
  children,
}: {
  htmlFor: string;
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4 py-6 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:gap-8">
      <div className="space-y-1">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  );
}

function SettingsSidebarPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Separator />
      {children}
    </section>
  );
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
  const profileEnglishVariantPreference = normalizeEnglishVariantPreference(
    profile?.english_variant_preference,
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
    englishVariantPreference: profileEnglishVariantPreference,
    appLanguage: profileAppLanguage,
    aiVoice: profileAiVoice ?? DEFAULT_GEMINI_TTS_VOICE,
  };

  const fullName = draft?.fullName ?? baseDraft.fullName;
  const learningLanguage =
    draft?.learningLanguage ?? baseDraft.learningLanguage;
  const sourceLanguage = draft?.sourceLanguage ?? baseDraft.sourceLanguage;
  const englishVariantPreference =
    draft?.englishVariantPreference ?? baseDraft.englishVariantPreference;
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

  function renderSaveButton(fullWidth = false) {
    return (
      <Button
        onClick={handleSave}
        disabled={saving}
        className={fullWidth ? "w-full justify-center" : undefined}
      >
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
    );
  }

  async function handleSave() {
    if (!profile) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    const normalizedAiVoice = normalizeGeminiTtsVoice(aiVoice);
    const normalizedEnglishVariantPreference = normalizeEnglishVariantPreference(
      englishVariantPreference,
    );

    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        cefr_level: cefrLevel,
        preferred_language: learningLanguage,
        source_language: sourceLanguage,
        english_variant_preference: normalizedEnglishVariantPreference,
        app_language: appLanguage,
        ai_voice: normalizedAiVoice,
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      if (
        profileAiVoice !== normalizedAiVoice ||
        profileEnglishVariantPreference !== normalizedEnglishVariantPreference
      ) {
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

  const isTutorView = profile?.role === "tutor";

  const fullNameControl = (
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
  );

  const learningLanguageControl = (
    <Select
      value={learningLanguage}
      onValueChange={(value) => {
        const nextLearningLanguage = value as LearningLanguage;

        updateDraft((current) => {
          const nextAllowedCefrLevels = getAllowedCefrLevels(nextLearningLanguage);
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
  );

  const sourceLanguageControl = (
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
        <SelectValue placeholder={messages.settings.sourceLanguagePlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {SOURCE_LANGUAGE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {messages.common.studyLanguageNames[option.value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const englishVariantControl = (
    <Select
      value={englishVariantPreference}
      onValueChange={(value) => {
        updateDraft((current) => ({
          ...current,
          englishVariantPreference: value as EnglishVariantPreference,
        }));
      }}
    >
      <SelectTrigger id="englishVariantPreference">
        <SelectValue
          placeholder={messages.settings.englishVariantPlaceholder}
        />
      </SelectTrigger>
      <SelectContent>
        {ENGLISH_VARIANT_PREFERENCES.map((value) => (
          <SelectItem key={value} value={value}>
            {messages.settings.englishVariants[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const appLanguageControl = (
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
        <SelectValue placeholder={messages.settings.appLanguagePlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {APP_LANGUAGES.map((value) => (
          <SelectItem key={value} value={value}>
            {messages.common.languageNames[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const aiVoiceSelectControl = (
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
        <SelectValue placeholder={messages.settings.aiVoice.placeholder} />
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
  );

  const tutorAiVoiceControl = (
    <div className="space-y-4">
      <div className="max-w-lg">{aiVoiceSelectControl}</div>

      <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
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
            {isUnsavedVoiceChange ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                {messages.settings.aiVoice.unsavedBadge}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {messages.settings.aiVoice.previewDescription(
              selectedLearningLanguageLabel,
            )}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
          {previewSamples.map((sample, index) => (
            <div key={sample.label}>
              {index > 0 ? <Separator /> : null}
              <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
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
                  englishVariantPreference={englishVariantPreference}
                  voice={aiVoice}
                  label={messages.settings.aiVoice.playPreview}
                  className="w-full justify-center md:w-auto"
                />
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {messages.settings.aiVoice.previewNote}
        </p>
      </div>
    </div>
  );

  const legacyAiVoiceControl = (
    <div className="space-y-2">
      {aiVoiceSelectControl}
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
                <p className="text-sm text-muted-foreground">{sample.text}</p>
              </div>
              <BrowserTtsButton
                text={sample.text}
                language={learningLanguage}
                englishVariantPreference={englishVariantPreference}
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
  );

  const cefrLevelControl = (
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
        <SelectValue placeholder={messages.settings.cefrLevelPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {allowedCefrLevels.map((level) => (
          <SelectItem key={level} value={level}>
            {level}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (isTutorView) {
    return (
      <div className="space-y-8">
        <div className="max-w-3xl space-y-2 border-b border-border/60 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            {messages.settings.title}
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            {messages.settings.description}
          </p>
        </div>

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-10">
            <SettingsSection
              title={messages.settings.profileTitle}
              description={messages.settings.profileDescription}
            >
              <SettingsFieldRow
                htmlFor="fullName"
                label={messages.settings.fullNameLabel}
              >
                <div className="max-w-lg">{fullNameControl}</div>
              </SettingsFieldRow>

              <SettingsFieldRow
                htmlFor="learningLanguage"
                label={messages.settings.learningLanguageLabel}
              >
                <div className="max-w-lg">{learningLanguageControl}</div>
              </SettingsFieldRow>

              <SettingsFieldRow
                htmlFor="sourceLanguage"
                label={messages.settings.sourceLanguageLabel}
              >
                <div className="max-w-lg">{sourceLanguageControl}</div>
              </SettingsFieldRow>

              {learningLanguage === "english" ? (
                <SettingsFieldRow
                  htmlFor="englishVariantPreference"
                  label={messages.settings.englishVariantLabel}
                  description={messages.settings.englishVariantDescription}
                >
                  <div className="max-w-lg">{englishVariantControl}</div>
                </SettingsFieldRow>
              ) : null}

              <SettingsFieldRow
                htmlFor="appLanguage"
                label={messages.settings.appLanguageLabel}
                description={messages.settings.appLanguageDescription}
              >
                <div className="max-w-lg">{appLanguageControl}</div>
              </SettingsFieldRow>

              <SettingsFieldRow
                htmlFor="aiVoice"
                label={messages.settings.aiVoice.label}
                description={messages.settings.aiVoice.description}
              >
                {tutorAiVoiceControl}
              </SettingsFieldRow>
            </SettingsSection>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <SettingsSidebarPanel
              title={messages.common.saveChanges}
              description={messages.settings.description}
            >
              <div className="space-y-3">
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
                {saved && !error ? (
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {messages.common.saved}
                  </p>
                ) : null}
                {renderSaveButton(true)}
              </div>
            </SettingsSidebarPanel>
          </aside>
        </div>
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
            {fullNameControl}
          </div>

          <div className="space-y-2">
            <Label htmlFor="learningLanguage">
              {messages.settings.learningLanguageLabel}
            </Label>
            {learningLanguageControl}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceLanguage">
              {messages.settings.sourceLanguageLabel}
            </Label>
            {sourceLanguageControl}
          </div>

          {learningLanguage === "english" ? (
            <div className="space-y-2">
              <Label htmlFor="englishVariantPreference">
                {messages.settings.englishVariantLabel}
              </Label>
              {englishVariantControl}
              <p className="text-xs text-muted-foreground">
                {messages.settings.englishVariantDescription}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="appLanguage">
              {messages.settings.appLanguageLabel}
            </Label>
            {appLanguageControl}
            <p className="text-xs text-muted-foreground">
              {messages.settings.appLanguageDescription}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aiVoice">{messages.settings.aiVoice.label}</Label>
            {legacyAiVoiceControl}
          </div>

          {profile?.role === "student" && (
            <div className="space-y-2">
              <Label htmlFor="cefrLevel">{messages.settings.cefrLevelLabel}</Label>
              {cefrLevelControl}
              <p className="text-xs text-muted-foreground">
                {messages.settings.cefrLevelDescription}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {renderSaveButton()}
        </CardContent>
      </Card>
    </div>
  );
}
