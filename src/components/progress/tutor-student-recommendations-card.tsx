"use client";

import Link from "next/link";
import {
  Brain,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Sparkles,
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
import { useAppI18n } from "@/components/providers/app-language-provider";
import type { StudentProgressSnapshot } from "@/lib/progress/profile-metrics";
import { PASSIVE_VOCAB_TARGETS } from "@/lib/progress/vocab-targets";
import type { TutorStudentThreeStateSummary } from "@/components/mastery/tutor-unified-mastery-client";

interface TutorStudentRecommendationsCardProps {
  studentId: string;
  snapshot: StudentProgressSnapshot;
  studentSummary?: TutorStudentThreeStateSummary | null;
}

export function TutorStudentRecommendationsCard({
  studentId,
  snapshot,
  studentSummary,
}: TutorStudentRecommendationsCardProps) {
  const { messages } = useAppI18n();
  const t = messages.tutorMastery.unified;

  const activeCount =
    studentSummary?.activeCount ?? snapshot.activeSignals.uniqueItems;
  const activeTarget =
    studentSummary?.activeTarget ?? snapshot.overview.activeVocabTarget;
  const activePct =
    studentSummary?.activePercentToNextLevel ??
    (activeTarget > 0
      ? Math.min(100, Math.round((activeCount / activeTarget) * 100))
      : 0);

  const passiveEquivalent =
    studentSummary?.passiveEquivalentCount ??
    snapshot.passiveSignals.equivalentWordCount;
  const passiveTarget =
    studentSummary?.passiveTarget ??
    PASSIVE_VOCAB_TARGETS[snapshot.profile.cefrLevel];
  const passivePct =
    studentSummary?.passivePercentToNextLevel ??
    (passiveTarget > 0
      ? Math.min(100, Math.round((passiveEquivalent / passiveTarget) * 100))
      : 0);

  const learningCount =
    studentSummary?.learningCount ?? snapshot.learningSignals.uniqueItems;

  const unmasteredGrammarTopics = snapshot.grammarTopicMastery
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

  return (
    <Card className="flex h-full flex-col justify-between">
      <div>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{t.recommendationsTitle}</CardTitle>
          </div>
          <CardDescription>{t.recommendationsDescription}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1.5 rounded-xl border bg-muted/20 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {t.vocabDiagnosticTitle}
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              {vocabDiagnosticMessage}
            </p>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {t.grammarDiagnosticTitle}
              </p>
              <Badge variant="outline" className="text-xs">
                {t.grammarDiagnosticSummary(
                  snapshot.overview.grammarMasteredCount,
                  snapshot.overview.grammarAvailableCount,
                  snapshot.profile.cefrLevel,
                )}
              </Badge>
            </div>

            {unmasteredGrammarTopics.length === 0 ? (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
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

          <div className="space-y-1.5 rounded-xl border bg-muted/20 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {t.regularityDiagnosticTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {t.regularityDiagnosticSummary(
                snapshot.overview.activeDays30,
                snapshot.overview.avgScore,
                snapshot.timeMetrics.totalLearningHours,
                snapshot.cefrGuidedHours.currentLevel.averageHours,
              )}
            </p>
          </div>
        </CardContent>
      </div>

      <CardContent className="pt-0">
        <div className="space-y-2.5 rounded-xl border bg-card p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.workflowActionsTitle}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={`/results?tab=plan&student=${studentId}`}>
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
              <Link href={`/results?tab=vocabulary&student=${studentId}`}>
                <Brain className="mr-1.5 h-3.5 w-3.5" />
                {messages.progressHub.planContext.viewVocabularyButton}
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
