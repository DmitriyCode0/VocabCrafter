"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Plus, Save, Target, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type ReportLanguage } from "@/lib/progress/monthly-report-language";

interface TutorStudentPlan {
  planTitle: string | null;
  goalSummary: string | null;
  objectives: string[];
  monthlySentenceTranslationTarget: number | null;
  monthlyGapFillTarget: number | null;
  monthlyCompletedLessonsTarget: number | null;
  monthlyNewMasteryWordsTarget: number | null;
  monthlyAverageScoreTarget: number | null;
  grammarTopicKeys: string[];
  reportLanguage: ReportLanguage;
}

interface GrammarTopicOption {
  topicKey: string;
  displayName: string;
  level: string;
}

interface MonthlyReportMetrics {
  activeDays: number;
  completedQuizzes: number;
  completedSentenceTranslations: number;
  completedGapFillExercises: number;
  completedLessons: number;
  newMasteryWords: number;
  practicedWords: number;
  trackedWordsTotal: number;
  averageScore: number | null;
}

interface TutorStudentPlanWorkspaceProps {
  studentId: string;
  studentName: string;
  currentMonthLabel: string;
  plan: TutorStudentPlan;
  metrics: MonthlyReportMetrics;
  availableGrammarTopics: GrammarTopicOption[];
  targetLanguageLabel: string;
}

function parseNullableWholeNumber(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Targets must be whole numbers or left empty.");
  }

  return parsed;
}

function parseNullablePercentage(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(
      "Average score target must be between 0 and 100 or left empty.",
    );
  }

  return parsed;
}

