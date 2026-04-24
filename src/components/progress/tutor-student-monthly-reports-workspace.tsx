"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Save,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
  getReportLanguageLabel,
  REPORT_LANGUAGE_OPTIONS,
  type ReportLanguage,
} from "@/lib/progress/monthly-report-language";

interface MonthlyReportGoals {
  planTitle: string | null;
  goalSummary: string | null;
  objectives: string[];
  monthlyQuizTarget: number | null;
  monthlyCompletedLessonsTarget: number | null;
  monthlyNewMasteryWordsTarget: number | null;
  monthlyAverageScoreTarget: number | null;
  grammarTopicKeys: string[];
  reportLanguage: ReportLanguage;
}

interface MonthlyReportMetrics {
  activeDays: number;
  completedQuizzes: number;
  completedLessons: number;
  totalHours: number;
  newMasteryWords: number;
  practicedWords: number;
  trackedWordsTotal: number;
  averageScore: number | null;
}

interface MonthlyReportQuotaSnapshot {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
}

type MonthlyReportStatus = "draft" | "published" | "failed" | "quota_blocked";

interface StoredMonthlyReport {
  id: string;
  reportMonth: string;
  status: MonthlyReportStatus;
  title: string;
  generationSource: "manual" | "scheduled";
  publishedContent: string | null;
  tutorAddendum: string | null;
  generationError: string | null;
  generatedAt: string;
  publishedAt: string | null;
  goalsSnapshot: MonthlyReportGoals;
  metricsSnapshot: MonthlyReportMetrics;
}

interface TutorStudentMonthlyReportsWorkspaceProps {
  studentId: string;
  studentName: string;
  currentReportMonth: string;
  currentMonthLabel: string;
  plan: MonthlyReportGoals;
  planHref: string;
  metrics: MonthlyReportMetrics;
  quota: MonthlyReportQuotaSnapshot;
  reports: StoredMonthlyReport[];
}

function getStatusVariant(status: MonthlyReportStatus) {
  if (status === "published") {
    return "default" as const;
  }

  if (status === "failed") {
    return "destructive" as const;
  }

  return "outline" as const;
}

function getStatusLabel(status: MonthlyReportStatus) {
  if (status === "quota_blocked") {
    return "Quota blocked";
  }

  return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");
}

