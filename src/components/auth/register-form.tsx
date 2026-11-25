"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Check,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OAuthButtons } from "./oauth-buttons";

type RequestedRole = "student" | "tutor";

function getPasswordStrength(password: string): {
  score: number;
  label: string;
} {
  if (!password) return { score: 0, label: "" };
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score: 1, label: "Weak — use at least 6 characters" };
  if (score === 2) return { score: 2, label: "Fair — add uppercase or a number" };
  if (score === 3) return { score: 3, label: "Good password" };
  return { score: 4, label: "Strong password" };
}

export function RegisterForm() {
  const router = useRouter();
  const supabase = createClient();
  const [requestedRole, setRequestedRole] = useState<RequestedRole>("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationNote, setRegistrationNote] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSentEmail, setConfirmationSentEmail] = useState<string | null>(
    null,
  );

  const strength = getPasswordStrength(password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: trimmedName,
          requested_role: requestedRole,
          registration_note: registrationNote.trim() || null,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    setConfirmationSentEmail(trimmedEmail);
    setLoading(false);
  };

  if (confirmationSentEmail) {
    return (
      <Card className="mx-auto w-full max-w-lg border-border/70 shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
            <MailCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl font-bold">Check your inbox</CardTitle>
          <CardDescription>
            We sent a verification link to{" "}
            <span className="font-medium text-foreground">
              {confirmationSentEmail}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <p>
            Confirm your email to complete profile setup and submit your access
            request for administrator review.
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Back to Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-lg border-border/70 shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Complete registration to request access to VocabCrafter 2.0. New
          accounts are approved manually by an administrator.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label>Account Type</Label>
            <div
              role="group"
              aria-label="Choose account type"
              className="grid grid-cols-2 gap-2.5"
            >
              {(
                [
                  {
                    value: "student" as const,
                    title: "Student",
                    subtitle: "Learn & take quizzes",
                    icon: GraduationCap,
                  },
                  {
                    value: "tutor" as const,
                    title: "Tutor",
                    subtitle: "Teach & manage classes",
                    icon: BookOpen,
                  },
                ] as const
              ).map((option) => {
                const Icon = option.icon;
                const isSelected = requestedRole === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setRequestedRole(option.value)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary/[0.08] shadow-xs"
                        : "border-border/70 bg-background/50 hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        isSelected ? "text-primary" : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-semibold text-foreground">
                          {option.title}
                        </span>
                        {isSelected ? (
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {option.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder="e.g. Olena Kovalenko"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          {password.length > 0 ? (
            <div className="space-y-1">
              <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
                {[1, 2, 3, 4].map((level) => (
                  <span
                    key={level}
                    className={cn(
                      "h-1.5 rounded-full transition-colors",
                      strength.score >= level
                        ? strength.score <= 1
                          ? "bg-destructive"
                          : strength.score === 2
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        : "bg-muted",
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{strength.label}</p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="registrationNote">
              Note for administrator{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="registrationNote"
              rows={2}
              maxLength={300}
              placeholder="Your tutor's name, class, or Telegram @username so we can verify your request faster"
              value={registrationNote}
              onChange={(e) => setRegistrationNote(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              After completing setup, your dashboard will show a pending status
              until an administrator activates your account.
            </span>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
            {loading ? "Submitting request..." : "Create account & request access"}
          </Button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <OAuthButtons />
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
