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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WordInput } from "@/components/quiz/word-input";
import { ParsedWordList } from "@/components/quiz/parsed-word-list";
import { WordBankPicker } from "@/components/quiz/word-bank-picker";
import { QuizWordPicker } from "@/components/quiz/quiz-word-picker";
import { GrammarTopicSelector } from "@/components/quiz/grammar-topic-selector";
import { useUser } from "@/hooks/use-user";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Loader2,
  PenLine,
  Languages,
  Save,
  Globe,
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
  const { profile } = useUser();
  const cefrLevel = profile?.cefr_level || "B1";

  const [step, setStep] = useState<Step>("input");
  const [terms, setTerms] = useState<QuizTerm[]>([]);
  const [title, setTitle] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(
    null,
  );
  const [isParseLoading, setIsParseLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Grammar topics state
  const [grammarTopics, setGrammarTopics] = useState<string[]>([]);

  // Public toggle
  const [isPublic, setIsPublic] = useState(false);

  // Save to word bank state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);

  function handleTermsParsed(parsed: QuizTerm[]) {
    setTerms(parsed);
    setStep("edit");
  }

  async function handleSaveToBank() {
    if (!bankName.trim() || terms.length === 0) return;

    setIsSavingBank(true);

    try {
      const res = await fetch("/api/word-banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: bankName.trim(), terms }),
      });

      if (!res.ok) throw new Error("Failed to save word bank");

      setBankSaved(true);
      setTimeout(() => {
        setSaveDialogOpen(false);
        setBankSaved(false);
        setBankName("");
      }, 1500);
    } catch {
      setError("Failed to save word bank.");
    } finally {
      setIsSavingBank(false);
    }
  }

  async function handleGenerate() {
    if (!selectedActivity || terms.length === 0) return;

    setError(null);
    setIsGenerating(true);

    try {
      const config = {
        cefrLevel: cefrLevel as "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
        vocabularyChallenge: "Standard" as const,
        grammarChallenge: "Standard" as const,
        teacherPersona: "standard" as const,
        timedMode: false,
        grammarTopics: grammarTopics.length > 0 ? grammarTopics : undefined,
      };

      let content: Record<string, unknown>;

      if (selectedActivity === "flashcards") {
        // Build flashcards directly from terms — no AI needed
        content = {
          cards: terms.map((t) => ({
            term: t.term,
            definition: t.definition,
          })),
        };
      } else {
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

        const result = await res.json();
        content = result.content;
      }

      // Save quiz to Supabase
      const saveRes = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || `Quiz - ${new Date().toLocaleDateString("en-US")}`,
          type: selectedActivity,
          cefrLevel,
          vocabularyTerms: terms,
          generatedContent: content,
          config,
          isPublic,
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data.error || "Failed to save quiz");
      }

      const { quiz } = await saveRes.json();
      router.push(`/quizzes/${quiz.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create New Quiz</h1>
        <p className="text-muted-foreground">
          {step === "input" && "Add vocabulary words to get started."}
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
            <CardTitle>Add Vocabulary</CardTitle>
            <CardDescription>
              Parse new words with AI, load from a saved word bank, or reuse
              vocabulary from a previous quiz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="parse">
              <TabsList className="mb-4">
                <TabsTrigger value="parse">Parse New</TabsTrigger>
                <TabsTrigger value="saved">Saved Words</TabsTrigger>
                <TabsTrigger value="quiz">From Quiz</TabsTrigger>
              </TabsList>
              <TabsContent value="parse">
                <WordInput
                  onParsed={handleTermsParsed}
                  isLoading={isParseLoading}
                  setIsLoading={setIsParseLoading}
                />
              </TabsContent>
              <TabsContent value="saved">
                <WordBankPicker onSelect={handleTermsParsed} />
              </TabsContent>
              <TabsContent value="quiz">
                <QuizWordPicker onSelect={handleTermsParsed} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Edit parsed words */}
      {step === "edit" && (
        <Card>
          <CardHeader>
            <CardTitle>Review Vocabulary</CardTitle>
            <CardDescription>
              Edit terms, fix translations, remove unwanted words, or add new
              ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ParsedWordList terms={terms} onTermsChange={setTerms} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("input")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Save className="mr-2 h-4 w-4" />
                    Save to Word Bank
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save to Word Bank</DialogTitle>
                    <DialogDescription>
                      Save these {terms.length} terms for reuse in future
                      quizzes.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">Bank Name</Label>
                    <Input
                      id="bank-name"
                      placeholder="e.g., Unit 5 Vocabulary"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleSaveToBank}
                      disabled={!bankName.trim() || isSavingBank}
                    >
                      {isSavingBank ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : bankSaved ? (
                        "Saved!"
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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

          {/* Public toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="is-public" className="font-medium">
                  Make quiz public
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow other users to discover and take this quiz.
                </p>
              </div>
            </div>
            <Switch
              id="is-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          {/* Grammar topic selector - only for translation activity */}
          {selectedActivity === "translation" && (
            <Card>
              <CardContent className="pt-6">
                <GrammarTopicSelector
                  cefrLevel={cefrLevel}
                  selectedTopics={grammarTopics}
                  onTopicsChange={setGrammarTopics}
                />
              </CardContent>
            </Card>
          )}

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
                  Generating{" "}
                  {selectedActivity === "flashcards" ? "flashcards" : "quiz"}...
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
