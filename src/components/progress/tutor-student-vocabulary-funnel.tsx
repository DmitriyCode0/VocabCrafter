"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Flame,
  Layers,
  Plus,
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
import { useAppI18n } from "@/components/providers/app-language-provider";
import type { StudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import { PASSIVE_VOCAB_TARGETS } from "@/lib/progress/vocab-targets";
import type { TutorStudentThreeStateSummary } from "@/components/mastery/tutor-unified-mastery-client";

interface TutorStudentVocabularyFunnelProps {
  studentId: string;
  studentName: string;
  snapshot: StudentProgressSnapshot;
  summary?: TutorStudentThreeStateSummary | null;
}

export function TutorStudentVocabularyFunnel({
  studentId,
  studentName,
  snapshot,
  summary,
}: TutorStudentVocabularyFunnelProps) {
  const { messages } = useAppI18n();
  const t = messages.tutorMastery.unified;

  const activeCount = summary?.activeCount ?? snapshot.activeSignals.uniqueItems;
  const activeTarget = summary?.activeTarget ?? snapshot.overview.activeVocabTarget;
  const activePct =
    summary?.activePercentToNextLevel ??
    (activeTarget > 0
      ? Math.min(100, Math.round((activeCount / activeTarget) * 100))
      : 0);

  const passiveEquivalent =
    summary?.passiveEquivalentCount ??
    snapshot.passiveSignals.equivalentWordCount;
  const passiveTarget =
    summary?.passiveTarget ?? PASSIVE_VOCAB_TARGETS[snapshot.profile.cefrLevel];
  const passivePct =
    summary?.passivePercentToNextLevel ??
    (passiveTarget > 0
      ? Math.min(100, Math.round((passiveEquivalent / passiveTarget) * 100))
      : 0);

  const learningCount =
    summary?.learningCount ?? snapshot.learningSignals.uniqueItems;
  const nextCefrLevel =
    summary?.nextCefrLevel ?? snapshot.cefrGuidedHours.nextLevel?.level ?? null;

  const activationRate =
    passiveEquivalent > 0
      ? Math.min(100, Math.round((activeCount / passiveEquivalent) * 100))
      : activeCount > 0
        ? 100
        : 0;

  return (
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
                  snapshot.profile.cefrLevel,
                  nextCefrLevel,
                )}
              </Badge>
              <Badge variant="outline">
                {snapshot.profile.targetLanguageLabel}
              </Badge>
            </div>
            <CardDescription className="mt-1">
              {t.funnelDescription}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/vocabulary?student=${studentId}`}>
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
                  snapshot.overview.masteredWords,
                  snapshot.overview.totalWords,
                )}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-amber-500/15 pt-3">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Avg SRS {snapshot.overview.avgMasteryLevel}/5
              </span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href={`/vocabulary?student=${studentId}`}>
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

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-sky-500/15 pt-3">
              <span className="text-xs text-muted-foreground">
                {t.wordsAndPhrasesLabel(
                  snapshot.passiveSignals.wordCount,
                  snapshot.passiveSignals.phraseCount,
                )}
              </span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link
                  href={`/vocabulary?student=${studentId}#my-dictionary-import`}
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
                  className="border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-700 dark:text-emerald-300"
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
                {t.ofTargetToNextLevel(activeCount, activeTarget, nextCefrLevel)}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-emerald-500/15 pt-3">
              <span className="text-xs text-muted-foreground">
                {messages.tutorMastery.cards.activeSummary(
                  snapshot.activeSignals.uniqueItems,
                  snapshot.activeSignals.totalUsageCount,
                )}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