function formatPercentage(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, "")}%`;
}

function parseObjectives(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function TutorStudentPlanWorkspace({
  studentId,
  studentName,
  currentMonthLabel,
  plan,
  metrics,
  availableGrammarTopics,
  targetLanguageLabel,
}: TutorStudentPlanWorkspaceProps) {
  const router = useRouter();
  const [planTitle, setPlanTitle] = useState(plan.planTitle ?? "");
  const [goalSummary, setGoalSummary] = useState(plan.goalSummary ?? "");
  const [objectives, setObjectives] = useState(plan.objectives.join("\n"));
  const [sentenceTranslationTarget, setSentenceTranslationTarget] = useState(
    plan.monthlySentenceTranslationTarget?.toString() ?? "",
  );
  const [gapFillTarget, setGapFillTarget] = useState(
    plan.monthlyGapFillTarget?.toString() ?? "",
  );
  const [lessonTarget, setLessonTarget] = useState(
    plan.monthlyCompletedLessonsTarget?.toString() ?? "",
  );
  const [wordTarget, setWordTarget] = useState(
    plan.monthlyNewMasteryWordsTarget?.toString() ?? "",
  );
  const [averageScoreTarget, setAverageScoreTarget] = useState(
    plan.monthlyAverageScoreTarget?.toString() ?? "",
  );
  const [grammarTopicKeys, setGrammarTopicKeys] = useState(
    plan.grammarTopicKeys,
  );
  const [selectedGrammarTopic, setSelectedGrammarTopic] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const grammarTopicMap = new Map(
    availableGrammarTopics.map((topic) => [topic.topicKey, topic]),
  );

  function handleAddGrammarTopic() {
    if (
      !selectedGrammarTopic ||
      grammarTopicKeys.includes(selectedGrammarTopic)
    ) {
      return;
    }

    setGrammarTopicKeys((current) => [...current, selectedGrammarTopic]);
    setSelectedGrammarTopic("");
  }

  function handleRemoveGrammarTopic(topicKey: string) {
    setGrammarTopicKeys((current) =>
      current.filter((item) => item !== topicKey),
    );
  }

  async function handleSavePlan() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/tutor/students/${studentId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planTitle,
          goalSummary,
          objectives: parseObjectives(objectives),
          monthlySentenceTranslationTarget: parseNullableWholeNumber(
            sentenceTranslationTarget,
          ),
          monthlyGapFillTarget: parseNullableWholeNumber(gapFillTarget),
          monthlyCompletedLessonsTarget: parseNullableWholeNumber(lessonTarget),
          monthlyNewMasteryWordsTarget: parseNullableWholeNumber(wordTarget),
          monthlyAverageScoreTarget:
            parseNullablePercentage(averageScoreTarget),
          grammarTopicKeys,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save plan");
      }

      toast.success(`Saved learning plan for ${studentName}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save learning plan",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-primary" />
              Learning Plan
            </CardTitle>
            <CardDescription>
              Define the goals and objectives that monthly reports should pull
              from automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-plan-title">Plan title</Label>
              <Input
                id="student-plan-title"
                placeholder="e.g. Build consistent B1 vocabulary momentum"
                value={planTitle}
                onChange={(event) => setPlanTitle(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="student-goal-summary">Goal summary</Label>
              <Textarea
                id="student-goal-summary"
                rows={5}
                value={goalSummary}
                onChange={(event) => setGoalSummary(event.target.value)}
                placeholder="Summarize the current focus, the expected habits, and what progress should look like this month..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="student-plan-objectives">Objectives</Label>
              <Textarea
                id="student-plan-objectives"
                rows={6}
                value={objectives}
                onChange={(event) => setObjectives(event.target.value)}
                placeholder={
                  "Write one objective per line, for example:\nComplete two quiz sessions each week\nReview weak translation answers within 24 hours\nAdd and practice new topic vocabulary after each lesson"
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2">
                <Label htmlFor="student-plan-grammar-topics">
                  Grammar topics
                </Label>
                <Select
                  value={selectedGrammarTopic}
                  onValueChange={setSelectedGrammarTopic}
                >
                  <SelectTrigger
                    id="student-plan-grammar-topics"
                    className="w-full"
                  >
                    <SelectValue
                      placeholder={`Select ${targetLanguageLabel} grammar focus`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGrammarTopics.map((topic) => (
                      <SelectItem key={topic.topicKey} value={topic.topicKey}>
                        {topic.displayName} ({topic.level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleAddGrammarTopic}
                disabled={
                  !selectedGrammarTopic ||
                  grammarTopicKeys.includes(selectedGrammarTopic)
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add topic
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Selected grammar topics</Label>
              {grammarTopicKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No grammar focus topics selected yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {grammarTopicKeys.map((topicKey) => {
                    const topic = grammarTopicMap.get(topicKey);

                    return (
                      <div
                        key={topicKey}
                        className="inline-flex items-center gap-2 rounded-full border bg-muted/20 px-3 py-1.5 text-sm"
                      >
                        <span>{topic?.displayName ?? topicKey}</span>
                        {topic?.level ? (
                          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                            {topic.level}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleRemoveGrammarTopic(topicKey)}
                          className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                          aria-label={`Remove ${topic?.displayName ?? topicKey}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Selected topics are included in the generated monthly report
                prompt and the saved plan snapshot.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-sentence-translation-target">
                  Monthly sentence translation target
                </Label>
                <Input
                  id="plan-sentence-translation-target"
                  inputMode="numeric"
                  placeholder="e.g. 8"
                  value={sentenceTranslationTarget}
                  onChange={(event) =>
                    setSentenceTranslationTarget(event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-gap-fill-target">
                  Monthly gap fill target
                </Label>
                <Input
                  id="plan-gap-fill-target"
                  inputMode="numeric"
                  placeholder="e.g. 8"
                  value={gapFillTarget}
                  onChange={(event) => setGapFillTarget(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-lesson-target">
                  Monthly lesson target
                </Label>
                <Input
                  id="plan-lesson-target"
                  inputMode="numeric"
                  placeholder="e.g. 4"
                  value={lessonTarget}
                  onChange={(event) => setLessonTarget(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-word-target">
                  Monthly new-word target
                </Label>
                <Input
                  id="plan-word-target"
                  inputMode="numeric"
                  placeholder="e.g. 80"
                  value={wordTarget}
                  onChange={(event) => setWordTarget(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-average-score-target">
                  Monthly average score target
                </Label>
                <Input
                  id="plan-average-score-target"
                  inputMode="decimal"
                  placeholder="e.g. 85"
                  value={averageScoreTarget}
                  onChange={(event) =>
                    setAverageScoreTarget(event.target.value)
                  }
                />
              </div>
            </div>

            <Button onClick={handleSavePlan} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Plan
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5 text-primary" />
              Current Month Context
            </CardTitle>
            <CardDescription>
              Use {currentMonthLabel} progress to set realistic goals. The
              reports page snapshots this plan when a monthly report is
              generated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">Active days</p>
                <p className="text-2xl font-semibold">{metrics.activeDays}</p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">Quizzes</p>
                <p className="text-2xl font-semibold">
                  {metrics.completedQuizzes}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">New words</p>
                <p className="text-2xl font-semibold">
                  {metrics.newMasteryWords}
                </p>
              </div>
              {grammarTopicKeys.length > 0 ? (
                <div className="rounded-lg border px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    Grammar topics
                  </p>
                  <p className="text-2xl font-semibold">
                    {grammarTopicKeys.length}
                  </p>
                </div>
              ) : null}
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  Sentence translation exercises
                </p>
                <p className="text-2xl font-semibold">
                  {metrics.completedSentenceTranslations}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  Gap fill exercises
                </p>
                <p className="text-2xl font-semibold">
                  {metrics.completedGapFillExercises}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  Completed lessons
                </p>
                <p className="text-2xl font-semibold">
                  {metrics.completedLessons}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  Words reviewed this month
                </p>
                <p className="text-2xl font-semibold">
                  {metrics.practicedWords}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  Words in vocabulary tracker
                </p>
                <p className="text-2xl font-semibold">
                  {metrics.trackedWordsTotal}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  Average quiz score
                </p>
                <p className="text-2xl font-semibold">
                  {formatPercentage(metrics.averageScore)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
