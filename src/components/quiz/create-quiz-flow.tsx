"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { WordInput } from "@/components/quiz/word-input";
import { ParsedWordList } from "@/components/quiz/parsed-word-list";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Loader2,
  PenLine,
  Languages,
} from "lucide-react";
import type { QuizTerm } from "@/types/quiz";

type Step = "input" | "edit" | "activity";
type ActivityType = "flashcards" | "gap_fill" | "translation";

const ACTIVITIES: {
  type: ActivityType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    type: "flashcards",
    label: "Flashcards",
    description: "Flip cards to memorize terms and definitions",
    icon: <BookOpen className="h-8 w-8" />,
  },
  {
    type: "gap_fill",
    label: "Fill in the Gap",
    description: "Complete sentences with the correct vocabulary word",
    icon: <PenLine className="h-8 w-8" />,
  },
  {
    type: "translation",
    label: "Sentence Translation",
    description: "Translate Ukrainian sentences to English using vocabulary",
    icon: <Languages className="h-8 w-8" />,
  },
];

export function CreateQuizFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [terms, setTerms] = useState<QuizTerm[]>([]);
  const [title, setTitle] = useState("");
  const [selectedActivity, setSelectedActivity] =
    useState<ActivityType | null>(null);
  const [isParseLoading, setIsParseLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTermsParsed(parsed: QuizTerm[]) {
    setTerms(parsed);
    setStep("edit");
  }

  async function handleGenerate() {
    if (!selectedActivity || terms.length === 0) return;

    setError(null);
    setIsGenerating(true);

    try {
      const config = {
        cefrLevel: "B1" as const,
        vocabularyChallenge: "Standard" as const,
        grammarChallenge: "Standard" as const,
        teacherPersona: "standard" as const,
        timedMode: false,
      };

      const res = await fetch("/api/ai/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedActivity,
          terms,
          config,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate quiz");
      }

      const { content } = await res.json();

      // Save quiz to Supabase
      const saveRes = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || `Quiz - ${new Date().toLocaleDateString()}`,
          type: selectedActivity,
          cefrLevel: "B1",
          vocabularyTerms: terms,
          generatedContent: content,
          config,
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data.error || "Failed to save quiz");
      }

      const { quiz } = await saveRes.json();
      router.push(`/quizzes/${quiz.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate quiz",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create New Quiz</h1>
        <p className="text-muted-foreground">
          {step === "input" && "Paste your vocabulary words to get started."}
          {step === "edit" && "Review and edit your parsed vocabulary list."}
          {step === "activity" && "Choose an activity type for your quiz."}
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={
            step === "input"
              ? "font-semibold text-primary"
              : "text-muted-foreground"
          }
        >
          1. Input
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span
          className={
            step === "edit"
              ? "font-semibold text-primary"
              : "text-muted-foreground"
          }
        >
          2. Edit
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span
          className={
            step === "activity"
              ? "font-semibold text-primary"
              : "text-muted-foreground"
          }
        >
          3. Activity
        </span>
      </div>

      {/* Step 1: Word Input */}
      {step === "input" && (
        <Card>
          <CardHeader>
            <CardTitle>Paste Vocabulary</CardTitle>
            <CardDescription>
              Paste text, word lists, or tab-separated vocabulary. AI will
              extract words and generate English-Ukrainian translations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WordInput
              onParsed={handleTermsParsed}
              isLoading={isParseLoading}
              setIsLoading={setIsParseLoading}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Edit parsed words */}
      {step === "edit" && (
        <Card>
          <CardHeader>
            <CardTitle>Review Vocabulary</CardTitle>
            <CardDescription>
              Edit terms, fix translations, remove unwanted words, or add new ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ParsedWordList terms={terms} onTermsChange={setTerms} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("input")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => setStep("activity")}
                disabled={terms.length === 0}
                className="flex-1"
              >
                Choose Activity
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Choose activity type */}
      {step === "activity" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quiz-title">Quiz Title (optional)</Label>
            <Input
              id="quiz-title"
              placeholder="e.g., Unit 5 Vocabulary"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {ACTIVITIES.map((activity) => (
              <Card
                key={activity.type}
                className={`cursor-pointer transition-colors hover:border-primary ${
                  selectedActivity === activity.type
                    ? "border-primary bg-primary/5"
                    : ""
                }`}
                onClick={() => setSelectedActivity(activity.type)}
              >
                <CardHeader className="items-center text-center">
                  <div
                    className={
                      selectedActivity === activity.type
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  >
                    {activity.icon}
                  </div>
                  <CardTitle className="text-base">{activity.label}</CardTitle>
                  <CardDescription>{activity.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("edit")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!selectedActivity || isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating {selectedActivity === "flashcards" ? "flashcards" : "quiz"}...
                </>
              ) : (
                <>
                  Generate{" "}
                  {ACTIVITIES.find((a) => a.type === selectedActivity)?.label ||
                    "Activity"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
