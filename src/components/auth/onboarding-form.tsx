"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const ROLE_DESCRIPTIONS: Record<string, string> = {
  student: "Create and take quizzes, join classes, track your progress",
  tutor: "Manage classes, assign quizzes, review student work",
};

const CEFR_LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function OnboardingForm() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>("B1");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

    const { error } = await supabase
      .from("profiles")
      .update({
        role: selectedRole,
        full_name: fullName || null,
        cefr_level: selectedRole === "student" ? cefrLevel : "B1",
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  if (step === 1) {
    return (
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome to VocabCrafter</h1>
          <p className="mt-2 text-muted-foreground">
            Choose your role to get started
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            className="cursor-pointer transition-colors hover:border-primary"
            onClick={() => handleRoleSelect("student")}
          >
            <CardHeader>
              <CardTitle>Student</CardTitle>
              <CardDescription>{ROLE_DESCRIPTIONS.student}</CardDescription>
            </CardHeader>
          </Card>
          <Card
            className="cursor-pointer transition-colors hover:border-primary"
            onClick={() => handleRoleSelect("tutor")}
          >
            <CardHeader>
              <CardTitle>Tutor</CardTitle>
              <CardDescription>{ROLE_DESCRIPTIONS.tutor}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md">
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
            />
          </div>

          {selectedRole === "student" && (
            <div className="space-y-2">
              <Label htmlFor="cefrLevel">Your English Level (CEFR)</Label>
              <Select
                value={cefrLevel}
                onValueChange={(value) => setCefrLevel(value as CEFRLevel)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your level" />
                </SelectTrigger>
                <SelectContent>
                  {CEFR_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This helps us tailor quizzes to your proficiency level
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

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
              {loading ? "Setting up..." : "Get Started"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