function formatQuotaLabel(quota: MonthlyReportQuotaSnapshot) {
  if (!Number.isFinite(quota.limit)) {
    return "Unlimited monthly reports";
  }

  return `${quota.remaining} of ${quota.limit} report slots left this month`;
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value
    .toFixed(maximumFractionDigits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatPercentage(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${formatNumber(value)}%`;
}

function formatProgressValue(actual: number, target: number | null) {
  if (target == null) {
    return formatNumber(actual, 0);
  }

  return `${formatNumber(actual, 0)} / ${formatNumber(target, 0)}`;
}

function formatPercentageProgressValue(actual: number | null, target: number | null) {
  if (target == null) {
    return formatPercentage(actual);
  }

  return `${formatPercentage(actual)} / ${formatPercentage(target)}`;
}

function formatHours(value: number) {
  return `${formatNumber(value, 2)} h`;
}

export function TutorStudentMonthlyReportsWorkspace({
  studentId,
  studentName,
  currentReportMonth,
  currentMonthLabel,
  plan,
  planHref,
  metrics,
  quota,
  reports,
}: TutorStudentMonthlyReportsWorkspaceProps) {
  const router = useRouter();
  const currentReport =
    reports.find((report) => report.reportMonth === currentReportMonth) ?? null;
  const previousReports = reports.filter(
    (report) => report.reportMonth !== currentReportMonth,
  );

  const [reportTitle, setReportTitle] = useState(currentReport?.title ?? "");
  const [publishedContent, setPublishedContent] = useState(
    currentReport?.publishedContent ?? "",
  );
  const [tutorAddendum, setTutorAddendum] = useState(
    currentReport?.tutorAddendum ?? "",
  );
  const [reportLanguage, setReportLanguage] = useState<ReportLanguage>(
    plan.reportLanguage,
  );
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isSavingReportLanguage, setIsSavingReportLanguage] = useState(false);

  useEffect(() => {
    setReportTitle(currentReport?.title ?? "");
    setPublishedContent(currentReport?.publishedContent ?? "");
    setTutorAddendum(currentReport?.tutorAddendum ?? "");
  }, [currentReport?.id, currentReport?.publishedContent, currentReport?.title, currentReport?.tutorAddendum]);

  useEffect(() => {
    setReportLanguage(plan.reportLanguage);
  }, [plan.reportLanguage]);

  async function handleReportLanguageChange(value: string) {
    const nextLanguage = value as ReportLanguage;
    const previousLanguage = reportLanguage;

    setReportLanguage(nextLanguage);
    setIsSavingReportLanguage(true);

    try {
      const response = await fetch(`/api/tutor/students/${studentId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportLanguage: nextLanguage }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update report language");
      }

      toast.success(`Report language set to ${getReportLanguageLabel(nextLanguage)}`);
      router.refresh();
    } catch (error) {
      setReportLanguage(previousLanguage);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update report language",
      );
    } finally {
      setIsSavingReportLanguage(false);
    }
  }

  async function handleGenerateReport(forceRegenerate: boolean) {
    setIsGeneratingReport(true);

    try {
      const response = await fetch(`/api/tutor/students/${studentId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRegenerate }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        created?: boolean;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to generate monthly report");
      }

      toast.success(
        forceRegenerate
          ? `Regenerated ${currentMonthLabel} report for ${studentName}`
          : data?.created === false
            ? `${currentMonthLabel} report already exists`
            : `Generated ${currentMonthLabel} report for ${studentName}`,
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate monthly report",
      );
    } finally {
      setIsGeneratingReport(false);
    }
  }

  async function handleSaveReport() {
    if (!currentReport) {
      toast.error("Generate a report first.");
      return;
    }

    setIsSavingReport(true);

    try {
      const response = await fetch(
        `/api/tutor/students/${studentId}/reports/${currentReport.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: reportTitle,
            publishedContent,
            tutorAddendum: tutorAddendum.trim() ? tutorAddendum.trim() : null,
          }),
        },
      );

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save report edits");
      }

      toast.success(`Saved ${currentMonthLabel} report edits`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save report edits",
      );
    } finally {
      setIsSavingReport(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-primary" />
              Current Plan
            </CardTitle>
            <CardDescription>
              Monthly reports use the student&apos;s plan page as their source of
              truth. Update goals and objectives there, then generate the report
              from this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.planTitle ? (
              <div className="space-y-1">
                <Label>Plan title</Label>
                <p className="font-medium">{plan.planTitle}</p>
              </div>
            ) : null}

            {plan.goalSummary ? (
              <div className="space-y-1">
                <Label>Goal summary</Label>
                <p className="text-sm leading-relaxed">{plan.goalSummary}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Objectives</Label>
              {plan.objectives.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No objectives listed yet.
                </p>
              ) : (
                <ul className="space-y-2 text-sm leading-relaxed">
                  {plan.objectives.map((objective) => (
                    <li key={objective} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                Quiz target: {plan.monthlyQuizTarget ?? "n/a"}
              </Badge>
              <Badge variant="outline">
                Lesson target: {plan.monthlyCompletedLessonsTarget ?? "n/a"}
              </Badge>
              <Badge variant="outline">
                New words: {plan.monthlyNewMasteryWordsTarget ?? "n/a"}
              </Badge>
              <Badge variant="outline">
                Avg score target: {formatPercentage(plan.monthlyAverageScoreTarget)}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label>Grammar topics</Label>
              {plan.grammarTopicKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No grammar topics selected yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {plan.grammarTopicKeys.map((topic) => (
                    <Badge key={topic} variant="outline">
                      {topic}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button asChild variant="outline">
              <Link href={planHref}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Plan Page
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5 text-primary" />
              Current Month Snapshot
            </CardTitle>
            <CardDescription>
              {currentMonthLabel}. Use the current-month metrics and the saved plan
              to create one published report for the student.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{formatQuotaLabel(quota)}</Badge>
              <Badge variant="outline">Reports used: {quota.used}</Badge>
              {currentReport ? (
                <Badge variant={getStatusVariant(currentReport.status)}>
                  {getStatusLabel(currentReport.status)}
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">Completed quizzes</p>
                <p className="text-2xl font-semibold">
                  {formatProgressValue(metrics.completedQuizzes, plan.monthlyQuizTarget)}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">Completed lessons</p>
                <p className="text-2xl font-semibold">
                  {formatProgressValue(
                    metrics.completedLessons,
                    plan.monthlyCompletedLessonsTarget,
                  )}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">Total hours</p>
                <p className="text-2xl font-semibold">{formatHours(metrics.totalHours)}</p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">New mastery words</p>
                <p className="text-2xl font-semibold">
                  {formatProgressValue(
                    metrics.newMasteryWords,
                    plan.monthlyNewMasteryWordsTarget,
                  )}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">Active days</p>
                <p className="text-2xl font-semibold">{metrics.activeDays}</p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">Words practiced</p>
                <p className="text-2xl font-semibold">{metrics.practicedWords}</p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">Average quiz score</p>
                <p className="text-2xl font-semibold">
                  {formatPercentageProgressValue(
                    metrics.averageScore,
                    plan.monthlyAverageScoreTarget,
                  )}
                </p>
              </div>
            </div>

            {currentReport?.generationError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {currentReport.generationError}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="monthly-report-language">Report language</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={reportLanguage}
                  onValueChange={handleReportLanguageChange}
                  disabled={isSavingReportLanguage}
                >
                  <SelectTrigger
                    id="monthly-report-language"
                    className="w-full sm:max-w-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isSavingReportLanguage ? (
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving language...
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                The selected language will be used the next time you generate or regenerate this monthly report.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleGenerateReport(Boolean(currentReport))}
                disabled={isGeneratingReport || isSavingReportLanguage}
              >
                {isGeneratingReport ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {currentReport ? "Regenerate Current Report" : "Generate Current Report"}
                  </>
                )}
              </Button>

              {currentReport?.publishedContent ? (
                <Button asChild variant="outline">
                  <a href={`/api/monthly-reports/${currentReport.id}/pdf`}>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </a>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Current Published Report
          </CardTitle>
          <CardDescription>
            Edit the student-visible report after generation. The original AI draft
            stays stored separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!currentReport || !currentReport.publishedContent ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No published report for {currentMonthLabel} yet. Update the plan if
              needed, then generate one when you are ready.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="monthly-report-title">Report title</Label>
                <Input
                  id="monthly-report-title"
                  value={reportTitle}
                  onChange={(event) => setReportTitle(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthly-report-content">Published content</Label>
                <Textarea
                  id="monthly-report-content"
                  value={publishedContent}
                  onChange={(event) => setPublishedContent(event.target.value)}
                  rows={16}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthly-report-addendum">Tutor addendum</Label>
                <Textarea
                  id="monthly-report-addendum"
                  value={tutorAddendum}
                  onChange={(event) => setTutorAddendum(event.target.value)}
                  rows={5}
                  placeholder="Optional tutor note that appears below the published report..."
                />
              </div>

              <Button onClick={handleSaveReport} disabled={isSavingReport}>
                {isSavingReport ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Published Report
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report History</CardTitle>
          <CardDescription>
            Previous monthly reports for {studentName}. Published reports are visible
            on the student&apos;s Feedback page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {previousReports.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No earlier monthly reports yet.
            </div>
          ) : (
            previousReports.map((report) => (
              <div key={report.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{report.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {report.reportMonth} · {report.generationSource}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getStatusVariant(report.status)}>
                      {getStatusLabel(report.status)}
                    </Badge>
                    {report.publishedContent ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={`/api/monthly-reports/${report.id}/pdf`}>
                          <Download className="mr-2 h-4 w-4" />
                          PDF
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">
                    Report: {getReportLanguageLabel(report.goalsSnapshot.reportLanguage)}
                  </Badge>
                  <Badge variant="outline">
                    Quizzes: {report.metricsSnapshot.completedQuizzes}
                    {report.goalsSnapshot.monthlyQuizTarget != null
                      ? ` / ${report.goalsSnapshot.monthlyQuizTarget}`
                      : ""}
                  </Badge>
                  <Badge variant="outline">
                    Lessons: {report.metricsSnapshot.completedLessons}
                    {report.goalsSnapshot.monthlyCompletedLessonsTarget != null
                      ? ` / ${report.goalsSnapshot.monthlyCompletedLessonsTarget}`
                      : ""}
                  </Badge>
                  <Badge variant="outline">
                    New words: {report.metricsSnapshot.newMasteryWords}
                    {report.goalsSnapshot.monthlyNewMasteryWordsTarget != null
                      ? ` / ${report.goalsSnapshot.monthlyNewMasteryWordsTarget}`
                      : ""}
                  </Badge>
                  <Badge variant="outline">
                    Avg score: {formatPercentageProgressValue(
                      report.metricsSnapshot.averageScore,
                      report.goalsSnapshot.monthlyAverageScoreTarget,
                    )}
                  </Badge>
                  <Badge variant="outline">
                    Active days: {report.metricsSnapshot.activeDays}
                  </Badge>
                  {report.goalsSnapshot.grammarTopicKeys.length > 0 ? (
                    <Badge variant="outline">
                      Grammar topics: {report.goalsSnapshot.grammarTopicKeys.length}
                    </Badge>
                  ) : null}
                </div>

                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {report.publishedContent || report.generationError || "No published content."}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}