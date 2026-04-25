"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Download,
  FileText,
  Loader2,
  Save,
  Sparkles,
  Star,
  Trash2,
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

interface MonthlyReportMetrics {
  activeDays: number;
  completedQuizzes: number;
  completedSentenceTranslations: number;
  completedGapFillExercises: number;
  completedLessons: number;
  appLearningHours: number | null;
  totalHours: number;
  newMasteryWords: number;
  practicedWords: number;
  trackedWordsTotal: number;
  averageScore: number | null;
}

interface MonthlyReportGoals {
  grammarTopicKeys: string[];
  monthlySentenceTranslationTarget: number | null;
  monthlyGapFillTarget: number | null;
  monthlyCompletedLessonsTarget: number | null;
  monthlyNewMasteryWordsTarget: number | null;
  monthlyAverageScoreTarget: number | null;
  reportLanguage: ReportLanguage;
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
  reviewRating: number | null;
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
  plan: {
    monthlySentenceTranslationTarget: number | null;
    monthlyGapFillTarget: number | null;
    monthlyCompletedLessonsTarget: number | null;
    monthlyNewMasteryWordsTarget: number | null;
    monthlyAverageScoreTarget: number | null;
    reportLanguage: ReportLanguage;
  };
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

function formatPercentageProgressValue(
  actual: number | null,
  target: number | null,
) {
  if (target == null) {
    return formatPercentage(actual);
  }

  return `${formatPercentage(actual)} / ${formatPercentage(target)}`;
}

function formatHours(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours} h ${minutes} min`;
}

function formatStarRating(value: number | null) {
  if (value == null || !Number.isFinite(value) || value < 1) {
    return "No rating";
  }

  const rating = Math.max(1, Math.min(5, Math.round(value)));
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

export function TutorStudentMonthlyReportsWorkspace({
  studentId,
  studentName,
  currentReportMonth,
  currentMonthLabel,
  plan,
  metrics,
  quota,
  reports,
}: TutorStudentMonthlyReportsWorkspaceProps) {
  const router = useRouter();
  const currentReport =
    reports.find((report) => report.reportMonth === currentReportMonth) ?? null;
  const historyReports = reports;

  const [reportTitle, setReportTitle] = useState(currentReport?.title ?? "");
  const [publishedContent, setPublishedContent] = useState(
    currentReport?.publishedContent ?? "",
  );
  const [reviewRating, setReviewRating] = useState(
    currentReport?.reviewRating ?? 0,
  );
  const [hoveredReviewRating, setHoveredReviewRating] = useState(0);
  const [reportLanguage, setReportLanguage] = useState<ReportLanguage>(
    plan.reportLanguage,
  );
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isSavingReportLanguage, setIsSavingReportLanguage] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setReportTitle(currentReport?.title ?? "");
    setPublishedContent(currentReport?.publishedContent ?? "");
    setReviewRating(currentReport?.reviewRating ?? 0);
    setHoveredReviewRating(0);
  }, [
    currentReport?.id,
    currentReport?.publishedContent,
    currentReport?.reviewRating,
    currentReport?.title,
  ]);

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

      toast.success(
        `Report language set to ${getReportLanguageLabel(nextLanguage)}`,
      );
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
            reviewRating: reviewRating > 0 ? reviewRating : null,
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

  async function handleDeleteReport(report: StoredMonthlyReport) {
    const confirmed = window.confirm(
      `Delete the ${report.reportMonth} report for ${studentName}? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingReportId(report.id);

    try {
      const response = await fetch(
        `/api/tutor/students/${studentId}/reports/${report.id}`,
        {
          method: "DELETE",
        },
      );

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete monthly report");
      }

