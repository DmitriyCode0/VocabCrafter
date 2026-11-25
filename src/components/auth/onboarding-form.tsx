"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Clock, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role, CEFRLevel } from "@/types";
import {
  TARGET_LANGUAGE_OPTIONS,
  SOURCE_LANGUAGE_OPTIONS,
  getAllowedCefrLevels,
  getDefaultCefrLevelForLanguage,
  type LearningLanguage,
  type SourceLanguage,
} from "@/lib/languages";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  student: "Create and take quizzes, join classes, track your progress",
  tutor: "Manage classes, assign quizzes, review student work",
};

export function OnboardingForm() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [registrationNote, setRegistrationNote] = useState("");
  const [learningLanguage, setLearningLanguage] =
    useState<LearningLanguage>("english");
  const [sourceLanguage, setSourceLanguage] =
    useState<SourceLanguage>("ukrainian");
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>("B1");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPrefill() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, registration_note, onboarding_completed")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      if (profile?.onboarding_completed) {
        router.replace("/dashboard");
        return;
      }

      const meta = user.user_metadata as
        | {
            full_name?: string;
            name?: string;
            requested_role?: string;
            registration_note?: string;
          }
        | undefined;

      const initialName =
        profile?.full_name || meta?.full_name || meta?.name || "";
      const initialNote =
        profile?.registration_note || meta?.registration_note || "";
      const requestedRole =
        meta?.requested_role === "student" || meta?.requested_role === "tutor"
          ? meta.requested_role
          : null;

      if (initialName) setFullName(initialName);
      if (initialNote) setRegistrationNote(initialNote);
      if (requestedRole) {
        setSelectedRole(requestedRole);
        setStep(2);
      }
    }

    loadPrefill();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  const allowedCefrLevels = getAllowedCefrLevels(learningLanguage);

  function handleLearningLanguageChange(value: string) {
    const nextLanguage = value as LearningLanguage;
    setLearningLanguage(nextLanguage);

    const nextAllowedLevels = getAllowedCefrLevels(nextLanguage);
    if (!nextAllowedLevels.includes(cefrLevel)) {
      setCefrLevel(getDefaultCefrLevelForLanguage(nextLanguage));
    }
  }

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep(2);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated. Please log in again.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        role: selectedRole,
        full_name: fullName.trim() || null,
        registration_note: registrationNote.trim() || null,
        cefr_level: selectedRole === "student" ? cefrLevel : undefined,
        preferred_language:
          selectedRole === "student" ? learningLanguage : undefined,
        source_language:
          selectedRole === "student" ? sourceLanguage : undefined,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  if (step === 1) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome to VocabCrafter 2.0</h1>
          <p className="mt-2 text-muted-foreground">
            Choose your role to finish requesting access
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            role="button"
            tabIndex={0}
            onClick={() => handleRoleSelect("student")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRoleSelect("student");
              }
            }}
            className="cursor-pointer transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CardHeader className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle>Student</CardTitle>
              <CardDescription>{ROLE_DESCRIPTIONS.student}</CardDescription>
            </CardHeader>
          </Card>
          <Card
            role="button"
            tabIndex={0}
            onClick={() => handleRoleSelect("tutor")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRoleSelect("tutor");
              }
            }}
            className="cursor-pointer transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CardHeader className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle>Tutor</CardTitle>
              <CardDescription>{ROLE_DESCRIPTIONS.tutor}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-lg border-border/70 shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          Set up your profile
        </CardTitle>
        <CardDescription>
          {selectedRole === "student"
            ? "Tell us about yourself to personalize your learning"
            : "Set up your tutor profile"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleComplete} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          {selectedRole === "student" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="learningLanguage">
                  Language You Are Learning
                </Label>
                <Select
                  value={learningLanguage}
                  onValueChange={handleLearningLanguageChange}
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

              <div className="space-y-2">
                <Label htmlFor="cefrLevel">Your Level (CEFR)</Label>
                <Select
                  value={cefrLevel}
                  onValueChange={(value) => setCefrLevel(value as CEFRLevel)}
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
                  This helps us tailor quizzes to your proficiency level.
                </p>
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="onboardingNote">
              Note for administrator{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="onboardingNote"
              rows={2}
              maxLength={300}
              placeholder="Who invited you, your tutor's name, or Telegram @username"
              value={registrationNote}
              onChange={(e) => setRegistrationNote(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
            <Clock
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              Your request will appear as pending on your dashboard until
              approved manually by an administrator.
            </span>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              className="flex-1"
            >
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
