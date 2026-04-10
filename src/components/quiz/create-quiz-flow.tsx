"use client";

import { useEffect, useState } from "react";
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
import {
  getAllowedCefrLevels,
  getDefaultCefrLevelForLanguage,
  getLearningLanguageLabel,
  getSourceLanguageLabel,
  normalizeLearningLanguage,
  normalizeSourceLanguage,
} from "@/lib/languages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Loader2,
  CircleDot,
  PenLine,
  Languages,
  FileText,
  MessageSquare,
  Save,
  GraduationCap,
} from "lucide-react";
import type { QuizTerm, CEFRLevel } from "@/types/quiz";
import { formatAppDate } from "@/lib/dates";

const CEFR_LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const CEFR_DESCRIPTIONS: Record<CEFRLevel, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper Intermediate",
  C1: "Advanced",
  C2: "Proficiency",
};

const GRAMMAR_TOPIC_STORAGE_KEY = "vocab-crafter:last-grammar-topic";

type Step = "input" | "edit" | "activity";
type ActivityType =
  | "mcq"
  | "flashcards"
  | "gap_fill"
  | "translation"
  | "text_translation"
  | "discussion";

interface GrammarTopicOption {
  topicKey: string;
  displayName: string;
}

interface GrammarTopicLevelGroup {
  level: string;
  topics: GrammarTopicOption[];
}

interface CreateQuizFlowProps {
  grammarTopicCatalog: {
    english: GrammarTopicLevelGroup[];
    spanish: GrammarTopicLevelGroup[];
  };
}

const ACTIVITIES: {
  type: ActivityType;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    type: "mcq",
    label: "Multiple Choice",
    icon: <CircleDot className="h-8 w-8" />,
  },
  {
    type: "flashcards",
    label: "Flashcards",
    icon: <BookOpen className="h-8 w-8" />,
  },
  {
    type: "gap_fill",
    label: "Fill in the Gap",
    icon: <PenLine className="h-8 w-8" />,
  },
  {
    type: "translation",
    label: "Sentence Translation",
    icon: <Languages className="h-8 w-8" />,
  },
  {
    type: "text_translation",
    label: "Text Translation",
    icon: <FileText className="h-8 w-8" />,
  },
  {
    type: "discussion",
    label: "Live Discussion",
    icon: <MessageSquare className="h-8 w-8" />,
  },
];