      toast.success(`Deleted ${report.reportMonth} report`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete monthly report",
      );
    } finally {
      setDeletingReportId((current) =>
        current === report.id ? null : current,
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5 text-primary" />
              Current Month Snapshot
            </CardTitle>
            <CardDescription>
              {currentMonthLabel}. Use the current-month metrics and the saved
              plan to create one published report for the student.
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
                <p className="text-xs text-muted-foreground">
                  Completed quizzes
                </p>
                <p className="text-2xl font-semibold">
                  {formatNumber(metrics.completedQuizzes, 0)}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  Sentence translation exercises
                </p>
                <p className="text-2xl font-semibold">
                  {formatProgressValue(
                    metrics.completedSentenceTranslations,
                    plan.monthlySentenceTranslationTarget,
                  )}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  Gap fill exercises
                </p>
                <p className="text-2xl font-semibold">
                  {formatProgressValue(
                    metrics.completedGapFillExercises,
                    plan.monthlyGapFillTarget,
                  )}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  Completed lessons
                </p>
                <p className="text-2xl font-semibold">
                  {formatProgressValue(
                    metrics.completedLessons,
                    plan.monthlyCompletedLessonsTarget,
                  )}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  App learning time
                </p>
                <p className="text-2xl font-semibold">
                  {formatHours(metrics.appLearningHours)}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  New mastery words
                </p>
                <p className="text-2xl font-semibold">
                  {formatProgressValue(
                    metrics.newMasteryWords,
                    plan.monthlyNewMasteryWordsTarget,
                  )}
                </p>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  Active days in application
                </p>
                <p className="text-2xl font-semibold">{metrics.activeDays}</p>
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
                  Average quiz score
                </p>
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
                The selected language will be used the next time you generate or
                regenerate this monthly report.
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
                    {currentReport
                      ? "Regenerate Current Report"
                      : "Generate Current Report"}
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
            Edit the student-visible report after generation. The original AI
            draft stays stored separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!currentReport || !currentReport.publishedContent ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No published report for {currentMonthLabel} yet. Update the plan
              if needed, then generate one when you are ready.
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
                <Label htmlFor="monthly-report-content">
                  Published content
                </Label>
                <Textarea
                  id="monthly-report-content"
                  value={publishedContent}
                  onChange={(event) => setPublishedContent(event.target.value)}
                  rows={16}
                />
              </div>

              <div className="space-y-2">
                <Label>Review rating</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setReviewRating((current) =>
                            current === star ? 0 : star,
                          )
                        }
                        onMouseEnter={() => setHoveredReviewRating(star)}
                        onMouseLeave={() => setHoveredReviewRating(0)}
                        className="p-0.5 transition-colors"
                        aria-label={`Set report rating to ${star}`}
                      >
                        <Star
                          className={`h-5 w-5 ${
                            star <= (hoveredReviewRating || reviewRating)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatStarRating(reviewRating > 0 ? reviewRating : null)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
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

                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => currentReport && handleDeleteReport(currentReport)}
                  disabled={deletingReportId === currentReport?.id}
                >
                  {deletingReportId === currentReport?.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Report
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report History</CardTitle>
          <CardDescription>
            Saved monthly reports for {studentName}. Published reports are
            visible on the student&apos;s Feedback page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyReports.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No monthly reports saved yet.
            </div>
          ) : (
            historyReports.map((report) => (
              <div key={report.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{report.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {report.reportMonth} · {report.generationSource}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {report.reportMonth === currentReportMonth ? (
                      <Badge variant="secondary">Current month</Badge>
                    ) : null}
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteReport(report)}
                      disabled={deletingReportId === report.id}
                    >
                      {deletingReportId === report.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">
                    Report:{" "}
                    {getReportLanguageLabel(
                      report.goalsSnapshot.reportLanguage,
                    )}
                  </Badge>
                  <Badge variant="outline">
                    Quizzes: {report.metricsSnapshot.completedQuizzes}
                  </Badge>
                  <Badge variant="outline">
                    Sentence translations: {report.metricsSnapshot.completedSentenceTranslations}
                    {report.goalsSnapshot.monthlySentenceTranslationTarget != null
                      ? ` / ${report.goalsSnapshot.monthlySentenceTranslationTarget}`
                      : ""}
                  </Badge>
                  <Badge variant="outline">
                    Gap fill: {report.metricsSnapshot.completedGapFillExercises}
                    {report.goalsSnapshot.monthlyGapFillTarget != null
                      ? ` / ${report.goalsSnapshot.monthlyGapFillTarget}`
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
                    Avg score:{" "}
                    {formatPercentageProgressValue(
                      report.metricsSnapshot.averageScore,
                      report.goalsSnapshot.monthlyAverageScoreTarget,
                    )}
                  </Badge>
                  <Badge variant="outline">
                    Active days in application: {report.metricsSnapshot.activeDays}
                  </Badge>
                  {report.reviewRating != null ? (
                    <Badge variant="outline">
                      Review: {formatStarRating(report.reviewRating)}
                    </Badge>
                  ) : null}
                  {report.goalsSnapshot.grammarTopicKeys.length > 0 ? (
                    <Badge variant="outline">
                      Grammar topics:{" "}
                      {report.goalsSnapshot.grammarTopicKeys.length}
                    </Badge>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
