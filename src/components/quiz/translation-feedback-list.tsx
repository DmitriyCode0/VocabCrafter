"use client";

import { useAppI18n } from "@/components/providers/app-language-provider";
import {
  getTranslationFeedbackLabels,
  parseTranslationFeedback,
} from "@/lib/translation-feedback";
import { cn } from "@/lib/utils";

interface TranslationFeedbackListProps {
  feedback: string;
  className?: string;
  itemClassName?: string;
}

export function TranslationFeedbackList({
  feedback,
  className,
  itemClassName,
}: TranslationFeedbackListProps) {
  const { appLanguage } = useAppI18n();
  const labels = getTranslationFeedbackLabels(appLanguage);
  const metrics = parseTranslationFeedback(feedback);

  if (metrics.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {metrics.map((metric) => (
        <div
          key={metric.key}
          className={cn(
            "rounded-md border px-3 py-2 text-sm leading-relaxed",
            metric.passed &&
              "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
            !metric.passed &&
              "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
            itemClassName,
          )}
        >
          <span className="font-medium">
            {metric.passed ? "✓" : "✗"} {labels[metric.key]}:
          </span>{" "}
          <span>{metric.comment}</span>
        </div>
      ))}
    </div>
  );
}
