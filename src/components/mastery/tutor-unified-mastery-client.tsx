"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Flame,
  GraduationCap,
  Layers,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TutorEditableStudentSkillRadar } from "@/components/progress/tutor-editable-student-skill-radar";
import { TutorStudentVocabularyDistribution } from "@/components/progress/tutor-student-vocabulary-distribution";
import { StudentMasteryCards } from "@/components/mastery/student-mastery-cards";
import { useAppI18n } from "@/components/providers/app-language-provider";
import type {
  StudentProgressSnapshot,
  StudentThreeStateVocabularySummary,
} from "@/lib/progress/profile-metrics";

export interface TutorStudentThreeStateSummary
  extends StudentThreeStateVocabularySummary {
  name: string;
}

interface TutorUnifiedMasteryClientProps {
  students: TutorStudentThreeStateSummary[];
  selectedStudentId: string;
  selectedSnapshot: StudentProgressSnapshot;
}

export function TutorUnifiedMasteryClient({
  students,
  selectedStudentId,
  selectedSnapshot,
}: TutorUnifiedMasteryClientProps) {
  const { messages } = useAppI18n();
  const t = messages.tutorMastery.unified;

  const selectedSummary =
    students.find((s) => s.studentId === selectedStudentId) ?? students[0];

  const activeCount =
    selectedSummary?.activeCount ?? selectedSnapshot.activeSignals.uniqueItems;
  const activeTarget =
    selectedSummary?.activeTarget ?? selectedSnapshot.overview.activeVocabTarget;
  const activePct =
    selectedSummary?.activePercentToNextLevel ??
    (activeTarget > 0
      ? Math.min(100, Math.round((activeCount / activeTarget) * 100))
      : 0);

  const passiveEquivalent =
    selectedSummary?.passiveEquivalentCount ??
    selectedSnapshot.passiveSignals.equivalentWordCount;
  const passiveTarget = selectedSummary?.passiveTarget ?? 1500;
  const passivePct =
    selectedSummary?.passivePercentToNextLevel ??
    (passiveTarget > 0
      ? Math.min(100, Math.round((passiveEquivalent / passiveTarget) * 100))
      : 0);

  const learningCount =
    selectedSummary?.learningCount ??
    selectedSnapshot.learningSignals.uniqueItems;
  const nextCefrLevel =
    selectedSummary?.nextCefrLevel ??
    selectedSnapshot.cefrGuidedHours.nextLevel?.level ??
    null;

  const activationRate =
    passiveEquivalent > 0
      ? Math.min(100, Math.round((activeCount / passiveEquivalent) * 100))
      : activeCount > 0
        ? 100
        : 0;

  const unmasteredGrammarTopics = selectedSnapshot.grammarTopicMastery
    .filter((topic) => !topic.mastered)
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 4);

  const vocabDiagnosticMessage = (() => {
    if (passivePct >= activePct + 12 && passiveEquivalent >= 30) {
      return t.vocabDiagnosticActivate(passivePct, activePct);
    }
    if (passivePct < 20) {
      return t.vocabDiagnosticBuildPassive(passivePct);
    }
    if (learningCount >= 15) {
      return t.vocabDiagnosticConsolidateLearning(learningCount);
    }
    return t.vocabDiagnosticBalanced(activePct, passivePct);
  })();

  const studentName =
    selectedSnapshot.profile.fullName ||
    selectedSummary?.name ||
    messages.tutorMastery.unknownStudent;

  return (
    <div className="space-y-6">
      {/* 1. All Active Students — 3-State Vocabulary Matrix */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.allStudentsRosterTitle}</CardTitle>
          <CardDescription>{t.allStudentsRosterDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {students.map((student) => {
              const isSelected = student.studentId === selectedStudentId;

              return (
                <Link
                  key={student.studentId}
                  href={`/mastery?student=${student.studentId}`}
                  scroll={false}
                  className={`group block rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="truncate font-semibold text-sm">
                        {student.name}
                      </span>
                      <Badge variant="outline" className="text-[11px] shrink-0">
                        {t.levelProgressionBadge(
                          student.currentCefrLevel,
                          student.nextCefrLevel,
                        )}
                      </Badge>
                    </div>
                    {isSelected ? (
                      <Badge className="bg-primary text-primary-foreground text-[10px]">
                        {t.selectedBadge}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border bg-background/70 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        {messages.tutorMastery.levelLabels.learning}
                      </p>
                      <p className="mt-0.5 text-sm font-bold">
                        {student.learningCount}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background/70 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-sky-600 dark:text-sky-400">
                        Passive
                      </p>
                      <p className="mt-0.5 text-sm font-bold">
                        {student.passiveEquivalentCount}
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          (
                          {t.percentToNextLevel(
                            student.passivePercentToNextLevel,
                            student.nextCefrLevel,
                          )}
                          )
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background/70 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Active
                      </p>
                      <p className="mt-0.5 text-sm font-bold">
                        {student.activeCount}
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          (
                          {t.percentToNextLevel(
                            student.activePercentToNextLevel,
                            student.nextCefrLevel,
                          )}
                          )
                        </span>
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2. Selected Student — 3-State Vocabulary Funnel */}
      <Card className="border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">
                  {t.funnelTitle(studentName)}
                </CardTitle>
                <Badge variant="secondary">
                  {t.levelProgressionBadge(
                    selectedSnapshot.profile.cefrLevel,
                    nextCefrLevel,
                  )}
                </Badge>
                <Badge variant="outline">
                  {selectedSnapshot.profile.targetLanguageLabel}
                </Badge>
              </div>
              <CardDescription className="mt-1">
                {t.funnelDescription}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/vocabulary?student=${selectedStudentId}`}>
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  {t.manageDictionaryButton}
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/quizzes/new">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {t.practiceLearningButton}
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Stage 1: Learning Vocabulary */}
            <div className="relative flex flex-col justify-between rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <Brain className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {t.learningVocabLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.learningVocabSublabel}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 text-muted-foreground lg:block" />
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight">
                    {learningCount.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {messages.tutorProgressPage.vocabularyItemsLabel}
                  </span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {t.srsReviewDueLabel(
                    selectedSnapshot.overview.masteredWords,
                    selectedSnapshot.overview.totalWords,
                  )}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-amber-500/15 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Avg SRS {selectedSnapshot.overview.avgMasteryLevel}/5
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href={`/vocabulary?student=${selectedStudentId}`}>
                    {t.manageDictionaryButton}
                  </Link>
                </Button>
              </div>
            </div>

            {/* Stage 2: Passive Vocabulary */}
            <div className="relative flex flex-col justify-between rounded-xl border border-sky-500/25 bg-sky-500/5 p-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                      <Layers className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {t.passiveVocabLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.passiveVocabSublabel}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 text-muted-foreground lg:block" />
                </div>

                <div className="mt-4 flex items-baseline justify-between gap-2">
                  <span className="text-3xl font-bold tracking-tight">
                    {passiveEquivalent.toLocaleString()}
                  </span>
                  <span className="text-xs font-medium text-sky-700 dark:text-sky-300">
                    {t.percentToNextLevel(passivePct, nextCefrLevel)}
                  </span>
                </div>

                <Progress value={passivePct} className="mt-2 h-2" />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t.ofTargetToNextLevel(
                    passiveEquivalent,
                    passiveTarget,
                    nextCefrLevel,
                  )}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-sky-500/15 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {t.wordsAndPhrasesLabel(
                    selectedSnapshot.passiveSignals.wordCount,
                    selectedSnapshot.passiveSignals.phraseCount,
                  )}
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link
                    href={`/vocabulary?student=${selectedStudentId}#my-dictionary-import`}
                  >
                    {t.importPassiveButton}
                  </Link>
                </Button>
              </div>
            </div>

            {/* Stage 3: Active Vocabulary */}
            <div className="relative flex flex-col justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Flame className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {t.activeVocabLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.activeVocabSublabel}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px]"
                  >
                    {t.activationRateLabel(activationRate)}
                  </Badge>
                </div>

                <div className="mt-4 flex items-baseline justify-between gap-2">
                  <span className="text-3xl font-bold tracking-tight">
                    {activeCount.toLocaleString()}
                  </span>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {t.percentToNextLevel(activePct, nextCefrLevel)}
                  </span>
                </div>

                <Progress value={activePct} className="mt-2 h-2" />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t.ofTargetToNextLevel(
                    activeCount,
                    activeTarget,
                    nextCefrLevel,
                  )}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-emerald-500/15 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {messages.tutorMastery.cards.activeSummary(
                    selectedSnapshot.activeSignals.uniqueItems,
                    selectedSnapshot.activeSignals.totalUsageCount,
                  )}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Side-by-Side: 5-Axis Pentagon Radar + Data-Informed Teaching Plan */}
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <TutorEditableStudentSkillRadar
            studentId={selectedStudentId}
            axes={selectedSnapshot.axes}
            chartData={selectedSnapshot.chartData}
            cefrLevel={selectedSnapshot.profile.cefrLevel}
            grammarNotice={selectedSnapshot.grammar.betaNotice}
            grammarTopics={selectedSnapshot.grammarTopicMastery}
          />
        </div>

        <Card className="xl:col-span-5 flex flex-col justify-between">
          <div>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">
                  {t.recommendationsTitle}
                </CardTitle>
              </div>
              <CardDescription>{t.recommendationsDescription}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Diagnostic 1: Vocabulary Balance */}
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {t.vocabDiagnosticTitle}
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {vocabDiagnosticMessage}
                </p>
              </div>

              {/* Diagnostic 2: Grammar Variety */}
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {t.grammarDiagnosticTitle}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {t.grammarDiagnosticSummary(
                      selectedSnapshot.overview.grammarMasteredCount,
                      selectedSnapshot.overview.grammarAvailableCount,
                      selectedSnapshot.profile.cefrLevel,
                    )}
                  </Badge>
                </div>

                {unmasteredGrammarTopics.length === 0 ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {t.grammarDiagnosticAllMastered}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {t.grammarDiagnosticNextTopicsLabel}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {unmasteredGrammarTopics.map((topic) => (
                        <Badge
                          key={topic.topicKey}
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          <GraduationCap className="mr-1 h-3 w-3 text-muted-foreground" />
                          {topic.label}
                          {topic.attempts > 0 ? (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              ({topic.attempts}x
                              {topic.averageScore !== null
                                ? ` · ${topic.averageScore}%`
                                : ""}
                              )
                            </span>
                          ) : null}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Diagnostic 3: Regularity & Guided Hours */}
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {t.regularityDiagnosticTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.regularityDiagnosticSummary(
                    selectedSnapshot.overview.activeDays30,
                    selectedSnapshot.overview.avgScore,
                    selectedSnapshot.timeMetrics.totalLearningHours,
                    selectedSnapshot.cefrGuidedHours.currentLevel.averageHours,
                  )}
                </p>
              </div>
            </CardContent>
          </div>

          {/* Connected Workflow Actions */}
          <CardContent className="pt-0">
            <div className="rounded-xl border bg-card p-3.5 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.workflowActionsTitle}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/plans-and-reports?student=${selectedStudentId}`}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    {t.openPlanButton}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/assignments">
                    <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                    {t.openHomeworkButton}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/results?student=${selectedStudentId}`}>
                    <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                    {t.openFullProgressButton}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. CEFR Distribution (Active / Passive / Learning) */}
      <TutorStudentVocabularyDistribution
        activeSignals={selectedSnapshot.activeSignals}
        passiveSignals={selectedSnapshot.passiveSignals}
        learningSignals={selectedSnapshot.learningSignals}
      />

      {/* 5. Expandable SRS Word Mastery Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {messages.tutorMastery.studentOverviewTitle}
          </CardTitle>
          <CardDescription>
            {messages.tutorMastery.studentOverviewDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentMasteryCards
            students={students.map((s) => ({
              studentId: s.studentId,
              name: s.name,
              totalWords: s.srsTotalWords,
              mastered: s.srsMasteredWords,
              avgLevel: s.srsAvgLevel,
              levelCounts: s.srsLevelCounts,
              passiveEvidenceCount: s.passiveRawCount,
              equivalentWords: s.passiveEquivalentCount,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