export function CreateQuizFlow({ grammarTopicCatalog }: CreateQuizFlowProps) {
  const router = useRouter();
  const { profile } = useUser();
  const grammarTopicStorageKey = profile?.id
    ? `${GRAMMAR_TOPIC_STORAGE_KEY}:${profile.id}`
    : GRAMMAR_TOPIC_STORAGE_KEY;
  const isTutor = profile?.role === "tutor" || profile?.role === "superadmin";
  const profileCefrLevel = profile?.cefr_level as CEFRLevel | undefined;
  const targetLanguage = normalizeLearningLanguage(profile?.preferred_language);
  const sourceLanguage = normalizeSourceLanguage(profile?.source_language);
  const targetLanguageLabel = getLearningLanguageLabel(targetLanguage);
  const sourceLanguageLabel = getSourceLanguageLabel(sourceLanguage);
  const allowedCefrLevels = getAllowedCefrLevels(targetLanguage);
  const defaultCefr =
    profileCefrLevel && allowedCefrLevels.includes(profileCefrLevel)
      ? profileCefrLevel
      : getDefaultCefrLevelForLanguage(targetLanguage);

  const [step, setStep] = useState<Step>("input");
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>(defaultCefr);
  const [hasCustomCefrLevel, setHasCustomCefrLevel] = useState(false);
  const [terms, setTerms] = useState<QuizTerm[]>([]);
  const [title, setTitle] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(
    null,
  );
  const [isParseLoading, setIsParseLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableGrammarLevels = grammarTopicCatalog[
    targetLanguage === "spanish" ? "spanish" : "english"
  ].filter(({ level }) => {
    const levelIndex = CEFR_LEVELS.indexOf(level as CEFRLevel);
    const selectedLevelIndex = CEFR_LEVELS.indexOf(cefrLevel);

    return levelIndex !== -1 && selectedLevelIndex !== -1
      ? levelIndex <= selectedLevelIndex
      : false;
  });
  const availableTopicKeys = availableGrammarLevels.flatMap(({ topics }) =>
    topics.map((topic) => topic.topicKey),
  );

  // Grammar topics state
  const [grammarTopics, setGrammarTopics] = useState<string[]>([]);

  // Save to word bank state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);

  useEffect(() => {
    if (hasCustomCefrLevel) {
      return;
    }

    setCefrLevel(defaultCefr);
  }, [defaultCefr, hasCustomCefrLevel]);

  useEffect(() => {
    if (!allowedCefrLevels.includes(cefrLevel)) {
      setCefrLevel(getDefaultCefrLevelForLanguage(targetLanguage));
      setHasCustomCefrLevel(false);
    }
  }, [allowedCefrLevels, cefrLevel, targetLanguage]);

  useEffect(() => {
    if (selectedActivity !== "translation" || grammarTopics.length > 0) {
      return;
    }

    const savedTopic = window.localStorage.getItem(grammarTopicStorageKey);

    if (savedTopic && availableTopicKeys.includes(savedTopic)) {
      setGrammarTopics([savedTopic]);
    }
  }, [
    availableTopicKeys,
    grammarTopicStorageKey,
    grammarTopics.length,
    selectedActivity,
  ]);

  useEffect(() => {
    const selectedTopic = grammarTopics[0];

    if (selectedTopic) {
      window.localStorage.setItem(grammarTopicStorageKey, selectedTopic);
      return;
    }

    window.localStorage.removeItem(grammarTopicStorageKey);
  }, [grammarTopicStorageKey, grammarTopics]);

  useEffect(() => {
    if (grammarTopics.length === 0) {
      return;
    }

    if (!availableTopicKeys.includes(grammarTopics[0])) {
      setGrammarTopics([]);
    }
  }, [availableTopicKeys, grammarTopics]);

  function handleCefrLevelChange(value: string) {
    setHasCustomCefrLevel(true);
    setCefrLevel(value as CEFRLevel);
  }

  function getActivityDescription(type: ActivityType) {
    if (type === "mcq") {
      return `Answer ${targetLanguageLabel.toLowerCase()} multiple-choice questions with one correct option and three distractors.`;
    }

    if (type === "text_translation") {
      return `Translate a short ${sourceLanguageLabel.toLowerCase()} passage into ${targetLanguageLabel.toLowerCase()} with one full-text score.`;
    }

    if (type === "translation") {
      return `Translate ${sourceLanguageLabel.toLowerCase()} sentences into ${targetLanguageLabel.toLowerCase()} using your vocabulary.`;
    }

    if (type === "gap_fill") {
      return `Complete ${targetLanguageLabel.toLowerCase()} sentences with the correct vocabulary word.`;
    }

    if (type === "discussion") {
      return `Generate CEFR-level topic sentences that naturally use your ${targetLanguageLabel.toLowerCase()} vocabulary for live speaking practice.`;
    }

    return `Flip cards to memorize ${targetLanguageLabel.toLowerCase()} terms and ${sourceLanguageLabel.toLowerCase()} meanings.`;
  }

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
      const grammarTopicLabels = Object.fromEntries(
        availableGrammarLevels.flatMap(({ topics }) =>
          topics.map((topic) => [topic.topicKey, topic.displayName]),
        ),
      );
      const config = {
        cefrLevel: cefrLevel as "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
        studentProfileCefrLevel: profileCefrLevel ?? null,
        selectedCefrLevel: cefrLevel,
        targetLanguage,
        sourceLanguage,
        vocabularyChallenge: "Standard" as const,
        grammarChallenge: "Standard" as const,
        teacherPersona: "standard" as const,
        timedMode: false,
        grammarTopics: grammarTopics.length > 0 ? grammarTopics : undefined,
        grammarTopicLabels:
          grammarTopics.length > 0 ? grammarTopicLabels : undefined,
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
          title: title || `Quiz - ${formatAppDate(new Date())}`,
          type: selectedActivity,
          cefrLevel,
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
                  targetLanguage={targetLanguage}
                  sourceLanguage={sourceLanguage}
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
            <ParsedWordList
              terms={terms}
              onTermsChange={setTerms}
              targetLanguage={targetLanguage}
              sourceLanguage={sourceLanguage}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setStep("input")}
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
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
                className="w-full sm:flex-1"
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
                  <CardDescription>
                    {getActivityDescription(activity.type)}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Difficulty (CEFR level) selector */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="cefr-select" className="font-medium">
                  Difficulty Level
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isTutor
                    ? "Choose the CEFR difficulty for this quiz"
                    : "Defaults to your profile level — override if needed"}
                  {targetLanguage === "spanish"
                    ? " Spanish is currently limited to A1."
                    : ""}
                </p>
              </div>
            </div>
            <Select value={cefrLevel} onValueChange={handleCefrLevelChange}>
              <SelectTrigger id="cefr-select" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CEFR_LEVELS.filter((lvl) =>
                  allowedCefrLevels.includes(lvl),
                ).map((lvl) => (
                  <SelectItem key={lvl} value={lvl}>
                    {lvl} — {CEFR_DESCRIPTIONS[lvl]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grammar topic selector - only for translation activity */}
          {selectedActivity === "translation" && (
            <Card>
              <CardContent className="pt-6">
                <GrammarTopicSelector
                  levels={availableGrammarLevels}
                  selectedTopics={grammarTopics}
                  onTopicsChange={setGrammarTopics}
                />
              </CardContent>
            </Card>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setStep("edit")}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!selectedActivity || isGenerating}
              className="w-full sm:flex-1"
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
