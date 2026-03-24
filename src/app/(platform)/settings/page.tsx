"use client";

import { useState, useEffect } from "react";
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

export default function SettingsPage() {
  const { profile, isLoading: profileLoading } = useUser();
  const [fullName, setFullName] = useState("");
  const [cefrLevel, setCefrLevel] = useState("B1");
  const [learningLanguage, setLearningLanguage] =
    useState<LearningLanguage>("english");
  const [sourceLanguage, setSourceLanguage] =
    useState<SourceLanguage>("ukrainian");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedCefrLevels = getAllowedCefrLevels(learningLanguage);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      const normalizedLearningLanguage = normalizeLearningLanguage(
        profile.preferred_language,
      );
      setLearningLanguage(normalizedLearningLanguage);
      setSourceLanguage(normalizeSourceLanguage(profile.source_language));

      const allowedLevels = getAllowedCefrLevels(normalizedLearningLanguage);
      const nextCefrLevel = allowedLevels.includes(
        profile.cefr_level as (typeof allowedLevels)[number],
      )
        ? profile.cefr_level
        : getDefaultCefrLevelForLanguage(normalizedLearningLanguage);

      setCefrLevel(nextCefrLevel);
    }
  }, [profile]);

  useEffect(() => {
    if (
      !allowedCefrLevels.includes(
        cefrLevel as (typeof allowedCefrLevels)[number],
      )
    ) {
      setCefrLevel(getDefaultCefrLevelForLanguage(learningLanguage));
    }
  }, [allowedCefrLevels, cefrLevel, learningLanguage]);

  async function handleSave() {
    if (!profile) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        cefr_level: cefrLevel,
        preferred_language: learningLanguage,
        source_language: sourceLanguage,
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
    } else {
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
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="learningLanguage">Language You Are Learning</Label>
            <Select
              value={learningLanguage}
              onValueChange={(value) =>
                setLearningLanguage(value as LearningLanguage)
              }
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
              onValueChange={(value) =>
                setSourceLanguage(value as SourceLanguage)
              }
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

          {profile?.role === "student" && (
            <div className="space-y-2">
              <Label htmlFor="cefrLevel">Level (CEFR)</Label>
              <Select value={cefrLevel} onValueChange={setCefrLevel}>
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
